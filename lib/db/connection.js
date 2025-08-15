import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import * as schema from "./schema.js";
import "dotenv/config";

const { Pool } = pkg;

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Create Drizzle instance
export const db = drizzle(pool, { schema });

// Test database connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT version()");
    console.log("✅ PostgreSQL connected:", result.rows[0].version);
    client.release();
    return true;
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error.message);
    return false;
  }
}

// Close database connection
export async function closeConnection() {
  await pool.end();
}