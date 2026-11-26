// Package fares is a small, self-contained flight search and revalidation
// service for the portfolio's live demo. The suppliers and carriers are
// fictional, but the shape mirrors production booking engines:
//
//   - suppliers sit behind one interface and declare their capabilities,
//     so a supplier with partial API coverage plugs in without changing the
//     booking logic;
//   - return trips are split into parallel one-way calls (some suppliers only
//     search one way), each started through safego so a panic can't crash
//     the process;
//   - outbound and return offers are paired with a hashmap, O(n+m);
//   - suppliers without a revalidation API are revalidated from a cached
//     snapshot of the search result.
package fares

import (
	"context"
	"fmt"
	"hash/fnv"
	"time"
)

// Capability is something a supplier's API can do.
type Capability uint8

const (
	CapSearch Capability = 1 << iota
	CapRevalidate
)

// Leg is one one-way search.
type Leg struct {
	From string `json:"from"`
	To   string `json:"to"`
	Date string `json:"date"` // YYYY-MM-DD
}

// Offer is one bookable one-way fare.
type Offer struct {
	ID          string `json:"id"`
	Supplier    string `json:"supplier"`
	Carrier     string `json:"carrier"`
	Flight      string `json:"flight"`
	Brand       string `json:"brand"`
	From        string `json:"from"`
	To          string `json:"to"`
	Date        string `json:"date"`
	Depart      string `json:"depart"`
	Arrive      string `json:"arrive"`
	DurationMin int    `json:"durationMin"`
	Base        int    `json:"base"`
	Taxes       int    `json:"taxes"`
	Total       int    `json:"total"`
	Currency    string `json:"currency"`
}

// Supplier is one fare source. Callers must check Capabilities before calling
// anything other than Search.
type Supplier interface {
	Name() string
	Capabilities() Capability
	Search(ctx context.Context, leg Leg) ([]Offer, error)
	// Revalidate returns the supplier's current total for an offer.
	Revalidate(ctx context.Context, o Offer) (int, error)
}

// ErrUnsupported is returned when a supplier lacks a capability.
var ErrUnsupported = fmt.Errorf("capability not supported by supplier")

// mockSupplier generates deterministic fares with simulated network latency.
type mockSupplier struct {
	name     string
	caps     Capability
	latency  time.Duration
	carriers []carrier
	// revalidation drift: one offer in `driftEvery` comes back more expensive
	driftEvery uint64
}

type carrier struct {
	name   string
	code   string
	brands []brand
}

type brand struct {
	name string
	mult float64
}

func (m *mockSupplier) Name() string             { return m.name }
func (m *mockSupplier) Capabilities() Capability { return m.caps }

func (m *mockSupplier) wait(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

func (m *mockSupplier) Search(ctx context.Context, leg Leg) ([]Offer, error) {
	a, okA := airports[leg.From]
	b, okB := airports[leg.To]
	if !okA || !okB {
		return nil, fmt.Errorf("%s: unknown route %s-%s", m.name, leg.From, leg.To)
	}
	// latency varies a little per route so the trace looks like real traffic
	jitter := time.Duration(hash(m.name, leg.From, leg.To, leg.Date)%90) * time.Millisecond
	if err := m.wait(ctx, m.latency+jitter); err != nil {
		return nil, err
	}

	km := distanceKm(a, b)
	minutes := int(km/820*60) + 30
	var out []Offer
	for ci, c := range m.carriers {
		h := hash(m.name, c.code, leg.From, leg.To, leg.Date)
		dep := 300 + int(h%960) // between 05:00 and 21:00
		dep -= dep % 5
		flight := fmt.Sprintf("%s %d", c.code, 100+int(h%800)+ci)
		for _, br := range c.brands {
			// base fare: distance-driven, ±12% per carrier/date
			base := (2200 + km*4.1) * br.mult * (0.88 + float64(h%25)/100)
			baseInt := round10(base)
			taxes := round10(float64(baseInt)*0.12 + 650)
			o := Offer{
				Supplier:    m.name,
				Carrier:     c.name,
				Flight:      flight,
				Brand:       br.name,
				From:        leg.From,
				To:          leg.To,
				Date:        leg.Date,
				Depart:      clock(dep),
				Arrive:      clock(dep + minutes),
				DurationMin: minutes,
				Base:        baseInt,
				Taxes:       taxes,
				Total:       baseInt + taxes,
				Currency:    "INR",
			}
			out = append(out, o)
		}
	}
	return out, nil
}

func (m *mockSupplier) Revalidate(ctx context.Context, o Offer) (int, error) {
	if m.caps&CapRevalidate == 0 {
		return 0, ErrUnsupported
	}
	if err := m.wait(ctx, m.latency/2); err != nil {
		return 0, err
	}
	h := hash("reval", o.ID)
	if m.driftEvery > 0 && h%m.driftEvery == 0 {
		// the fare moved between search and booking: +4% to +9%
		return round10(float64(o.Total) * (1.04 + float64(h%6)/100)), nil
	}
	return o.Total, nil
}

// DefaultSuppliers returns the demo's two fictional suppliers: an aggregator
// with a revalidation API, and a direct airline connection without one.
func DefaultSuppliers() []Supplier {
	return []Supplier{
		&mockSupplier{
			name:       "AeroHub",
			caps:       CapSearch | CapRevalidate,
			latency:    170 * time.Millisecond,
			driftEvery: 3,
			carriers: []carrier{
				{name: "Saffron Air", code: "SF", brands: []brand{{"Saver", 1}, {"Flexi", 1.32}}},
				{name: "Monsoon Jet", code: "MJ", brands: []brand{{"Saver", 0.96}, {"Flexi", 1.28}}},
			},
		},
		&mockSupplier{
			name:    "Falcon Direct",
			caps:    CapSearch, // no revalidation API: we fall back to the cached search result
			latency: 230 * time.Millisecond,
			carriers: []carrier{
				{name: "Falcon Airways", code: "FA", brands: []brand{{"Saver", 1.04}, {"Flexi", 1.36}}},
			},
		},
	}
}

func hash(parts ...string) uint64 {
	h := fnv.New64a()
	for _, p := range parts {
		_, _ = h.Write([]byte(p))
		_, _ = h.Write([]byte{0})
	}
	return h.Sum64()
}

func round10(f float64) int { return int(f/10+0.5) * 10 }

func clock(min int) string {
	min %= 24 * 60
	return fmt.Sprintf("%02d:%02d", min/60, min%60)
}
