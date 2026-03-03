const { neon } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");

// Load .env.local if present
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL in .env.local or environment");
  process.exit(1);
}

const sql = neon(connectionString);

async function run() {
  const migrationPath = path.join(__dirname, "..", "supabase", "migrations", "001_initial_schema.sql");
  const full = fs.readFileSync(migrationPath, "utf8");
  // Split on semicolon at end of line (statement boundary)
  const statements = full
    .split(/\;\s*\n/)
    .map((s) => s.replace(/^\s*--[^\n]*\n?/gm, "").trim())
    .filter((s) => s.length > 0);

  for (let i = 0; i < statements.length; i++) {
    const q = statements[i] + ";";
    try {
      await sql.query(q, []);
      console.log("OK", i + 1 + "/" + statements.length);
    } catch (err) {
      console.error("Error on statement", i + 1, ":", err.message);
      console.error("Statement preview:", q.slice(0, 200) + "...");
      process.exit(1);
    }
  }
  console.log("Migration complete.");
}

run();
