import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGE_SIZE, pageRange, parseListParams, parseStatus } from "./orders.ts";

test("parseStatus acepta solo los estados conocidos", () => {
  assert.equal(parseStatus("entregado"), "entregado");
  assert.equal(parseStatus("ENTREGADO"), null);
  assert.equal(parseStatus("borrado"), null);
  assert.equal(parseStatus(42), null);
});

test("sin parámetros: todos los estados, página 1", () => {
  assert.deepEqual(parseListParams({}), { status: null, page: 1 });
});

test("lee estado y página de la URL", () => {
  assert.deepEqual(parseListParams({ estado: "enviado", pagina: "3" }), { status: "enviado", page: 3 });
});

test("ignora estados que no existen y páginas inválidas", () => {
  assert.deepEqual(parseListParams({ estado: "robado", pagina: "-2" }), { status: null, page: 1 });
  assert.deepEqual(parseListParams({ pagina: "abc" }), { status: null, page: 1 });
  assert.deepEqual(parseListParams({ pagina: "2.5" }), { status: null, page: 1 });
});

test("si el parámetro viene repetido usa el primero", () => {
  assert.deepEqual(parseListParams({ estado: ["pagado", "enviado"] }), { status: "pagado", page: 1 });
});

test("de 50 en 50: rango inclusivo para Supabase", () => {
  assert.equal(PAGE_SIZE, 50);
  assert.deepEqual(pageRange(1), { from: 0, to: 49 });
  assert.deepEqual(pageRange(3), { from: 100, to: 149 });
});
