import Database, { type Database as DatabaseType } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import path from "path";
import fs from "fs";

// Ensure data directory exists
const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database file path
const dbPath = process.env.DATABASE_URL || path.join(dataDir, "tahfidz.db");

// Create SQLite connection
const sqlite: DatabaseType = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

// Export for direct SQLite access if needed
export { sqlite };

// Export schema for convenience
export * from "./schema.js";
