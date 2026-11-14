import SwiftUI

private struct DemoStory: Identifiable {
    let id = UUID()
    let name: String
    let initials: String
    let tint: Color
    var isAdd = false
}

private struct DemoPost: Identifiable {
    let id = UUID()
    let name: String
    let handle: String
    let initials: String
    let tint: Color
    let text: String
    let time: String
    let likes: String
}

struct FeedView: View {
    @State private var liked: Set<UUID> = []
    @State private var selectedFilter = "Для тебя"
    private let filters = ["Для тебя", "Подписки", "Популярное"]
    private let stories = [
        DemoStory(name: "Ваша история", initials: "+", tint: NexusStyle.violet, isAdd: true),
        DemoStory(name: "Алекс", initials: "А", tint: Color(hex: 0xB56F91)),
        DemoStory(name: "Мира", initials: "М", tint: Color(hex: 0x668DBB)),
        DemoStory(name: "Даниил", initials: "Д", tint: Color(hex: 0x8B78C9)),
        DemoStory(name: "София", initials: "С", tint: Color(hex: 0xC18B62))
    ]
    private let posts = [
        DemoPost(name: "Александр Миронов", handle: "@alex.m", initials: "А", tint: Color(hex: 0xB56F91), text: "Иногда лучший план — просто начать. Остальное выстроится по пути.", time: "12 мин", likes: "248"),
        DemoPost(name: "Мира Волкова", handle: "@mira.v", initials: "М", tint: Color(hex: 0x668DBB), text: "Собираю вокруг себя вещи, людей и идеи, которые действительно вдохновляют ✨", time: "38 мин", likes: "96")
    ]

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 22) {
                header
                storiesRow
                filtersRow
                SectionHeading(title: "Твоя лента", trailing: "Настроить")
                ForEach(posts) { post in postCard(post) }
            }
            .padding(.horizontal, 18)
            .padding(.top, 12)
            .padding(.bottom, 22)
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("NEXUS").font(.system(size: 25, weight: .black, design: .rounded)).tracking(2.1)
                Text("PRESENCE OVER NOISE").font(.system(size: 8, weight: .bold)).tracking(2.3).foregroundStyle(NexusStyle.muted)
            }
            Spacer()
            IconButton(icon: "magnifyingglass")
            IconButton(icon: "bell")
        }
        .padding(.bottom, 2)
    }

    private var storiesRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 15) {
                ForEach(stories) { story in
                    VStack(spacing: 7) {
                        ZStack {
                            Circle().stroke(story.isAdd ? NexusStyle.line : NexusStyle.gradient, lineWidth: 2).frame(width: 61, height: 61)
                            AvatarView(initials: story.initials, size: 53, tint: story.tint)
                            if story.isAdd {
                                Circle().fill(NexusStyle.violet).frame(width: 19, height: 19).overlay(Image(systemName: "plus").font(.system(size: 10, weight: .bold)).foregroundStyle(.white)).offset(x: 22, y: 21)
                            }
                        }
                        Text(story.name).font(.system(size: 10, weight: .medium)).foregroundStyle(story.isAdd ? .white : NexusStyle.muted).lineLimit(1)
                    }.frame(width: 66)
                }
            }
        }
    }

    private var filtersRow: some View {
        HStack(spacing: 8) {
            ForEach(filters, id: \.self) { filter in
                Button { withAnimation(.easeInOut(duration: 0.18)) { selectedFilter = filter } } label: {
                    Text(filter).font(.system(size: 12, weight: .semibold))
                        .padding(.horizontal, 15).padding(.vertical, 9)
                        .background(selectedFilter == filter ? Color.white : NexusStyle.elevated, in: Capsule())
                        .foregroundStyle(selectedFilter == filter ? Color.black : NexusStyle.muted)
                }.buttonStyle(.plain)
            }
        }
    }

    private func postCard(_ post: DemoPost) -> some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(spacing: 11) {
                AvatarView(initials: post.initials, size: 43, tint: post.tint)
                VStack(alignment: .leading, spacing: 3) {
                    Text(post.name).font(.system(size: 13, weight: .semibold))
                    Text("\(post.handle) · \(post.time)").font(.system(size: 11)).foregroundStyle(NexusStyle.muted)
                }
                Spacer()
                Image(systemName: "ellipsis").foregroundStyle(NexusStyle.muted).padding(8)
            }
            Text(post.text).font(.system(size: 14)).lineSpacing(4).foregroundStyle(Color.white.opacity(0.9))
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(LinearGradient(colors: [post.tint.opacity(0.48), NexusStyle.elevated, NexusStyle.background], startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(height: 190)
                .overlay(alignment: .bottomLeading) {
                    HStack(spacing: 7) {
                        Image(systemName: "sparkles")
                        Text("Момент, которым хочется поделиться")
                    }.font(.system(size: 10, weight: .medium)).foregroundStyle(.white.opacity(0.65)).padding(14)
                }
            HStack(spacing: 19) {
                Button { toggleLike(post) } label: {
                    Label(liked.contains(post.id) ? "Нравится" : post.likes, systemImage: liked.contains(post.id) ? "heart.fill" : "heart")
                        .foregroundStyle(liked.contains(post.id) ? Color(hex: 0xF28BA8) : .white)
                }
                Button {} label: { Label("Обсудить", systemImage: "bubble.right") }
                Button {} label: { Image(systemName: "paperplane") }
                Spacer()
                Button {} label: { Image(systemName: "bookmark") }
            }
            .font(.system(size: 12, weight: .medium)).foregroundStyle(NexusStyle.muted).buttonStyle(.plain)
        }
        .padding(16)
        .background(NexusStyle.surface, in: RoundedRectangle(cornerRadius: 23, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 23, style: .continuous).stroke(NexusStyle.line, lineWidth: 1))
    }

    private func toggleLike(_ post: DemoPost) {
        withAnimation(.spring(response: 0.25, dampingFraction: 0.55)) {
            if liked.contains(post.id) { liked.remove(post.id) } else { liked.insert(post.id) }
        }
    }
}
