package projects

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCatalogIsValid(t *testing.T) {
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, p := range c.All("") {
		if p.Slug == "" || p.Title == "" || len(p.Stack) == 0 {
			t.Errorf("incomplete project: %+v", p)
		}
		if seen[p.Slug] {
			t.Errorf("duplicate slug %q", p.Slug)
		}
		seen[p.Slug] = true
		switch p.Category {
		case "backend", "frontend", "fullstack":
		default:
			t.Errorf("%s: bad category %q", p.Slug, p.Category)
		}
		if p.Status == "live" && p.Live == "" {
			t.Errorf("%s: status live but no live URL", p.Slug)
		}
	}
}

func TestListFiltersByCategory(t *testing.T) {
	c, _ := Load()
	rec := httptest.NewRecorder()
	c.List(rec, httptest.NewRequest(http.MethodGet, "/api/projects?category=frontend", nil))
	var body struct{ Projects []Project }
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Projects) == 0 {
		t.Fatal("expected frontend projects")
	}
	for _, p := range body.Projects {
		if p.Category != "frontend" {
			t.Fatalf("got %s in frontend filter", p.Category)
		}
	}
}
