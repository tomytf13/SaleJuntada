#!/usr/bin/env bash
#
# EMPTY DATABASE → WORKING SALE JUNTADA
#
# Demuestra que el proyecto se reconstruye desde una base vacía sin pasos
# manuales ocultos. Corre los diez pasos en orden y falla al primer error.
#
# Uso:
#   DATABASE_URL=postgresql://user:pass@host:port/una_base_vacia \
#     bash scripts/verify-empty-rebuild.sh
#
# La base tiene que estar vacía y NO debe ser la de nadie más: el paso 1
# crea el schema completo. No usa `prisma db push` en ningún momento.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL apuntando a una base vacía." >&2
  exit 1
fi
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

BACK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$BACK/.." && pwd)"
FRONT="$ROOT/sale-juntada-front"
E2E="$ROOT/sale-juntada-e2e"

step() { printf '\n=== %s ===\n' "$1"; }

step "1/10 migrations"
npm --prefix "$BACK" run migrate:deploy

step "2/10 seed"
npm --prefix "$BACK" run prisma:seed

step "3/10 prisma generate"
npm --prefix "$BACK" run prisma:generate

step "4/10 backend lint"
npm --prefix "$BACK" run lint

step "5/10 backend tests"
npm --prefix "$BACK" test

step "6/10 backend build"
npm --prefix "$BACK" run build

step "7/10 frontend lint"
npm --prefix "$FRONT" run lint:ci

step "8/10 frontend tests"
npm --prefix "$FRONT" test

step "9/10 frontend build"
npm --prefix "$FRONT" run build

step "10/10 e2e smoke"
# Los smoke tests interceptan la API con `page.route`; el único caso que
# consulta PostgreSQL de verdad se saltea salvo E2E_REAL_DB=1.
(cd "$E2E" && npx playwright test --project="Desktop Chrome")

printf '\nEMPTY DATABASE -> WORKING SALE JUNTADA: OK\n'
