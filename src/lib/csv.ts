// CSV pensado para abrirse con doble clic en un Excel configurado en español:
// BOM para que lea UTF-8 (acentos y ñ), punto y coma como separador, coma decimal y CRLF.

export const CSV_BOM = "﻿";
const SEPARATOR = ";";

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function csvField(value: string): string {
  // Excel ejecuta como fórmula lo que empieza con = + - @ (inyección de CSV).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function csvRow(values: string[]): string {
  return values.map(csvField).join(SEPARATOR) + "\r\n";
}

export function formatCsvAmount(value: number | string): string {
  return Number(value).toFixed(2).replace(".", ",");
}

export function formatCsvDate(iso: string): string {
  const parts = Object.fromEntries(dateFormat.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
