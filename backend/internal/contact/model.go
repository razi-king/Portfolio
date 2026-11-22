// Package contact handles messages sent through the portfolio contact form:
// validation, storage, and handing them to the email queue.
package contact

import (
	"errors"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"
)

// Status is the lifecycle of a contact message.
type Status string

const (
	StatusQueued Status = "queued" // stored and published to the queue
	StatusSent   Status = "sent"   // email delivered to the SMTP server
	StatusFailed Status = "failed" // retries exhausted, moved to the parking lot
)

// Message is a contact-form submission.
type Message struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Subject   string    `json:"subject"`
	Body      string    `json:"message"`
	Status    Status    `json:"status"`
	Attempts  int       `json:"attempts"`
	LastError string    `json:"-"`
	CreatedAt time.Time `json:"createdAt"`
}

// Request is the JSON body accepted by POST /api/contact.
type Request struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Subject string `json:"subject"`
	Message string `json:"message"`
	Website string `json:"website"` // honeypot: real users never fill this hidden field
}

// ValidationError lists every invalid field so the UI can show them all at once.
type ValidationError struct {
	Fields map[string]string `json:"fields"`
}

func (e *ValidationError) Error() string { return "validation failed" }

// ErrSpam is returned when the honeypot field is filled.
var ErrSpam = errors.New("spam detected")

const (
	maxName    = 80
	maxSubject = 120
	maxMessage = 4000
	minMessage = 10
)

// Normalize trims whitespace in place.
func (r *Request) Normalize() {
	r.Name = strings.TrimSpace(r.Name)
	r.Email = strings.TrimSpace(strings.ToLower(r.Email))
	r.Subject = strings.TrimSpace(r.Subject)
	r.Message = strings.TrimSpace(r.Message)
}

// Validate checks every field and returns a *ValidationError or ErrSpam.
func (r *Request) Validate() error {
	if r.Website != "" {
		return ErrSpam
	}
	f := map[string]string{}
	switch n := utf8.RuneCountInString(r.Name); {
	case n == 0:
		f["name"] = "Name is required."
	case n > maxName:
		f["name"] = "Name is too long."
	}
	if r.Email == "" {
		f["email"] = "Email is required."
	} else if a, err := mail.ParseAddress(r.Email); err != nil || a.Address != r.Email {
		f["email"] = "Email address is not valid."
	}
	if utf8.RuneCountInString(r.Subject) > maxSubject {
		f["subject"] = "Subject is too long."
	}
	switch n := utf8.RuneCountInString(r.Message); {
	case n < minMessage:
		f["message"] = "Message must be at least 10 characters."
	case n > maxMessage:
		f["message"] = "Message is too long."
	}
	if strings.ContainsAny(r.Name+r.Subject, "\r\n") {
		f["subject"] = "Line breaks are not allowed here." // blocks email header injection
	}
	if len(f) > 0 {
		return &ValidationError{Fields: f}
	}
	return nil
}
