import ExpoModulesCore
import SwiftUI

public final class NativeInteractivePagerViewProps: ExpoSwiftUI.ViewProps {
  @Field var fillWidth: Bool = false
  @Field var initialPage: Int = 0
  @Field var requestedPage: Int?
  @Field var requestID: Int = 0

  var onGeometry = EventDispatcher()
  var onPageSettled = EventDispatcher()
}

public final class NativeInteractivePagerPageProps: ExpoSwiftUI.ViewProps {
  @Field var page: Int = 0
}

struct NativeInteractivePagerPage: ExpoSwiftUI.View {
  @ObservedObject var props: NativeInteractivePagerPageProps

  init(props: NativeInteractivePagerPageProps) {
    self.props = props
  }

  var body: some View {
    Children()
  }
}

public struct NativeInteractivePagerView: ExpoSwiftUI.View {
  @ObservedObject public var props: NativeInteractivePagerViewProps
  @State private var currentPage = 0
  @State private var lastRequestID = 0
  @State private var hasAppeared = false

  public init(props: NativeInteractivePagerViewProps) {
    self.props = props
  }

  public var body: some View {
    let pages = props.children?.compactMap(Self.unwrapPage) ?? []

    let pager = SwiftUI.TabView(selection: $currentPage) {
      ForEach(pages, id: \.props.page) { page in
        Self.pageContent(for: page, props: props, selectedPage: currentPage)
          .tag(page.props.page)
      }
    }
    .tabViewStyle(.page(indexDisplayMode: .never))
    .background {
      GeometryReader { geometry in
        Color.clear
          .onAppear {
            Self.reportGeometry(
              props: props,
              layer: "tab-view",
              page: nil,
              selectedPage: currentPage,
              frame: geometry.frame(in: .global)
            )
          }
          .onChange(of: geometry.frame(in: .global)) { frame in
            Self.reportGeometry(
              props: props,
              layer: "tab-view",
              page: nil,
              selectedPage: currentPage,
              frame: frame
            )
          }
      }
    }
    let sizedPager = props.fillWidth
      ? AnyView(pager.frame(maxWidth: .infinity, alignment: .topLeading).clipped())
      : AnyView(pager)

    return sizedPager
      .background {
        GeometryReader { geometry in
          Color.clear
            .onAppear {
              Self.reportGeometry(
                props: props,
                layer: "pager",
                page: nil,
                selectedPage: currentPage,
                frame: geometry.frame(in: .global)
              )
            }
            .onChange(of: geometry.frame(in: .global)) { frame in
              Self.reportGeometry(
                props: props,
                layer: "pager",
                page: nil,
                selectedPage: currentPage,
                frame: frame
              )
            }
        }
      }
      .onAppear {
      guard !hasAppeared else { return }
      hasAppeared = true
      lastRequestID = props.requestID
      currentPage = Self.resolvePage(props.initialPage, in: pages)
    }
    .onChange(of: props.requestID) { requestID in
      guard requestID != lastRequestID else { return }
      lastRequestID = requestID

      guard let requestedPage = props.requestedPage else { return }
      let nextPage = Self.resolvePage(requestedPage, in: pages)
      guard nextPage != currentPage else { return }

      withAnimation(.spring(response: 0.42, dampingFraction: 0.86)) {
        currentPage = nextPage
      }
    }
    .onChange(of: currentPage) { page in
      props.onPageSettled(["page": page])
    }
  }

  private static func resolvePage(_ requestedPage: Int, in pages: [NativeInteractivePagerPage]) -> Int {
    pages.first(where: { $0.props.page == requestedPage })?.props.page ?? pages.first?.props.page ?? 0
  }

  private static func pageContent(
    for page: NativeInteractivePagerPage,
    props: NativeInteractivePagerViewProps,
    selectedPage: Int
  ) -> AnyView {
    let fillWidth = props.fillWidth
    let content = AnyView(
      ForEach(page.props.children ?? [], id: \.id) { child in
        eraseChildView(child)
      }
    )
    let sizedContent = fillWidth
      ? AnyView(content.frame(maxWidth: .infinity, alignment: .topLeading))
      : content

    return AnyView(
      sizedContent.background {
        GeometryReader { geometry in
          Color.clear
            .onAppear {
              Self.reportGeometry(
                props: props,
                layer: "page",
                page: page.props.page,
                selectedPage: selectedPage,
                frame: geometry.frame(in: .global)
              )
            }
            .onChange(of: geometry.frame(in: .global)) { frame in
              Self.reportGeometry(
                props: props,
                layer: "page",
                page: page.props.page,
                selectedPage: selectedPage,
                frame: frame
              )
            }
        }
      }
    )
  }

  private static func reportGeometry(
    props: NativeInteractivePagerViewProps,
    layer: String,
    page: Int?,
    selectedPage: Int,
    frame: CGRect
  ) {
    #if DEBUG
    let pageString = page.map { String($0) } ?? "none"
    props.onGeometry([
      "fillWidth": props.fillWidth,
      "height": Double(frame.height),
      "layer": layer,
      "page": page ?? NSNull(),
      "selectedPage": selectedPage,
      "width": Double(frame.width),
      "x": Double(frame.origin.x),
      "y": Double(frame.origin.y),
    ])
    print(
      "[bottom-sheet-geometry] scope=native-interactive-pager layer=\(layer) page=\(pageString) selectedPage=\(selectedPage) fillWidth=\(props.fillWidth) x=\(frame.origin.x) y=\(frame.origin.y) width=\(frame.size.width) height=\(frame.size.height)"
    )
    #endif
  }

  private static func eraseChildView<Child: ExpoSwiftUI.AnyChild>(_ child: Child) -> AnyView {
    AnyView(child.childView)
  }

  private static func unwrapPage(_ child: any ExpoSwiftUI.AnyChild) -> NativeInteractivePagerPage? {
    if let page = child as? NativeInteractivePagerPage {
      return page
    }

    if let wrapper = child as? ExpoSwiftUI.ViewWrapper {
      return wrapper.getWrappedView() as? NativeInteractivePagerPage
    }

    return nil
  }
}
