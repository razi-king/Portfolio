package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterRefills(t *testing.T) {
	now := time.Unix(0, 0)
	l := NewRateLimiter(2) // 2 per minute
	l.now = func() time.Time { return now }

	if !l.Allow("ip") || !l.Allow("ip") {
		t.Fatal("first two requests should pass")
	}
	if l.Allow("ip") {
		t.Fatal("third request should be limited")
	}
	if !l.Allow("other-ip") {
		t.Fatal("limits are per client")
	}
	now = now.Add(30 * time.Second) // refills one token
	if !l.Allow("ip") {
		t.Fatal("token should refill after 30s")
	}
}

func TestRateLimiterCleanup(t *testing.T) {
	now := time.Unix(0, 0)
	l := NewRateLimiter(5)
	l.now = func() time.Time { return now }
	l.Allow("a")
	now = now.Add(time.Hour)
	l.Cleanup(10 * time.Minute)
	if len(l.buckets) != 0 {
		t.Fatalf("idle bucket not removed")
	}
}

func TestCORS(t *testing.T) {
	h := WithCORS([]string{"https://razi-king.github.io"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))

	req := httptest.NewRequest(http.MethodOptions, "/api/contact", nil)
	req.Header.Set("Origin", "https://razi-king.github.io")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent || rec.Header().Get("Access-Control-Allow-Origin") == "" {
		t.Fatalf("preflight not allowed: %d %v", rec.Code, rec.Header())
	}

	req.Header.Set("Origin", "https://evil.example")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("unknown origin must not be allowed")
	}
}

func TestRecover(t *testing.T) {
	h := WithRecover(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") }))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestClientIP(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "10.0.0.1:1234"
	if ClientIP(r) != "10.0.0.1" {
		t.Fatal(ClientIP(r))
	}
	r.Header.Set("X-Forwarded-For", "203.0.113.7, 10.0.0.1")
	if ClientIP(r) != "203.0.113.7" {
		t.Fatal(ClientIP(r))
	}
}
