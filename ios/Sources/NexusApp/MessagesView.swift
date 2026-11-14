import SwiftUI

private struct DemoChat: Identifiable {
    let id = UUID()
    let name: String
    let initials: String
    let tint: Color
    let message: String
    let time: String
    let unread: Int
}

struct MessagesView: View {
    @State private var search = ""
    private let chats = [
        DemoChat(name: "Александр Миронов", initials: "А", tint: Color(hex: 0xB56F91), message: "Давай обсудим идею завтра", time: "14:32", unread: 2),
        DemoChat(name: "Мира Волкова", initials: "М", tint: Color(hex: 0x668DBB), message: "Отправила тебе фотографии ✨", time: "13:08", unread: 0),
        DemoChat(name: "Даниил Соколов", initials: "Д", tint: Color(hex: 0x8B78C9), message: "Отлично, договорились", time: "Вчера", unread: 0),
        DemoChat(name: "София", initials: "С", tint: Color(hex: 0xC18B62), message: "Спасибо большое!", time: "Вт", unread: 0)
    ]

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Сообщения").font(.system(size: 29, weight: .bold, design: .rounded)).tracking(-0.6)
                        Text("Личное пространство для общения").font(.system(size: 12)).foregroundStyle(NexusStyle.muted)
                    }
                    Spacer()
                    IconButton(icon: "square.and.pencil")
                }
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").foregroundStyle(NexusStyle.muted)
                    TextField("Поиск диалогов", text: $search).font(.system(size: 14))
                }
                .padding(14).background(NexusStyle.surface, in: RoundedRectangle(cornerRadius: 15))
                .overlay(RoundedRectangle(cornerRadius: 15).stroke(NexusStyle.line, lineWidth: 1))
                HStack(spacing: 10) {
                    Image(systemName: "lock.fill").foregroundStyle(NexusStyle.violet)
                    Text("Личные переписки").font(.system(size: 13, weight: .semibold))
                    Spacer()
                    Text("Защищено").font(.system(size: 10, weight: .semibold)).foregroundStyle(Color(hex: 0x70C9A4))
                }
                .padding(14).background(NexusStyle.elevated.opacity(0.75), in: RoundedRectangle(cornerRadius: 15))
                VStack(spacing: 0) {
                    ForEach(chats.filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) }) { chat in
                        HStack(spacing: 13) {
                            AvatarView(initials: chat.initials, size: 52, tint: chat.tint)
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(chat.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                                    Spacer()
                                    Text(chat.time).font(.system(size: 10)).foregroundStyle(NexusStyle.muted)
                                }
                                HStack {
                                    Text(chat.message).font(.system(size: 12)).foregroundStyle(NexusStyle.muted).lineLimit(1)
                                    Spacer()
                                    if chat.unread > 0 {
                                        Text("\(chat.unread)").font(.system(size: 10, weight: .bold)).foregroundStyle(.white)
                                            .frame(width: 19, height: 19).background(NexusStyle.violet, in: Circle())
                                    }
                                }
                            }
                        }.padding(.vertical, 13)
                        if chat.id != chats.last?.id { Rectangle().fill(NexusStyle.line).frame(height: 1).padding(.leading, 65) }
                    }
                }
            }.padding(20)
        }
    }
}
