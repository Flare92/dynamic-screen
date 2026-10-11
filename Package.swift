// swift-tools-version:5.7
// Tools version 5.7 = minimo comune per le Command Line Tools su macOS 13 Ventura.
// Non usare feature più recenti (macro, parameter packs, `if`/`switch` come espressioni).
import PackageDescription

let package = Package(
    name: "NovaSplit",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "NovaSplit", targets: ["NovaSplit"])
    ],
    targets: [
        // Logica pura (solo Foundation): layout, regole, parsing, cache. Testata con `swift test`.
        .target(
            name: "NovaSplitCore",
            path: "Sources/NovaSplitCore"
        ),
        // App menu bar: AppKit + SwiftUI + Accessibility API.
        // Le risorse (.lproj, icona, Info.plist) NON passano da SwiftPM: le copia scripts/bundle.sh
        // dentro NovaSplit.app/Contents/Resources (un .bundle SwiftPM nella root dell'app romperebbe codesign).
        .executableTarget(
            name: "NovaSplit",
            dependencies: ["NovaSplitCore"],
            path: "Sources/NovaSplit"
        ),
        .testTarget(
            name: "NovaSplitCoreTests",
            dependencies: ["NovaSplitCore"],
            path: "Tests/NovaSplitCoreTests"
        )
    ]
)
