# CLAUDE.md — NovaSplit

App macOS menu bar (LSUIElement) che gestisce lo split screen fino a 4 zone, con scenari contestuali
e una "Dynamic Island" flottante integrata con la CLI `claude`. Uso personale, niente App Store,
niente notarizzazione.

## Macchina di destinazione
- MacBook Pro 2017 **Intel**, macOS **13 Ventura**, schermo 60 Hz, **senza notch**.
- Solo **Command Line Tools** (niente Xcode completo, niente `.xcodeproj`).
- Deployment target: macOS 13. API più recenti solo dietro `#available` con fallback.

## Ambiente di sviluppo (importante)
Il codice viene scritto da Claude in un container **Linux senza toolchain Swift né SDK macOS**:
lì non è possibile compilare né eseguire i test. **La fonte di verità è il Mac**: dopo ogni fase
l'utente esegue `scripts/doctor.sh`, `scripts/test.sh`, `scripts/build.sh` e riporta l'output.
Di conseguenza: codice conservativo, niente API "a memoria" non verificate, e ogni dubbio su
Ventura/Intel va segnalato esplicitamente.

## Comandi
| Scopo | Comando |
|---|---|
| Diagnostica toolchain (Swift, SDK, XCTest, firma, CLI claude) | `scripts/doctor.sh` |
| Certificato di firma autofirmato (una volta sola) | `scripts/setup-signing.sh` (guidato) o `--auto` |
| Test unitari | `scripts/test.sh` (= `swift test`) |
| Build release universale + bundle + firma | `scripts/build.sh` → `build/NovaSplit.app` |
| Build debug nativa, riavvio app | `scripts/run.sh` (`--logs` per seguire i log, `--release`) |
| Solo icona | `scripts/make-icon.sh` → `build/AppIcon.icns` |
| Log dell'app | `log stream --level debug --predicate 'subsystem == "com.novasplit.NovaSplit"'` |

Build universale: `build.sh` compila separatamente `x86_64-apple-macosx13.0` e `arm64-apple-macosx13.0`
con `--triple` e unisce con `lipo`. Se arm64 fallisce ripiega su x86_64 e lo segnala.
I warning vengono contati e stampati: l'obiettivo è **zero warning**.

## Struttura
```
Package.swift                 swift-tools-version 5.7, macOS 13
VERSION                       versione marketing (CFBundleShortVersionString); build = n. commit
Resources/
  Info.plist                  template (__VERSION__/__BUILD__ sostituiti da bundle.sh)
  en.lproj, it.lproj          Localizable.strings (NO .xcstrings)
Sources/
  NovaSplitCore/              logica pura, solo Foundation → testabile con `swift test`
    Support/                  AppIdentity (bundle id, subsystem log, lingue)
    Localization/             parser .strings + audit chiavi
    (Layout/, Rules/, Scenes/, AI/ arriveranno nelle prossime fasi)
  NovaSplit/                  eseguibile: AppKit + SwiftUI + Accessibility
    App/                      NovaSplitApp (@main, ciclo di vita SwiftUI) + AppDelegate
    Core/Windows/             AccessibilityPermission (+ wrapper AXUIElement in Fase 1)
    UI/MenuBar/               StatusItemController (NSStatusItem + NSMenu)
    UI/Settings/              finestra impostazioni (NSWindowController + NSHostingController)
    UI/Onboarding/            schermata guidata permesso Accessibilità
    Diagnostics/              Log (os.Logger per categoria)
    Support/                  L10n, AppRelauncher
Tests/NovaSplitCoreTests/     XCTest sulla logica pura
scripts/                      common, doctor, setup-signing, build, bundle, run, test, make-icon
docs/claude-cli-help.txt      `claude --help` registrato (da riverificare sul Mac)
```

Moduli previsti (fasi successive): Core/Layout, Core/Context, Core/Rules, Core/Scenes, UI/SnapOverlay,
UI/Island, UI/Launcher, AI/Claude, Settings, Diagnostics (FPS, signpost).
Regola di divisione: **tutto ciò che è calcolo puro va in `NovaSplitCore`** (testato); in `NovaSplit`
solo l'adattamento a AppKit/AX/Process.

