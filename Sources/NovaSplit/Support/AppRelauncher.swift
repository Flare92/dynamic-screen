import AppKit

@MainActor
enum AppRelauncher {
    /// Riavvia l'app: utile se macOS non applica subito il permesso Accessibilità.
    static func relaunch() {
        let bundleURL = Bundle.main.bundleURL
        guard bundleURL.pathExtension == "app" else {
            Log.app.error("Relaunch skipped: not running from an .app bundle")
            return
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/sh")
        // Attende la chiusura di questo processo, poi riapre il bundle.
        process.arguments = ["-c", "sleep 0.5; /usr/bin/open -n \"$0\"", bundleURL.path]
        do {
            try process.run()
            NSApp.terminate(nil)
        } catch {
            Log.app.error("Relaunch failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
