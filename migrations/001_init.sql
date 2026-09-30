-- Free AI-Readiness Scorecard: one row per attempt.
CREATE TABLE scorecards (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Unguessable token the founder's browser, report links and PDF links use.
  token            text NOT NULL UNIQUE,
  device_id        text NOT NULL,
  ip_hash          text NOT NULL,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'scored', 'report_ready', 'report_failed')),
  details          jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers          jsonb NOT NULL DEFAULT '[]'::jsonb,
  bottleneck       text NOT NULL DEFAULT '',
  software         text[] NOT NULL DEFAULT '{}',
  automate_task    text NOT NULL DEFAULT '',
  -- Which open answers were dictated by voice (their transcripts are machine-written).
  voice_used       jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_at       timestamptz,
  total            smallint,
  pillar_scores    smallint[],
  band             text,
  report           jsonb,
  report_model     text,
  report_error     text,
  report_attempts  smallint NOT NULL DEFAULT 0,
  pdf              bytea,
  whatsapp_sent_at timestamptz,
  email_sent_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  submitted_at     timestamptz
);

CREATE INDEX scorecards_device_created ON scorecards (device_id, created_at);
CREATE INDEX scorecards_ip_created ON scorecards (ip_hash, created_at);
CREATE INDEX scorecards_retry ON scorecards (status, report_attempts) WHERE status = 'report_failed';

-- Next-step requests: webinar, audit call, Self-Audit access, consultant-led audit.
CREATE TABLE interest_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id  uuid REFERENCES scorecards (id) ON DELETE SET NULL,
  kind          text NOT NULL CHECK (kind IN ('webinar', 'audit_call', 'self_audit', 'consultant_audit')),
  name          text NOT NULL DEFAULT '',
  business      text NOT NULL DEFAULT '',
  phone         text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX interest_requests_created ON interest_requests (created_at DESC);
