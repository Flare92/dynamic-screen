import XCTest
@testable import NovaSplitCore

/// Verifica i file reali del progetto: le lingue devono avere le stesse chiavi
/// e ogni chiave usata nel codice dell'app deve esistere.
final class ProjectLocalizationTests: XCTestCase {
    private var repoRoot: URL {
        // .../Tests/NovaSplitCoreTests/ProjectLocalizationTests.swift → radice del repo
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    private func table(_ language: String) throws -> LocalizationTable {
        let url = repoRoot.appendingPathComponent("Resources/\(language).lproj/Localizable.strings")
        return try LocalizationTable.load(contentsOf: url)
    }

    func testAllLanguagesMatchEnglish() throws {
        let english = try table("en")
        XCTAssertFalse(english.entries.isEmpty)
        for language in AppIdentity.supportedLocalizations where language != "en" {
            let report = LocalizationAudit.compare(reference: english, translation: try table(language))
            XCTAssertTrue(report.isClean, "\(language).lproj non allineato: \(report)")
        }
    }

    func testEveryKeyUsedInAppSourcesExists() throws {
        let sourcesDir = repoRoot.appendingPathComponent("Sources/NovaSplit")
        guard let enumerator = FileManager.default.enumerator(at: sourcesDir, includingPropertiesForKeys: nil) else {
            return XCTFail("Cartella sorgenti non trovata: \(sourcesDir.path)")
        }
        var used = Set<String>()
        for case let url as URL in enumerator where url.pathExtension == "swift" {
            used.formUnion(LocalizationAudit.keysUsed(inSource: try String(contentsOf: url, encoding: .utf8)))
        }
        XCTAssertFalse(used.isEmpty)
        for language in AppIdentity.supportedLocalizations {
            let missing = used.subtracting(try table(language).keys).sorted()
            XCTAssertEqual(missing, [], "Chiavi mancanti in \(language).lproj")
        }
    }
}
