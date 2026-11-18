import SwiftUI

struct ContentView: View {
  @ObservedObject var model: WatchModel
  #if DEBUG
  @State private var page = UserDefaults.standard.integer(forKey: "page")   // -page 1 for screenshots
  #else
  @State private var page = 0
  #endif

  var body: some View {
    Group {
      switch model.state {
      case .loading:
        MessageView(title: String(localized: "Loading..."), action: nil)
      case .failed(let message):
        MessageView(title: message, action: { Task { await model.refresh() } })
      case .ready(let forecast):
        TabView(selection: $page) {
          DayView(title: String(localized: "Today"), day: forecast.today, settings: model.settings).tag(0)
          DayView(title: String(localized: "Tomorrow"), day: forecast.tomorrow, settings: model.settings).tag(1)
        }
        .tabViewStyle(.verticalPage)
      }
    }
    .task { await model.refresh() }
  }
}

/// One day, as on the iPhone: the title, the penguin, the big number, high or low, and the condition.
struct DayView: View {
  let title: String
  let day: DaySummary
  let settings: PenguinSettings

  var body: some View {
    VStack(spacing: 0) {
      Text(title)
        .font(.system(size: 15, weight: .light))
        .padding(.top, 2)
      Image(day.outfit.imageName)
        .resizable()
        .scaledToFit()
        .frame(maxHeight: .infinity)
        .accessibilityLabel(day.outfit.accessibilityLabel)
      HStack(alignment: .firstTextBaseline, spacing: 6) {
        Text(settings.format(day.temp))
          .font(.system(size: 34, weight: .thin))
        Text(detail)
          .font(.system(size: 13, weight: .light))
          .foregroundStyle(.secondary)
      }
      Text(day.summary)
        .font(.system(size: 13, weight: .light))
        .foregroundStyle(.secondary)
        .lineLimit(2)
        .multilineTextAlignment(.center)
    }
    .foregroundStyle(.black)
    // A paged view keeps about a fifth of the screen clear at the top and bottom; the penguin needs that room,
    // so the page takes the whole screen and keeps clear of the clock itself.
    .padding(.top, 30)
    .padding(.bottom, 10)
    .padding(.horizontal, 8)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .ignoresSafeArea()
    // painted directly: watchOS darkens a paged view's container background, and the penguin needs its pale blue
    .background {
      ZStack {
        Color("Sky")
        if day.rain { RainView() }
      }
      .ignoresSafeArea()
    }
  }

  private var detail: String {
    if let high = day.high { return String(localized: "High of \(settings.format(high))") }
    if let low = day.low { return String(localized: "Low of \(settings.format(low))") }
    return ""
  }
}

/// The hand-drawn raindrop tile, as on the iPhone, behind the penguin when it dresses for rain.
/// Drawn in a Canvas so the tile can be smaller than on the phone.
struct RainView: View {
  var body: some View {
    Canvas { context, size in
      let drop = context.resolve(Image("raindrop"))
      // two thirds of the phone's size: the watch screen is small
      let tile = CGSize(width: drop.size.width * 2 / 3, height: drop.size.height * 2 / 3)
      guard tile.width > 0, tile.height > 0 else { return }
      context.opacity = 0.7
      var y: CGFloat = 0
      while y < size.height {
        var x: CGFloat = 0
        while x < size.width {
          context.draw(drop, in: CGRect(origin: CGPoint(x: x, y: y), size: tile))
          x += tile.width
        }
        y += tile.height
      }
    }
    // fades out before the numbers, as on the iPhone
    .mask(LinearGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.45),
                                 .init(color: .clear, location: 0.7)], startPoint: .top, endPoint: .bottom))
    .allowsHitTesting(false)
    .accessibilityHidden(true)
  }
}

struct MessageView: View {
  let title: String
  let action: (() -> Void)?

  var body: some View {
    VStack(spacing: 6) {
      Image(Outfit.naked.imageName)
        .resizable()
        .scaledToFit()
        .accessibilityLabel(Outfit.naked.accessibilityLabel)
      Text(title)
        .font(.system(size: 15, weight: .light))
        .multilineTextAlignment(.center)
      if let action {
        Button(String(localized: "Try Again"), action: action)
      }
    }
    .foregroundStyle(.black)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color("Sky").ignoresSafeArea())
  }
}
