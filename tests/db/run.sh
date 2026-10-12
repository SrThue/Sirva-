#!/usr/bin/env bash
# Uso: DATABASE_URL=postgres://... tests/db/run.sh   (banco descartável!)
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?defina DATABASE_URL de um banco descartável}"
psql() { command psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }
psql -c "drop schema if exists public cascade; drop schema if exists auth cascade; drop schema if exists storage cascade; create schema public;"
psql -f tests/db/00_stub_supabase.sql
for f in supabase/migrations/*.sql; do psql -f "$f"; done
psql -f tests/db/rls.test.sql
