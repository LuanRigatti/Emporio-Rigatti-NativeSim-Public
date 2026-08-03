import ExpoModulesCore
import SwiftUI
import UIKit

public final class NativeStartupSplashViewProps: ExpoSwiftUI.ViewProps {
  @Field var colorScheme: String = "light"
  @Field var startReveal: Bool = false
  @Field var reduceMotion: Bool = false

  var onReady = EventDispatcher()
  var onAnimationComplete = EventDispatcher()
}

public struct NativeStartupSplashView: ExpoSwiftUI.View {
  @ObservedObject public var props: NativeStartupSplashViewProps
  @State private var revealRadius: CGFloat = 0
  @State private var revealStarted = false
  @State private var readySent = false
  @State private var completionSent = false
  @State private var displayImage: UIImage?
  @State private var maskImage: UIImage?

  public init(props: NativeStartupSplashViewProps) {
    self.props = props
  }

  public var body: some View {
    GeometryReader { geometry in
      splashLayer(size: geometry.size)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea()
        .modifier(
          RevealCompletionModifier(
            animatableData: revealRadius,
            targetValue: max(geometry.size.width, geometry.size.height) * 1.25,
            completion: sendCompletionIfNeeded,
          )
        )
        .onAppear {
          loadMaskImageIfNeeded()
          sendReadyIfNeeded()
          startRevealIfNeeded(in: geometry.size)
        }
        .onChange(of: props.startReveal) { _ in
          startRevealIfNeeded(in: geometry.size)
        }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Empório Rigatti")
  }

  private func sendReadyIfNeeded() {
    guard !readySent else { return }

    readySent = true
    props.onReady(["ready": maskImage != nil])
  }

  private func loadMaskImageIfNeeded() {
    guard displayImage == nil, maskImage == nil else { return }
    guard let image = splashImage(for: props.colorScheme) else { return }
    displayImage = image
    maskImage = alphaCroppedImage(image)
  }

  @ViewBuilder
  private func splashLayer(size: CGSize) -> some View {
    let background = props.colorScheme == "dark"
      ? Color(red: 11.0 / 255.0, green: 15.0 / 255.0, blue: 20.0 / 255.0)
      : Color.white

    ZStack {
      background.mask(alphaSilhouetteMask(size: size))

      if let displayImage {
        Image(uiImage: displayImage)
          .resizable()
          .scaledToFill()
          .frame(width: size.width, height: size.height)
          .clipped()
      }
    }
  }

  @ViewBuilder
  private func alphaSilhouetteMask(size: CGSize) -> some View {
    ZStack {
      Color.white

      if let maskImage {
        Image(uiImage: maskImage)
          .resizable()
          .scaledToFit()
          .frame(
            width: max(1, revealRadius * 2),
            height: max(1, revealRadius * 2),
          )
          .blendMode(.destinationOut)
      }
    }
    .frame(width: size.width, height: size.height)
    .compositingGroup()
  }

  private func startRevealIfNeeded(in size: CGSize) {
    guard props.startReveal, !revealStarted else { return }

    revealStarted = true
    let finalRadius = max(size.width, size.height) * 1.25

    if props.reduceMotion {
      revealRadius = finalRadius
      sendCompletionIfNeeded()
      return
    }

    withAnimation(.easeInOut(duration: 0.52)) {
      revealRadius = finalRadius
    }
  }

  private func sendCompletionIfNeeded() {
    guard !completionSent else { return }

    completionSent = true
    props.onAnimationComplete(["completed": true])
  }

  private func splashImage(for colorScheme: String) -> UIImage? {
    let fileName = colorScheme == "dark" ? "splash-dark.png" : "splash-light.png"
    let resourceBundle: Bundle?
    if let resourceURL = Bundle.main.url(
      forResource: "NativeStartupSplashResources",
      withExtension: "bundle",
    ) {
      resourceBundle = Bundle(url: resourceURL)
    } else {
      resourceBundle = nil
    }

    let imageURL = resourceBundle?.url(forResource: fileName, withExtension: nil)
      ?? Bundle.main.url(forResource: fileName, withExtension: nil)

    guard let imageURL else { return nil }
    guard let image = UIImage(contentsOfFile: imageURL.path) else { return nil }
    return image
  }

  private func alphaCroppedImage(_ image: UIImage) -> UIImage? {
    guard let cgImage = image.cgImage else { return image }

    switch cgImage.alphaInfo {
    case .none, .noneSkipFirst, .noneSkipLast:
      return image
    default:
      break
    }

    let width = cgImage.width
    let height = cgImage.height
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let rendered = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard let baseAddress = buffer.baseAddress,
            let context = CGContext(
              data: baseAddress,
              width: width,
              height: height,
              bitsPerComponent: 8,
              bytesPerRow: width * 4,
              space: CGColorSpaceCreateDeviceRGB(),
              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            )
      else {
        return false
      }

      context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }

    guard rendered else { return image }

    var minX = width
    var minY = height
    var maxX = -1
    var maxY = -1

    for y in 0..<height {
      for x in 0..<width {
        if pixels[(y * width + x) * 4 + 3] == 0 { continue }
        minX = min(minX, x)
        minY = min(minY, y)
        maxX = max(maxX, x)
        maxY = max(maxY, y)
      }
    }

    guard maxX >= minX, maxY >= minY else { return nil }

    let cropRect = CGRect(
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    )
    guard let cropped = cgImage.cropping(to: cropRect) else { return image }
    return UIImage(cgImage: cropped, scale: image.scale, orientation: image.imageOrientation)
  }
}

private struct RevealCompletionModifier: ViewModifier, Animatable {
  var animatableData: CGFloat {
    didSet {
      guard oldValue < targetValue, animatableData >= targetValue else { return }

      let completion = completion
      DispatchQueue.main.async {
        completion()
      }
    }
  }

  let targetValue: CGFloat
  let completion: () -> Void

  func body(content: Content) -> some View {
    content
  }
}
