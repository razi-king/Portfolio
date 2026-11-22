// Command worker runs only the email consumer, for deployments that scale
// the API and the worker separately (set RUN_WORKER=false on the API).
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/razi-king/portfolio/backend/internal/config"
	"github.com/razi-king/portfolio/backend/internal/contact"
	"github.com/razi-king/portfolio/backend/internal/mailer"
	"github.com/razi-king/portfolio/backend/internal/queue"
	"github.com/razi-king/portfolio/backend/internal/worker"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	cfg := config.Load()
	if cfg.AMQPURL == "" || cfg.DatabaseURL == "" {
		slog.Error("the standalone worker needs AMQP_URL and DATABASE_URL")
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	repo, err := contact.NewPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("postgres", "err", err)
		os.Exit(1)
	}
	defer repo.Close()

	rq, err := queue.NewRabbitMQ(cfg.AMQPURL, queue.RetryDelays)
	if err != nil {
		slog.Error("rabbitmq", "err", err)
		os.Exit(1)
	}
	defer rq.Close()

	var m mailer.Mailer = mailer.Log{}
	if cfg.SMTPHost != "" {
		m = mailer.SMTP{Host: cfg.SMTPHost, Port: cfg.SMTPPort, User: cfg.SMTPUser, Pass: cfg.SMTPPass, From: cfg.MailFrom}
	}
	w := worker.New(m, repo, cfg.MailTo)
	slog.Info("worker started")
	if err := rq.Consume(ctx, w.Handle, w.Park); err != nil {
		slog.Error("worker stopped", "err", err)
		os.Exit(1)
	}
}
