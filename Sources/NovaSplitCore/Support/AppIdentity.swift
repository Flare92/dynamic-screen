import Foundation

/// Costanti di identità condivise tra app, script e log.
/// Il bundle identifier deve restare stabile: il permesso Accessibilità (TCC) è legato a
/// identifier + certificato di firma.
public enum AppIdentity {
    public static let name = "NovaSplit"
    public static let bundleIdentifier = "com.novasplit.NovaSplit"
    /// Subsystem di os.Logger / os_signpost. Filtrare con:
    /// `log stream --predicate 'subsystem == "com.novasplit.NovaSplit"'`
    public static let logSubsystem = bundleIdentifier
    public static let supportedLocalizations = ["en", "it"]
}
