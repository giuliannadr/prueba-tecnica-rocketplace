# Pedidos multitienda

Listado de pedidos de varias tiendas en la misma base. Cada usuario ve y edita solo los pedidos de su tienda, y eso lo garantiza Postgres con RLS, no la pantalla.

- Listado de 50 en 50, con filtro por estado y página en la URL (`/pedidos?estado=pendiente&pagina=2`).
- Descarga CSV del conjunto filtrado entero, lista para abrir con doble clic en un Excel en español.
- Cambio de estado de cada pedido (solo el estado, solo de la propia tienda).
- Datos de prueba generados por script: 3 tiendas, un usuario por tienda, 8.064 pedidos ficticios.

**Stack:** Next.js 16 (App Router), TypeScript, Tailwind 4, Supabase (Postgres + Auth).

## Cómo correrlo

```bash
pnpm install
cp .env.example .env.local   # completar con los datos del proyecto de Supabase
pnpm db:migrate              # crea tablas, índices y políticas RLS
pnpm db:seed                 # tiendas, usuarios y pedidos de prueba
pnpm dev
```

Usuarios de prueba (contraseña `pedidos-demo-2026`): `norte@example.com`, `sur@example.com`, `oeste@example.com`.

## Cómo comprobar el aislamiento

```bash
pnpm db:check-rls                    # 19 comprobaciones con la anon key, como la app
bash scripts/probar-aislamiento.sh   # Sur pide a la API de Supabase, sin la app, los pedidos de Norte
pnpm test                            # lógica de dominio (CSV, parámetros de la URL)
```

## Decisiones

- **Aislamiento en la base.** `orders`, `stores` y `store_members` tienen RLS con `auth.uid()`. La app usa solo la anon key con la sesión del usuario y nunca filtra por `store_id` a mano. La service role key solo la usa `scripts/seed.ts`.
- **Escritura mínima.** `authenticated` tiene `select` y `update (status)` sobre `orders`: aunque una política falle, no puede tocar el total, la tienda ni el cliente. `anon` no tiene permisos.
- **CSV para Excel en español.** UTF-8 con BOM, `;` como separador, coma decimal, fechas `dd/mm/aaaa hh:mm` (hora de Buenos Aires), CRLF, campos con comillas escapadas y textos que empiezan con `= + - @` neutralizados contra inyección de fórmulas.
- **CSV completo.** Supabase devuelve como máximo 1000 filas por pedido: el export lee de a lotes hasta recibir uno vacío y lo envía en streaming. Si un lote falla, la descarga se corta con error en lugar de entregar un archivo incompleto.
- **Paginación por offset.** Alcanza para miles de pedidos por tienda; con cientos de miles convendría paginar por cursor.
- **Sin reglas de transición.** Cualquier estado puede pasar a cualquier otro y no se guarda historial de cambios.

## Estructura

```
supabase/migrations/   SQL: tablas, índices, RLS y permisos
scripts/               migrate, seed, check-rls, probar-aislamiento
src/lib/               dominio puro (orders, csv) + cliente de Supabase
src/app/pedidos/       listado, export CSV, menú de estado y acción
src/proxy.ts           refresca la sesión y redirige al login (comodidad, no seguridad)
```
