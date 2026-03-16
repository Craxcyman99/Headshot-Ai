#!/usr/bin/env bash
# ============================================================
# Headshot AI — Supabase Setup Script
# ============================================================
#
# Prerequisites:
#   1. Create a Supabase project at https://supabase.com
#   2. Set the following env vars in .env.local:
#
#      NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
#      NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
#      SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
#
#   3. Install Supabase CLI: npm i -g supabase
#      OR use the SQL Editor in the Supabase Dashboard.
#
# Usage:
#   Option A — Run migration via Supabase CLI (local dev):
#     supabase db reset   # applies all migrations in supabase/migrations/
#
#   Option B — Run migration via Dashboard:
#     Paste the contents of supabase/migrations/001_initial_schema.sql
#     into the SQL Editor at:
#     https://supabase.com/dashboard/project/<project-ref>/sql
#
#   Option C — Run this script against a live database:
#     export DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
#     ./scripts/setup-supabase.sh
#
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/001_initial_schema.sql"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL not set."
  echo ""
  echo "Set it to your Supabase Postgres connection string:"
  echo "  export DATABASE_URL=\"postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres\""
  echo ""
  echo "Or use one of the alternative methods described at the top of this script."
  exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "🚀 Running initial migration..."
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

echo ""
echo "✅ Migration complete. Tables, RLS policies, and storage buckets created."
echo ""
echo "Next steps:"
echo "  1. Verify tables in Supabase Dashboard → Table Editor"
echo "  2. Verify storage buckets in Supabase Dashboard → Storage"
echo "  3. Configure Supabase Auth providers (Email magic link, Google, etc.)"
echo "  4. Set redirect URLs in Auth → URL Configuration"
