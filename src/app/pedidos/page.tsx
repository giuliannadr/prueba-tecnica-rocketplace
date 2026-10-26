import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import {
  listHref,
  ORDER_COLUMNS,
  ORDER_STATUSES,
  pageRange,
  PAGE_SIZE,
  parseListParams,
  STATUS_LABELS,
  type Order,
  type OrderStatus,
} from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import { StatusMenu } from "./status-menu";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const date = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  dateStyle: "short",
  timeStyle: "short",
});
const integer = new Intl.NumberFormat("es-AR");

export default function PedidosPage({ searchParams }: PageProps<"/pedidos">) {
  // Todo depende de la sesión y de la URL, así que se resuelve en cada pedido dentro del Suspense.
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersView searchParams={searchParams} />
    </Suspense>
  );
}

function OrdersSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded bg-[var(--surface)]" />
      <div className="h-9 w-full max-w-xl animate-pulse rounded bg-[var(--surface)]" />
      <div className="h-96 w-full animate-pulse rounded-lg bg-[var(--surface)]" />
    </main>
  );
}

async function OrdersView({ searchParams }: { searchParams: PageProps<"/pedidos">["searchParams"] }) {
  const { status, page } = parseListParams(await searchParams);
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  // No hay filtro por tienda acá a propósito: RLS devuelve solo los pedidos de la tienda del usuario.
  let query = supabase
    .from("orders")
    .select(ORDER_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (status) query = query.eq("status", status);

  const [{ data: userData }, { data: stores }, { data, count, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("stores").select("name"),
    query,
  ]);

  // PostgREST responde PGRST103 si la página pedida queda fuera del total.
  if (error?.code === "PGRST103") redirect(listHref(status));
  if (error) throw new Error(error.message);

  const orders = (data ?? []) as Order[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportHref = status ? `/pedidos/export?estado=${status}` : "/pedidos/export";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{stores?.map((s) => s.name).join(", ") || "Sin tienda asignada"}</h1>
          <p className="text-sm text-[var(--muted)]">{userData.user?.email}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="btn-ghost">
            Salir
          </button>
        </form>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          <StatusLink current={status} value={null} />
          {ORDER_STATUSES.map((s) => (
            <StatusLink key={s} current={status} value={s} />
          ))}
        </nav>
        <a href={exportHref} download className="btn-primary">
          Descargar CSV ({integer.format(total)})
        </a>
      </div>

      <p className="text-sm text-[var(--muted)]" aria-live="polite">
        {integer.format(total)} pedidos{status ? ` ${STATUS_LABELS[status].toLowerCase()}s` : ""}
        {total > 0 && ` · mostrando ${integer.format(from + 1)}–${integer.format(from + orders.length)}`}
      </p>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--line)] p-10 text-center text-[var(--muted)]">
          No hay pedidos con este estado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[var(--surface)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">N.º</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 tabular-nums">{o.number}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{date.format(new Date(o.created_at))}</td>
                  <td className="px-4 py-3">
                    <div className="whitespace-pre-line">{o.customer_name}</div>
                    <div className="text-[var(--muted)]">{o.customer_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusMenu orderId={o.id} number={o.number} status={o.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money.format(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Paginación" className="flex items-center justify-between gap-4 text-sm">
        <PageLink status={status} page={page - 1} disabled={page <= 1}>
          Anterior
        </PageLink>
        <span className="tabular-nums text-[var(--muted)]">
          Página {page} de {totalPages}
        </span>
        <PageLink status={status} page={page + 1} disabled={page >= totalPages}>
          Siguiente
        </PageLink>
      </nav>
    </main>
  );
}

function StatusLink({ current, value }: { current: OrderStatus | null; value: OrderStatus | null }) {
  const active = current === value;
  return (
    <Link href={listHref(value)} aria-current={active ? "page" : undefined} className={active ? "chip chip-active" : "chip"}>
      {value ? STATUS_LABELS[value] : "Todos"}
    </Link>
  );
}

function PageLink({
  status,
  page,
  disabled,
  children,
}: {
  status: OrderStatus | null;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) return <span className="btn-ghost opacity-40">{children}</span>;
  return (
    <Link href={listHref(status, page)} className="btn-ghost">
      {children}
    </Link>
  );
}
