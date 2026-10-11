import AppKit
import Combine
import NovaSplitCore

/// Icona e menu nella barra dei menu. Il menu viene ricostruito solo all'apertura (`menuNeedsUpdate`),
/// così a riposo non c'è alcun lavoro.
@MainActor
final class StatusItemController: NSObject, NSMenuDelegate {
    struct Actions {
        var openSettings: () -> Void
        var openAccessibilityOnboarding: () -> Void
        var showAbout: () -> Void
    }

    private let statusItem: NSStatusItem
    private let permission: AccessibilityPermission
    private let actions: Actions
    private var cancellables = Set<AnyCancellable>()

    init(permission: AccessibilityPermission, actions: Actions) {
        self.permission = permission
        self.actions = actions
        self.statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        super.init()

        if let button = statusItem.button {
            button.image = Self.makeIcon()
            button.toolTip = L10n.Menu.statusTooltip
        }
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu

        permission.$isTrusted
            .removeDuplicates()
            .sink { [weak self] trusted in self?.updateBadge(trusted: trusted) }
            .store(in: &cancellables)
    }

    private static func makeIcon() -> NSImage? {
        let image = NSImage(systemSymbolName: "rectangle.split.2x2", accessibilityDescription: AppIdentity.name)
        image?.isTemplate = true
        return image
    }

    private func updateBadge(trusted: Bool) {
        // Senza permesso, l'icona appare attenuata come promemoria discreto.
        statusItem.button?.appearsDisabled = !trusted
    }

    // MARK: NSMenuDelegate

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()

        if permission.isTrusted {
            let item = NSMenuItem(title: L10n.Menu.accessibilityGranted, action: nil, keyEquivalent: "")
            item.isEnabled = false
            menu.addItem(item)
        } else {
            menu.addItem(makeItem(L10n.Menu.grantAccessibility, #selector(openAccessibility)))
        }
        menu.addItem(.separator())
        menu.addItem(makeItem(L10n.Menu.settings, #selector(openSettings), key: ","))
        menu.addItem(makeItem(L10n.Menu.about, #selector(showAbout)))
        menu.addItem(.separator())
        menu.addItem(makeItem(L10n.Menu.quit, #selector(quit), key: "q"))
    }

    private func makeItem(_ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    @objc private func openSettings() { actions.openSettings() }
    @objc private func openAccessibility() { actions.openAccessibilityOnboarding() }
    @objc private func showAbout() { actions.showAbout() }
    @objc private func quit() { NSApp.terminate(nil) }
}

