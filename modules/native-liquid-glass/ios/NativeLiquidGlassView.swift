import ExpoModulesCore
import SwiftUI

struct NativeGlassAction: Record {
  @Field var id: String = ""
  @Field var systemImage: String = "circle"
  @Field var title: String?
  @Field var accessibilityLabel: String?
  @Field var shape: String = "circle"
  @Field var width: Double?
  @Field var height: Double?
  @Field var tint: Color?
  @Field var disabled: Bool = false
  @Field var visible: Bool = true
}

public final class NativeLiquidGlassViewProps: ExpoSwiftUI.ViewProps {
  @Field var mode: String = "transition"
  @Field var state: String = "collapsed"
  @Field var glassIdentity: String = "liquid-glass"
  @Field var unionID: String?
  @Field var spacing: Double = 8
  @Field var animationDuration: Double = 0.42
  @Field var animationBounce: Double = 0.08
  @Field var accessibilityLabel: String?
  @Field var tint: Color?
  @Field var actions: [NativeGlassAction] = []
  @Field var collapsedActionIDs: [String] = []
  @Field var expandedActionIDs: [String] = []
  @Field var collapsedSystemImage: String = "plus"
  @Field var expandedSystemImage: String = "xmark"
  @Field var collapsedTitle: String?
  @Field var expandedTitle: String?
  @Field var collapsedShape: String = "circle"
  @Field var expandedShape: String = "capsule"

  var onActionPress = EventDispatcher()
  var onAnimationComplete = EventDispatcher()
}

public struct NativeLiquidGlassView: ExpoSwiftUI.View {
  @ObservedObject public var props: NativeLiquidGlassViewProps
  @Namespace private var namespace
  @State private var visualState: String?

  public init(props: NativeLiquidGlassViewProps) {
    self.props = props
  }

  public var body: some View {
    Group {
      if #available(iOS 26.0, *) {
        GlassEffectContainer(spacing: CGFloat(max(props.spacing, 0))) {
          nativeContent
        }
      } else {
        fallbackContent
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(props.accessibilityLabel ?? "")
    .onAppear {
      visualState = props.state
    }
    .onChange(of: props.state) { newState in
      guard visualState != newState else { return }
      if #available(iOS 17.0, *) {
        withAnimation(nativeAnimation) {
          visualState = newState
        } completion: {
          props.onAnimationComplete([:])
        }
      } else {
        withAnimation(nativeAnimation) {
          visualState = newState
        }
        props.onAnimationComplete([:])
      }
    }
  }

  private var activeState: String {
    visualState ?? props.state
  }

  private var nativeAnimation: Animation {
    let duration = max(props.animationDuration, 0.15)
    let bounce = min(max(props.animationBounce, 0), 1)

    if #available(iOS 17.0, *) {
      return .spring(duration: duration, bounce: bounce)
    }

