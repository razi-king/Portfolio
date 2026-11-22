package contact

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/razi-king/portfolio/backend/internal/queue"
)

type fakePublisher struct {
	jobs []queue.EmailJob
	err  error
}

func (f *fakePublisher) Publish(_ context.Context, j queue.EmailJob) error {
	if f.err != nil {
		return f.err
	}
	f.jobs = append(f.jobs, j)
	return nil
}

func valid() Request {
	return Request{Name: "Asha", Email: "asha@example.com", Subject: "Hi", Message: "I would like to hire you."}
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*Request)
		field   string
		wantErr error
	}{
		{"valid", func(*Request) {}, "", nil},
		{"missing name", func(r *Request) { r.Name = "" }, "name", nil},
		{"bad email", func(r *Request) { r.Email = "not-an-email" }, "email", nil},
		{"display-name email rejected", func(r *Request) { r.Email = "Bob <bob@x.com>" }, "email", nil},
		{"short message", func(r *Request) { r.Message = "hey" }, "message", nil},
		{"long message", func(r *Request) { r.Message = strings.Repeat("a", maxMessage+1) }, "message", nil},
		{"header injection", func(r *Request) { r.Subject = "hi\r\nBcc: x@y.com" }, "subject", nil},
		{"honeypot", func(r *Request) { r.Website = "http://spam" }, "", ErrSpam},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := valid()
			tt.mutate(&r)
			r.Normalize()
			err := r.Validate()
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("want %v, got %v", tt.wantErr, err)
				}
				return
			}
			if tt.field == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			var verr *ValidationError
			if !errors.As(err, &verr) || verr.Fields[tt.field] == "" {
				t.Fatalf("want error on %q, got %v", tt.field, err)
			}
		})
	}
}

func TestServiceSubmitStoresAndPublishes(t *testing.T) {
	repo, pub := NewMemory(), &fakePublisher{}
	m, err := NewService(repo, pub).Submit(context.Background(), valid())
	if err != nil {
		t.Fatal(err)
	}
	if m.ID == 0 || m.Status != StatusQueued {
		t.Fatalf("unexpected message: %+v", m)
	}
	if len(pub.jobs) != 1 || pub.jobs[0].MessageID != m.ID {
		t.Fatalf("job not published: %+v", pub.jobs)
	}
}

func TestServiceKeepsMessageWhenQueueFails(t *testing.T) {
	repo, pub := NewMemory(), &fakePublisher{err: errors.New("broker down")}
	if _, err := NewService(repo, pub).Submit(context.Background(), valid()); err == nil {
		t.Fatal("expected error")
	}
	got, err := repo.Get(context.Background(), 1)
	if err != nil {
		t.Fatalf("message should still be stored: %v", err)
	}
	if !strings.Contains(got.LastError, "broker down") {
		t.Fatalf("last error not recorded: %q", got.LastError)
	}
}

func TestHandler(t *testing.T) {
	tests := []struct {
		name string
		body string
		want int
	}{
		{"accepted", `{"name":"Asha","email":"asha@example.com","message":"Let's build something."}`, http.StatusAccepted},
		{"invalid json", `{"name":`, http.StatusBadRequest},
		{"unknown field", `{"name":"A","email":"a@b.co","message":"0123456789","admin":true}`, http.StatusBadRequest},
		{"validation", `{"name":"","email":"x","message":"short"}`, http.StatusUnprocessableEntity},
		{"honeypot looks accepted", `{"name":"Bot","email":"b@b.co","message":"buy now buy now","website":"x"}`, http.StatusAccepted},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pub := &fakePublisher{}
			h := NewHandler(NewService(NewMemory(), pub))
			rec := httptest.NewRecorder()
			h.Submit(rec, httptest.NewRequest(http.MethodPost, "/api/contact", strings.NewReader(tt.body)))
			if rec.Code != tt.want {
				t.Fatalf("status = %d, want %d, body %s", rec.Code, tt.want, rec.Body)
			}
		})
	}
}

func TestHandlerQueueDownReturns503(t *testing.T) {
	h := NewHandler(NewService(NewMemory(), &fakePublisher{err: errors.New("down")}))
	rec := httptest.NewRecorder()
	body := `{"name":"Asha","email":"asha@example.com","message":"Let's build something."}`
	h.Submit(rec, httptest.NewRequest(http.MethodPost, "/api/contact", strings.NewReader(body)))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}
