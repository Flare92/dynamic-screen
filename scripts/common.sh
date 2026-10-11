#!/bin/bash
# Variabili condivise dagli script. Personalizzazioni locali in scripts/local.env (ignorato da git), es.:
#   NOVASPLIT_SIGN_IDENTITY="Il Mio Certificato"
set -eo pipefail  # niente -u: con bash 3.2 (default su macOS) "$@" vuoto darebbe errore

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT_DIR/scripts/local.env" ]]; then
    # shellcheck disable=SC1091
    source "$ROOT_DIR/scripts/local.env"
fi

APP_NAME="NovaSplit"
BUNDLE_ID="com.novasplit.NovaSplit"
SIGN_IDENTITY="${NOVASPLIT_SIGN_IDENTITY:-NovaSplit Self-Signed}"
BUILD_DIR="$ROOT_DIR/build"
APP_PATH="$BUILD_DIR/$APP_NAME.app"
VERSION="$(tr -d '[:space:]' < "$ROOT_DIR/VERSION")"

info()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
fail()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

require_macos() {
    [[ "$(uname -s)" == "Darwin" ]] || fail "Questo script va eseguito su macOS."
}

# Vero se nel portachiavi esiste un'identità di firma codice con il nome configurato.
# Niente -v: un certificato autofirmato non è "trusted" ma codesign lo usa comunque.
has_sign_identity() {
    security find-identity -p codesigning 2>/dev/null | grep -F "\"$SIGN_IDENTITY\"" >/dev/null
}
