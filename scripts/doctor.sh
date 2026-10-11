#!/bin/bash
# Diagnostica della toolchain: esegui questo per primo e incolla l'output a Claude.
source "$(dirname "$0")/common.sh"
require_macos
set +e

echo "== Sistema =="
sw_vers
echo "Architettura: $(uname -m)"
echo
echo "== Toolchain =="
echo "xcode-select -p: $(xcode-select -p 2>&1)"
swift --version 2>&1
echo "SDK macOS: $(xcrun --show-sdk-version 2>&1)"
echo "SDK path:  $(xcrun --show-sdk-path 2>&1)"
echo
echo "== XCTest =="
DEV_DIR="$(xcode-select -p 2>/dev/null)"
FOUND=0
for candidate in \
    "$DEV_DIR/Library/Developer/Frameworks/XCTest.framework" \
    "$DEV_DIR/Platforms/MacOSX.platform/Developer/Library/Frameworks/XCTest.framework"; do
    if [[ -d "$candidate" ]]; then echo "Trovato: $candidate"; FOUND=1; fi
done
[[ $FOUND == 1 ]] || echo "XCTest.framework NON trovato: 'swift test' probabilmente fallirà (vedi CLAUDE.md, sezione Test)."
echo
echo "== Cross-compilazione arm64 (per build universale) =="
SDK_PATH="$(xcrun --show-sdk-path 2>/dev/null)"
if [[ -f "$SDK_PATH/usr/lib/libSystem.tbd" ]] && grep -q "arm64" "$SDK_PATH/usr/lib/libSystem.tbd"; then
    echo "L'SDK contiene slice arm64: build universale probabilmente possibile."
else
    echo "Slice arm64 non trovate nell'SDK: build solo x86_64."
fi
echo
echo "== Firma =="
echo "Identità configurata: \"$SIGN_IDENTITY\""
security find-identity -p codesigning 2>&1 | sed 's/^/  /'
if has_sign_identity; then echo "OK: identità trovata."; else echo "Identità non trovata: esegui scripts/setup-signing.sh (altrimenti firma ad-hoc)."; fi
echo
echo "== Claude CLI =="
CLAUDE_BIN="$(command -v claude 2>/dev/null)"
for candidate in "$HOME/.claude/local/claude" /opt/homebrew/bin/claude /usr/local/bin/claude "$HOME/.npm-global/bin/claude"; do
    [[ -z "$CLAUDE_BIN" && -x "$candidate" ]] && CLAUDE_BIN="$candidate"
done
if [[ -n "$CLAUDE_BIN" ]]; then
    echo "Percorso: $CLAUDE_BIN"
    "$CLAUDE_BIN" --version 2>&1
    echo "Flag rilevanti:"
    "$CLAUDE_BIN" --help 2>&1 | grep -E -- "--(print|model|output-format|verbose|include-partial-messages|json-schema|tools|no-session-persistence|system-prompt|permission-mode|max-budget-usd)\b" | sed 's/^/  /'
else
    echo "claude non trovato nel PATH né nei percorsi comuni."
fi
