import AppKit
import NovaSplitCore

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private let permission = AccessibilityPermission.shared
    private var statusItemController: StatusItemController?
    private var settingsWindowController: SettingsWindowController?
    private var onboardingWindowController: AccessibilityOnboardingWindowController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // LSUIElement nel bundle nasconde già il Dock; questo copre anche `swift run` senza bundle.
        NSApp.setActivationPolicy(.accessory)
        Log.app.info("NovaSplit launched (bundle: \(Bundle.main.bundlePath, privacy: .public))")

        statusItemController = StatusItemController(
            permission: permission,
            actions: StatusItemController.Actions(
                openSettings: { [weak self] in self?.showSettings() },
                openAccessibilityOnboarding: { [weak self] in self?.showAccessibilityOnboarding() },
                showAbout: { [weak self] in self?.showAbout() }
            )
        )

        if !permission.isTrusted {
            showAccessibilityOnboarding()
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        // Doppio clic sull'app già aperta: mostra le impostazioni.
        if !flag { showSettings() }
        return true
    }

    func showSettings() {
        if settingsWindowController == nil {
            settingsWindowController = SettingsWindowController(
                permission: permission,
                onConfigureAccessibility: { [weak self] in self?.showAccessibilityOnboarding() }
            )
        }
        settingsWindowController?.present()
    }

    func showAccessibilityOnboarding() {
        if onboardingWindowController == nil {
            onboardingWindowController = AccessibilityOnboardingWindowController(permission: permission)
        }
        onboardingWindowController?.present()
    }

    func showAbout() {
        NSApp.activate(ignoringOtherApps: true)
        NSApp.orderFrontStandardAboutPanel(nil)
    }
}
