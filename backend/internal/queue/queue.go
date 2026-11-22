// Package queue moves email jobs from the API to the worker.
//
// Two implementations share the same retry policy:
//   - RabbitMQ (production): durable queues, per-delay retry queues, a
//     dead-letter queue for malformed messages, and a parking-lot queue for
//     messages that keep failing.
//   - Memory (local demo): a buffered channel, so the site runs with no infra.
package queue

import (
	"context"
	"time"
)

// EmailJob is the payload published for every contact message.
type EmailJob struct {
	MessageID int64  `json:"messageId"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Subject   string `json:"subject"`
	Body      string `json:"body"`
}

// Publisher sends jobs to the queue.
type Publisher interface {
	Publish(ctx context.Context, job EmailJob) error
}

// Handler processes one job. Returning an error triggers a retry.
type Handler func(ctx context.Context, job EmailJob, attempt int) error

// ParkHandler is called once a job has exhausted its retries.
type ParkHandler func(ctx context.Context, job EmailJob, attempts int, lastErr error)

// Consumer delivers jobs to a Handler until ctx is cancelled.
type Consumer interface {
	Consume(ctx context.Context, h Handler, onPark ParkHandler) error
}

// RetryDelays is the backoff schedule: attempt 1 fails → wait 5s, then 30s,
// then 2m. After the last delay the job goes to the parking lot.
var RetryDelays = []time.Duration{5 * time.Second, 30 * time.Second, 2 * time.Minute}

// Decision is what to do with a failed job.
type Decision struct {
	Park  bool          // true: retries exhausted
	Delay time.Duration // wait before the next attempt (when Park is false)
	Next  int           // number of the next attempt
}

// Decide applies the retry policy for a job that just failed on attempt
// (1-based), given the delay schedule.
func Decide(attempt int, delays []time.Duration) Decision {
	if attempt < 1 {
		attempt = 1
	}
	if attempt > len(delays) {
		return Decision{Park: true}
	}
	return Decision{Delay: delays[attempt-1], Next: attempt + 1}
}
