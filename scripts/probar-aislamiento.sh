#!/usr/bin/env bash
# Entra como sur@example.com y le pide a la API de Supabase, sin pasar por la app, los pedidos de Almacén Norte.
# Uso: bash scripts/probar-aislamiento.sh
set -euo pipefail
cd "$(dirname "$0")/.."

URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2-)
KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2-)
json() { node -pe "const d = JSON.parse(require('fs').readFileSync(0, 'utf8')); $1"; }

login() {
  curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"pedidos-demo-2026\"}" | json "d.access_token"
}
api() { curl -s "$URL/rest/v1/$2" -H "apikey: $KEY" -H "Authorization: Bearer $1" "${@:3}"; }

NORTE=$(login norte@example.com)
SUR=$(login sur@example.com)

# Con la sesión de Norte se consiguen el id de su tienda y el de un pedido, para que Sur los pida explícitamente.
NORTE_STORE=$(api "$NORTE" "stores?select=id" | json "d[0].id")
NORTE_ORDER=$(api "$NORTE" "orders?select=id,number&limit=1" | json "d[0].id")

echo "1) Norte ve sus propios pedidos:"
api "$NORTE" "orders?select=number,customer_name&store_id=eq.$NORTE_STORE&limit=3"; echo

echo "2) Sur pide los pedidos de la tienda de Norte ($NORTE_STORE):"
api "$SUR" "orders?select=number,customer_name&store_id=eq.$NORTE_STORE&limit=3"; echo

echo "3) Sur pide un pedido de Norte por su id:"
api "$SUR" "orders?select=number,customer_name&id=eq.$NORTE_ORDER"; echo

echo "4) Sur intenta cambiarle el estado a ese pedido de Norte:"
api "$SUR" "orders?id=eq.$NORTE_ORDER" -X PATCH -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"status":"cancelado"}'; echo

echo "5) Sur intenta cambiar el total de un pedido propio (solo puede tocar el estado):"
SUR_ORDER=$(api "$SUR" "orders?select=id&limit=1" | json "d[0].id")
api "$SUR" "orders?id=eq.$SUR_ORDER" -X PATCH -H "Content-Type: application/json" -d '{"total":1}'; echo
