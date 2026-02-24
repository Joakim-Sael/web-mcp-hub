-- Step 1: Create the tools table
CREATE TABLE "tools" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "config_id"   uuid NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
  "name"        text NOT NULL,
  "description" text NOT NULL,
  "input_schema" jsonb NOT NULL,
  "annotations" jsonb,
  "execution"   jsonb,
  "contributor" text NOT NULL,
  "verified"    boolean DEFAULT false NOT NULL,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"  timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "uq_tools_config_name" ON "tools" ("config_id", "name");
CREATE INDEX "idx_tools_config_id" ON "tools" ("config_id");
CREATE INDEX "idx_tools_contributor" ON "tools" ("contributor");

ALTER TABLE "tools" ENABLE ROW LEVEL SECURITY;

-- Step 2: Backfill tools from existing JSONB data
-- configs.tools is a JSONB array of ToolDescriptor objects (camelCase keys).
-- configs.verified_tools is a JSONB object keyed by tool name (set in migration 0005).
INSERT INTO tools (config_id, name, description, input_schema, annotations, execution, contributor, verified)
SELECT
  c.id,
  t->>'name',
  t->>'description',
  t->'inputSchema',
  t->'annotations',
  t->'execution',
  c.contributor,
  COALESCE(c.verified_tools ? (t->>'name'), false)
FROM configs c, jsonb_array_elements(c.tools) AS t;

-- Step 3: Drop the size constraint that references configs.tools before dropping the column
ALTER TABLE configs DROP CONSTRAINT IF EXISTS configs_tools_size;

-- Step 4: Drop the replaced columns (PostgreSQL auto-drops their indexes)
ALTER TABLE configs DROP COLUMN tools;
ALTER TABLE configs DROP COLUMN verified_tools;
ALTER TABLE configs DROP COLUMN has_execution;
