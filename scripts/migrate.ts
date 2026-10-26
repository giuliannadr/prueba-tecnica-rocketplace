// Aplica en orden los .sql de supabase/migrations que todavía no corrieron.
// Uso: pnpm db:migrate (lee DATABASE_URL de .env.local)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL en .env.local");

const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = join(import.meta.dirname, "..", "supabase", "migrations");

try {
  await sql`create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())`;
  // Está en public, así que se cierra para que la API no la exponga.
  await sql`alter table public._migrations enable row level security`;
  await sql`revoke all on public._migrations from anon, authenticated`;
  const applied = new Set((await sql<{ name: string }[]>`select name from public._migrations`).map((r) => r.name));

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(dir, file), "utf8"));
      await tx`insert into public._migrations (name) values (${file})`;
    });
    console.log(`aplicada ${file}`);
  }
  console.log("migraciones al día");
} finally {
  await sql.end();
}
