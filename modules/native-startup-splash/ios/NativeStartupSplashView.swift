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
    props.onReady(["ready": splashImage(for: props.colorScheme) != nil])
  }

  @ViewBuilder
  private func splashLayer(size: CGSize) -> some View {
    let background = props.colorScheme == "dark"
      ? Color(red: 11.0 / 255.0, green: 15.0 / 255.0, blue: 20.0 / 255.0)
      : Color.white

    background
      .overlay {
        if let image = splashImage(for: props.colorScheme) {
          Image(uiImage: image)
            .resizable()
            .scaledToFill()
            .frame(width: size.width, height: size.height)
            .clipped()
        }
      }
      .mask(
        RevealMask(radius: revealRadius)
          .fill(style: FillStyle(eoFill: true))
      )
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
    return UIImage(contentsOfFile: imageURL.path)
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

private struct RevealMask: Shape {
  var radius: CGFloat

  var animatableData: CGFloat {
    get { radius }
    set { radius = newValue }
  }

  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.addRect(rect)

    let center = CGPoint(x: rect.midX, y: rect.midY)
    let hole = CGRect(
      x: center.x - radius,
      y: center.y - radius,
      width: radius * 2,
      height: radius * 2,
    )
    path.addEllipse(in: hole)

    return path
  }
}
