/*
 * Applies db/script.sql against the configured Postgres database.
 * Uses the `pg` client's simple query protocol, which supports running a
 * multi-statement SQL file in a single call - no `psql` binary required, so
 * this works the same in local dev (Windows), Docker, and on EC2.
 *
 * Run manually: npm run db:migrate
 * Run automatically: docker-entrypoint.sh calls this before starting the app.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const sqlPath = path.join(__dirname, '..', 'db', 'script.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT) || 5432,
    user: process.env.PG_USERNAME,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log(`[migrate] Applying ${sqlPath} to ${process.env.PG_DB}@${process.env.PG_HOST}...`);

  // Several replicas start at once during a deploy and each runs this script.
  // A session-level advisory lock makes them take turns, so concurrent
  // CREATE TABLE IF NOT EXISTS / ALTER TABLE statements can't collide.
  const LOCK_ID = 727274001;
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(sql);
    console.log('[migrate] Done.');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end();
  }
}

main().catch((err) => {
  console.error('[migrate] Failed:', err.message);
  process.exit(1);
});
