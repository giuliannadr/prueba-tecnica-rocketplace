"use server";

import { refresh } from "next/cache";
import { parseStatus } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export type UpdateStatusResult = { error: string | null };

// No chequea la tienda acá: RLS solo deja actualizar pedidos propios y el permiso de columna solo deja tocar status.
export async function updateOrderStatus(orderId: string, rawStatus: string): Promise<UpdateStatusResult> {
  const status = parseStatus(rawStatus);
  if (!status) return { error: "Ese estado no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").update({ status }).eq("id", orderId).select("id");
  if (error) return { error: "No se pudo cambiar el estado. Probá de nuevo." };
  // Sin filas: el pedido no existe o es de otra tienda. RLS no distingue entre las dos cosas, y está bien.
  if (!data.length) return { error: "No encontramos ese pedido en tu tienda." };

  refresh();
  return { error: null };
}
