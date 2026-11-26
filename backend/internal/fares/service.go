package fares

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/razi-king/portfolio/backend/internal/safego"
)

// SearchRequest is a one-way (Return empty) or return search.
type SearchRequest struct {
	From   string
	To     string
	Date   string
	Return string
}

// Itinerary is one priced option: an outbound offer, plus a matched return offer for round trips.
type Itinerary struct {
	Outbound Offer  `json:"outbound"`
	Return   *Offer `json:"return,omitempty"`
	Total    int    `json:"total"`
}

// Call is one supplier call in the trace.
type Call struct {
	Leg      string `json:"leg"`
	Supplier string `json:"supplier"`
	Ms       int64  `json:"ms"`
	Offers   int    `json:"offers"`
	Error    string `json:"error,omitempty"`
}

// SearchResult is what the search endpoint returns.
type SearchResult struct {
	Itineraries []Itinerary `json:"itineraries"`
	Calls       []Call      `json:"calls"`
	// WallMs is how long the search took; SequentialMs is how long the same
	// calls would take one after another. The gap is the fan-out paying off.
	WallMs       int64 `json:"wallMs"`
	SequentialMs int64 `json:"sequentialMs"`
	Matched      int   `json:"matched"`
}

// RevalidateResult reports whether an offer's price still holds.
type RevalidateResult struct {
	Status   string `json:"status"` // confirmed | price_changed
	Path     string `json:"path"`   // native | cached
	Supplier string `json:"supplier"`
	Previous int    `json:"previous"`
	Current  int    `json:"current"`
	Message  string `json:"message"`
}

// ValidationError is a bad request the caller can fix.
type ValidationError struct{ Msg string }

func (e ValidationError) Error() string { return e.Msg }

// ErrExpired means a cached-only offer is too old (or the server restarted).
var ErrExpired = errors.New("offer expired, search again")

// Service runs searches across suppliers and revalidates offers.
type Service struct {
	suppliers []Supplier
	key       []byte
	cache     *snapshots
	timeout   time.Duration
	now       func() time.Time
}

// NewService builds the service. Offer IDs are signed with secret; pass nil
// to use a random per-process key (IDs then expire on restart).
func NewService(suppliers []Supplier, secret []byte) *Service {
	if len(secret) == 0 {
		secret = make([]byte, 32)
		_, _ = rand.Read(secret)
	}
	return &Service{
		suppliers: suppliers,
		key:       secret,
		cache:     newSnapshots(15 * time.Minute),
		timeout:   2 * time.Second,
		now:       time.Now,
	}
}

func (s *Service) validate(r *SearchRequest) error {
	r.From = strings.ToUpper(strings.TrimSpace(r.From))
	r.To = strings.ToUpper(strings.TrimSpace(r.To))
	if _, ok := airports[r.From]; !ok {
		return ValidationError{"Choose a departure airport from the list."}
	}
	if _, ok := airports[r.To]; !ok {
		return ValidationError{"Choose an arrival airport from the list."}
	}
	if r.From == r.To {
		return ValidationError{"Departure and arrival must be different."}
	}
	today := s.now().UTC().Truncate(24 * time.Hour)
	d, err := time.Parse(time.DateOnly, r.Date)
	if err != nil {
		return ValidationError{"Departure date must look like 2026-12-20."}
	}
	if d.Before(today.AddDate(0, 0, -1)) || d.After(today.AddDate(1, 0, 0)) {
		return ValidationError{"Pick a departure date within the next 12 months."}
	}
	if r.Return != "" {
		rd, err := time.Parse(time.DateOnly, r.Return)
		if err != nil {
			return ValidationError{"Return date must look like 2026-12-27."}
		}
		if rd.Before(d) {
			return ValidationError{"Return date can't be before the departure date."}
		}
		if rd.After(today.AddDate(1, 0, 0)) {
			return ValidationError{"Pick a return date within the next 12 months."}
		}
	}
	return nil
}

type job struct {
	leg      Leg
	supplier Supplier
}

type outcome struct {
	offers []Offer
	ms     int64
	err    error
}

var errIncomplete = errors.New("supplier call did not complete")

// Search fans every leg out to every capable supplier in parallel, then
// pairs outbound and return offers.
func (s *Service) Search(ctx context.Context, req SearchRequest) (SearchResult, error) {
	if err := s.validate(&req); err != nil {
		return SearchResult{}, err
	}
	legs := []Leg{{From: req.From, To: req.To, Date: req.Date}}
	if req.Return != "" {
		// the suppliers only search one way, so a return trip is two one-way searches
		legs = append(legs, Leg{From: req.To, To: req.From, Date: req.Return})
	}

	var jobs []job
	for _, leg := range legs {
		for _, sup := range s.suppliers {
			if sup.Capabilities()&CapSearch != 0 {
				jobs = append(jobs, job{leg, sup})
			}
		}
	}

	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	start := time.Now()
	results := make([]outcome, len(jobs))
	var wg sync.WaitGroup
	for i, j := range jobs {
		// pre-set a failure: if the call panics, safego recovers it and this stays
		results[i] = outcome{err: errIncomplete}
		wg.Add(1)
		safego.Go("fare-search:"+j.supplier.Name(), func() {
			defer wg.Done()
			t := time.Now()
			offers, err := j.supplier.Search(ctx, j.leg)
			results[i] = outcome{offers: offers, ms: time.Since(t).Milliseconds(), err: err}
		}, nil)
	}
	wg.Wait()

	res := SearchResult{WallMs: time.Since(start).Milliseconds()}
	var outbound, inbound []Offer
	for i, j := range jobs {
		r := results[i]
		call := Call{Leg: j.leg.From + "→" + j.leg.To, Supplier: j.supplier.Name(), Ms: r.ms, Offers: len(r.offers)}
		if r.err != nil {
			call.Error = "no response" // partial results beat no results; the other suppliers still count
		}
		res.Calls = append(res.Calls, call)
		res.SequentialMs += r.ms
		for _, o := range r.offers {
			o.ID = s.sign(o)
			if j.supplier.Capabilities()&CapRevalidate == 0 {
				s.cache.put(o.ID, o)
			}
			if j.leg.From == req.From {
				outbound = append(outbound, o)
			} else {
				inbound = append(inbound, o)
			}
		}
	}

	if req.Return == "" {
		for _, o := range outbound {
			res.Itineraries = append(res.Itineraries, Itinerary{Outbound: o, Total: o.Total})
		}
	} else {
		res.Itineraries = match(outbound, inbound)
		res.Matched = len(res.Itineraries)
	}
	slices.SortFunc(res.Itineraries, func(a, b Itinerary) int { return a.Total - b.Total })
	if len(res.Itineraries) > 8 {
		res.Itineraries = res.Itineraries[:8]
	}
	if res.Itineraries == nil {
		res.Itineraries = []Itinerary{}
	}
	return res, nil
}

