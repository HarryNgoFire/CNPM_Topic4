import { config } from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running migrations.');
  await client.connect();
  const table = await client.query("SELECT to_regclass('public._prisma_migrations') AS name");
  if (table.rows[0].name) {
    const legacy = await client.query(
      'SELECT 1 FROM public._prisma_migrations WHERE migration_name = $1 AND rolled_back_at IS NULL LIMIT 1',
      ['202610110001_m2_baseline'],
    );
    if (legacy.rowCount) throw new Error(
      'M2_LEGACY_BASELINE: This database has the old M2 baseline. The M3 migration series cannot be deployed directly. No data has been changed. Back up and follow docs/m2/M3_INTEGRATION.md; recreate only a disposable demo/test database.',
    );
  }
  console.log('Migration history compatible with the M3 series.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
