CREATE TABLE IF NOT EXISTS contact_messages (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(80)   NOT NULL,
    email       VARCHAR(254)  NOT NULL,
    subject     VARCHAR(120)  NOT NULL DEFAULT '',
    body        TEXT          NOT NULL,
    status      VARCHAR(16)   NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'sent', 'failed')),
    attempts    INT           NOT NULL DEFAULT 0,
    last_error  TEXT,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created
    ON contact_messages (status, created_at DESC);
