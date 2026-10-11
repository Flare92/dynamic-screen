#!/bin/bash
# Genera build/AppIcon.icns a partire da scripts/icon/GenerateIcon.swift.
source "$(dirname "$0")/common.sh"
require_macos

ICONSET="$BUILD_DIR/AppIcon.iconset"
ICNS="$BUILD_DIR/AppIcon.icns"
mkdir -p "$BUILD_DIR"
rm -rf "$ICONSET"

info "Disegno l'icona…"
swift "$ROOT_DIR/scripts/icon/GenerateIcon.swift" "$ICONSET"
iconutil --convert icns --output "$ICNS" "$ICONSET"
rm -rf "$ICONSET"
ok "Icona: $ICNS"