    return .spring(response: duration, dampingFraction: 0.78, blendDuration: 0.12)
  }

  @available(iOS 26.0, *)
  @ViewBuilder
  private var nativeContent: some View {
    switch props.mode {
    case "crossScreenMorph":
      nativeCrossScreenMorph
    case "morphButton":
      nativeMorphButton
    case "actionGroup":
      nativeActionGroup
    default:
      nativeTransition
    }
  }

  @available(iOS 26.0, *)
  @ViewBuilder
  private var nativeCrossScreenMorph: some View {
    if activeState == "circle" || activeState == "collapsed" || activeState == "source" {
      nativeButton(NativeGlassAction(
        id: "primary",
        systemImage: props.collapsedSystemImage.isEmpty ? "ellipsis" : props.collapsedSystemImage,
        accessibilityLabel: props.collapsedTitle ?? "Mais opções"
      ))
      .frame(width: 44, height: 44)
      .glassEffect(glassMaterial(for: NativeGlassAction()), in: .circle)
      .glassEffectID(props.glassIdentity, in: namespace)
      .glassEffectTransition(.matchedGeometry)
    } else {
      HStack(spacing: 8) {
        nativeButton(NativeGlassAction(
          id: "secondary",
          systemImage: "plus",
          accessibilityLabel: "Ação secundária"
        ))
        .frame(width: 44, height: 44)

        nativeButton(NativeGlassAction(
          id: "primary",
          systemImage: props.expandedSystemImage.isEmpty ? "xmark" : props.expandedSystemImage,
          accessibilityLabel: props.expandedTitle ?? "Fechar"
        ))
        .frame(width: 44, height: 44)
      }
      .foregroundStyle(props.tint ?? .primary)
      .frame(width: 100, height: 44)
      .glassEffect(glassMaterial(for: NativeGlassAction()), in: .capsule)
      .glassEffectID(props.glassIdentity, in: namespace)
      .glassEffectTransition(.matchedGeometry)
    }
  }

  @available(iOS 26.0, *)
  private var nativeTransition: some View {
    HStack(spacing: CGFloat(max(props.spacing, 0))) {
      ForEach(actionsForCurrentState, id: \.id) { action in
        nativeGlassButton(action, namespace: namespace)
      }
    }
  }

  @available(iOS 26.0, *)
  private var nativeActionGroup: some View {
    HStack(spacing: CGFloat(max(props.spacing, 0))) {
      ForEach(props.actions.filter(\.visible), id: \.id) { action in
        nativeGlassButton(action, namespace: namespace)
      }
    }
    .glassEffectUnion(id: props.unionID, namespace: namespace)
  }

  @available(iOS 26.0, *)
  private var nativeMorphButton: some View {
    let action = morphAction

    return nativeGlassButton(action, namespace: namespace)
  }

  @available(iOS 26.0, *)
  @ViewBuilder
  private func nativeGlassButton(_ action: NativeGlassAction, namespace: Namespace.ID) -> some View {
    let button = nativeButton(action)

    if action.shape == "circle" {
      button
        .frame(width: CGFloat(action.width ?? 44), height: CGFloat(action.height ?? 44))
        .glassEffect(glassMaterial(for: action), in: .circle)
        .glassEffectID(glassID(for: action), in: namespace)
        .glassEffectUnion(id: props.unionID, namespace: namespace)
        .glassEffectTransition(.matchedGeometry)
    } else if action.shape == "roundedRectangle" {
      button
        .frame(width: action.width.map { CGFloat($0) }, height: CGFloat(action.height ?? 44))
        .glassEffect(glassMaterial(for: action), in: .rect(cornerRadius: 16))
        .glassEffectID(glassID(for: action), in: namespace)
        .glassEffectUnion(id: props.unionID, namespace: namespace)
        .glassEffectTransition(.matchedGeometry)
    } else {
      button
        .frame(width: action.width.map { CGFloat($0) }, height: CGFloat(action.height ?? 44))
        .glassEffect(glassMaterial(for: action), in: .capsule)
        .glassEffectID(glassID(for: action), in: namespace)
        .glassEffectUnion(id: props.unionID, namespace: namespace)
        .glassEffectTransition(.matchedGeometry)
    }
  }

  @available(iOS 26.0, *)
  private func glassMaterial(for action: NativeGlassAction) -> Glass {
    var material = Glass.regular.interactive()
    if let tint = action.tint ?? props.tint {
      material = material.tint(tint)
    }
    return material
  }

  private func nativeButton(_ action: NativeGlassAction) -> some View {
    SwiftUI.Button {
      props.onActionPress(["id": action.id])
    } label: {
      if let title = action.title, !title.isEmpty {
        Label(title, systemImage: action.systemImage)
          .font(.body.weight(.semibold))
      } else {
        Image(systemName: action.systemImage)
          .font(.body.weight(.semibold))
      }
    }
    .foregroundStyle(action.tint ?? props.tint ?? .primary)
    .buttonStyle(.plain)
    .disabled(action.disabled)
    .accessibilityLabel(action.accessibilityLabel ?? action.title ?? action.systemImage)
  }

  private var actionsForCurrentState: [NativeGlassAction] {
    let ids = activeState == "expanded" ? props.expandedActionIDs : props.collapsedActionIDs

    guard !ids.isEmpty else {
      return props.actions.filter(\.visible)
    }

    let selectedIDs = Set(ids)
    return props.actions.filter { $0.visible && selectedIDs.contains($0.id) }
  }

  private var morphAction: NativeGlassAction {
    var action = NativeGlassAction()
    let expanded = activeState == "expanded"
    action.id = props.glassIdentity
    action.systemImage = expanded ? props.expandedSystemImage : props.collapsedSystemImage
    action.title = expanded ? props.expandedTitle : props.collapsedTitle
    action.shape = expanded ? props.expandedShape : props.collapsedShape
    action.tint = props.tint
    action.accessibilityLabel = props.accessibilityLabel
    return action
  }

  private func glassID(for action: NativeGlassAction) -> String {
    "\(props.glassIdentity)-\(action.id)"
  }

  @ViewBuilder
  private var fallbackContent: some View {
    switch props.mode {
    case "crossScreenMorph":
      fallbackCrossScreenMorph
    case "morphButton":
      fallbackButton(morphAction)
    case "actionGroup":
      fallbackGroup(props.actions.filter(\.visible))
    default:
      fallbackGroup(actionsForCurrentState)
    }
  }

  @ViewBuilder
  private var fallbackCrossScreenMorph: some View {
    if activeState == "circle" || activeState == "collapsed" || activeState == "source" {
      nativeButton(NativeGlassAction(id: props.glassIdentity, systemImage: props.collapsedSystemImage.isEmpty ? "ellipsis" : props.collapsedSystemImage))
        .frame(width: 44, height: 44)
        .background(.ultraThinMaterial, in: Circle())
    } else {
      HStack(spacing: 8) {
        Image(systemName: "ellipsis")
          .font(.body.weight(.semibold))
          .frame(width: 44, height: 44)
        Image(systemName: "xmark")
          .font(.body.weight(.semibold))
          .frame(width: 44, height: 44)
      }
      .foregroundStyle(props.tint ?? .primary)
      .frame(width: 100, height: 44)
      .background(.ultraThinMaterial, in: Capsule())
    }
  }

  @ViewBuilder
  private func fallbackGroup(_ actions: [NativeGlassAction]) -> some View {
    HStack(spacing: CGFloat(max(props.spacing, 0))) {
      ForEach(actions, id: \.id) { action in
        fallbackButton(action)
      }
    }
  }

  @ViewBuilder
  private func fallbackButton(_ action: NativeGlassAction) -> some View {
    let label = nativeButton(action)

    if action.shape == "circle" {
      label
        .frame(width: CGFloat(action.width ?? 44), height: CGFloat(action.height ?? 44))
        .background(.ultraThinMaterial, in: Circle())
    } else if action.shape == "roundedRectangle" {
      label
        .frame(width: action.width.map { CGFloat($0) }, height: CGFloat(action.height ?? 44))
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
    } else {
      label
        .frame(width: action.width.map { CGFloat($0) }, height: CGFloat(action.height ?? 44))
        .background(.ultraThinMaterial, in: Capsule())
    }
  }
}
