import SwiftUI

struct ProfileView: View {
    @State private var selectedSection = "Публикации"
    private let sections = ["Публикации", "Медиа", "Сохранённое"]

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 20) {
                HStack {
                    Text("Профиль").font(.system(size: 28, weight: .bold, design: .rounded))
                    Spacer()
                    IconButton(icon: "gearshape")
                    IconButton(icon: "square.and.arrow.up")
                }
                ZStack(alignment: .bottomLeading) {
                    RoundedRectangle(cornerRadius: 25).fill(LinearGradient(colors: [Color(hex: 0x46416F), Color(hex: 0x1D2538), NexusStyle.surface], startPoint: .topLeading, endPoint: .bottomTrailing)).frame(height: 155)
                    Circle().fill(Color.white.opacity(0.06)).frame(width: 170).offset(x: 235, y: -30).blur(radius: 1)
                    Text("N").font(.system(size: 110, weight: .black, design: .rounded)).foregroundStyle(.white.opacity(0.06)).offset(x: 250, y: 18)
                    AvatarView(initials: "М", size: 86, tint: NexusStyle.violet).padding(18).offset(y: 39)
                }
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Максим").font(.system(size: 23, weight: .bold, design: .rounded))
                        Image(systemName: "checkmark.seal.fill").foregroundStyle(NexusStyle.violet)
                    }
                    Text("@maxim").font(.system(size: 13)).foregroundStyle(NexusStyle.muted)
                    Text("Создаю своё пространство. Делюсь тем, что имеет значение.").font(.system(size: 13)).lineSpacing(3).padding(.top, 3)
                    HStack(spacing: 24) {
                        metric("12", label: "публикаций")
                        metric("248", label: "подписчиков")
                        metric("186", label: "подписок")
                    }.padding(.top, 10)
                    Button {} label: {
                        Text("Редактировать профиль").font(.system(size: 13, weight: .semibold)).frame(maxWidth: .infinity).padding(.vertical, 13)
                            .background(NexusStyle.elevated, in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(NexusStyle.line, lineWidth: 1))
                    }.buttonStyle(.plain).padding(.top, 8)
                }.frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 0) {
                    ForEach(sections, id: \.self) { section in
                        Button { selectedSection = section } label: {
                            Text(section).font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(selectedSection == section ? .white : NexusStyle.muted)
                                .frame(maxWidth: .infinity).padding(.vertical, 12)
                                .overlay(alignment: .bottom) { if selectedSection == section { Capsule().fill(NexusStyle.violet).frame(height: 2) } }
                        }.buttonStyle(.plain)
                    }
                }
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 7) {
                    ForEach(0..<6) { index in
                        RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: [NexusStyle.violet.opacity(0.32 - Double(index) * 0.025), NexusStyle.elevated], startPoint: .topLeading, endPoint: .bottomTrailing)).aspectRatio(0.82, contentMode: .fit)
                            .overlay(Image(systemName: ["sparkles", "mountain.2", "camera", "moon.stars", "building.2", "leaf"][index]).font(.system(size: 22)).foregroundStyle(.white.opacity(0.5)))
                    }
                }
            }.padding(20)
        }
    }

    private func metric(_ value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value).font(.system(size: 17, weight: .bold, design: .rounded))
            Text(label).font(.system(size: 10)).foregroundStyle(NexusStyle.muted)
        }
    }
}
