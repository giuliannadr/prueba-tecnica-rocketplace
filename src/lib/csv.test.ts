import assert from "node:assert/strict";
import { test } from "node:test";
import { csvField, csvRow, formatCsvAmount, formatCsvDate } from "./csv.ts";

test("separa con punto y coma y termina en CRLF, como espera Excel en español", () => {
  assert.equal(csvRow(["1", "Ana", "Pendiente"]), "1;Ana;Pendiente\r\n");
});

test("entrecomilla los campos con separador, comillas o saltos de línea", () => {
  assert.equal(csvField("Pérez; Hnos."), '"Pérez; Hnos."');
  assert.equal(csvField('Distribuidora "La Unión"'), '"Distribuidora ""La Unión"""');
  assert.equal(csvField("Kiosco\nEl Pibe"), '"Kiosco\nEl Pibe"');
  assert.equal(csvField("Sofía Núñez"), "Sofía Núñez");
});

test("neutraliza textos que Excel ejecutaría como fórmula", () => {
  assert.equal(csvField("=1+1 Gómez"), "'=1+1 Gómez");
  assert.equal(csvField("+54 11"), "'+54 11");
  assert.equal(csvField("@usuario"), "'@usuario");
});

test("montos con coma decimal y sin separador de miles", () => {
  assert.equal(formatCsvAmount(1234.5), "1234,50");
  assert.equal(formatCsvAmount(250000), "250000,00");
  assert.equal(formatCsvAmount("99.99"), "99,99");
});

test("fechas dd/mm/aaaa hh:mm en hora de Buenos Aires", () => {
  // 03:30 UTC del 2 de enero = 00:30 del 2 de enero en Argentina (UTC-3).
  assert.equal(formatCsvDate("2026-01-02T03:30:00Z"), "02/01/2026 00:30");
  // 01:00 UTC del 1 de marzo = 22:00 del 28 de febrero en Argentina.
  assert.equal(formatCsvDate("2026-03-01T01:00:00+00:00"), "28/02/2026 22:00");
});
