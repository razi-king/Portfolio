package contact

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/razi-king/portfolio/backend/internal/httpx"
)

const maxBodyBytes = 16 << 10 // 16 KB is plenty for a contact form

// Handler exposes the contact service over HTTP.
type Handler struct{ svc *Service }

// NewHandler returns the HTTP handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Submit handles POST /api/contact.
func (h *Handler) Submit(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var req Request
	if err := dec.Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}

	m, err := h.svc.Submit(r.Context(), req)
	var verr *ValidationError
	switch {
	case errors.As(err, &verr):
		httpx.JSON(w, http.StatusUnprocessableEntity, map[string]any{
			"error": "validation_failed", "message": "Please fix the highlighted fields.", "fields": verr.Fields,
		})
	case errors.Is(err, ErrSpam):
		// Pretend it worked so bots learn nothing.
		httpx.JSON(w, http.StatusAccepted, map[string]any{"status": StatusQueued})
	case err != nil:
		slog.ErrorContext(r.Context(), "submit contact failed", "err", err, "requestId", httpx.RequestID(r.Context()))
		httpx.Error(w, http.StatusServiceUnavailable, "unavailable", "Could not send right now. Please email me directly.")
	default:
		httpx.JSON(w, http.StatusAccepted, map[string]any{"id": m.ID, "status": m.Status})
	}
}
