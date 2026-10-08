import UIKit

final class NativeContextMenuPreviewViewController: UIViewController {
  private let content: [String: Any]
  private let presentationStyle: NativeContextMenuPreviewPresentationStyle
  private let scrollView = UIScrollView()
  private let cardView = UIView()
  private let contentStack = UIStackView()

  init(
    content: [String: Any],
    presentationStyle: NativeContextMenuPreviewPresentationStyle = .page
  ) {
    self.content = content
    self.presentationStyle = presentationStyle
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

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    updatePreferredContentSize()
  }

  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    if traitCollection.preferredContentSizeCategory
      != previousTraitCollection?.preferredContentSizeCategory {
      view.setNeedsLayout()
    }
  }

  private func buildLayout() {
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
    cardView.layer.cornerRadius = 28
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
    container.backgroundColor = .secondarySystemGroupedBackground
    container.layer.cornerRadius = 20
    container.layer.cornerCurve = .continuous

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
      labels.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 16),
      labels.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -16),
      labels.topAnchor.constraint(equalTo: container.topAnchor, constant: 16),
      labels.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -16),
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
    guard let window = view.window else {
      if preferredContentSize == .zero {
        let height: CGFloat = presentationStyle == .expandedPanel ? 520 : 420
        preferredContentSize = CGSize(width: 360, height: height)
      }
      return
    }

    let screenBounds = window.windowScene?.screen.bounds ?? window.bounds
    let safeHeight = screenBounds.height - window.safeAreaInsets.top - window.safeAreaInsets.bottom
    let maxHeight: CGFloat = presentationStyle == .expandedPanel ? 560 : 460
    let minHeight: CGFloat = presentationStyle == .expandedPanel ? 320 : 240
    let height = min(maxHeight, max(minHeight, safeHeight - 180))
    let width = min(400, max(280, screenBounds.width - 32))
    let nextSize = CGSize(width: width, height: height)

    if abs(preferredContentSize.width - nextSize.width) > 1
      || abs(preferredContentSize.height - nextSize.height) > 1 {
      preferredContentSize = nextSize
    }
  }
}
