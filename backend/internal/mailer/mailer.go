// Package mailer sends emails over SMTP (or just logs them in dev mode).
package mailer

import (
	"context"
	"fmt"
	"log/slog"
	"mime"
	"net/smtp"
	"strings"
	"time"
)

// Email is one outgoing message.
type Email struct {
	To      string
	ReplyTo string
	Subject string
	Text    string
}

// Mailer sends an email.
type Mailer interface {
	Send(ctx context.Context, e Email) error
}

// SMTP sends mail through an SMTP server with STARTTLS (e.g. Gmail on 587
// using an app password stored in an environment variable, never in code).
type SMTP struct {
	Host, Port, User, Pass, From string
}

// Send delivers the email. net/smtp has no context support, so a timeout
// guard stops a hung server from blocking the worker forever.
func (s SMTP) Send(ctx context.Context, e Email) error {
	msg := buildMessage(s.From, e)
	auth := smtp.PlainAuth("", s.User, s.Pass, s.Host)
	done := make(chan error, 1)
	go func() { done <- smtp.SendMail(s.Host+":"+s.Port, auth, s.From, []string{e.To}, msg) }()
	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(30 * time.Second):
		return fmt.Errorf("smtp timeout after 30s")
	}
}

func buildMessage(from string, e Email) []byte {
	var b strings.Builder
	h := func(k, v string) { fmt.Fprintf(&b, "%s: %s\r\n", k, v) }
	h("From", from)
	h("To", e.To)
	if e.ReplyTo != "" {
		h("Reply-To", e.ReplyTo)
	}
	h("Subject", mime.QEncoding.Encode("utf-8", e.Subject))
	h("MIME-Version", "1.0")
	h("Content-Type", `text/plain; charset="utf-8"`)
	h("Date", time.Now().Format(time.RFC1123Z))
	b.WriteString("\r\n")
	b.WriteString(strings.ReplaceAll(e.Text, "\n", "\r\n"))
	return []byte(b.String())
}

// Log "sends" by logging, for local development without SMTP credentials.
type Log struct{}

// Send logs the email.
func (Log) Send(_ context.Context, e Email) error {
	slog.Info("email (dev mode, not sent)", "to", e.To, "replyTo", e.ReplyTo, "subject", e.Subject)
	return nil
}
