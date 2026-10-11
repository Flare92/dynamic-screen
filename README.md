# NovaSplit

Split screen futuristico per macOS 13+: zone fino a 4 finestre, scenari contestuali e una
"Dynamic Island" flottante integrata con Claude (via CLI `claude`). Uso personale.

> Stato: **Fase 0** — app menu bar con impostazioni e schermata guidata per il permesso Accessibilità.
> Guida completa e checklist di test arriveranno con la Fase 7. Dettagli tecnici in [CLAUDE.md](CLAUDE.md).

## Requisiti
- macOS 13 Ventura o successivo, Command Line Tools (`xcode-select --install`).

## Primo avvio
```bash
scripts/doctor.sh          # verifica toolchain, XCTest, firma, CLI claude
scripts/setup-signing.sh   # crea il certificato autofirmato (una volta sola)
scripts/test.sh            # test unitari
scripts/run.sh             # compila, impacchetta, firma e avvia build/NovaSplit.app
```
