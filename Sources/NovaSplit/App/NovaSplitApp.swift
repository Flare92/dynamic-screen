import SwiftUI

/// Entry point. Il ciclo di vita SwiftUI garantisce l'isolamento @MainActor;
/// tutta la logica AppKit vive in `AppDelegate`. Le finestre sono gestite a mano
/// (NSWindowController + NSHostingController) per controllarne attivazione e livello.
@main
struct NovaSplitApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        // Una scena è obbligatoria: Settings vuota non apre finestre all'avvio.
        Settings {
            EmptyView()
        }
    }
}
