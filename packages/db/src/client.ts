import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. The database client is only available when DATABASE_URL is configured.",
    );
  }

  _sql = postgres(url);
  _db = drizzle(_sql, { schema });
  return _db;
}

export type Database = ReturnType<typeof getDb>;
