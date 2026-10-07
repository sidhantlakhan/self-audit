-- Record the consent/privacy notice version accepted when the assessment was started.
ALTER TABLE assessments ADD COLUMN consent_at timestamptz;
ALTER TABLE assessments ADD COLUMN consent_version text;
