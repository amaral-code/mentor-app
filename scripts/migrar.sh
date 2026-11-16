#!/usr/bin/env bash
# Aplica as migrations de supabase/migrations em um ambiente.
#
#   bash scripts/migrar.sh local       # Supabase local (npx supabase start)
#   bash scripts/migrar.sh staging     # precisa de SUPABASE_STAGING_REF
#   bash scripts/migrar.sh production  # precisa de SUPABASE_PROD_REF + confirmação
#
# Usa o Supabase CLI, que registra o que já foi aplicado em
# supabase_migrations.schema_migrations. Num banco que já recebeu as
# migrations à mão (SQL Editor), marque-as como aplicadas uma vez antes:
#   npx supabase migration repair --status applied 001 003 004 ... 021
set -euo pipefail

AMBIENTE="${1:-}"
CLI="npx --yes supabase@2"

case "$AMBIENTE" in
  local)
    $CLI migration up --local
    ;;
  staging)
    : "${SUPABASE_STAGING_REF:?Defina SUPABASE_STAGING_REF (ID do projeto de staging)}"
    $CLI link --project-ref "$SUPABASE_STAGING_REF"
    $CLI db push
    ;;
  production)
    : "${SUPABASE_PROD_REF:?Defina SUPABASE_PROD_REF (ID do projeto de produção)}"
    echo "Você vai aplicar migrations em PRODUÇÃO ($SUPABASE_PROD_REF)."
    echo "Elas já foram testadas em staging? Digite 'producao' para continuar:"
    read -r confirmacao
    [ "$confirmacao" = "producao" ] || { echo "Cancelado."; exit 1; }
    $CLI link --project-ref "$SUPABASE_PROD_REF"
    $CLI db push
    ;;
  *)
    echo "Uso: bash scripts/migrar.sh <local|staging|production>" >&2
    exit 1
    ;;
esac
