ALTER TABLE configs ADD COLUMN verified integer DEFAULT 0 NOT NULL;
ALTER TABLE configs ADD COLUMN verified_tools jsonb;
