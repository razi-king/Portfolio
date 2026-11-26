package fares

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/razi-king/portfolio/backend/internal/httpx"
)

// Handler exposes the service over HTTP.
type Handler struct{ svc *Service }

// NewHandler wraps svc.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Search handles GET /api/fares/search?from=BOM&to=DXB&date=2026-12-20[&return=2026-12-27].
func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	res, err := h.svc.Search(r.Context(), SearchRequest{
		From:   q.Get("from"),
		To:     q.Get("to"),
		Date:   q.Get("date"),
		Return: q.Get("return"),
	})
	var ve ValidationError
	switch {
	case errors.As(err, &ve):
		httpx.Error(w, http.StatusUnprocessableEntity, "invalid_search", ve.Msg)
	case err != nil:
		slog.Error("fare search failed", "err", err, "requestId", httpx.RequestID(r.Context()))
		httpx.Error(w, http.StatusBadGateway, "search_failed", "The fare search failed. Please try again.")
	default:
		w.Header().Set("Cache-Control", "no-store")
		httpx.JSON(w, http.StatusOK, res)
	}
}

// Revalidate handles POST /api/fares/revalidate with {"id": "..."}.
func (h *Handler) Revalidate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_json", "Send a JSON body like {\"id\": \"...\"}.")
		return
	}
	res, err := h.svc.Revalidate(r.Context(), body.ID)
	switch {
	case errors.Is(err, errBadID):
		httpx.Error(w, http.StatusUnprocessableEntity, "invalid_offer", "That offer ID isn't valid (or was edited).")
	case errors.Is(err, ErrExpired):
		httpx.Error(w, http.StatusGone, "offer_expired", ErrExpired.Error())
	case err != nil:
		slog.Error("revalidation failed", "err", err, "requestId", httpx.RequestID(r.Context()))
		httpx.Error(w, http.StatusBadGateway, "revalidation_failed", "The supplier didn't answer. Please try again.")
	default:
		httpx.JSON(w, http.StatusOK, res)
	}
}
