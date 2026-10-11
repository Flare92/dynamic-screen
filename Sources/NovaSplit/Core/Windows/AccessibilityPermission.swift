import AppKit
import ApplicationServices
import Combine

/// Stato del permesso Accessibilità (TCC) per questo processo.
///
/// Controllo a basso costo: niente polling a riposo. Si ricontrolla
/// - quando l'app torna attiva,
/// - alla notifica distribuita `com.apple.accessibility.api` (inviata quando cambia la lista TCC),
/// - con un timer leggero SOLO mentre la schermata guidata è aperta (`beginWatching`/`endWatching`).
@MainActor
final class AccessibilityPermission: ObservableObject {
    static let shared = AccessibilityPermission()

    @Published private(set) var isTrusted: Bool = AXIsProcessTrusted()

    private var watchers = 0
    private var timer: Timer?
    private var observers: [NSObjectProtocol] = []

    private init() {
        let center = NSWorkspace.shared.notificationCenter
        observers.append(center.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main
        ) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in self.refresh() }
        })
        observers.append(DistributedNotificationCenter.default().addObserver(
            forName: NSNotification.Name("com.apple.accessibility.api"), object: nil, queue: .main
        ) { [weak self] _ in
            guard let self = self else { return }
            // La lista TCC viene aggiornata subito dopo la notifica: ricontrolla con un piccolo ritardo.
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 300_000_000)
                self.refresh()
            }
        })
    }

    func refresh() {
        let trusted = AXIsProcessTrusted()
        if trusted != isTrusted {
            Log.permissions.info("Accessibility trusted changed: \(trusted, privacy: .public)")
            isTrusted = trusted
        }
        if trusted { stopTimer() }
    }

    /// Mostra il prompt di sistema (solo se il permesso non è ancora stato concesso).
    func requestPrompt() {
        let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
        let trusted = AXIsProcessTrustedWithOptions([key: true] as CFDictionary)
        Log.permissions.info("Prompt requested, trusted=\(trusted, privacy: .public)")
        refresh()
    }

    /// Apre Impostazioni di Sistema → Privacy e sicurezza → Accessibilità (URL valido su Ventura).
    func openSystemSettings() {
        let urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        if let url = URL(string: urlString) {
            NSWorkspace.shared.open(url)
        }
    }

    func beginWatching() {
        watchers += 1
        refresh()
        guard !isTrusted, timer == nil else { return }
        let timer = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in self.refresh() }
        }
        timer.tolerance = 0.5
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    func endWatching() {
        watchers = max(0, watchers - 1)
        if watchers == 0 { stopTimer() }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }
}
