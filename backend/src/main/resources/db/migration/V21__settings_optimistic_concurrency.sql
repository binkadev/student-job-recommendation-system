ALTER TABLE companies ADD COLUMN account_revision BIGINT NOT NULL DEFAULT 0 CHECK (account_revision >= 0);
ALTER TABLE user_notification_settings ADD COLUMN revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0);
