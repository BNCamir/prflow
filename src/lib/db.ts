import { neon, NeonQueryFunction } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn("DATABASE_URL is not set. DB operations will fail.");
}

export const sql: NeonQueryFunction<false, false> | null = connectionString
  ? neon(connectionString)
  : null;

export function requireDb(): NeonQueryFunction<false, false> {
  if (!sql) throw new Error("Database not configured (DATABASE_URL)");
  return sql;
}
