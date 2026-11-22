package queue

import (
	"context"
	"errors"
	"sync"
	"time"
)

// ErrQueueFull is returned when the in-memory buffer is full.
var ErrQueueFull = errors.New("queue full")

type memItem struct {
	job     EmailJob
	attempt int
}

// Memory is an in-process queue used when no AMQP_URL is configured.
// Jobs are lost on restart, which is fine for local demos.
type Memory struct {
	ch     chan memItem
	delays []time.Duration
	wg     sync.WaitGroup
}

// NewMemory creates a queue with the given buffer size and retry schedule.
func NewMemory(buffer int, delays []time.Duration) *Memory {
	return &Memory{ch: make(chan memItem, buffer), delays: delays}
}

// Publish enqueues a job without blocking.
func (m *Memory) Publish(_ context.Context, job EmailJob) error {
	select {
	case m.ch <- memItem{job: job, attempt: 1}:
		return nil
	default:
		return ErrQueueFull
	}
}

// Consume handles jobs until ctx is cancelled, rescheduling failures with
// the shared retry policy and parking jobs that exhaust it.
func (m *Memory) Consume(ctx context.Context, h Handler, onPark ParkHandler) error {
	for {
		select {
		case <-ctx.Done():
			m.wg.Wait()
			return nil
		case it := <-m.ch:
			err := h(ctx, it.job, it.attempt)
			if err == nil {
				continue
			}
			d := Decide(it.attempt, m.delays)
			if d.Park {
				if onPark != nil {
					onPark(ctx, it.job, it.attempt, err)
				}
				continue
			}
			next := memItem{job: it.job, attempt: d.Next}
			m.wg.Add(1)
			time.AfterFunc(d.Delay, func() {
				defer m.wg.Done()
				select {
				case m.ch <- next:
				case <-ctx.Done():
				}
			})
		}
	}
}
