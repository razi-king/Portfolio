// Package worker turns queued contact messages into emails.
package worker

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/razi-king/portfolio/backend/internal/contact"
	"github.com/razi-king/portfolio/backend/internal/mailer"
	"github.com/razi-king/portfolio/backend/internal/queue"
)

// Worker sends one email per job and records the outcome.
type Worker struct {
	mail mailer.Mailer
	repo contact.Repository
	to   string
}

// New creates a worker that emails every contact message to `to`.
func New(m mailer.Mailer, repo contact.Repository, to string) *Worker {
	return &Worker{mail: m, repo: repo, to: to}
}

// Handle is a queue.Handler. A returned error makes the queue retry the job.
func (w *Worker) Handle(ctx context.Context, job queue.EmailJob, attempt int) error {
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	err := w.mail.Send(ctx, mailer.Email{
		To:      w.to,
		ReplyTo: job.Email,
		Subject: "[Portfolio] " + job.Subject,
		Text: fmt.Sprintf("New message from your portfolio\n\nFrom: %s <%s>\nMessage ID: %d\n\n%s\n",
			job.Name, job.Email, job.MessageID, job.Body),
	})
	if err != nil {
		slog.Warn("email failed", "messageId", job.MessageID, "attempt", attempt, "err", err)
		_ = w.repo.RecordAttempt(ctx, job.MessageID, attempt, err.Error())
		return err
	}
	if err := w.repo.MarkSent(ctx, job.MessageID, attempt); err != nil {
		slog.Error("email sent but status update failed", "messageId", job.MessageID, "err", err)
	}
	slog.Info("email sent", "messageId", job.MessageID, "attempt", attempt)
	return nil
}

// Park is a queue.ParkHandler: retries are exhausted, mark the message failed.
func (w *Worker) Park(ctx context.Context, job queue.EmailJob, attempts int, lastErr error) {
	slog.Error("email parked after retries", "messageId", job.MessageID, "attempts", attempts, "err", lastErr)
	_ = w.repo.MarkFailed(ctx, job.MessageID, attempts, lastErr.Error())
}
