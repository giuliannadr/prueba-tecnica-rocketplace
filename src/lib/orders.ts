// Reglas del listado de pedidos. No sabe nada de Supabase ni de Next.

export const PAGE_SIZE = 50;

export const ORDER_STATUSES = ["pendiente", "pagado", "enviado", "entregado", "cancelado"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export type Order = {
  id: string;
  number: number;
  customer_name: string;
  customer_email: string;
  status: OrderStatus;
  total: number;
  created_at: string;
};

export const ORDER_COLUMNS = "id, number, customer_name, customer_email, status, total, created_at";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

// Para datos que vienen del cliente (por ejemplo, una server action).
export function parseStatus(value: unknown): OrderStatus | null {
  return isStatus(value) ? value : null;
}

export function parseListParams(params: SearchParams): { status: OrderStatus | null; page: number } {
  const estado = first(params.estado);
  const pagina = first(params.pagina);
  const page = pagina && /^\d+$/.test(pagina) ? Number(pagina) : 1;
  return { status: isStatus(estado) ? estado : null, page: page >= 1 ? page : 1 };
}

// Supabase usa rangos inclusivos: la página 1 es 0..49.
export function pageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}

// Arma la URL del listado conservando el filtro; omite los valores por defecto.
export function listHref(status: OrderStatus | null, page = 1): string {
  const query = new URLSearchParams();
  if (status) query.set("estado", status);
  if (page > 1) query.set("pagina", String(page));
  const qs = query.toString();
  return qs ? `/pedidos?${qs}` : "/pedidos";
}
