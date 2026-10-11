import Foundation

/// Contenuto di un file `Localizable.strings` (chiave → traduzione).
public struct LocalizationTable: Equatable {
    public let entries: [String: String]

    public init(entries: [String: String]) {
        self.entries = entries
    }

    public var keys: Set<String> { Set(entries.keys) }

    public enum ParseError: Error, Equatable {
        case notUTF8
        case malformed(String)
    }

    /// Parsa il formato `.strings` (`"chiave" = "valore";` con commenti `/* */` e `//`).
    /// Il formato è un sottoinsieme delle property list OpenStep, quindi usiamo il parser di Foundation.
    public static func parse(_ data: Data) throws -> LocalizationTable {
        guard String(data: data, encoding: .utf8) != nil else { throw ParseError.notUTF8 }
        if data.isEmpty { return LocalizationTable(entries: [:]) }
        let object: Any
        do {
            object = try PropertyListSerialization.propertyList(from: data, options: [], format: nil)
        } catch {
            throw ParseError.malformed(String(describing: error))
        }
        guard let dict = object as? [String: String] else {
            throw ParseError.malformed("il contenuto non è un dizionario di stringhe")
        }
        return LocalizationTable(entries: dict)
    }

    public static func load(contentsOf url: URL) throws -> LocalizationTable {
        try parse(try Data(contentsOf: url))
    }
}

/// Confronta le tabelle delle diverse lingue con quella di riferimento.
public enum LocalizationAudit {
    public struct Report: Equatable {
        /// Chiavi presenti nel riferimento ma assenti nella traduzione.
        public var missing: [String]
        /// Chiavi presenti nella traduzione ma non nel riferimento (probabilmente obsolete).
        public var extra: [String]
        /// Chiavi tradotte con stringa vuota.
        public var empty: [String]

        public var isClean: Bool { missing.isEmpty && extra.isEmpty && empty.isEmpty }
    }

    public static func compare(reference: LocalizationTable, translation: LocalizationTable) -> Report {
        Report(
            missing: reference.keys.subtracting(translation.keys).sorted(),
            extra: translation.keys.subtracting(reference.keys).sorted(),
            empty: translation.entries.filter { $0.value.isEmpty }.map { $0.key }.sorted()
        )
    }

    /// Estrae le chiavi usate nel codice tramite `L10n.tr("chiave", ...)`.
    public static func keysUsed(inSource source: String) -> Set<String> {
        let pattern = #"L10n\.tr\(\s*"([^"\\]+)""#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let range = NSRange(source.startIndex..<source.endIndex, in: source)
        var result = Set<String>()
        for match in regex.matches(in: source, range: range) {
            if let keyRange = Range(match.range(at: 1), in: source) {
                result.insert(String(source[keyRange]))
            }
        }
        return result
    }
}
