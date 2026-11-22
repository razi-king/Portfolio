// Package projects serves the portfolio's project catalogue.
//
// projects.json is the single source of truth: the Go API embeds it and the
// frontend imports the same file at build time, so the site works even when
// the API is asleep.
package projects

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/razi-king/portfolio/backend/internal/httpx"
)

//go:embed projects.json
var raw []byte

// Project is one portfolio entry.
type Project struct {
	Slug        string   `json:"slug"`
	Title       string   `json:"title"`
	Tagline     string   `json:"tagline"`
	Description string   `json:"description"`
	Category    string   `json:"category"` // backend | frontend | fullstack
	Status      string   `json:"status"`   // live | deploying | in-progress
	Highlights  []string `json:"highlights"`
	Stack       []string `json:"stack"`
	Repo        string   `json:"repo,omitempty"`
	Live        string   `json:"live,omitempty"`
	Featured    bool     `json:"featured"`
}

// Catalog holds the parsed projects.
type Catalog struct{ items []Project }

// Load parses the embedded catalogue.
func Load() (*Catalog, error) {
	var items []Project
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, fmt.Errorf("parse projects.json: %w", err)
	}
	return &Catalog{items: items}, nil
}

// All returns every project, optionally filtered by category.
func (c *Catalog) All(category string) []Project {
	if category == "" {
		return c.items
	}
	out := make([]Project, 0, len(c.items))
	for _, p := range c.items {
		if strings.EqualFold(p.Category, category) {
			out = append(out, p)
		}
	}
	return out
}

// List handles GET /api/projects?category=backend.
func (c *Catalog) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "public, max-age=300")
	httpx.JSON(w, http.StatusOK, map[string]any{"projects": c.All(r.URL.Query().Get("category"))})
}
