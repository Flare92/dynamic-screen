import NovaSplitCore
import os

/// Logger per categoria. Lettura dal Terminale:
/// `log stream --level debug --predicate 'subsystem == "com.novasplit.NovaSplit"'`
enum Log {
    static let app = Logger(subsystem: AppIdentity.logSubsystem, category: "app")
    static let permissions = Logger(subsystem: AppIdentity.logSubsystem, category: "permissions")
    static let ui = Logger(subsystem: AppIdentity.logSubsystem, category: "ui")
}
