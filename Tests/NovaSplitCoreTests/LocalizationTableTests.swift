import XCTest
@testable import NovaSplitCore

final class LocalizationTableTests: XCTestCase {
    func testParsesEntriesCommentsAndEscapes() throws {
        let source = """
        /* commento a blocco */
        // commento di riga
        "a" = "Uno";
        "b" = "Con \\"virgolette\\" e\\nnuova riga";
        "c" = "Unicode → è ✓";
        """
        let table = try LocalizationTable.parse(Data(source.utf8))
        XCTAssertEqual(table.entries["a"], "Uno")
        XCTAssertEqual(table.entries["b"], "Con \"virgolette\" e\nnuova riga")
        XCTAssertEqual(table.entries["c"], "Unicode → è ✓")
        XCTAssertEqual(table.keys, ["a", "b", "c"])
    }

    func testEmptyFileIsEmptyTable() throws {
        XCTAssertEqual(try LocalizationTable.parse(Data()).entries, [:])
    }

    func testMalformedFileThrows() {
        let source = #""a" = "manca il punto e virgola" "b" = ;"#
        XCTAssertThrowsError(try LocalizationTable.parse(Data(source.utf8)))
    }

    func testAuditFindsMissingExtraAndEmpty() {
        let reference = LocalizationTable(entries: ["a": "A", "b": "B", "c": "C"])
        let translation = LocalizationTable(entries: ["a": "A", "c": "", "z": "Z"])
        let report = LocalizationAudit.compare(reference: reference, translation: translation)
        XCTAssertEqual(report.missing, ["b"])
        XCTAssertEqual(report.extra, ["z"])
        XCTAssertEqual(report.empty, ["c"])
        XCTAssertFalse(report.isClean)
    }

    func testKeysUsedInSource() {
        let source = """
        static var x: String { L10n.tr("menu.quit", "Quit") }
        static var y: String { L10n.tr( "settings.title" , "Title") }
        let z = tr(dynamicKey, "ignored")
        """
        XCTAssertEqual(LocalizationAudit.keysUsed(inSource: source), ["menu.quit", "settings.title"])
    }
}
