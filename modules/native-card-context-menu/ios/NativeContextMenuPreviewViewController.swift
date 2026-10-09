import UIKit

final class NativeContextMenuPreviewViewController: UIViewController {
  private static let previewCardCornerRadius: CGFloat = 28
  // Matches open-payment cards: theme.radius.xl (22) + theme.spacing.sm (12).
  private static let expandedCardCornerRadius: CGFloat = 34

  private let content: [String: Any]
  private let presentationStyle: NativeContextMenuPreviewPresentationStyle
  private var currentThemeAppearance: [String: Any]?
  private let scrollView = UIScrollView()
  private let cardView = UIView()
  private let contentStack = UIStackView()
  private let viewerSurfaceView = UIView()
  private weak var expandedPageNavigationBar: UINavigationBar?
  private var expandedPageAppearanceSnapshot: ExpandedPageAppearanceSnapshot?
  weak var transitionSourceView: UIView?
  private weak var commitNavigationController: UINavigationController?
  private var interactiveDismissCoordinator: NativePeekPopInteractiveDismissCoordinator?

  private struct ExpandedPageAppearanceSnapshot {
    let viewBackgroundColor: UIColor?
    let cardBackgroundColor: UIColor?
    let navigationBarBackgroundColor: UIColor?
    let standardAppearance: UINavigationBarAppearance
    let scrollEdgeAppearance: UINavigationBarAppearance?
    let compactAppearance: UINavigationBarAppearance?
    let compactScrollEdgeAppearance: UINavigationBarAppearance?
  }

  var usesInteractiveViewer: Bool { presentationStyle == .interactiveViewer }

  init(
    content: [String: Any],
    presentationStyle: NativeContextMenuPreviewPresentationStyle = .page
  ) {
    self.content = content
    self.presentationStyle = presentationStyle
    currentThemeAppearance = content["appearance"] as? [String: Any]
    super.init(nibName: nil, bundle: nil)
    title = content["title"] as? String
    navigationItem.largeTitleDisplayMode = .never
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    buildLayout()
    buildContent()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    installInteractiveDismissCoordinatorIfNeeded()
  }

  override func accessibilityPerformEscape() -> Bool {
    guard usesInteractiveViewer,
          navigationController?.topViewController === self else {
      return super.accessibilityPerformEscape()
    }

    navigationController?.popViewController(animated: true)
    return true
  }

  func prepareForInteractiveViewer(in navigationController: UINavigationController) {
    guard usesInteractiveViewer else {
      return
    }
    commitNavigationController = navigationController
    navigationController.view.isUserInteractionEnabled = true
    navigationController.setNavigationBarHidden(true, animated: false)
  }

  func prepareForExpandedPagePresentation(in navigationController: UINavigationController) {
    guard presentationStyle == .page else { return }
    navigationItem.largeTitleDisplayMode = .always
    cardView.layer.cornerRadius = Self.expandedCardCornerRadius
    applyThemeAppearanceIfPresent(in: navigationController.navigationBar)
    updateExpandedPageLargeTitleAppearance(in: navigationController)
  }

  func restorePeekPresentation() {
    guard presentationStyle == .page else { return }
    navigationItem.largeTitleDisplayMode = .never
    cardView.layer.cornerRadius = Self.previewCardCornerRadius
    restoreThemeAppearance()
  }

