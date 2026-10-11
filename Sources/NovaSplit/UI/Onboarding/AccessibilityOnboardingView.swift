import SwiftUI

/// Schermata guidata per concedere il permesso Accessibilità.
struct AccessibilityOnboardingView: View {
    @ObservedObject var permission: AccessibilityPermission
    var onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: permission.isTrusted ? "checkmark.shield.fill" : "lock.shield")
                    .font(.system(size: 40, weight: .regular))
                    .foregroundColor(permission.isTrusted ? .green : .accentColor)
                    .frame(width: 52)
                Text(L10n.Onboarding.title)
                    .font(.title2.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(L10n.Onboarding.body)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 10) {
                StepRow(number: 1, text: L10n.Onboarding.step1)
                StepRow(number: 2, text: L10n.Onboarding.step2)
                StepRow(number: 3, text: L10n.Onboarding.step3)
            }
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color.primary.opacity(0.05)))

            statusRow

            if !permission.isTrusted {
                Text(L10n.Onboarding.relaunchHint)
                    .font(.footnote)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack {
                if permission.isTrusted {
                    Spacer()
                    Button(L10n.Onboarding.done, action: onClose)
                        .keyboardShortcut(.defaultAction)
                } else {
                    Button(L10n.Onboarding.relaunch) { AppRelauncher.relaunch() }
                    Spacer()
                    Button(L10n.Onboarding.later, action: onClose)
                        .keyboardShortcut(.cancelAction)
                    Button(L10n.Onboarding.openSettings) {
                        permission.requestPrompt()
                        permission.openSystemSettings()
                    }
                    .keyboardShortcut(.defaultAction)
                }
            }
        }
        .padding(24)
        .frame(width: 480)
    }

    @ViewBuilder
    private var statusRow: some View {
        HStack(spacing: 8) {
            if permission.isTrusted {
                Image(systemName: "checkmark.circle.fill").foregroundColor(.green)
                Text(L10n.Onboarding.granted).fontWeight(.medium)
            } else {
                ProgressView().controlSize(.small)
                Text(L10n.Onboarding.waiting).foregroundColor(.secondary)
            }
        }
    }
}

private struct StepRow: View {
    let number: Int
    let text: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(number)")
                .font(.callout.weight(.bold).monospacedDigit())
                .frame(width: 20, height: 20)
                .background(Circle().fill(Color.accentColor.opacity(0.2)))
            Text(text)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
