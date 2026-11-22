package worker

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/razi-king/portfolio/backend/internal/contact"
	"github.com/razi-king/portfolio/backend/internal/mailer"
	"github.com/razi-king/portfolio/backend/internal/queue"
)

type fakeMailer struct {
	err  error
	sent []mailer.Email
}

func (f *fakeMailer) Send(_ context.Context, e mailer.Email) error {
	if f.err != nil {
		return f.err
	}
	f.sent = append(f.sent, e)
	return nil
}

func setup(t *testing.T, mailErr error) (*Worker, *contact.Memory, *fakeMailer, queue.EmailJob) {
	t.Helper()
	repo := contact.NewMemory()
	m := &contact.Message{Name: "Asha", Email: "asha@example.com", Subject: "Hello", Body: "Let's talk", Status: contact.StatusQueued}
	if err := repo.Create(context.Background(), m); err != nil {
		t.Fatal(err)
	}
	fm := &fakeMailer{err: mailErr}
	job := queue.EmailJob{MessageID: m.ID, Name: m.Name, Email: m.Email, Subject: m.Subject, Body: m.Body}
	return New(fm, repo, "me@example.com"), repo, fm, job
}

func TestHandleSuccessMarksSent(t *testing.T) {
	w, repo, fm, job := setup(t, nil)
	if err := w.Handle(context.Background(), job, 1); err != nil {
		t.Fatal(err)
	}
	got, _ := repo.Get(context.Background(), job.MessageID)
	if got.Status != contact.StatusSent {
		t.Fatalf("status = %s", got.Status)
	}
	e := fm.sent[0]
	if e.To != "me@example.com" || e.ReplyTo != "asha@example.com" || !strings.Contains(e.Subject, "Hello") {
		t.Fatalf("unexpected email: %+v", e)
	}
}

func TestHandleFailureRecordsAttempt(t *testing.T) {
	w, repo, _, job := setup(t, errors.New("smtp 421"))
	if err := w.Handle(context.Background(), job, 2); err == nil {
		t.Fatal("expected error so the queue retries")
	}
	got, _ := repo.Get(context.Background(), job.MessageID)
	if got.Status != contact.StatusQueued || got.Attempts != 2 || got.LastError != "smtp 421" {
		t.Fatalf("unexpected state: %+v", got)
	}
}

func TestParkMarksFailed(t *testing.T) {
	w, repo, _, job := setup(t, nil)
	w.Park(context.Background(), job, 4, errors.New("gave up"))
	got, _ := repo.Get(context.Background(), job.MessageID)
	if got.Status != contact.StatusFailed || got.Attempts != 4 {
		t.Fatalf("unexpected state: %+v", got)
	}
}
