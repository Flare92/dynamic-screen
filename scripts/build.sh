#!/bin/bash
# Build release + bundle + firma.
# Prova la build universale (arm64 + x86_64: compila le due architetture separatamente e le unisce con lipo);
# se la toolchain non riesce a produrre arm64, ripiega su x86_64 e lo segnala.
# Uso: scripts/build.sh [--debug] [--native]
source "$(dirname "$0")/common.sh"
require_macos

CONFIG=release
NATIVE_ONLY=0
for arg in "$@"; do
    case "$arg" in
        --debug)  CONFIG=debug ;;
        --native) NATIVE_ONLY=1 ;;
        *) fail "Argomento sconosciuto: $arg" ;;
    esac
done

cd "$ROOT_DIR"
LOG_DIR="$BUILD_DIR/logs"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

# --triple funziona con il build system nativo di SwiftPM (--arch richiederebbe XCBuild, assente nelle CLT).
triple() { echo "$1-apple-macosx13.0"; }

build_arch() {
    local arch="$1"
    info "swift build -c $CONFIG --triple $(triple "$arch")"
    swift build -c "$CONFIG" --triple "$(triple "$arch")" 2>&1 | tee "$LOG_DIR/build-$arch.log"
    return "${PIPESTATUS[0]}"
}

bin_path() {
    swift build -c "$CONFIG" --triple "$(triple "$1")" --show-bin-path
}

HOST_ARCH="$(uname -m)"
ARCHS=("$HOST_ARCH")
if [[ $NATIVE_ONLY == 0 ]]; then
    OTHER_ARCH=arm64; [[ "$HOST_ARCH" == arm64 ]] && OTHER_ARCH=x86_64
    ARCHS+=("$OTHER_ARCH")
fi

build_arch "$HOST_ARCH" || fail "Build $HOST_ARCH fallita (log: $LOG_DIR/build-$HOST_ARCH.log)"
BINARIES=("$(bin_path "$HOST_ARCH")/$APP_NAME")

if [[ ${#ARCHS[@]} -gt 1 ]]; then
    if build_arch "${ARCHS[1]}"; then
        BINARIES+=("$(bin_path "${ARCHS[1]}")/$APP_NAME")
    else
        warn "Build ${ARCHS[1]} non riuscita con questa toolchain: procedo solo con $HOST_ARCH."
    fi
fi

WARNINGS="$(cat "$LOG_DIR"/build-*.log | grep -c "warning:" || true)"
if [[ "$WARNINGS" != "0" ]]; then
    warn "La build ha prodotto $WARNINGS warning (dettagli in $LOG_DIR):"
    cat "$LOG_DIR"/build-*.log | grep "warning:" | sort -u >&2
fi

OUTPUT_BIN="$BUILD_DIR/$APP_NAME"
if [[ ${#BINARIES[@]} -gt 1 ]]; then
    lipo -create "${BINARIES[@]}" -output "$OUTPUT_BIN"
else
    cp "${BINARIES[0]}" "$OUTPUT_BIN"
fi
ok "Eseguibile: $(lipo -archs "$OUTPUT_BIN") ($CONFIG)"

"$ROOT_DIR/scripts/bundle.sh" "$OUTPUT_BIN"
