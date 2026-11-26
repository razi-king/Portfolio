// Package config loads service configuration from environment variables.
package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds every setting the API and the worker need.
// Empty DatabaseURL / AMQPURL switch the service to in-memory mode,
// so the portfolio runs with zero infrastructure for local demos.
type Config struct {
	Port           string
	DatabaseURL    string
	AMQPURL        string
	AllowedOrigins []string
	RunWorker      bool // run the email worker inside the API process

	SMTPHost string
	SMTPPort string
	SMTPUser string
	SMTPPass string
	MailFrom string
	MailTo   string

	RateLimitPerMinute     int
	FareRateLimitPerMinute int
	FaresSecret            string // signs fare offer IDs; empty = random per process
	ShutdownTimeout        time.Duration
}

// Load reads the environment and applies defaults.
func Load() Config {
	return Config{
		Port:                   env("PORT", "8080"),
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		AMQPURL:                os.Getenv("AMQP_URL"),
		AllowedOrigins:         split(env("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,https://razi-king.github.io")),
		RunWorker:              envBool("RUN_WORKER", true),
		SMTPHost:               os.Getenv("SMTP_HOST"),
		SMTPPort:               env("SMTP_PORT", "587"),
		SMTPUser:               os.Getenv("SMTP_USER"),
		SMTPPass:               os.Getenv("SMTP_PASS"),
		MailFrom:               env("MAIL_FROM", os.Getenv("SMTP_USER")),
		MailTo:                 env("MAIL_TO", "raziinsane@gmail.com"),
		RateLimitPerMinute:     envInt("RATE_LIMIT_PER_MINUTE", 5),
		FareRateLimitPerMinute: envInt("FARE_RATE_LIMIT_PER_MINUTE", 60),
		FaresSecret:            os.Getenv("FARES_SECRET"),
		ShutdownTimeout:        10 * time.Second,
	}
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func envBool(key string, def bool) bool {
	if v, err := strconv.ParseBool(os.Getenv(key)); err == nil {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v, err := strconv.Atoi(os.Getenv(key)); err == nil && v > 0 {
		return v
	}
	return def
}

func split(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
