-- Convert verified_tools from array format to map keyed by tool name
UPDATE configs
SET verified_tools = (
  SELECT jsonb_object_agg(tool->>'name', tool)
  FROM jsonb_array_elements(verified_tools) AS tool
)
WHERE verified_tools IS NOT NULL;

-- Drop config-level verified column (verification is now per-tool)
ALTER TABLE configs DROP COLUMN verified;
