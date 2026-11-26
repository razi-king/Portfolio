package fares

import "math"

type airport struct {
	City string
	Lat  float64
	Lon  float64
}

// airports is the demo network, matching the globe on the site.
var airports = map[string]airport{
	"BOM": {"Mumbai", 19.07, 72.88},
	"DEL": {"Delhi", 28.61, 77.21},
	"BLR": {"Bengaluru", 12.97, 77.59},
	"DXB": {"Dubai", 25.2, 55.27},
	"JED": {"Jeddah", 21.49, 39.19},
	"RUH": {"Riyadh", 24.71, 46.68},
	"MCT": {"Muscat", 23.59, 58.41},
	"SIN": {"Singapore", 1.35, 103.82},
	"LHR": {"London", 51.5, -0.12},
	"CDG": {"Paris", 48.86, 2.35},
	"ALA": {"Almaty", 43.24, 76.95},
	"NBO": {"Nairobi", -1.29, 36.82},
}

func distanceKm(a, b airport) float64 {
	rad := func(d float64) float64 { return d * math.Pi / 180 }
	dLat := rad(b.Lat - a.Lat)
	dLon := rad(b.Lon - a.Lon)
	h := math.Pow(math.Sin(dLat/2), 2) + math.Cos(rad(a.Lat))*math.Cos(rad(b.Lat))*math.Pow(math.Sin(dLon/2), 2)
	return 2 * 6371 * math.Asin(math.Sqrt(h))
}
