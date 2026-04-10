#!/bin/bash

load_env_files() {
  local helper_dir repo_root env_file
  helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  repo_root="$(cd "${helper_dir}/.." && pwd)"

  for env_file in \
    "${repo_root}/.env.local" \
    "${repo_root}/.env" \
    "${repo_root}/.env.supabase"
  do
    if [ -f "$env_file" ]; then
      set -a
      # shellcheck disable=SC1090
      source "$env_file"
      set +a
    fi
  done
}

require_env() {
  local var_name="$1"
  local hint="${2:-}"
  local value="${!var_name:-}"

  if [ -n "$value" ]; then
    return 0
  fi

  echo "Missing required environment variable: ${var_name}" >&2
  if [ -n "$hint" ]; then
    echo "  ${hint}" >&2
  fi
  exit 1
}

get_supabase_url() {
  printf '%s' "${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
}

get_supabase_anon_key() {
  printf '%s' "${SUPABASE_ANON_KEY:-${VITE_SUPABASE_PUBLISHABLE_KEY:-}}"
}

get_supabase_project_id() {
  printf '%s' "${SUPABASE_PROJECT_ID:-${VITE_SUPABASE_PROJECT_ID:-}}"
}

get_supabase_service_role_key() {
  printf '%s' "${SUPABASE_SERVICE_ROLE_KEY:-}"
}
