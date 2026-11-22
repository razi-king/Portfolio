// Command server runs the portfolio API (and, by default, the email worker).
//
// Modes:
//   - DATABASE_URL empty → in-memory storage
//   - AMQP_URL empty     → in-memory queue
//   - SMTP_HOST empty    → emails are logged, not sent
//
// So `go run ./cmd/server` works with zero setup, and production just sets env vars.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/razi-king/portfolio/backend/internal/config"
	"github.com/razi-king/portfolio/backend/internal/contact"
	"github.com/razi-king/portfolio/backend/internal/httpx"
	"github.com/razi-king/portfolio/backend/internal/mailer"
	"github.com/razi-king/portfolio/backend/internal/projects"
	"github.com/razi-king/portfolio/backend/internal/queue"
	"github.com/razi-king/portfolio/backend/internal/safego"
	"github.com/razi-king/portfolio/backend/internal/worker"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	repo, closeRepo, err := buildRepository(ctx, cfg)
	if err != nil {
		return err
	}
	defer closeRepo()

	pub, cons, closeQueue, err := buildQueue(cfg)
	if err != nil {
		return err
	}
	defer closeQueue()

	catalog, err := projects.Load()
	if err != nil {
		return err
	}

	if cfg.RunWorker {
		w := worker.New(buildMailer(cfg), repo, cfg.MailTo)
		safego.Go("email-worker", func() {
			if err := cons.Consume(ctx, w.Handle, w.Park); err != nil {
				slog.Error("worker stopped", "err", err)
			}
		}, nil)
	}

	limiter := httpx.NewRateLimiter(cfg.RateLimitPerMinute)
	safego.Go("rate-limit-cleanup", func() {
		t := time.NewTicker(5 * time.Minute)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				limiter.Cleanup(10 * time.Minute)
			}
		}
	}, nil)

	contactHandler := contact.NewHandler(contact.NewService(repo, pub))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		if err := repo.Ping(r.Context()); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "db_unavailable", "database not reachable")
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
	mux.HandleFunc("GET /api/projects", catalog.List)
	mux.HandleFunc("POST /api/contact", limiter.Limit(contactHandler.Submit))

	srv := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: httpx.Chain(mux,
			httpx.WithRequestID, httpx.WithRecover, httpx.WithLogging,
			httpx.WithSecurityHeaders, httpx.WithCORS(cfg.AllowedOrigins)),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	safego.Go("http-server", func() {
		slog.Info("listening", "port", cfg.Port, "worker", cfg.RunWorker,
			"db", cfg.DatabaseURL != "", "rabbitmq", cfg.AMQPURL != "", "smtp", cfg.SMTPHost != "")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}, nil)

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}
	slog.Info("shutting down")
	shCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	return srv.Shutdown(shCtx)
}

func buildRepository(ctx context.Context, cfg config.Config) (contact.Repository, func(), error) {
	if cfg.DatabaseURL == "" {
		slog.Warn("DATABASE_URL not set, using in-memory storage")
		return contact.NewMemory(), func() {}, nil
	}
	pg, err := contact.NewPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, nil, err
	}
	return pg, func() { _ = pg.Close() }, nil
}

func buildQueue(cfg config.Config) (queue.Publisher, queue.Consumer, func(), error) {
	if cfg.AMQPURL == "" {
		slog.Warn("AMQP_URL not set, using in-memory queue")
		m := queue.NewMemory(256, queue.RetryDelays)
		return m, m, func() {}, nil
	}
	rq, err := queue.NewRabbitMQ(cfg.AMQPURL, queue.RetryDelays)
	if err != nil {
		return nil, nil, nil, err
	}
	return rq, rq, func() { _ = rq.Close() }, nil
}

func buildMailer(cfg config.Config) mailer.Mailer {
	if cfg.SMTPHost == "" {
		slog.Warn("SMTP_HOST not set, emails will only be logged")
		return mailer.Log{}
	}
	return mailer.SMTP{Host: cfg.SMTPHost, Port: cfg.SMTPPort, User: cfg.SMTPUser, Pass: cfg.SMTPPass, From: cfg.MailFrom}
}
