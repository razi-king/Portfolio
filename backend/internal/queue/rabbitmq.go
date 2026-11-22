package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

// RabbitMQ topology
//
//	                       ┌──────────────── retry.5s / retry.30s / retry.2m ◄─┐
//	                       │  (TTL, dead-letter back to the main exchange)     │ handler error
//	                       ▼                                                   │
//	API ──► [portfolio.contact] ──email──► contact.email ──► worker ───────────┤
//	                       │                    │ reject (bad JSON)            │ retries exhausted
//	                       │                    ▼                              ▼
//	                       │           [portfolio.contact.dlx] ──► contact.email.dlq
//	                       └──parking──► contact.email.parking ◄───────────────┘
const (
	Exchange     = "portfolio.contact"
	DLXExchange  = "portfolio.contact.dlx"
	MainQueue    = "contact.email"
	DLQueue      = "contact.email.dlq"
	ParkingQueue = "contact.email.parking"
	keyEmail     = "email"
	keyParking   = "parking"
	hdrAttempt   = "x-attempt"
	hdrLastError = "x-last-error"
)

// RetryQueueName returns the retry queue used for a given delay.
func RetryQueueName(d time.Duration) string { return "contact.email.retry." + d.String() }

// RabbitMQ publishes and consumes email jobs over AMQP.
type RabbitMQ struct {
	url    string
	delays []time.Duration

	mu   sync.Mutex
	conn *amqp.Connection
	pub  *amqp.Channel
	conf chan amqp.Confirmation
}

// NewRabbitMQ connects, declares the topology and opens a confirming publisher channel.
func NewRabbitMQ(url string, delays []time.Duration) (*RabbitMQ, error) {
	r := &RabbitMQ{url: url, delays: delays}
	if err := r.connect(); err != nil {
		return nil, err
	}
	return r, nil
}

