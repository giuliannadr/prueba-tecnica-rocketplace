-- Cada tienda puede cambiar el estado de sus propios pedidos, y nada más.

-- Permiso de columna: desde la API solo se puede escribir status (ni total, ni store_id, ni cliente).
grant update (status) on public.orders to authenticated;

-- using: qué filas puede tocar. with check: cómo tienen que quedar (siguen siendo de su tienda).
create policy "cambiar estado de pedidos de mis tiendas" on public.orders
  for update to authenticated
  using (store_id in (select store_id from public.store_members where user_id = (select auth.uid())))
  with check (store_id in (select store_id from public.store_members where user_id = (select auth.uid())));
