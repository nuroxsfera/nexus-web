import SwiftUI

enum NexusTab: String, CaseIterable {
    case home = "Главная"
    case discover = "Обзор"
    case create = "Создать"
    case messages = "Сообщения"
    case profile = "Профиль"

    var icon: String {
        switch self {
        case .home: "square.grid.2x2.fill"
        case .discover: "safari"
        case .create: "plus"
        case .messages: "bubble.left.and.bubble.right"
        case .profile: "person.crop.circle"
        }
    }
}

struct AppRootView: View {
    @State private var selectedTab: NexusTab = .home
    @State private var showComposer = false

    var body: some View {
        ZStack {
            NexusStyle.background.ignoresSafeArea()
            Group {
                switch selectedTab {
                case .home: FeedView()
                case .discover: DiscoverView()
                case .create: FeedView()
                case .messages: MessagesView()
                case .profile: ProfileView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            tabBar
        }
        .sheet(isPresented: $showComposer) {
            ComposerSheet()
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(NexusStyle.surface)
        }
    }

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(NexusTab.allCases, id: \.self) { tab in
                Button {
                    if tab == .create {
                        showComposer = true
                    } else {
                        withAnimation(.spring(response: 0.34, dampingFraction: 0.82)) { selectedTab = tab }
                    }
                } label: {
                    VStack(spacing: 5) {
                        Image(systemName: tab.icon)
                            .font(.system(size: tab == .create ? 19 : 18, weight: .semibold))
                            .frame(height: 22)
                        if tab != .create {
                            Text(tab.rawValue).font(.system(size: 9, weight: .medium))
                        }
                    }
                    .foregroundStyle(tab == .create ? Color.white : (selectedTab == tab ? NexusStyle.violet : NexusStyle.muted))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 11)
                    .padding(.bottom, 7)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .overlay {
                    if tab == .create {
                        Circle().fill(NexusStyle.gradient).frame(width: 43, height: 43).overlay(Image(systemName: "plus").font(.system(size: 19, weight: .bold)).foregroundStyle(.white)).offset(y: -5)
                    }
                }
            }
        }
        .padding(.horizontal, 8)
        .background(.ultraThinMaterial)
        .background(NexusStyle.background.opacity(0.88))
        .overlay(alignment: .top) { Rectangle().fill(NexusStyle.line).frame(height: 1) }
    }
}

struct DiscoverView: View {
    private let tiles: [(String, String, Color)] = [
        ("Каналы", "person.3.fill", Color(hex: 0x7665D8)),
        ("Магазины", "bag.fill", Color(hex: 0xB36E9D)),
        ("Видео", "play.rectangle.fill", Color(hex: 0xD17B58)),
        ("Музыка", "music.note", Color(hex: 0x4D91B8)),
        ("Кино", "film.fill", Color(hex: 0x6379C8)),
        ("Здоровье", "heart.fill", Color(hex: 0x4E9D83))
    ]

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 24) {
                HStack { Text("Открывай новое").font(.system(size: 29, weight: .bold, design: .rounded)); Spacer(); IconButton(icon: "magnifyingglass") }
                Text("Твоя экосистема интересов — в одном пространстве.").font(.system(size: 15)).foregroundStyle(NexusStyle.muted)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(tiles, id: \.0) { item in
                        Surface(radius: 22) {
                            VStack(alignment: .leading, spacing: 18) {
                                Image(systemName: item.1).font(.system(size: 24, weight: .semibold)).foregroundStyle(item.2)
                                    .frame(width: 48, height: 48).background(item.2.opacity(0.15), in: RoundedRectangle(cornerRadius: 15))
                                Text(item.0).font(.system(size: 17, weight: .semibold))
                                Text("Скоро здесь").font(.system(size: 12)).foregroundStyle(NexusStyle.muted)
                            }.frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }.padding(20)
        }
    }
}

struct ComposerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack { Text("Новая публикация").font(.system(size: 22, weight: .bold)); Spacer(); Button("Закрыть") { dismiss() }.foregroundStyle(NexusStyle.violet) }
            TextField("Чем хочешь поделиться?", text: $text, axis: .vertical)
                .lineLimit(5...9).padding(16).background(NexusStyle.elevated, in: RoundedRectangle(cornerRadius: 18))
            HStack {
                Label("Фото", systemImage: "photo").foregroundStyle(NexusStyle.muted)
                Spacer()
                Button("Опубликовать") { dismiss() }.font(.system(size: 14, weight: .semibold)).padding(.horizontal, 18).padding(.vertical, 11).background(NexusStyle.gradient, in: Capsule()).foregroundStyle(.white)
            }
            Spacer()
        }.padding(22).padding(.top, 10)
    }
}
