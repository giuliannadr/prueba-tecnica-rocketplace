import type { NextRequest } from "next/server";
import { CSV_BOM, csvRow, formatCsvAmount, formatCsvDate } from "@/lib/csv";
import { ORDER_COLUMNS, parseListParams, STATUS_LABELS, type Order } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

// Supabase corta cada respuesta en 1000 filas (max_rows). Se pide de a lotes hasta que
// llegue uno vacío: cortar cuando "vienen menos de 1000" fallaría si max_rows fuese menor.
const BATCH_SIZE = 1000;

export async function GET(request: NextRequest) {
  const { status } = parseListParams(Object.fromEntries(request.nextUrl.searchParams));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Necesitás iniciar sesión", { status: 401 });

  const encoder = new TextEncoder();
  let offset = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(CSV_BOM + csvRow(["Número", "Fecha", "Cliente", "Email", "Estado", "Total"])));
    },
    async pull(controller) {
      // Mismo orden que el listado, con id para desempatar y que los lotes no se pisen.
      let query = supabase
        .from("orders")
        .select(ORDER_COLUMNS)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      // Si falla a mitad de camino, la descarga se corta con error en vez de dejar un archivo incompleto que parece bueno.
      if (error) return controller.error(new Error(error.message));
      if (!data.length) return controller.close();

      offset += data.length;
      const rows = (data as Order[]).map((o) =>
        csvRow([
          String(o.number),
          formatCsvDate(o.created_at),
          o.customer_name,
          o.customer_email,
          STATUS_LABELS[o.status],
          formatCsvAmount(o.total),
        ]),
      );
      controller.enqueue(encoder.encode(rows.join("")));
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-${status ?? "todos"}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
