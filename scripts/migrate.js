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

  try {
    await client.query(sql);
    console.log('[migrate] Done.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[migrate] Failed:', err.message);
  process.exit(1);
});