// match pairs each outbound offer with the cheapest return offer from the same
// supplier, carrier and fare brand (fares only combine within a carrier's brand). One pass to index, one pass to look up: O(n+m),
// instead of comparing every outbound with every return offer.
func match(outbound, inbound []Offer) []Itinerary {
	cheapest := make(map[string]Offer, len(inbound))
	for _, r := range inbound {
		k := matchKey(r)
		if c, ok := cheapest[k]; !ok || r.Total < c.Total {
			cheapest[k] = r
		}
	}
	out := make([]Itinerary, 0, len(outbound))
	for _, o := range outbound {
		if r, ok := cheapest[matchKey(o)]; ok {
			out = append(out, Itinerary{Outbound: o, Return: &r, Total: o.Total + r.Total})
		}
	}
	return out
}

// Revalidate checks an offer's price before booking. Nothing should be written
// as a booking until this confirms the price the traveller agreed to.
func (s *Service) Revalidate(ctx context.Context, id string) (RevalidateResult, error) {
	o, err := s.verify(id)
	if err != nil {
		return RevalidateResult{}, err
	}
	var sup Supplier
	for _, x := range s.suppliers {
		if x.Name() == o.Supplier {
			sup = x
		}
	}
	if sup == nil {
		return RevalidateResult{}, errBadID
	}

	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	res := RevalidateResult{Supplier: o.Supplier, Previous: o.Total}
	if sup.Capabilities()&CapRevalidate != 0 {
		total, err := sup.Revalidate(ctx, o)
		if err != nil {
			return RevalidateResult{}, fmt.Errorf("revalidate with %s: %w", o.Supplier, err)
		}
		res.Path, res.Current = "native", total
	} else {
		snap, ok := s.cache.get(o.ID)
		if !ok {
			return RevalidateResult{}, ErrExpired
		}
		res.Path, res.Current = "cached", snap.Total
	}

	switch {
	case res.Current != res.Previous:
		res.Status = "price_changed"
		res.Message = "The fare changed since search. Nothing is booked at the old price: the traveller has to accept the new total first."
	case res.Path == "cached":
		res.Status = "confirmed"
		res.Message = "This supplier has no revalidation API, so the price was checked against the cached search snapshot."
	default:
		res.Status = "confirmed"
		res.Message = "The supplier confirmed the price. It's safe to create the booking."
	}
	return res, nil
}

func matchKey(o Offer) string { return o.Supplier + "|" + o.Carrier + "|" + o.Brand }

/* ------------------------------------------------------------- signed IDs */

var errBadID = errors.New("offer id is not valid")

// sign makes the offer its own ID, with an HMAC so a client can't edit the price.
func (s *Service) sign(o Offer) string {
	o.ID = ""
	b, _ := json.Marshal(o)
	payload := base64.RawURLEncoding.EncodeToString(b)
	return payload + "." + s.mac(payload)
}

func (s *Service) mac(payload string) string {
	m := hmac.New(sha256.New, s.key)
	m.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil)[:18])
}

func (s *Service) verify(id string) (Offer, error) {
	if id == "" || len(id) > 4096 {
		return Offer{}, errBadID
	}
	payload, sig, ok := strings.Cut(id, ".")
	if !ok || !hmac.Equal([]byte(sig), []byte(s.mac(payload))) {
		return Offer{}, errBadID
	}
	b, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return Offer{}, errBadID
	}
	var o Offer
	if err := json.Unmarshal(b, &o); err != nil {
		return Offer{}, errBadID
	}
	o.ID = id
	return o, nil
}

/* ------------------------------------------------------------- snapshot cache */

// snapshots stands in for the MongoDB / Azure Blob search cache used for
// suppliers that can't revalidate: a TTL map of offers as they were found.
type snapshots struct {
	mu   sync.Mutex
	ttl  time.Duration
	data map[string]snapshot
	now  func() time.Time
}

type snapshot struct {
	offer   Offer
	expires time.Time
}

func newSnapshots(ttl time.Duration) *snapshots {
	return &snapshots{ttl: ttl, data: map[string]snapshot{}, now: time.Now}
}

func (c *snapshots) put(id string, o Offer) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	if len(c.data) > 5000 {
		for k, v := range c.data {
			if now.After(v.expires) {
				delete(c.data, k)
			}
		}
	}
	c.data[id] = snapshot{offer: o, expires: now.Add(c.ttl)}
}

func (c *snapshots) get(id string) (Offer, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	v, ok := c.data[id]
	if !ok || c.now().After(v.expires) {
		delete(c.data, id)
		return Offer{}, false
	}
	return v.offer, true
}
