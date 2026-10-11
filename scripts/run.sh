#!/bin/bash
# Compila (solo architettura nativa, più veloce), chiude l'istanza in esecuzione e avvia il bundle.
# Uso: scripts/run.sh [--release] [--logs]
#   --logs  dopo l'avvio segue i log dell'app (Ctrl+C per uscire; l'app resta aperta)
source "$(dirname "$0")/common.sh"
require_macos

BUILD_ARGS=(--native --debug)
FOLLOW_LOGS=0
for arg in "$@"; do
    case "$arg" in
        --release) BUILD_ARGS=(--native) ;;
        --logs)    FOLLOW_LOGS=1 ;;
        *) fail "Argomento sconosciuto: $arg" ;;
    esac
done

"$ROOT_DIR/scripts/build.sh" "${BUILD_ARGS[@]}"

if pgrep -x "$APP_NAME" >/dev/null; then
    info "Chiudo l'istanza in esecuzione"
    pkill -x "$APP_NAME" || true
    sleep 0.5
fi

info "Avvio $APP_PATH"
open "$APP_PATH"

if [[ $FOLLOW_LOGS == 1 ]]; then
    log stream --level debug --style compact --predicate "subsystem == \"$BUNDLE_ID\""
fi
