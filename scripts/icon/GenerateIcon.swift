// Genera le PNG dell'icona di NovaSplit in un .iconset (poi convertito con iconutil).
// Uso: swift scripts/icon/GenerateIcon.swift <cartella.iconset>
// Solo CoreGraphics + ImageIO: nessuna dipendenza da Xcode.
import CoreGraphics
import Foundation
import ImageIO

func color(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: r / 255, green: g / 255, blue: b / 255, alpha: a)
}

func drawIcon(size: Int) -> CGImage? {
    let s = CGFloat(size)
    guard let space = CGColorSpace(name: CGColorSpace.sRGB),
          let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                              space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { return nil }
    ctx.interpolationQuality = .high
    ctx.setShouldAntialias(true)

    // Griglia icone macOS: corpo 824/1024 centrato, raggio ~185/1024.
    let inset = s * 100 / 1024
    let body = CGRect(x: inset, y: inset, width: s - inset * 2, height: s - inset * 2)
    let radius = s * 185 / 1024
    let bodyPath = CGPath(roundedRect: body, cornerWidth: radius, cornerHeight: radius, transform: nil)

    // Ombra leggera sotto il corpo.
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.012), blur: s * 0.03, color: color(0, 0, 0, 0.35))
    ctx.addPath(bodyPath)
    ctx.setFillColor(color(12, 14, 32))
    ctx.fillPath()
    ctx.restoreGState()

    // Sfondo: gradiente notte → indaco.
    ctx.saveGState()
    ctx.addPath(bodyPath)
    ctx.clip()
    if let gradient = CGGradient(colorsSpace: space,
                                 colors: [color(10, 12, 30), color(38, 30, 92)] as CFArray,
                                 locations: [0, 1]) {
        ctx.drawLinearGradient(gradient, start: CGPoint(x: body.minX, y: body.minY),
                               end: CGPoint(x: body.maxX, y: body.maxY), options: [])
    }

    // Quattro zone: una grande a sinistra, tre a destra (preset "1 grande + 3").
    let pad = s * 0.155
    let gap = s * 0.035
    let area = body.insetBy(dx: pad - inset, dy: pad - inset)
    let leftWidth = (area.width - gap) * 0.56
    let rightWidth = area.width - gap - leftWidth
    let tileHeight = (area.height - gap * 2) / 3
    var tiles: [CGRect] = [CGRect(x: area.minX, y: area.minY, width: leftWidth, height: area.height)]
    for i in 0..<3 {
        tiles.append(CGRect(x: area.minX + leftWidth + gap,
                            y: area.minY + CGFloat(i) * (tileHeight + gap),
                            width: rightWidth, height: tileHeight))
    }
    let tileRadius = s * 0.045
    let tileColors: [(CGColor, CGColor)] = [
        (color(0, 229, 255), color(64, 120, 255)),   // ciano → blu (zona principale)
        (color(150, 90, 255), color(110, 70, 230)),
        (color(110, 120, 255), color(80, 90, 220)),
        (color(255, 80, 200), color(170, 70, 255))
    ]
    for (index, tile) in tiles.enumerated() {
        let path = CGPath(roundedRect: tile, cornerWidth: tileRadius, cornerHeight: tileRadius, transform: nil)
        // Alone luminoso.
        ctx.saveGState()
        ctx.setShadow(offset: .zero, blur: s * 0.04, color: color(0, 220, 255, index == 0 ? 0.55 : 0.25))
        ctx.addPath(path)
        ctx.setFillColor(tileColors[index].0)
        ctx.fillPath()
        ctx.restoreGState()
        // Riempimento a gradiente.
        ctx.saveGState()
        ctx.addPath(path)
        ctx.clip()
        if let g = CGGradient(colorsSpace: space, colors: [tileColors[index].0, tileColors[index].1] as CFArray,
                              locations: [0, 1]) {
            ctx.drawLinearGradient(g, start: CGPoint(x: tile.minX, y: tile.maxY),
                                   end: CGPoint(x: tile.maxX, y: tile.minY), options: [])
        }
        ctx.restoreGState()
    }

    // Riflesso sottile sul bordo superiore del corpo.
    ctx.addPath(bodyPath)
    ctx.setStrokeColor(color(255, 255, 255, 0.12))
    ctx.setLineWidth(max(1, s * 0.006))
    ctx.strokePath()
    ctx.restoreGState()

    return ctx.makeImage()
}

func writePNG(_ image: CGImage, to url: URL) -> Bool {
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else {
        return false
    }
    CGImageDestinationAddImage(dest, image, nil)
    return CGImageDestinationFinalize(dest)
}

let arguments = CommandLine.arguments
guard arguments.count == 2 else {
    FileHandle.standardError.write("Uso: GenerateIcon.swift <cartella.iconset>\n".data(using: .utf8)!)
    exit(2)
}
let outputDir = URL(fileURLWithPath: arguments[1], isDirectory: true)
try? FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)

// (nome base, lato in punti) → genera @1x e @2x.
let specs: [(String, Int)] = [("16x16", 16), ("32x32", 32), ("128x128", 128), ("256x256", 256), ("512x512", 512)]
var failed = false
for (name, points) in specs {
    for scale in [1, 2] {
        let pixels = points * scale
        let file = scale == 1 ? "icon_\(name).png" : "icon_\(name)@2x.png"
        guard let image = drawIcon(size: pixels), writePNG(image, to: outputDir.appendingPathComponent(file)) else {
            FileHandle.standardError.write("Impossibile generare \(file)\n".data(using: .utf8)!)
            failed = true
            continue
        }
    }
}
exit(failed ? 1 : 0)
