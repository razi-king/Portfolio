package contact

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
	"sync"
	"time"

	_ "github.com/lib/pq" // Postgres driver
)

// Repository stores contact messages and their delivery status.
type Repository interface {
	Create(ctx context.Context, m *Message) error
	MarkSent(ctx context.Context, id int64, attempts int) error
	MarkFailed(ctx context.Context, id int64, attempts int, lastErr string) error
	RecordAttempt(ctx context.Context, id int64, attempts int, lastErr string) error
	Get(ctx context.Context, id int64) (Message, error)
	Ping(ctx context.Context) error
}

// ErrNotFound is returned when a message does not exist.
var ErrNotFound = errors.New("message not found")

// ---------------------------------------------------------------- Postgres

//go:embed migrations/001_init.sql
var schema string

// Postgres is the production repository.
type Postgres struct{ db *sql.DB }

// NewPostgres opens the database and applies the schema (idempotent).
func NewPostgres(ctx context.Context, url string) (*Postgres, error) {
	db, err := sql.Open("postgres", url)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxIdleTime(5 * time.Minute)
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("postgres ping: %w", err)
	}
	if _, err := db.ExecContext(ctx, schema); err != nil {
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	return &Postgres{db: db}, nil
}

func (p *Postgres) Create(ctx context.Context, m *Message) error {
	return p.db.QueryRowContext(ctx, `
		INSERT INTO contact_messages (name, email, subject, body, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`,
		m.Name, m.Email, m.Subject, m.Body, m.Status,
	).Scan(&m.ID, &m.CreatedAt)
}

func (p *Postgres) MarkSent(ctx context.Context, id int64, attempts int) error {
	return p.update(ctx, id, StatusSent, attempts, "")
}

func (p *Postgres) MarkFailed(ctx context.Context, id int64, attempts int, lastErr string) error {
	return p.update(ctx, id, StatusFailed, attempts, lastErr)
}

func (p *Postgres) RecordAttempt(ctx context.Context, id int64, attempts int, lastErr string) error {
	return p.update(ctx, id, StatusQueued, attempts, lastErr)
}

func (p *Postgres) update(ctx context.Context, id int64, s Status, attempts int, lastErr string) error {
	res, err := p.db.ExecContext(ctx, `
		UPDATE contact_messages
		SET status = $2, attempts = $3, last_error = NULLIF($4, ''), updated_at = now()
		WHERE id = $1`, id, s, attempts, lastErr)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (p *Postgres) Get(ctx context.Context, id int64) (Message, error) {
	var m Message
	var lastErr sql.NullString
	err := p.db.QueryRowContext(ctx, `
		SELECT id, name, email, subject, body, status, attempts, last_error, created_at
		FROM contact_messages WHERE id = $1`, id,
	).Scan(&m.ID, &m.Name, &m.Email, &m.Subject, &m.Body, &m.Status, &m.Attempts, &lastErr, &m.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return m, ErrNotFound
	}
	m.LastError = lastErr.String
	return m, err
}

func (p *Postgres) Ping(ctx context.Context) error { return p.db.PingContext(ctx) }

// Close closes the pool.
func (p *Postgres) Close() error { return p.db.Close() }

// ---------------------------------------------------------------- Memory

// Memory is a thread-safe in-memory repository for local runs and tests.
type Memory struct {
	mu   sync.RWMutex
	seq  int64
	msgs map[int64]Message
}

// NewMemory returns an empty in-memory repository.
func NewMemory() *Memory { return &Memory{msgs: map[int64]Message{}} }

func (r *Memory) Create(_ context.Context, m *Message) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.seq++
	m.ID, m.CreatedAt = r.seq, time.Now().UTC()
	r.msgs[m.ID] = *m
	return nil
}

func (r *Memory) set(id int64, s Status, attempts int, lastErr string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, ok := r.msgs[id]
	if !ok {
		return ErrNotFound
	}
	m.Status, m.Attempts, m.LastError = s, attempts, lastErr
	r.msgs[id] = m
	return nil
}

func (r *Memory) MarkSent(_ context.Context, id int64, a int) error {
	return r.set(id, StatusSent, a, "")
}
func (r *Memory) MarkFailed(_ context.Context, id int64, a int, e string) error {
	return r.set(id, StatusFailed, a, e)
}
func (r *Memory) RecordAttempt(_ context.Context, id int64, a int, e string) error {
	return r.set(id, StatusQueued, a, e)
}

func (r *Memory) Get(_ context.Context, id int64) (Message, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	m, ok := r.msgs[id]
	if !ok {
		return m, ErrNotFound
	}
	return m, nil
}

func (r *Memory) Ping(context.Context) error { return nil }
