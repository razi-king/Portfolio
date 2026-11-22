//go:build integration

// End-to-end test against real PostgreSQL and RabbitMQ.
// Run with: DATABASE_URL=... AMQP_URL=... go test -tags integration -v .
package backend_test

import (
	"context"
	"errors"
	"os"
	"sync/atomic"
	"testing"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/razi-king/portfolio/backend/internal/contact"
	"github.com/razi-king/portfolio/backend/internal/mailer"
	"github.com/razi-king/portfolio/backend/internal/queue"
	"github.com/razi-king/portfolio/backend/internal/worker"
)

type flakyMailer struct{ failures, calls atomic.Int32 }

func (f *flakyMailer) Send(context.Context, mailer.Email) error {
	if f.calls.Add(1) <= f.failures.Load() {
		return errors.New("smtp temporarily unavailable")
	}
	return nil
}

func env(t *testing.T, k string) string {
	v := os.Getenv(k)
	if v == "" {
		t.Skipf("%s not set", k)
	}
	return v
}

func waitStatus(t *testing.T, repo contact.Repository, id int64, want contact.Status) contact.Message {
	t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		m, err := repo.Get(context.Background(), id)
		if err == nil && m.Status == want {
			return m
		}
		time.Sleep(100 * time.Millisecond)
	}
	m, _ := repo.Get(context.Background(), id)
	t.Fatalf("message %d: status %q, want %q", id, m.Status, want)
	return m
}

func TestPostgresRepository(t *testing.T) {
	ctx := context.Background()
	repo, err := contact.NewPostgres(ctx, env(t, "DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close()
	m := &contact.Message{Name: "Asha", Email: "a@example.com", Subject: "Hi", Body: "Hello there!", Status: contact.StatusQueued}
	if err := repo.Create(ctx, m); err != nil {
		t.Fatal(err)
	}
	if err := repo.RecordAttempt(ctx, m.ID, 1, "boom"); err != nil {
		t.Fatal(err)
	}
	if err := repo.MarkSent(ctx, m.ID, 2); err != nil {
		t.Fatal(err)
	}
	got, err := repo.Get(ctx, m.ID)
	if err != nil || got.Status != contact.StatusSent || got.Attempts != 2 || got.LastError != "" {
		t.Fatalf("got %+v, %v", got, err)
	}
	if _, err := repo.Get(ctx, -1); !errors.Is(err, contact.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

// Full pipeline: API service → Postgres → RabbitMQ → worker (fails once,
// goes through a real retry queue) → email sent → status "sent".
func TestRabbitMQPipelineWithRetry(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	repo, err := contact.NewPostgres(ctx, env(t, "DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close()
	delays := []time.Duration{time.Second, 2 * time.Second}
	rq, err := queue.NewRabbitMQ(env(t, "AMQP_URL"), delays)
	if err != nil {
		t.Fatal(err)
	}
	defer rq.Close()

	fm := &flakyMailer{}
	fm.failures.Store(1)
	w := worker.New(fm, repo, "me@example.com")
	go rq.Consume(ctx, w.Handle, w.Park)

	m, err := contact.NewService(repo, rq).Submit(ctx, contact.Request{
		Name: "Asha", Email: "asha@example.com", Message: "Testing the retry pipeline.",
	})
	if err != nil {
		t.Fatal(err)
	}
	got := waitStatus(t, repo, m.ID, contact.StatusSent)
	if got.Attempts != 2 {
		t.Fatalf("attempts = %d, want 2 (one retry)", got.Attempts)
	}
}

func TestRabbitMQParksAndDeadLetters(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	amqpURL := env(t, "AMQP_URL")
	repo, err := contact.NewPostgres(ctx, env(t, "DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close()
	delays := []time.Duration{time.Second, 2 * time.Second}
	rq, err := queue.NewRabbitMQ(amqpURL, delays)
	if err != nil {
		t.Fatal(err)
	}
	defer rq.Close()

	fm := &flakyMailer{}
	fm.failures.Store(1000) // never succeeds
	w := worker.New(fm, repo, "me@example.com")
	go rq.Consume(ctx, w.Handle, w.Park)

	m, err := contact.NewService(repo, rq).Submit(ctx, contact.Request{
		Name: "Asha", Email: "asha@example.com", Message: "This one should end up parked.",
	})
	if err != nil {
		t.Fatal(err)
	}
	got := waitStatus(t, repo, m.ID, contact.StatusFailed)
	if got.Attempts != 3 {
		t.Fatalf("attempts = %d, want 3", got.Attempts)
	}

	conn, err := amqp.Dial(amqpURL)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	ch, _ := conn.Channel()
	if q, err := ch.QueueDeclarePassive(queue.ParkingQueue, true, false, false, false, nil); err != nil || q.Messages < 1 {
		t.Fatalf("parking queue should hold the job: %+v %v", q, err)
	}

	// A malformed payload must go straight to the dead-letter queue.
	_ = ch.PublishWithContext(ctx, queue.Exchange, "email", false, false, amqp.Publishing{Body: []byte("{not json")})
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if q, err := ch.QueueDeclarePassive(queue.DLQueue, true, false, false, false, nil); err == nil && q.Messages > 0 {
			return
		}
		time.Sleep(200 * time.Millisecond)
	}
	t.Fatal("malformed message did not reach the DLQ")
}
