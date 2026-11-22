package queue

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestDecide(t *testing.T) {
	delays := []time.Duration{time.Second, 2 * time.Second}
	tests := []struct {
		attempt int
		want    Decision
	}{
		{0, Decision{Delay: time.Second, Next: 2}}, // clamps to attempt 1
		{1, Decision{Delay: time.Second, Next: 2}},
		{2, Decision{Delay: 2 * time.Second, Next: 3}},
		{3, Decision{Park: true}},
	}
	for _, tt := range tests {
		if got := Decide(tt.attempt, delays); got != tt.want {
			t.Errorf("Decide(%d) = %+v, want %+v", tt.attempt, got, tt.want)
		}
	}
}

func TestRetryQueueName(t *testing.T) {
	if got := RetryQueueName(30 * time.Second); got != "contact.email.retry.30s" {
		t.Fatalf("got %q", got)
	}
}

func TestMemoryRetriesThenSucceeds(t *testing.T) {
	q := NewMemory(8, []time.Duration{10 * time.Millisecond, 10 * time.Millisecond})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	var mu sync.Mutex
	var attempts []int
	done := make(chan struct{})
	h := func(_ context.Context, _ EmailJob, attempt int) error {
		mu.Lock()
		defer mu.Unlock()
		attempts = append(attempts, attempt)
		if attempt < 3 {
			return errors.New("smtp down")
		}
		close(done)
		return nil
	}
	go q.Consume(ctx, h, func(context.Context, EmailJob, int, error) { t.Error("should not park") })
	if err := q.Publish(ctx, EmailJob{MessageID: 1}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-done:
	case <-ctx.Done():
		t.Fatal("timed out")
	}
	mu.Lock()
	defer mu.Unlock()
	if len(attempts) != 3 || attempts[2] != 3 {
		t.Fatalf("attempts = %v", attempts)
	}
}

func TestMemoryParksAfterRetries(t *testing.T) {
	q := NewMemory(8, []time.Duration{5 * time.Millisecond})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	parked := make(chan int, 1)
	fail := func(context.Context, EmailJob, int) error { return errors.New("always fails") }
	go q.Consume(ctx, fail, func(_ context.Context, j EmailJob, attempts int, _ error) { parked <- attempts })
	_ = q.Publish(ctx, EmailJob{MessageID: 7})
	select {
	case n := <-parked:
		if n != 2 {
			t.Fatalf("parked after %d attempts, want 2", n)
		}
	case <-ctx.Done():
		t.Fatal("job was never parked")
	}
}

func TestMemoryPublishFullQueue(t *testing.T) {
	q := NewMemory(1, nil)
	_ = q.Publish(context.Background(), EmailJob{})
	if err := q.Publish(context.Background(), EmailJob{}); !errors.Is(err, ErrQueueFull) {
		t.Fatalf("want ErrQueueFull, got %v", err)
	}
}
