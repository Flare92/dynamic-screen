import AppKit
import SwiftUI

@MainActor
final class AccessibilityOnboardingWindowController: NSWindowController, NSWindowDelegate {
    private let permission: AccessibilityPermission

    init(permission: AccessibilityPermission) {
        self.permission = permission
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 480, height: 400),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: true
        )
        window.title = L10n.Onboarding.windowTitle
        window.isReleasedWhenClosed = false
        super.init(window: window)
        window.delegate = self
        let view = AccessibilityOnboardingView(permission: permission) { [weak self] in
            self?.close()
        }
        window.contentViewController = NSHostingController(rootView: view)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) non supportato") }

    func present() {
        permission.beginWatching()
        guard let window = window else { return }
        if !window.isVisible { window.center() }
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }

    func windowWillClose(_ notification: Notification) {
        permission.endWatching()
    }
}
