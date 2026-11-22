package contact

import (
	"context"
	"fmt"

	"github.com/razi-king/portfolio/backend/internal/queue"
)

// Service stores a message, then hands it to the queue. The HTTP request
// returns as soon as the job is queued; email delivery happens in the worker,
// so a slow or failing SMTP server never slows down the website.
type Service struct {
	repo Repository
	pub  queue.Publisher
}

// NewService wires the service.
func NewService(repo Repository, pub queue.Publisher) *Service {
	return &Service{repo: repo, pub: pub}
}

// Submit validates, stores and enqueues a contact request.
func (s *Service) Submit(ctx context.Context, req Request) (Message, error) {
	req.Normalize()
	if err := req.Validate(); err != nil {
		return Message{}, err
	}
	subject := req.Subject
	if subject == "" {
		subject = "New message from your portfolio"
	}
	m := Message{Name: req.Name, Email: req.Email, Subject: subject, Body: req.Message, Status: StatusQueued}
	if err := s.repo.Create(ctx, &m); err != nil {
		return Message{}, fmt.Errorf("store message: %w", err)
	}
	job := queue.EmailJob{MessageID: m.ID, Name: m.Name, Email: m.Email, Subject: m.Subject, Body: m.Body}
	if err := s.pub.Publish(ctx, job); err != nil {
		// The message is safe in the database; mark it so it can be re-sent.
		_ = s.repo.RecordAttempt(ctx, m.ID, 0, "enqueue failed: "+err.Error())
		return Message{}, fmt.Errorf("enqueue message: %w", err)
	}
	return m, nil
}
