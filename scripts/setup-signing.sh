#!/bin/bash
# Crea (o verifica) il certificato autofirmato usato per firmare NovaSplit.
#
# Perché: con la firma ad-hoc l'identità del codice cambia a ogni build e macOS "dimentica"
# il permesso Accessibilità. Con un certificato stabile il permesso resta valido tra le build.
#
# Uso:
#   scripts/setup-signing.sh            guida passo-passo con Accesso Portachiavi + verifica
#   scripts/setup-signing.sh --auto     crea il certificato da terminale (openssl + security)
#   scripts/setup-signing.sh --check    verifica soltanto
# Nome del certificato: NOVASPLIT_SIGN_IDENTITY (default "NovaSplit Self-Signed"), anche in scripts/local.env.
source "$(dirname "$0")/common.sh"
require_macos

MODE="${1:-guide}"

check() {
    if has_sign_identity; then
        ok "Identità di firma \"$SIGN_IDENTITY\" trovata nel portachiavi."
        # Prova di firma su un file temporaneo: conferma che codesign può usare la chiave.
        local tmp; tmp="$(mktemp -d)"
        cp /usr/bin/true "$tmp/novasplit-signtest"
        if codesign --force --sign "$SIGN_IDENTITY" "$tmp/novasplit-signtest" 2>"$tmp/err"; then
            ok "codesign funziona con questo certificato."
        else
            warn "codesign non riesce a usare il certificato:"; cat "$tmp/err" >&2
            warn "Se compare una richiesta del portachiavi, scegli \"Consenti sempre\" e riprova."
        fi
        rm -rf "$tmp"
        return 0
    fi
    warn "Identità \"$SIGN_IDENTITY\" non trovata. Le build useranno la firma ad-hoc (permesso Accessibilità da ridare a ogni build)."
    return 1
}

auto_create() {
    has_sign_identity && { ok "Esiste già."; return 0; }
    local tmp; tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' RETURN
    local pass="novasplit-$RANDOM$RANDOM"
    cat > "$tmp/cert.cnf" <<CNF
[ req ]
distinguished_name = dn
x509_extensions = ext
prompt = no
[ dn ]
CN = $SIGN_IDENTITY
[ ext ]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
CNF
    info "Genero chiave e certificato (validità 10 anni)…"
    # /usr/bin/openssl (LibreSSL) produce un .p12 importabile da `security` senza flag legacy.
    /usr/bin/openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
        -keyout "$tmp/key.pem" -out "$tmp/cert.pem" -config "$tmp/cert.cnf" >/dev/null 2>&1 \
        || fail "openssl req non riuscito"
    /usr/bin/openssl pkcs12 -export -inkey "$tmp/key.pem" -in "$tmp/cert.pem" \
        -name "$SIGN_IDENTITY" -out "$tmp/cert.p12" -passout "pass:$pass" >/dev/null 2>&1 \
        || fail "openssl pkcs12 non riuscito"
    info "Importo nel portachiavi login (codesign autorizzato a usare la chiave)…"
    security import "$tmp/cert.p12" -k "$HOME/Library/Keychains/login.keychain-db" \
        -P "$pass" -T /usr/bin/codesign >/dev/null || fail "security import non riuscito"
    ok "Certificato \"$SIGN_IDENTITY\" creato."
}

guide() {
    cat <<GUIDE

Creazione del certificato con Accesso Portachiavi (circa 1 minuto):

  1. Apri "Accesso Portachiavi" (Applicazioni → Utility).
  2. Menu Accesso Portachiavi → Assistente Certificato → Crea un certificato…
  3. Nome:               $SIGN_IDENTITY
     Tipo di identità:   Radice autofirmata
     Tipo di certificato: Firma codice
     (lascia deselezionato "Lasciami sostituire le impostazioni predefinite")
  4. Crea → Continua → Fine. Deve finire nel portachiavi "login".

In alternativa, senza interfaccia:  scripts/setup-signing.sh --auto

GUIDE
    read -r -p "Premi Invio quando hai finito per verificare… " _
}

case "$MODE" in
    --check) check ;;
    --auto)  auto_create; check ;;
    *)       has_sign_identity || guide; check ;;
esac
