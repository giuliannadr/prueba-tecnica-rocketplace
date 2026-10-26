-- Pedidos multitienda: varias tiendas en la misma base.
-- El aislamiento por tienda lo hace RLS: la app nunca filtra por store_id a mano.

create type public.order_status as enum ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Qué usuario pertenece a qué tienda. Hoy es una por usuario, pero el modelo admite varias.
create table public.store_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  primary key (user_id, store_id)
);
create index store_members_store_idx on public.store_members (store_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  number integer not null,
  customer_name text not null,
  customer_email text not null,
  status public.order_status not null,
  total numeric(12, 2) not null check (total >= 0),
  created_at timestamptz not null default now(),
  unique (store_id, number)
);
-- El listado siempre es "pedidos de mi tienda, opcionalmente por estado, del más nuevo al más viejo".
create index orders_store_created_idx on public.orders (store_id, created_at desc, id desc);
create index orders_store_status_created_idx on public.orders (store_id, status, created_at desc, id desc);

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.orders enable row level security;

-- (select auth.uid()) se evalúa una vez por consulta y no una vez por fila.
create policy "ver mis membresías" on public.store_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "ver mis tiendas" on public.stores
  for select to authenticated
  using (id in (select store_id from public.store_members where user_id = (select auth.uid())));

create policy "ver pedidos de mis tiendas" on public.orders
  for select to authenticated
  using (store_id in (select store_id from public.store_members where user_id = (select auth.uid())));

-- Sin políticas de insert/update/delete: desde la API nadie escribe.
-- Además se cierran los permisos de tabla, así un error en una política no abre la escritura.
revoke all on public.stores, public.store_members, public.orders from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.stores, public.store_members, public.orders to authenticated;
