import AppKit
import SwiftUI

@MainActor
final class SettingsWindowController: NSWindowController {
    init(permission: AccessibilityPermission, onConfigureAccessibility: @escaping () -> Void) {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 300),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: true
        )
        window.title = L10n.Settings.windowTitle
        window.isReleasedWhenClosed = false
        window.contentViewController = NSHostingController(
            rootView: SettingsView(permission: permission, onConfigureAccessibility: onConfigureAccessibility)
        )
        super.init(window: window)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) non supportato") }

    func present() {
        guard let window = window else { return }
        if !window.isVisible { window.center() }
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }
}
