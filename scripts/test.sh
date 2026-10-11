#!/bin/bash
# Esegue i test unitari (XCTest via `swift test`).
source "$(dirname "$0")/common.sh"
require_macos
cd "$ROOT_DIR"
mkdir -p "$BUILD_DIR"
LOG="$BUILD_DIR/test.log"

if swift test "$@" 2>&1 | tee "$LOG"; then
    rm -f "$LOG"
    ok "Test verdi."
else
    if grep -q "no such module 'XCTest'" "$LOG"; then
        warn "XCTest non disponibile con questa installazione delle Command Line Tools."
        warn "Esegui scripts/doctor.sh e incolla l'output: passeremo a un eseguibile di test dedicato."
    fi
    rm -f "$LOG"
    exit 1
fi
