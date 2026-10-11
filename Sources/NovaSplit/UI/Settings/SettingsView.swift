import NovaSplitCore
import SwiftUI

struct SettingsView: View {
    @ObservedObject var permission: AccessibilityPermission
    var onConfigureAccessibility: () -> Void

    var body: some View {
        TabView {
            GeneralSettingsPane(permission: permission, onConfigureAccessibility: onConfigureAccessibility)
                .tabItem { Label(L10n.Settings.tabGeneral, systemImage: "gearshape") }
            AboutPane()
                .tabItem { Label(L10n.Settings.tabAbout, systemImage: "info.circle") }
        }
        .padding(20)
        .frame(width: 520, height: 300)
    }
}

private struct GeneralSettingsPane: View {
    @ObservedObject var permission: AccessibilityPermission
    var onConfigureAccessibility: () -> Void

    var body: some View {
        Form {
            HStack {
                Text(L10n.Settings.accessibility)
                Spacer()
                Image(systemName: permission.isTrusted ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .foregroundColor(permission.isTrusted ? .green : .orange)
                Text(permission.isTrusted ? L10n.Settings.enabled : L10n.Settings.disabled)
                    .foregroundColor(.secondary)
                if !permission.isTrusted {
                    Button(L10n.Settings.configure, action: onConfigureAccessibility)
                }
            }
            Text(L10n.Settings.comingSoon)
                .font(.footnote)
                .foregroundColor(.secondary)
                .padding(.top, 12)
        }
    }
}

private struct AboutPane: View {
    var body: some View {
        VStack(spacing: 10) {
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .frame(width: 72, height: 72)
            Text(AppIdentity.name).font(.title.weight(.semibold))
            Text(L10n.Settings.tagline).foregroundColor(.secondary)
            Text(versionString).font(.footnote.monospacedDigit()).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var versionString: String {
        let info = Bundle.main.infoDictionary ?? [:]
        let short = info["CFBundleShortVersionString"] as? String ?? "dev"
        let build = info["CFBundleVersion"] as? String ?? "0"
        return String(format: L10n.Settings.version, short, build)
    }
}
