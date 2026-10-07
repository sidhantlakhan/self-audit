-- AI Readiness Diagnostic — initial schema (PostgreSQL 14+; also runs on embedded PGlite)

CREATE TABLE config_versions (
  kind          text        NOT NULL CHECK (kind IN ('assessment','scoring','prompt','report')),
  version       text        NOT NULL,
  content_hash  text        NOT NULL,
  payload       jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, version)
);

CREATE TABLE system_config (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assessments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id             text NOT NULL UNIQUE,
  status                text NOT NULL DEFAULT 'started' CHECK (status IN
    ('started','in_progress','completed','analysis_pending','analysis_complete','report_pending','report_complete','consultation_booked')),
  analysis_status       text NOT NULL DEFAULT 'not_started' CHECK (analysis_status IN ('not_started','pending','processing','complete','failed')),
  report_status         text NOT NULL DEFAULT 'not_started' CHECK (report_status IN ('not_started','pending','processing','complete','failed')),
  consultation_status   text NOT NULL DEFAULT 'none' CHECK (consultation_status IN ('none','clicked','booked')),
  respondent_name       text,
  business_name         text,
  mobile                text,            -- E.164
  email                 text,            -- lower-cased
  role                  text,
  industry              text,
  business_model        jsonb,
  turnover_range        text,
  team_size             text,
  years_in_operation    text,
  current_phase         int  NOT NULL DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 7),
  completed_phases      jsonb NOT NULL DEFAULT '[]'::jsonb,
  completion_percentage int  NOT NULL DEFAULT 0,
  assessment_version    text NOT NULL,
  scoring_version       text,
  prompt_version        text,
  report_version        text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  started_at            timestamptz,
  last_activity_at      timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  analysis_completed_at timestamptz,
  report_generated_at   timestamptz,
  consultation_booked_at timestamptz
);
CREATE INDEX assessments_email_idx ON assessments (email);
CREATE INDEX assessments_mobile_idx ON assessments (mobile);
CREATE INDEX assessments_status_idx ON assessments (status);
CREATE INDEX assessments_created_idx ON assessments (created_at);

-- Resume / access tokens. Only an HMAC of the token is stored; the token itself is never persisted.
CREATE TABLE assessment_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  last_used_at  timestamptz
);
CREATE INDEX assessment_tokens_assessment_idx ON assessment_tokens (assessment_id);

CREATE TABLE assessment_responses (
  assessment_id  uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id    text NOT NULL,
  response_value jsonb NOT NULL,
  response_type  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id, question_id)
);

-- Frozen copy of the answers used for scoring (immutable once written).
CREATE TABLE assessment_snapshots (
  assessment_id      uuid PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
  answers            jsonb NOT NULL,
  assessment_version text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assessment_scores (
  assessment_id      uuid PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
  overall_score      double precision NOT NULL,
  overall_rounded    int NOT NULL,
  readiness_band     text NOT NULL,
  scoring_version    text NOT NULL,
  assessment_version text NOT NULL,
  result             jsonb NOT NULL,     -- full ScoreResult snapshot
  calculated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assessment_dimension_scores (
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  dimension     text NOT NULL,
  score         double precision NOT NULL,
  weight        double precision NOT NULL,
  PRIMARY KEY (assessment_id, dimension)
);

CREATE TABLE assessment_indicators (
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  kind          text NOT NULL,          -- founder_dependency | opportunity | adoption_intent
  level         text,
  value         jsonb NOT NULL,
  PRIMARY KEY (assessment_id, kind)
);

CREATE TABLE ai_analysis (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  uuid NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
  status         text NOT NULL CHECK (status IN ('pending','processing','complete','failed')),
  prompt_version text NOT NULL,
  model          text,
  provider       text,
  input_hash     text,
  input_snapshot jsonb,
  output         jsonb,
  error          text,                  -- sanitised, never contains provider payloads
  attempts       int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

CREATE TABLE reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  report_version    text NOT NULL,
  status            text NOT NULL CHECK (status IN ('pending','processing','complete','failed')),
  score_snapshot    jsonb,
  analysis_snapshot jsonb,
  pdf               bytea,
  pdf_bytes         int,
  error             text,
  generated_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, report_version)
);

CREATE TABLE consultations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     uuid NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
  status            text NOT NULL CHECK (status IN ('clicked','booked')),
  clicked_at        timestamptz,
  booked_at         timestamptz,
  booking_reference text,
  source            text,               -- webhook | self_reported | admin
  metadata          jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attribution (
  assessment_id    uuid PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
  visitor_id       text,
  first_source     text, first_medium text, first_campaign text, first_content text, first_term text, first_ref text,
  first_category   text,
  first_touch_at   timestamptz,
  latest_source    text, latest_medium text, latest_campaign text, latest_content text, latest_term text, latest_ref text,
  latest_category  text,
  latest_touch_at  timestamptz,
  landing_url      text,
  referrer         text,
  device           text
);
CREATE INDEX attribution_category_idx ON attribution (first_category);

CREATE TABLE analytics_events (
  id            bigserial PRIMARY KEY,
  event         text NOT NULL,
  assessment_id uuid REFERENCES assessments(id) ON DELETE CASCADE,
  visitor_id    text,
  source        text,
  device        text,
  props         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analytics_events_event_idx ON analytics_events (event, created_at);
CREATE INDEX analytics_events_assessment_idx ON analytics_events (assessment_id);

CREATE TABLE admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text,
  password_hash text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE admin_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  csrf_token  text NOT NULL,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);

CREATE TABLE login_attempts (
  key          text PRIMARY KEY,        -- "email:<addr>" or "ip:<addr>"
  failures     int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id         bigserial PRIMARY KEY,
  admin_id   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  admin_email text,
  action     text NOT NULL,
  entity     text,
  entity_id  text,
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL CHECK (type IN ('analysis','report')),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed')),
  attempts      int NOT NULL DEFAULT 0,
  max_attempts  int NOT NULL DEFAULT 3,
  run_at        timestamptz NOT NULL DEFAULT now(),
  locked_at     timestamptz,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);
-- Duplicate-execution prevention: at most one live job per (type, assessment).
CREATE UNIQUE INDEX jobs_active_unique ON jobs (type, assessment_id) WHERE status IN ('queued','running');
CREATE INDEX jobs_poll_idx ON jobs (status, run_at);

CREATE TABLE notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES assessments(id) ON DELETE CASCADE,
  channel       text NOT NULL CHECK (channel IN ('email','whatsapp')),
  template      text NOT NULL,
  recipient     text NOT NULL,
  subject       text,
  body          text NOT NULL,
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  provider      text,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz
);
