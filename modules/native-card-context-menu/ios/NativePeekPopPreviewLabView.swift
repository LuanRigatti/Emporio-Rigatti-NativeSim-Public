import ExpoModulesCore
import UIKit

public final class NativePeekPopPreviewLabView: ExpoView {
  let onClose = EventDispatcher()
  let onAction = EventDispatcher()
  let onOpen = EventDispatcher()

  var identifier = "" {
    didSet { updateConfiguration() }
  }
  var previewContent: [String: Any] = [:] {
    didSet { updateConfiguration() }
  }
  var actions: [[String: Any]] = [] {
    didSet { updateConfiguration() }
  }
  var menuTitle = "" {
    didSet { updateConfiguration() }
  }
  var secondaryCard: [String: Any]? {
    didSet { updateConfiguration() }
  }

  private weak var hostViewController: UIViewController?
  private var navigationController: UINavigationController?
  private var rootViewController: NativePeekPopPreviewLabRootViewController?

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .systemGroupedBackground
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      removeNavigationController()
    } else {
      installNavigationControllerIfPossible()
    }
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    installNavigationControllerIfPossible()
  }

  private func installNavigationControllerIfPossible() {
    guard window != nil,
          navigationController == nil,
          let hostViewController = nearestViewController() else {
      return
    }

    let rootViewController = NativePeekPopPreviewLabRootViewController(
      identifier: identifier,
      previewContent: previewContent,
      actions: actions,
      menuTitle: menuTitle,
      secondaryCard: secondaryCard,
      onClose: { [weak self] identifier in
        self?.onClose(["identifier": identifier])
      },
      onAction: { [weak self] identifier, actionId in
        self?.onAction(["identifier": identifier, "actionId": actionId])
      },
      onOpen: { [weak self] identifier, preview in
        self?.onOpen(["identifier": identifier, "preview": preview])
      }
    )
    let navigationController = UINavigationController(rootViewController: rootViewController)
    navigationController.navigationBar.prefersLargeTitles = false
    navigationController.view.backgroundColor = .systemGroupedBackground
    navigationController.view.translatesAutoresizingMaskIntoConstraints = false

    hostViewController.addChild(navigationController)
    addSubview(navigationController.view)
    NSLayoutConstraint.activate([
      navigationController.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      navigationController.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      navigationController.view.topAnchor.constraint(equalTo: topAnchor),
      navigationController.view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
    navigationController.didMove(toParent: hostViewController)

    self.hostViewController = hostViewController
    self.navigationController = navigationController
    self.rootViewController = rootViewController
  }

  private func removeNavigationController() {
    guard let navigationController else {
      return
    }

    navigationController.willMove(toParent: nil)
    navigationController.view.removeFromSuperview()
    navigationController.removeFromParent()
    self.navigationController = nil
    rootViewController = nil
    hostViewController = nil
  }

  private func nearestViewController() -> UIViewController? {
    var responder: UIResponder? = self
    while let currentResponder = responder {
      if let viewController = currentResponder as? UIViewController {
        return viewController
      }
      responder = currentResponder.next
    }
    return nil
  }

  private func updateConfiguration() {
    rootViewController?.configure(
      identifier: identifier,
      previewContent: previewContent,
      actions: actions,
      menuTitle: menuTitle,
      secondaryCard: secondaryCard
    )
  }
}

private final class NativePeekPopPreviewLabRootViewController: UIViewController {
  private let cardView = UIView()
  private let avatarView = UIImageView()
  private let titleLabel = UILabel()
  private let valueLabel = UILabel()
  private let instructionLabel = UILabel()
  private let secondaryTitleLabel = UILabel()
  private let secondaryCardView = UIView()
  private let secondaryAvatarView = UIImageView()
  private let secondaryCustomerLabel = UILabel()
  private let secondaryValueLabel = UILabel()

  private var identifier: String
  private var previewContent: [String: Any]
  private var actions: [[String: Any]]
  private var menuTitle: String
  private var secondaryCard: [String: Any]?
  private let onClose: (String) -> Void
  private let onAction: (String, String) -> Void
  private let onOpen: (String, [String: Any]) -> Void
  private var coordinator: NativeContextMenuPreviewCoordinator?
  private var secondaryCoordinator: NativeContextMenuPreviewCoordinator?

  init(
    identifier: String,
    previewContent: [String: Any],
    actions: [[String: Any]],
    menuTitle: String,
    secondaryCard: [String: Any]?,
    onClose: @escaping (String) -> Void,
    onAction: @escaping (String, String) -> Void,
    onOpen: @escaping (String, [String: Any]) -> Void
  ) {
    self.identifier = identifier
    self.previewContent = previewContent
    self.actions = actions
    self.menuTitle = menuTitle
    self.secondaryCard = secondaryCard
    self.onClose = onClose
    self.onAction = onAction
    self.onOpen = onOpen
    super.init(nibName: nil, bundle: nil)
    title = "Teste de prévia nativa"
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    buildLayout()
    configureCoordinator()
    updateTriggerCard()
  }

  func configure(
    identifier: String,
    previewContent: [String: Any],
    actions: [[String: Any]],
    menuTitle: String,
    secondaryCard: [String: Any]?
  ) {
    self.identifier = identifier
    self.previewContent = previewContent
    self.actions = actions
    self.menuTitle = menuTitle
    self.secondaryCard = secondaryCard
    coordinator?.identifier = identifier
    coordinator?.previewContent = previewContent
    coordinator?.actions = actions
    coordinator?.menuTitle = menuTitle
    configureSecondaryCoordinator()
    if isViewLoaded {
      updateTriggerCard()
    }
  }

  private func buildLayout() {
    view.backgroundColor = .systemGroupedBackground
    navigationItem.leftBarButtonItem = UIBarButtonItem(
      title: "Voltar",
      style: .plain,
      target: self,
      action: #selector(closeLab)
    )

    let contentStack = UIStackView()
    contentStack.axis = .vertical
    contentStack.spacing = 16
    contentStack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(contentStack)

    cardView.backgroundColor = .secondarySystemGroupedBackground
    cardView.layer.cornerRadius = 28
    cardView.layer.cornerCurve = .continuous
    cardView.translatesAutoresizingMaskIntoConstraints = false
    contentStack.addArrangedSubview(cardView)

    let cardContents = UIStackView()
    cardContents.axis = .horizontal
    cardContents.alignment = .center
    cardContents.spacing = 16
    cardContents.translatesAutoresizingMaskIntoConstraints = false
    cardView.addSubview(cardContents)

    avatarView.tintColor = .secondaryLabel
    avatarView.backgroundColor = .tertiarySystemGroupedBackground
    avatarView.contentMode = .scaleAspectFit
    avatarView.layer.cornerRadius = 28
    avatarView.layer.cornerCurve = .continuous
    avatarView.clipsToBounds = true
    avatarView.translatesAutoresizingMaskIntoConstraints = false
    avatarView.widthAnchor.constraint(equalToConstant: 56).isActive = true
    avatarView.heightAnchor.constraint(equalToConstant: 56).isActive = true
    cardContents.addArrangedSubview(avatarView)

    let labels = UIStackView()
    labels.axis = .vertical
    labels.spacing = 4
    labels.addArrangedSubview(titleLabel)
    cardContents.addArrangedSubview(labels)

    titleLabel.font = UIFont.preferredFont(forTextStyle: .headline)
    titleLabel.adjustsFontForContentSizeCategory = true
    titleLabel.textColor = .label
    titleLabel.numberOfLines = 0

    let semiboldBodyFont = UIFont.systemFont(ofSize: 17, weight: .semibold)
    valueLabel.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: semiboldBodyFont)
    valueLabel.adjustsFontForContentSizeCategory = true
    valueLabel.textColor = .label
    valueLabel.numberOfLines = 1
    cardContents.addArrangedSubview(valueLabel)

    instructionLabel.font = UIFont.preferredFont(forTextStyle: .footnote)
    instructionLabel.adjustsFontForContentSizeCategory = true
    instructionLabel.textColor = .secondaryLabel
    instructionLabel.numberOfLines = 0
    instructionLabel.text = "Pressione e segure o card para abrir a prévia."
    contentStack.addArrangedSubview(instructionLabel)

    secondaryTitleLabel.font = UIFont.preferredFont(forTextStyle: .headline)
    secondaryTitleLabel.adjustsFontForContentSizeCategory = true
    secondaryTitleLabel.textColor = .label
    secondaryTitleLabel.numberOfLines = 0
    contentStack.addArrangedSubview(secondaryTitleLabel)

    secondaryCardView.backgroundColor = .secondarySystemGroupedBackground
    secondaryCardView.layer.cornerRadius = 28
    secondaryCardView.layer.cornerCurve = .continuous
    secondaryCardView.translatesAutoresizingMaskIntoConstraints = false
    contentStack.addArrangedSubview(secondaryCardView)

    let secondaryCardContents = UIStackView()
    secondaryCardContents.axis = .horizontal
    secondaryCardContents.alignment = .center
    secondaryCardContents.spacing = 16
    secondaryCardContents.translatesAutoresizingMaskIntoConstraints = false
    secondaryCardView.addSubview(secondaryCardContents)

    secondaryAvatarView.tintColor = .secondaryLabel
    secondaryAvatarView.backgroundColor = .tertiarySystemGroupedBackground
    secondaryAvatarView.contentMode = .scaleAspectFit
    secondaryAvatarView.layer.cornerRadius = 28
    secondaryAvatarView.layer.cornerCurve = .continuous
    secondaryAvatarView.clipsToBounds = true
    secondaryAvatarView.translatesAutoresizingMaskIntoConstraints = false
    secondaryAvatarView.widthAnchor.constraint(equalToConstant: 56).isActive = true
    secondaryAvatarView.heightAnchor.constraint(equalToConstant: 56).isActive = true
    secondaryCardContents.addArrangedSubview(secondaryAvatarView)

    let secondaryLabels = UIStackView()
    secondaryLabels.axis = .vertical
    secondaryLabels.spacing = 4
    secondaryLabels.addArrangedSubview(secondaryCustomerLabel)
    secondaryCardContents.addArrangedSubview(secondaryLabels)

    secondaryCustomerLabel.font = UIFont.preferredFont(forTextStyle: .headline)
    secondaryCustomerLabel.adjustsFontForContentSizeCategory = true
    secondaryCustomerLabel.textColor = .label
    secondaryCustomerLabel.numberOfLines = 0

    secondaryValueLabel.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: semiboldBodyFont)
    secondaryValueLabel.adjustsFontForContentSizeCategory = true
    secondaryValueLabel.textColor = .label
    secondaryValueLabel.numberOfLines = 1
    secondaryCardContents.addArrangedSubview(secondaryValueLabel)

    NSLayoutConstraint.activate([
      contentStack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
      contentStack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
      contentStack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
      cardContents.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 18),
      cardContents.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -18),
      cardContents.topAnchor.constraint(equalTo: cardView.topAnchor, constant: 18),
      cardContents.bottomAnchor.constraint(equalTo: cardView.bottomAnchor, constant: -18),
      secondaryCardContents.leadingAnchor.constraint(equalTo: secondaryCardView.leadingAnchor, constant: 18),
      secondaryCardContents.trailingAnchor.constraint(equalTo: secondaryCardView.trailingAnchor, constant: -18),
      secondaryCardContents.topAnchor.constraint(equalTo: secondaryCardView.topAnchor, constant: 18),
      secondaryCardContents.bottomAnchor.constraint(equalTo: secondaryCardView.bottomAnchor, constant: -18),
    ])
  }

  private func configureCoordinator() {
    let coordinator = NativeContextMenuPreviewCoordinator(
      attachingTo: cardView,
      commitBehavior: .pushPreviewController
    )
    coordinator.navigationControllerProvider = { [weak self] in self?.navigationController }
    coordinator.onAction = { [weak self] identifier, actionId in
      self?.onAction(identifier, actionId)
    }
    coordinator.onOpen = { [weak self] identifier, preview in
      self?.onOpen(identifier, preview)
    }
    self.coordinator = coordinator
    configure(
      identifier: identifier,
      previewContent: previewContent,
      actions: actions,
      menuTitle: menuTitle,
      secondaryCard: secondaryCard
    )
  }

  private func configureSecondaryCoordinator() {
    guard let secondaryCard else {
      secondaryTitleLabel.isHidden = true
      secondaryCardView.isHidden = true
      secondaryCoordinator?.identifier = ""
      return
    }

    secondaryTitleLabel.text = secondaryCard["title"] as? String
    secondaryTitleLabel.isHidden = false
    secondaryCardView.isHidden = false

    let identifier = secondaryCard["identifier"] as? String ?? ""
    let preview = secondaryCard["preview"] as? [String: Any] ?? [:]
    let actions = secondaryCard["actions"] as? [[String: Any]] ?? []
    let menuTitle = secondaryCard["menuTitle"] as? String ?? ""
    let presentationStyle = NativeContextMenuPreviewPresentationStyle(
      rawValue: secondaryCard["presentationStyle"] as? String ?? "page"
    ) ?? .page

    if secondaryCoordinator == nil {
      let secondaryCoordinator = NativeContextMenuPreviewCoordinator(
        attachingTo: secondaryCardView,
        commitBehavior: .pushPreviewController
      )
      secondaryCoordinator.navigationControllerProvider = { [weak self] in self?.navigationController }
      secondaryCoordinator.onAction = { [weak self] identifier, actionId in
        self?.onAction(identifier, actionId)
      }
      secondaryCoordinator.onOpen = { [weak self] identifier, preview in
        self?.onOpen(identifier, preview)
      }
      self.secondaryCoordinator = secondaryCoordinator
    }

    secondaryCoordinator?.identifier = identifier
    secondaryCoordinator?.previewContent = preview
    secondaryCoordinator?.actions = actions
    secondaryCoordinator?.menuTitle = menuTitle
    secondaryCoordinator?.presentationStyle = presentationStyle
    updateSecondaryTriggerCard(preview: preview)
  }

  private func updateTriggerCard() {
    titleLabel.text = previewContent["title"] as? String
    if let summary = previewContent["summary"] as? [String: Any] {
      valueLabel.text = summary["value"] as? String
    } else {
      valueLabel.text = nil
    }
    let symbolName = previewContent["leadingSystemImage"] as? String ?? "person.crop.circle.fill"
    avatarView.image = UIImage(systemName: symbolName)
  }

  private func updateSecondaryTriggerCard(preview: [String: Any]) {
    secondaryCustomerLabel.text = preview["title"] as? String
    if let summary = preview["summary"] as? [String: Any] {
      secondaryValueLabel.text = summary["value"] as? String
    } else {
      secondaryValueLabel.text = nil
    }
    let symbolName = preview["leadingSystemImage"] as? String ?? "person.crop.circle.fill"
    secondaryAvatarView.image = UIImage(systemName: symbolName)
  }

  @objc private func closeLab() {
    onClose(identifier)
  }
}
