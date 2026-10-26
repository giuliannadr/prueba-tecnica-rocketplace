// Comprueba contra la base real que cada usuario ve solo su tienda.
// Usa la anon key, igual que la app: si esto pasa, la pantalla no puede mostrar pedidos ajenos.
// Uso: pnpm db:check-rls
import { createClient } from "@supabase/supabase-js";
import { DEMO_PASSWORD, DEMO_STORES } from "./demo-data.ts";

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey } = process.env;
if (!url || !anonKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");

const newClient = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
let failures = 0;
function check(ok: boolean, message: string) {
  console.log(`${ok ? "ok  " : "FALLA"} ${message}`);
  if (!ok) failures++;
}

// Sin sesión no se ve nada (o la base directamente niega el permiso).
{
  const { data, error } = await newClient().from("orders").select("id").limit(1);
  check(!!error || data?.length === 0, `sin sesión no ve pedidos${error ? ` (${error.code})` : ""}`);
}

const sessions: { email: string; db: ReturnType<typeof newClient>; sampleOrder: { id: string; status: string } }[] = [];

for (const store of DEMO_STORES) {
  const db = newClient();
  const { error: loginError } = await db.auth.signInWithPassword({ email: store.email, password: DEMO_PASSWORD });
  if (loginError) throw loginError;

  const { data: stores } = await db.from("stores").select("id, name");
  check(stores?.length === 1 && stores[0].name === store.name, `${store.email} ve solo su tienda (${stores?.map((s) => s.name).join(", ")})`);
  const ownId = stores?.[0]?.id ?? "";

  const { count: total } = await db.from("orders").select("*", { count: "exact", head: true });
  check(total === store.orders, `${store.email} ve ${total} pedidos, esperaba ${store.orders}`);

  // Aunque pida explícitamente pedidos de otras tiendas, la base no se los da.
  const { count: foreign } = await db.from("orders").select("*", { count: "exact", head: true }).neq("store_id", ownId);
  check(foreign === 0, `${store.email} pidiendo otras tiendas recibe ${foreign} pedidos`);

  const { data: updated, error: updateError } = await db.from("orders").update({ total: 0 }).eq("store_id", ownId).select("id");
  check(!!updateError || updated?.length === 0, `${store.email} no puede cambiar el total${updateError ? ` (${updateError.code})` : ""}`);

  const { data: sample } = await db.from("orders").select("id, status").limit(1).single();
  if (!sample) throw new Error(`${store.email} no tiene pedidos para probar la edición`);
  sessions.push({ email: store.email, db, sampleOrder: sample });
}

// Edición de estado: la propia sí, la ajena no (aunque se conozca el id del pedido).
for (const [i, { email, db, sampleOrder }] of sessions.entries()) {
  const next = sampleOrder.status === "cancelado" ? "pendiente" : "cancelado";
  const { data: own } = await db.from("orders").update({ status: next }).eq("id", sampleOrder.id).select("status");
  check(own?.length === 1 && own[0].status === next, `${email} cambia el estado de un pedido propio`);
  await db.from("orders").update({ status: sampleOrder.status }).eq("id", sampleOrder.id);

  const foreign = sessions[(i + 1) % sessions.length];
  const { data: other, error: otherError } = await db.from("orders").update({ status: next }).eq("id", foreign.sampleOrder.id).select("id");
  check(!!otherError || other?.length === 0, `${email} no puede cambiar un pedido de ${foreign.email} (${other?.length ?? 0} filas)`);
}

if (failures) {
  console.error(`\n${failures} comprobaciones fallaron`);
  process.exit(1);
}
console.log("\nRLS ok: cada usuario ve solo los pedidos de su tienda");
