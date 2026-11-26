package fares

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

var day = time.Date(2026, 12, 1, 10, 0, 0, 0, time.UTC)

func newTestService(sups ...Supplier) *Service {
	if len(sups) == 0 {
		sups = DefaultSuppliers()
	}
	s := NewService(sups, []byte("test-secret"))
	s.now = func() time.Time { return day }
	return s
}

func TestSearchValidation(t *testing.T) {
	s := newTestService()
	cases := []SearchRequest{
		{From: "XXX", To: "DXB", Date: "2026-12-20"},
		{From: "BOM", To: "BOM", Date: "2026-12-20"},
		{From: "BOM", To: "DXB", Date: "20-12-2026"},
		{From: "BOM", To: "DXB", Date: "2025-01-01"},
		{From: "BOM", To: "DXB", Date: "2026-12-20", Return: "2026-12-10"},
	}
	for _, c := range cases {
		_, err := s.Search(context.Background(), c)
		var ve ValidationError
		if !errors.As(err, &ve) {
			t.Errorf("%+v: want ValidationError, got %v", c, err)
		}
	}
}

func TestOneWaySearchIsSortedAndSigned(t *testing.T) {
	s := newTestService()
	res, err := s.Search(context.Background(), SearchRequest{From: "bom", To: "dxb", Date: "2026-12-20"})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Itineraries) == 0 || len(res.Calls) != 2 {
		t.Fatalf("want offers from 2 supplier calls, got %d itineraries, %d calls", len(res.Itineraries), len(res.Calls))
	}
	for i, it := range res.Itineraries {
		if i > 0 && it.Total < res.Itineraries[i-1].Total {
			t.Fatal("itineraries not sorted by price")
		}
		if it.Return != nil {
			t.Fatal("one-way search returned a return leg")
		}
		if _, err := s.verify(it.Outbound.ID); err != nil {
			t.Fatalf("offer id does not verify: %v", err)
		}
	}
}

func TestReturnSearchRunsInParallelAndMatches(t *testing.T) {
	s := newTestService()
	res, err := s.Search(context.Background(), SearchRequest{From: "BOM", To: "LHR", Date: "2026-12-20", Return: "2026-12-30"})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Calls) != 4 {
		t.Fatalf("want 2 legs x 2 suppliers = 4 calls, got %d", len(res.Calls))
	}
	// four ~200ms calls in parallel should take far less than their sum
	if res.WallMs >= res.SequentialMs*3/4 {
		t.Fatalf("calls look sequential: wall %dms vs sequential %dms", res.WallMs, res.SequentialMs)
	}
	for _, it := range res.Itineraries {
		if it.Return == nil {
			t.Fatal("return itinerary without return offer")
		}
		if it.Return.Supplier != it.Outbound.Supplier || it.Return.Carrier != it.Outbound.Carrier || it.Return.Brand != it.Outbound.Brand {
			t.Fatalf("mismatched pair: %s/%s with %s/%s", it.Outbound.Supplier, it.Outbound.Brand, it.Return.Supplier, it.Return.Brand)
		}
		if it.Return.From != "LHR" || it.Total != it.Outbound.Total+it.Return.Total {
			t.Fatalf("bad itinerary: %+v", it)
		}
	}
}

func TestMatchPicksCheapestReturnPerSupplierAndBrand(t *testing.T) {
	out := []Offer{{Supplier: "A", Brand: "Saver", Total: 100}, {Supplier: "B", Brand: "Saver", Total: 90}}
	in := []Offer{
		{Supplier: "A", Brand: "Saver", Total: 70},
		{Supplier: "A", Brand: "Saver", Total: 50},
		{Supplier: "A", Brand: "Flexi", Total: 10},
	}
	got := match(out, in)
	if len(got) != 1 || got[0].Return.Total != 50 || got[0].Total != 150 {
		t.Fatalf("got %+v", got)
	}
}

