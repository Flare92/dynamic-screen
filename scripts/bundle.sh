#!/bin/bash
# Assembla build/NovaSplit.app da un eseguibile già compilato e lo firma.
# Uso: scripts/bundle.sh <percorso-eseguibile>
source "$(dirname "$0")/common.sh"
require_macos

BINARY="${1:-}"
[[ -n "$BINARY" && -x "$BINARY" ]] || fail "Uso: scripts/bundle.sh <percorso-eseguibile>"

BUILD_NUMBER="$(git -C "$ROOT_DIR" rev-list --count HEAD 2>/dev/null || echo 1)"

info "Creo $APP_PATH (versione $VERSION, build $BUILD_NUMBER)"
rm -rf "$APP_PATH"
mkdir -p "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Resources"

cp "$BINARY" "$APP_PATH/Contents/MacOS/$APP_NAME"
sed -e "s/__VERSION__/$VERSION/" -e "s/__BUILD__/$BUILD_NUMBER/" \
    "$ROOT_DIR/Resources/Info.plist" > "$APP_PATH/Contents/Info.plist"
plutil -lint "$APP_PATH/Contents/Info.plist" >/dev/null || fail "Info.plist non valido"
printf 'APPL????' > "$APP_PATH/Contents/PkgInfo"

# Localizzazioni: Resources/<lingua>.lproj → Contents/Resources/<lingua>.lproj
for lproj in "$ROOT_DIR"/Resources/*.lproj; do
    name="$(basename "$lproj")"
    mkdir -p "$APP_PATH/Contents/Resources/$name"
    for strings in "$lproj"/*.strings; do
        plutil -lint "$strings" >/dev/null || fail "File .strings non valido: $strings"
        cp "$strings" "$APP_PATH/Contents/Resources/$name/"
    done
done

# Icona: rigenerata solo se manca o se il generatore è più recente.
if [[ ! -f "$BUILD_DIR/AppIcon.icns" || "$ROOT_DIR/scripts/icon/GenerateIcon.swift" -nt "$BUILD_DIR/AppIcon.icns" ]]; then
    "$ROOT_DIR/scripts/make-icon.sh"
fi
cp "$BUILD_DIR/AppIcon.icns" "$APP_PATH/Contents/Resources/AppIcon.icns"

# Firma: certificato autofirmato stabile se presente, altrimenti ad-hoc.
if has_sign_identity; then
    info "Firmo con \"$SIGN_IDENTITY\""
    codesign --force --sign "$SIGN_IDENTITY" --identifier "$BUNDLE_ID" --timestamp=none "$APP_PATH"
else
    warn "Certificato \"$SIGN_IDENTITY\" assente: firma ad-hoc."
    warn "Il permesso Accessibilità andrà ridato dopo ogni build. Rimedio: scripts/setup-signing.sh"
    codesign --force --sign - --identifier "$BUNDLE_ID" "$APP_PATH"
fi
codesign --verify --strict "$APP_PATH" || fail "Verifica della firma fallita"
ok "Bundle pronto: $APP_PATH"
codesign -dvv "$APP_PATH" 2>&1 | grep -E "^(Identifier|Authority|Signature)" | sed 's/^/    /' || true