  func updateExpandedPageThemeAppearance(_ appearance: [String: Any]?) {
    guard presentationStyle == .page else {
      return
    }
    currentThemeAppearance = appearance
    if let navigationBar = expandedPageNavigationBar {
      applyThemeAppearance(appearance, in: navigationBar)
    }
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    if usesInteractiveViewer {
      let bottomInset = view.safeAreaInsets.bottom
      if scrollView.contentInset.bottom != bottomInset {
        scrollView.contentInset.bottom = bottomInset
        scrollView.verticalScrollIndicatorInsets.bottom = bottomInset
      }
    }
    updatePreferredContentSize()
  }

  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    if traitCollection.preferredContentSizeCategory
      != previousTraitCollection?.preferredContentSizeCategory {
      view.setNeedsLayout()
      if navigationItem.largeTitleDisplayMode == .always,
         let navigationController {
        updateExpandedPageLargeTitleAppearance(in: navigationController)
      }
    }
  }

  private func updateExpandedPageLargeTitleAppearance(in navigationController: UINavigationController) {
    let baseFont = UIFont.systemFont(ofSize: 36, weight: .bold)
    let font = UIFontMetrics(forTextStyle: .largeTitle).scaledFont(
      for: baseFont,
      compatibleWith: traitCollection
    )
    navigationController.navigationBar.largeTitleTextAttributes = [
      .font: font,
      .foregroundColor: UIColor.label,
    ]
  }

  private func applyThemeAppearanceIfPresent(in navigationBar: UINavigationBar) {
    applyThemeAppearance(currentThemeAppearance, in: navigationBar)
  }

  private func applyThemeAppearance(
    _ appearance: [String: Any]?,
    in navigationBar: UINavigationBar
  ) {
    guard let appearance else { return }
    let pageColor = Self.themeColor(from: appearance["pageBackgroundColor"])
    let cardColor = Self.themeColor(from: appearance["cardSurfaceColor"])
    guard pageColor != nil || cardColor != nil else { return }

    if expandedPageAppearanceSnapshot == nil {
      expandedPageNavigationBar = navigationBar
      expandedPageAppearanceSnapshot = ExpandedPageAppearanceSnapshot(
        viewBackgroundColor: view.backgroundColor,
        cardBackgroundColor: cardView.backgroundColor,
        navigationBarBackgroundColor: navigationBar.backgroundColor,
        standardAppearance: Self.copyAppearance(navigationBar.standardAppearance),
        scrollEdgeAppearance: navigationBar.scrollEdgeAppearance.map(Self.copyAppearance),
        compactAppearance: navigationBar.compactAppearance.map(Self.copyAppearance),
        compactScrollEdgeAppearance: navigationBar.compactScrollEdgeAppearance.map(Self.copyAppearance)
      )
    }

    if let pageColor {
      view.backgroundColor = pageColor
      navigationBar.backgroundColor = pageColor
      navigationBar.standardAppearance = Self.appearance(
        basedOn: navigationBar.standardAppearance,
        backgroundColor: pageColor
      )
      navigationBar.scrollEdgeAppearance = Self.appearance(
        basedOn: navigationBar.scrollEdgeAppearance ?? navigationBar.standardAppearance,
        backgroundColor: pageColor
      )
      navigationBar.compactAppearance = Self.appearance(
        basedOn: navigationBar.compactAppearance ?? navigationBar.standardAppearance,
        backgroundColor: pageColor
      )
      navigationBar.compactScrollEdgeAppearance = Self.appearance(
        basedOn: navigationBar.compactScrollEdgeAppearance ?? navigationBar.standardAppearance,
        backgroundColor: pageColor
      )
    }

    if let cardColor {
      cardView.backgroundColor = cardColor
    }
  }

  private func restoreThemeAppearance() {
    guard let snapshot = expandedPageAppearanceSnapshot else { return }
    view.backgroundColor = snapshot.viewBackgroundColor
    cardView.backgroundColor = snapshot.cardBackgroundColor

    if let navigationBar = expandedPageNavigationBar {
      navigationBar.backgroundColor = snapshot.navigationBarBackgroundColor
      navigationBar.standardAppearance = Self.copyAppearance(snapshot.standardAppearance)
      navigationBar.scrollEdgeAppearance = snapshot.scrollEdgeAppearance.map(Self.copyAppearance)
      navigationBar.compactAppearance = snapshot.compactAppearance.map(Self.copyAppearance)
      navigationBar.compactScrollEdgeAppearance = snapshot.compactScrollEdgeAppearance.map(Self.copyAppearance)
    }

    expandedPageNavigationBar = nil
    expandedPageAppearanceSnapshot = nil
  }

  private static func themeColor(from value: Any?) -> UIColor? {
    guard let hex = value as? String,
          hex.count == 7,
          hex.first == "#",
          let rgb = UInt32(hex.dropFirst(), radix: 16) else {
      return nil
    }

    return UIColor(
      red: CGFloat((rgb >> 16) & 0xFF) / 255,
      green: CGFloat((rgb >> 8) & 0xFF) / 255,
      blue: CGFloat(rgb & 0xFF) / 255,
      alpha: 1
    )
  }

  private static func copyAppearance(_ appearance: UINavigationBarAppearance) -> UINavigationBarAppearance {
    appearance.copy() as? UINavigationBarAppearance ?? UINavigationBarAppearance()
  }

  private static func appearance(
    basedOn appearance: UINavigationBarAppearance,
    backgroundColor: UIColor
  ) -> UINavigationBarAppearance {
    let themedAppearance = copyAppearance(appearance)
    themedAppearance.backgroundEffect = nil
    themedAppearance.backgroundColor = backgroundColor
    return themedAppearance
  }

  private func buildLayout() {
    if usesInteractiveViewer {
      buildInteractiveViewerLayout()
      return
    }

    if presentationStyle == .expandedPanel {
      buildExpandedPanelLayout()
      return
    }

    view.backgroundColor = .secondarySystemGroupedBackground

    scrollView.translatesAutoresizingMaskIntoConstraints = false
    scrollView.alwaysBounceVertical = false
    scrollView.showsVerticalScrollIndicator = false
    view.addSubview(scrollView)

    cardView.translatesAutoresizingMaskIntoConstraints = false
    cardView.backgroundColor = .systemBackground
    cardView.layer.cornerRadius = Self.previewCardCornerRadius
    cardView.layer.cornerCurve = .continuous
    scrollView.addSubview(cardView)

    contentStack.translatesAutoresizingMaskIntoConstraints = false
    contentStack.axis = .vertical
    contentStack.spacing = 22
    cardView.addSubview(contentStack)

    NSLayoutConstraint.activate([
      scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      scrollView.topAnchor.constraint(equalTo: view.topAnchor),
      scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      cardView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 14),
      cardView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -14),
      cardView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 14),
      cardView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -14),
      cardView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -28),
      contentStack.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 22),
      contentStack.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -22),
      contentStack.topAnchor.constraint(equalTo: cardView.topAnchor, constant: 24),
      contentStack.bottomAnchor.constraint(equalTo: cardView.bottomAnchor, constant: -24),
    ])
  }

  private func buildInteractiveViewerLayout() {
    let safeArea = view.safeAreaLayoutGuide
    view.backgroundColor = .clear
    view.isOpaque = false

    viewerSurfaceView.translatesAutoresizingMaskIntoConstraints = false
    viewerSurfaceView.backgroundColor = .systemBackground
    viewerSurfaceView.layer.cornerRadius = 32
    viewerSurfaceView.layer.cornerCurve = .continuous
    viewerSurfaceView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
    viewerSurfaceView.clipsToBounds = true
    view.addSubview(viewerSurfaceView)

    scrollView.translatesAutoresizingMaskIntoConstraints = false
    scrollView.backgroundColor = .clear
    scrollView.alwaysBounceVertical = false
    scrollView.showsVerticalScrollIndicator = false
    scrollView.contentInsetAdjustmentBehavior = .never
    viewerSurfaceView.addSubview(scrollView)

    contentStack.translatesAutoresizingMaskIntoConstraints = false
    contentStack.axis = .vertical
    contentStack.spacing = 24
    scrollView.addSubview(contentStack)

    NSLayoutConstraint.activate([
      viewerSurfaceView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      viewerSurfaceView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      viewerSurfaceView.topAnchor.constraint(equalTo: safeArea.topAnchor),
      viewerSurfaceView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      scrollView.leadingAnchor.constraint(equalTo: viewerSurfaceView.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: viewerSurfaceView.trailingAnchor),
      scrollView.topAnchor.constraint(equalTo: viewerSurfaceView.topAnchor),
      scrollView.bottomAnchor.constraint(equalTo: viewerSurfaceView.bottomAnchor),
      contentStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 24),
      contentStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -24),
      contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 28),
      contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28),
      contentStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -48),
    ])
  }

  private func installInteractiveDismissCoordinatorIfNeeded() {
    guard usesInteractiveViewer,
          interactiveDismissCoordinator == nil,
          let navigationController = commitNavigationController,
          self.navigationController === navigationController,
          navigationController.topViewController === self else {
      return
    }

    interactiveDismissCoordinator = NativePeekPopInteractiveDismissCoordinator(
      navigationController: navigationController,
      viewerController: self,
      scrollView: scrollView,
      gestureView: viewerSurfaceView
    )
  }

  private func buildExpandedPanelLayout() {
    let safeArea = view.safeAreaLayoutGuide
    view.backgroundColor = .systemGroupedBackground

    cardView.translatesAutoresizingMaskIntoConstraints = false
    cardView.backgroundColor = .systemBackground
    cardView.layer.cornerRadius = 32
    cardView.layer.cornerCurve = .continuous
    cardView.clipsToBounds = true
    view.addSubview(cardView)

    scrollView.translatesAutoresizingMaskIntoConstraints = false
    scrollView.alwaysBounceVertical = false
    scrollView.showsVerticalScrollIndicator = false
    cardView.addSubview(scrollView)

    contentStack.translatesAutoresizingMaskIntoConstraints = false
    contentStack.axis = .vertical
    contentStack.spacing = 22
    scrollView.addSubview(contentStack)

    let preferredWidth = cardView.widthAnchor.constraint(equalTo: safeArea.widthAnchor, constant: -32)
    preferredWidth.priority = .defaultHigh

    NSLayoutConstraint.activate([
      cardView.centerXAnchor.constraint(equalTo: safeArea.centerXAnchor),
      cardView.centerYAnchor.constraint(equalTo: safeArea.centerYAnchor),
      cardView.widthAnchor.constraint(lessThanOrEqualToConstant: 640),
      cardView.leadingAnchor.constraint(greaterThanOrEqualTo: safeArea.leadingAnchor, constant: 16),
      cardView.trailingAnchor.constraint(lessThanOrEqualTo: safeArea.trailingAnchor, constant: -16),
      cardView.heightAnchor.constraint(equalTo: safeArea.heightAnchor, multiplier: 0.82),
      preferredWidth,
      scrollView.leadingAnchor.constraint(equalTo: cardView.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: cardView.trailingAnchor),
      scrollView.topAnchor.constraint(equalTo: cardView.topAnchor),
      scrollView.bottomAnchor.constraint(equalTo: cardView.bottomAnchor),
      contentStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 24),
      contentStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -24),
      contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 24),
      contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
      contentStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -48),
    ])
  }

  private func buildContent() {
    contentStack.arrangedSubviews.forEach {
      contentStack.removeArrangedSubview($0)
      $0.removeFromSuperview()
    }

    contentStack.addArrangedSubview(makeHeader())

    if let summary = content["summary"] as? [String: Any] {
      contentStack.addArrangedSubview(makeSummary(summary))
    }

    let sections = content["sections"] as? [[String: Any]] ?? []
    for section in sections {
      contentStack.addArrangedSubview(makeSection(section))
    }
  }

  private func makeHeader() -> UIView {
    let stack = UIStackView()
    stack.axis = .horizontal
    stack.alignment = .center
    stack.spacing = 16

    let avatar = UIImageView(
      image: UIImage(systemName: content["leadingSystemImage"] as? String ?? "person.crop.circle.fill")
    )
    avatar.translatesAutoresizingMaskIntoConstraints = false
    avatar.tintColor = .secondaryLabel
    avatar.backgroundColor = .secondarySystemGroupedBackground
    avatar.contentMode = .scaleAspectFit
    avatar.layer.cornerRadius = 30
    avatar.layer.cornerCurve = .continuous
    avatar.clipsToBounds = true
    avatar.setContentHuggingPriority(.required, for: .horizontal)
    avatar.widthAnchor.constraint(equalToConstant: 60).isActive = true
    avatar.heightAnchor.constraint(equalToConstant: 60).isActive = true
    stack.addArrangedSubview(avatar)

    let labels = UIStackView()
    labels.axis = .vertical
    labels.spacing = 4
    labels.addArrangedSubview(makeLabel(
      content["title"] as? String ?? "",
      style: .title3,
      weight: .semibold,
      color: .label
    ))
    if let subtitle = content["subtitle"] as? String, !subtitle.isEmpty {
      labels.addArrangedSubview(makeLabel(
        subtitle,
        style: .subheadline,
        weight: .regular,
        color: .secondaryLabel
      ))
    }
    stack.addArrangedSubview(labels)
    return stack
  }

  private func makeSummary(_ summary: [String: Any]) -> UIView {
    let container = UIView()
    if usesInteractiveViewer {
      container.backgroundColor = .clear
    } else {
      container.backgroundColor = .secondarySystemGroupedBackground
      container.layer.cornerRadius = 20
      container.layer.cornerCurve = .continuous
    }

    let labels = UIStackView()
    labels.translatesAutoresizingMaskIntoConstraints = false
    labels.axis = .vertical
    labels.spacing = 6
    labels.addArrangedSubview(makeLabel(
      summary["label"] as? String ?? "",
      style: .subheadline,
      weight: .regular,
      color: .secondaryLabel
    ))
    labels.addArrangedSubview(makeLabel(
      summary["value"] as? String ?? "",
      style: .title2,
      weight: .semibold,
      color: .label
    ))
    if let subtitle = summary["subtitle"] as? String, !subtitle.isEmpty {
      labels.addArrangedSubview(makeLabel(
        subtitle,
        style: .footnote,
        weight: .regular,
        color: .secondaryLabel
      ))
    }
    container.addSubview(labels)
    NSLayoutConstraint.activate([
      labels.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: usesInteractiveViewer ? 0 : 16),
      labels.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: usesInteractiveViewer ? 0 : -16),
      labels.topAnchor.constraint(equalTo: container.topAnchor, constant: usesInteractiveViewer ? 0 : 16),
      labels.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: usesInteractiveViewer ? 0 : -16),
    ])
    return container
  }

  private func makeSection(_ section: [String: Any]) -> UIView {
    let container = UIStackView()
    container.axis = .vertical
    container.spacing = 12

    if let title = section["title"] as? String, !title.isEmpty {
      container.addArrangedSubview(makeLabel(
        title,
        style: .headline,
        weight: .semibold,
        color: .label
      ))
    }

    let rows = section["rows"] as? [[String: Any]] ?? []
    for row in rows {
      container.addArrangedSubview(makeRow(row))
    }
    return container
  }

  private func makeRow(_ row: [String: Any]) -> UIView {
    let rowStack = UIStackView()
    rowStack.axis = .horizontal
    rowStack.alignment = .center
    rowStack.spacing = 14

    let leading = UIStackView()
    leading.axis = .vertical
    leading.spacing = 3
    if let systemImage = row["systemImage"] as? String {
      let icon = UIImageView(image: UIImage(systemName: systemImage))
      icon.tintColor = .secondaryLabel
      icon.contentMode = .scaleAspectFit
      icon.widthAnchor.constraint(equalToConstant: 20).isActive = true
      icon.heightAnchor.constraint(equalToConstant: 20).isActive = true
      leading.addArrangedSubview(icon)
    }
    leading.addArrangedSubview(makeLabel(
      row["title"] as? String ?? "",
      style: .body,
      weight: .regular,
      color: .label
    ))
    if let subtitle = row["subtitle"] as? String, !subtitle.isEmpty {
      leading.addArrangedSubview(makeLabel(
        subtitle,
        style: .footnote,
        weight: .regular,
        color: .secondaryLabel
      ))
    }
    rowStack.addArrangedSubview(leading)

    if let value = row["value"] as? String, !value.isEmpty {
      let valueLabel = makeLabel(value, style: .body, weight: .medium, color: .label)
      valueLabel.textAlignment = .right
      valueLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
      rowStack.addArrangedSubview(valueLabel)
    }

    return rowStack
  }

  private func makeLabel(
    _ text: String,
    style: UIFont.TextStyle,
    weight: UIFont.Weight,
    color: UIColor
  ) -> UILabel {
    let label = UILabel()
    label.text = text
    let weightedFont = UIFont.systemFont(ofSize: baseFontSize(for: style), weight: weight)
    label.font = UIFontMetrics(forTextStyle: style).scaledFont(for: weightedFont)
    label.textColor = color
    label.numberOfLines = 0
    label.adjustsFontForContentSizeCategory = true
    return label
  }

  private func baseFontSize(for style: UIFont.TextStyle) -> CGFloat {
    switch style {
    case .title2:
      return 22
    case .title3:
      return 20
    case .subheadline:
      return 15
    case .footnote:
      return 13
    default:
      return 17
    }
  }

  private func updatePreferredContentSize() {
    let preferredHeight: CGFloat
    let maxHeight: CGFloat
    let minHeight: CGFloat
    switch presentationStyle {
    case .page:
      preferredHeight = 420
      maxHeight = 460
      minHeight = 240
    case .expandedPanel, .interactiveViewer:
      preferredHeight = 520
      maxHeight = 560
      minHeight = 320
    }

    guard let window = view.window else {
      if preferredContentSize == .zero {
        preferredContentSize = CGSize(width: 360, height: preferredHeight)
      }
      return
    }

    let screenBounds = window.windowScene?.screen.bounds ?? window.bounds
    let safeHeight = screenBounds.height - window.safeAreaInsets.top - window.safeAreaInsets.bottom
    let height = min(maxHeight, max(minHeight, safeHeight - 180))
    let width = min(400, max(280, screenBounds.width - 32))
    let nextSize = CGSize(width: width, height: height)

    if abs(preferredContentSize.width - nextSize.width) > 1
      || abs(preferredContentSize.height - nextSize.height) > 1 {
      preferredContentSize = nextSize
    }
  }
}
