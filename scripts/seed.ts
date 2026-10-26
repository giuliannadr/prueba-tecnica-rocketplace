// Datos de prueba: 3 tiendas, un usuario por tienda y miles de pedidos ficticios.
// Se puede correr varias veces: borra lo anterior y vuelve a crear todo.
// Uso: pnpm db:seed (lee DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local)
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { DEMO_PASSWORD, DEMO_STORES } from "./demo-data.ts";

const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DATABASE_URL || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
}

const FIRST_NAMES = ["Sofía", "Martina", "Lucía", "Valentina", "Camila", "Julieta", "Mateo", "Santiago", "Benjamín", "Joaquín", "Tomás", "Agustín", "Florencia", "Nicolás", "Facundo", "Milagros"];
const LAST_NAMES = ["González", "Rodríguez", "Fernández", "López", "Martínez", "Pérez", "Gómez", "Díaz", "Sánchez", "Romero", "Núñez", "Peña", "O'Connor", "D'Alessandro", "Ibáñez", "Acuña"];
// Nombres que suelen romper un CSV: separador, comillas, saltos de línea y fórmulas.
const TRICKY_NAMES = ['Distribuidora "La Unión"', "Pérez; Hnos.", "Kiosco\nEl Pibe", "=1+1 Gómez"];

const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

try {
  // Borra los usuarios de demo que hayan quedado de una corrida anterior.
  const { data: existing, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const demoEmails = new Set(DEMO_STORES.map((s) => s.email));
  for (const user of existing.users.filter((u) => u.email && demoEmails.has(u.email))) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }
  await sql`truncate public.stores cascade`;

  for (const store of DEMO_STORES) {
    const [{ id: storeId }] = await sql<{ id: string }[]>`insert into public.stores (name) values (${store.name}) returning id`;

    const { data, error } = await admin.auth.admin.createUser({
      email: store.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    await sql`insert into public.store_members (user_id, store_id) values (${data.user.id}, ${storeId})`;

    // random() va en el CTE para que se evalúe por fila; el número de pedido sigue el orden de fecha.
    await sql`
      with g as (
        select random() as r_first, random() as r_last, random() as r_status, random() as r_total,
               now() - random() * interval '365 days' as created_at
        from generate_series(1, ${store.orders})
      ), numbered as (
        select *, row_number() over (order by created_at) as n from g
      )
      insert into public.orders (store_id, number, customer_name, customer_email, status, total, created_at)
      select
        ${storeId},
        n,
        (${sql.array(FIRST_NAMES)}::text[])[1 + floor(r_first * ${FIRST_NAMES.length})::int] || ' ' ||
          (${sql.array(LAST_NAMES)}::text[])[1 + floor(r_last * ${LAST_NAMES.length})::int],
        'cliente' || n || '@example.com',
        (case
          when r_status < 0.18 then 'pendiente'
          when r_status < 0.40 then 'pagado'
          when r_status < 0.62 then 'enviado'
          when r_status < 0.92 then 'entregado'
          else 'cancelado'
        end)::public.order_status,
        round((1500 + r_total * 248500)::numeric, 2),
        created_at
      from numbered`;

    for (const [i, name] of TRICKY_NAMES.entries()) {
      await sql`update public.orders set customer_name = ${name} where store_id = ${storeId} and number = ${store.orders - i}`;
    }
    console.log(`${store.name}: ${store.orders} pedidos, usuario ${store.email}`);
  }
  console.log(`contraseña de todos los usuarios: ${DEMO_PASSWORD}`);
} finally {
  await sql.end();
}