## Convenzioni
- **Compatibilità Swift 5.7**: niente macro (`#Preview`, `@Observable`), niente `if`/`switch` come
  espressioni, niente parameter packs, niente `consume`/`borrowing`. Usare `guard let x = x`
  (non la forma abbreviata) solo per uniformità. `ObservableObject` + `@Published`.
- **Concorrenza**: classi UI/stato `@MainActor`. Nelle closure di NotificationCenter/Timer (che negli
  SDK recenti sono `@Sendable`) catturare `[weak self]`, fare `guard let self = self` e saltare sul main
  actor con `Task { @MainActor in ... }`. Mai lavoro pesante sul main thread: Process, I/O, AX su più
  finestre → task in background.
- **Prestazioni**: nessun polling a riposo (target CPU < 1%). Timer solo quando serve (es. finestra di
  onboarding aperta), sempre con `tolerance`. Il menu si costruisce in `menuNeedsUpdate`.
- **Finestre**: NSWindowController + NSHostingController (non le scene SwiftUI) per controllare
  attivazione e livello. App `.accessory`: chiamare `NSApp.activate(ignoringOtherApps:)` prima di mostrare.
- **Localizzazione**: ogni stringa visibile passa da `L10n.tr("chiave", "fallback inglese")` in
  `Sources/NovaSplit/Support/L10n.swift`. Aggiungere la chiave in **entrambi** i `.lproj`.
  `ProjectLocalizationTests` fallisce se mancano chiavi o le lingue divergono.
- **Risorse**: non usare risorse SwiftPM (`Bundle.module`): il bundle generato finirebbe nella root
  del `.app` e romperebbe `codesign`. Le risorse le copia `scripts/bundle.sh` in `Contents/Resources`.
- **Log**: `Log.<categoria>` (os.Logger). Dati utente con `privacy: .private` (default), metadati `.public`.
- Commenti e messaggi di commit in italiano; identificatori in inglese.

## Firma e permesso Accessibilità
TCC lega il permesso al *designated requirement* della firma. Firma ad-hoc = requirement basato sul
cdhash, che cambia a ogni build → permesso perso. Con il certificato autofirmato
(`NOVASPLIT_SIGN_IDENTITY`, default "NovaSplit Self-Signed", configurabile in `scripts/local.env`)
il requirement è identifier + certificato → stabile. `bundle.sh` usa il certificato se presente,
altrimenti ad-hoc con avviso. Niente hardened runtime, niente sandbox.

## Test
`swift test` con XCTest. Con le sole Command Line Tools XCTest **potrebbe mancare**: `doctor.sh` lo
verifica. Piano B se manca: target eseguibile `NovaSplitCoreChecks` con un mini-framework di asserzioni
(`swift run NovaSplitCoreChecks`), mantenendo i test sulla stessa logica di `NovaSplitCore`.
Si testa solo la logica pura; UI e Accessibility si verificano a mano (checklist per fase).

## CLI `claude` (Fase 5)
Flag verificati con `claude --help` (v2.1.296, vedi `docs/claude-cli-help.txt`); **riverificare sul Mac**:
`-p/--print`, `--output-format stream-json` (richiede `--verbose` con `-p`: da verificare provando),
`--include-partial-messages`, `--model <alias|nome>`, `--json-schema`, `--tools`,
`--no-session-persistence`, `--system-prompt`, `--permission-mode`, `--max-budget-usd`.
Mai inventare flag: provarli prima di usarli.

## Stato delle fasi
- [x] Fase 0 — Setup (repo, package, script, menu bar vuota, onboarding Accessibilità)
- [ ] Fase 1 — Motore finestre e zone
- [ ] Fase 2 — Snap interattivo
- [ ] Fase 3 — Contesto e regole
- [ ] Fase 4 — Dynamic Island (senza AI)
- [ ] Fase 5 — Integrazione Claude via CLI
- [ ] Fase 6 — Launcher e fluidità
- [ ] Fase 7 — Rifinitura e DMG