func TestTamperedOfferIsRejected(t *testing.T) {
	s := newTestService()
	res, _ := s.Search(context.Background(), SearchRequest{From: "BOM", To: "DXB", Date: "2026-12-20"})
	id := res.Itineraries[0].Outbound.ID
	payload, sig, _ := strings.Cut(id, ".")
	for _, bad := range []string{"", "nope", payload + ".AAAA", strings.ToUpper(payload) + "." + sig} {
		if _, err := s.Revalidate(context.Background(), bad); !errors.Is(err, errBadID) {
			t.Errorf("id %.20q: want errBadID, got %v", bad, err)
		}
	}
}

func TestRevalidatePaths(t *testing.T) {
	s := newTestService()
	res, _ := s.Search(context.Background(), SearchRequest{From: "BOM", To: "SIN", Date: "2026-12-20"})
	seen := map[string]bool{}
	for _, it := range res.Itineraries {
		r, err := s.Revalidate(context.Background(), it.Outbound.ID)
		if err != nil {
			t.Fatal(err)
		}
		seen[r.Path+":"+r.Status] = true
		if r.Path == "cached" && r.Status != "confirmed" {
			t.Fatalf("cached path should confirm the snapshot price, got %+v", r)
		}
		if r.Status == "price_changed" && r.Current <= r.Previous {
			t.Fatalf("price change should go up in this demo: %+v", r)
		}
	}
	if !seen["cached:confirmed"] || !seen["native:confirmed"] && !seen["native:price_changed"] {
		t.Fatalf("expected both revalidation paths, saw %v", seen)
	}
}

func TestCachedOfferExpires(t *testing.T) {
	s := newTestService()
	res, _ := s.Search(context.Background(), SearchRequest{From: "BOM", To: "DEL", Date: "2026-12-20"})
	var falcon string
	for _, it := range res.Itineraries {
		if it.Outbound.Supplier == "Falcon Direct" {
			falcon = it.Outbound.ID
		}
	}
	if falcon == "" {
		t.Fatal("no Falcon Direct offer")
	}
	s.cache.now = func() time.Time { return time.Now().Add(time.Hour) }
	if _, err := s.Revalidate(context.Background(), falcon); !errors.Is(err, ErrExpired) {
		t.Fatalf("want ErrExpired, got %v", err)
	}
}

type panicky struct{ mockSupplier }

func (p *panicky) Search(context.Context, Leg) ([]Offer, error) { panic("supplier blew up") }

func TestPanickingSupplierDoesNotSinkTheSearch(t *testing.T) {
	good := DefaultSuppliers()[0]
	bad := &panicky{mockSupplier{name: "Broken", caps: CapSearch}}
	s := newTestService(good, bad)
	res, err := s.Search(context.Background(), SearchRequest{From: "BOM", To: "DXB", Date: "2026-12-20"})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Itineraries) == 0 {
		t.Fatal("the healthy supplier's offers should still come back")
	}
	var failed bool
	for _, c := range res.Calls {
		if c.Supplier == "Broken" && c.Error != "" {
			failed = true
		}
	}
	if !failed {
		t.Fatal("the panicking supplier should show up as a failed call")
	}
}

func TestHandlers(t *testing.T) {
	h := NewHandler(newTestService())

	rec := httptest.NewRecorder()
	h.Search(rec, httptest.NewRequest(http.MethodGet, "/api/fares/search?from=BOM&to=JED&date=2026-12-20", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("search: status %d: %s", rec.Code, rec.Body)
	}
	var res SearchResult
	_ = json.NewDecoder(rec.Body).Decode(&res)

	rec = httptest.NewRecorder()
	h.Search(rec, httptest.NewRequest(http.MethodGet, "/api/fares/search?from=BOM&to=BOM&date=2026-12-20", nil))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("bad search: want 422, got %d", rec.Code)
	}

	body := `{"id":"` + res.Itineraries[0].Outbound.ID + `"}`
	rec = httptest.NewRecorder()
	h.Revalidate(rec, httptest.NewRequest(http.MethodPost, "/api/fares/revalidate", strings.NewReader(body)))
	if rec.Code != http.StatusOK {
		t.Fatalf("revalidate: status %d: %s", rec.Code, rec.Body)
	}

	rec = httptest.NewRecorder()
	h.Revalidate(rec, httptest.NewRequest(http.MethodPost, "/api/fares/revalidate", strings.NewReader(`{"id":"x.y"}`)))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("tampered revalidate: want 422, got %d", rec.Code)
	}
}