func (r *RabbitMQ) connect() error {
	conn, err := amqp.Dial(r.url)
	if err != nil {
		return fmt.Errorf("amqp dial: %w", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("amqp channel: %w", err)
	}
	if err := declareTopology(ch, r.delays); err != nil {
		conn.Close()
		return err
	}
	if err := ch.Confirm(false); err != nil {
		conn.Close()
		return fmt.Errorf("enable publisher confirms: %w", err)
	}
	r.conn, r.pub = conn, ch
	r.conf = ch.NotifyPublish(make(chan amqp.Confirmation, 1))
	return nil
}

func declareTopology(ch *amqp.Channel, delays []time.Duration) error {
	steps := []func() error{
		func() error { return ch.ExchangeDeclare(Exchange, "direct", true, false, false, false, nil) },
		func() error { return ch.ExchangeDeclare(DLXExchange, "fanout", true, false, false, false, nil) },
		func() error {
			_, err := ch.QueueDeclare(MainQueue, true, false, false, false, amqp.Table{"x-dead-letter-exchange": DLXExchange})
			return err
		},
		func() error { return ch.QueueBind(MainQueue, keyEmail, Exchange, false, nil) },
		func() error { _, err := ch.QueueDeclare(DLQueue, true, false, false, false, nil); return err },
		func() error { return ch.QueueBind(DLQueue, "", DLXExchange, false, nil) },
		func() error { _, err := ch.QueueDeclare(ParkingQueue, true, false, false, false, nil); return err },
		func() error { return ch.QueueBind(ParkingQueue, keyParking, Exchange, false, nil) },
	}
	for _, d := range delays {
		d := d
		steps = append(steps, func() error {
			_, err := ch.QueueDeclare(RetryQueueName(d), true, false, false, false, amqp.Table{
				"x-message-ttl":             d.Milliseconds(),
				"x-dead-letter-exchange":    Exchange,
				"x-dead-letter-routing-key": keyEmail,
			})
			return err
		})
	}
	for _, s := range steps {
		if err := s(); err != nil {
			return fmt.Errorf("declare topology: %w", err)
		}
	}
	return nil
}

// Publish sends a job and waits for the broker's confirmation.
func (r *RabbitMQ) Publish(ctx context.Context, job EmailJob) error {
	body, err := json.Marshal(job)
	if err != nil {
		return err
	}
	return r.publish(ctx, Exchange, keyEmail, body, amqp.Table{hdrAttempt: int32(1)})
}

func (r *RabbitMQ) publish(ctx context.Context, exchange, key string, body []byte, h amqp.Table) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.conn == nil || r.conn.IsClosed() {
		if err := r.connect(); err != nil {
			return err
		}
	}
	err := r.pub.PublishWithContext(ctx, exchange, key, true, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Timestamp:    time.Now(),
		Headers:      h,
		Body:         body,
	})
	if err != nil {
		return fmt.Errorf("publish: %w", err)
	}
	select {
	case c := <-r.conf:
		if !c.Ack {
			return errors.New("publish not confirmed by broker")
		}
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Consume reads from the main queue until ctx is cancelled, reconnecting with
// backoff if the connection drops.
func (r *RabbitMQ) Consume(ctx context.Context, h Handler, onPark ParkHandler) error {
	backoff := time.Second
	for {
		err := r.consumeOnce(ctx, h, onPark)
		if ctx.Err() != nil {
			return nil
		}
		slog.Warn("consumer stopped, reconnecting", "err", err, "in", backoff)
		select {
		case <-time.After(backoff):
		case <-ctx.Done():
			return nil
		}
		if backoff < 30*time.Second {
			backoff *= 2
		}
		r.mu.Lock()
		if r.conn == nil || r.conn.IsClosed() {
			if cerr := r.connect(); cerr != nil {
				slog.Error("reconnect failed", "err", cerr)
			} else {
				backoff = time.Second
			}
		}
		r.mu.Unlock()
	}
}

func (r *RabbitMQ) consumeOnce(ctx context.Context, h Handler, onPark ParkHandler) error {
	r.mu.Lock()
	conn := r.conn
	r.mu.Unlock()
	if conn == nil || conn.IsClosed() {
		return errors.New("not connected")
	}
	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()
	if err := ch.Qos(10, 0, false); err != nil {
		return err
	}
	deliveries, err := ch.Consume(MainQueue, "portfolio-worker", false, false, false, false, nil)
	if err != nil {
		return err
	}
	closed := ch.NotifyClose(make(chan *amqp.Error, 1))
	for {
		select {
		case <-ctx.Done():
			return nil
		case e := <-closed:
			return fmt.Errorf("channel closed: %v", e)
		case d, ok := <-deliveries:
			if !ok {
				return errors.New("deliveries channel closed")
			}
			r.handle(ctx, d, h, onPark)
		}
	}
}

func (r *RabbitMQ) handle(ctx context.Context, d amqp.Delivery, h Handler, onPark ParkHandler) {
	var job EmailJob
	if err := json.Unmarshal(d.Body, &job); err != nil {
		slog.Error("malformed job, sending to DLQ", "err", err)
		_ = d.Nack(false, false) // dead-letters to contact.email.dlq
		return
	}
	attempt := attemptOf(d.Headers)
	herr := h(ctx, job, attempt)
	if herr == nil {
		_ = d.Ack(false)
		return
	}

	dec := Decide(attempt, r.delays)
	headers := amqp.Table{hdrAttempt: int32(dec.Next), hdrLastError: truncate(herr.Error(), 500)}
	var perr error
	if dec.Park {
		headers[hdrAttempt] = int32(attempt)
		perr = r.publish(ctx, Exchange, keyParking, d.Body, headers)
		if perr == nil && onPark != nil {
			onPark(ctx, job, attempt, herr)
		}
	} else {
		// Default exchange routes by queue name; the retry queue's TTL then
		// dead-letters the job back to the main queue.
		perr = r.publish(ctx, "", RetryQueueName(dec.Delay), d.Body, headers)
	}
	if perr != nil {
		slog.Error("could not reschedule job, requeueing", "err", perr, "messageId", job.MessageID)
		_ = d.Nack(false, true)
		return
	}
	_ = d.Ack(false)
}

func attemptOf(h amqp.Table) int {
	switch v := h[hdrAttempt].(type) {
	case int32:
		return int(v)
	case int64:
		return int(v)
	case int:
		return v
	case string:
		n, _ := strconv.Atoi(v)
		return max(n, 1)
	}
	return 1
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// Close shuts the connection down.
func (r *RabbitMQ) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.conn != nil {
		return r.conn.Close()
	}
	return nil
}
