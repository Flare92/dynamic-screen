import Foundation

/// Accesso alle stringhe localizzate di `Contents/Resources/<lingua>.lproj/Localizable.strings`.
/// Il valore inglese di fallback viene usato quando l'eseguibile gira fuori dal bundle (`swift run`).
/// Ogni chiave usata qui DEVE esistere in en.lproj e it.lproj: lo verifica `LocalizationTests`.
enum L10n {
    static func tr(_ key: String, _ fallback: String) -> String {
        NSLocalizedString(key, tableName: nil, bundle: .main, value: fallback, comment: "")
    }

    enum Menu {
        static var settings: String { L10n.tr("menu.settings", "Settings…") }
        static var about: String { L10n.tr("menu.about", "About NovaSplit") }
        static var quit: String { L10n.tr("menu.quit", "Quit NovaSplit") }
        static var grantAccessibility: String { L10n.tr("menu.grantAccessibility", "Grant Accessibility Permission…") }
        static var accessibilityGranted: String { L10n.tr("menu.accessibilityGranted", "Accessibility: enabled") }
        static var statusTooltip: String { L10n.tr("menu.statusTooltip", "NovaSplit") }
    }

    enum Onboarding {
        static var windowTitle: String { L10n.tr("onboarding.ax.windowTitle", "Accessibility Permission") }
        static var title: String { L10n.tr("onboarding.ax.title", "NovaSplit needs Accessibility access") }
        static var body: String {
            L10n.tr("onboarding.ax.body", "To move and resize the windows of other apps, macOS requires you to allow NovaSplit in System Settings → Privacy & Security → Accessibility.")
        }
        static var step1: String { L10n.tr("onboarding.ax.step1", "Click “Open System Settings”.") }
        static var step2: String { L10n.tr("onboarding.ax.step2", "Turn on the switch next to NovaSplit (unlock with your password if needed).") }
        static var step3: String { L10n.tr("onboarding.ax.step3", "Come back here: this window updates by itself.") }
        static var openSettings: String { L10n.tr("onboarding.ax.openSettings", "Open System Settings") }
        static var waiting: String { L10n.tr("onboarding.ax.waiting", "Waiting for permission…") }
        static var granted: String { L10n.tr("onboarding.ax.granted", "Permission granted. You're all set!") }
        static var done: String { L10n.tr("onboarding.ax.done", "Done") }
        static var later: String { L10n.tr("onboarding.ax.later", "Later") }
        static var relaunch: String { L10n.tr("onboarding.ax.relaunch", "Relaunch NovaSplit") }
        static var relaunchHint: String {
            L10n.tr("onboarding.ax.relaunchHint", "Already enabled but still waiting? Remove NovaSplit from the list with “–”, add it again, then relaunch.")
        }
    }

    enum Settings {
        static var windowTitle: String { L10n.tr("settings.windowTitle", "NovaSplit Settings") }
        static var tabGeneral: String { L10n.tr("settings.tab.general", "General") }
        static var tabAbout: String { L10n.tr("settings.tab.about", "About") }
        static var accessibility: String { L10n.tr("settings.accessibility", "Accessibility") }
        static var enabled: String { L10n.tr("settings.enabled", "Enabled") }
        static var disabled: String { L10n.tr("settings.disabled", "Not enabled") }
        static var configure: String { L10n.tr("settings.configure", "Configure…") }
        static var comingSoon: String { L10n.tr("settings.comingSoon", "Layouts, rules, Claude and shortcuts will appear here in the next phases.") }
        static var version: String { L10n.tr("settings.version", "Version %@ (%@)") }
        static var tagline: String { L10n.tr("settings.tagline", "Futuristic split screen for macOS.") }
    }
}
