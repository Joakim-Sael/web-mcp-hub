-- Unique constraint on domain + url_pattern (fixes TOCTOU race condition in app-level duplicate check)
ALTER TABLE configs ADD CONSTRAINT configs_domain_url_unique UNIQUE (domain, url_pattern);

-- Max tools JSONB column size (~1MB per row)
ALTER TABLE configs ADD CONSTRAINT configs_tools_size
  CHECK (pg_column_size(tools) <= 1048576);

-- Max title length (200 chars)
ALTER TABLE configs ADD CONSTRAINT configs_title_length
  CHECK (char_length(title) <= 200);

-- Max description length (5000 chars)
ALTER TABLE configs ADD CONSTRAINT configs_description_length
  CHECK (char_length(description) <= 5000);
