import SwiftUI

enum NexusStyle {
    static let background = Color(hex: 0x090A0F)
    static let surface = Color(hex: 0x12141D)
    static let elevated = Color(hex: 0x1A1D28)
    static let line = Color.white.opacity(0.075)
    static let muted = Color(hex: 0x85899A)
    static let violet = Color(hex: 0xA78BFA)
    static let blue = Color(hex: 0x7C8CFF)
    static let gradient = LinearGradient(colors: [violet, blue], startPoint: .topLeading, endPoint: .bottomTrailing)
}

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255, blue: Double(hex & 0xff) / 255, opacity: alpha)
    }
}

struct Surface<Content: View>: View {
    var radius: CGFloat = 22
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(16)
            .background(NexusStyle.surface, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).stroke(NexusStyle.line, lineWidth: 1))
    }
}

struct AvatarView: View {
    let initials: String
    var size: CGFloat = 48
    var tint: Color = NexusStyle.violet

    var body: some View {
        ZStack {
            Circle().fill(LinearGradient(colors: [tint.opacity(0.95), tint.opacity(0.35)], startPoint: .topLeading, endPoint: .bottomTrailing))
            Text(initials).font(.system(size: size * 0.31, weight: .semibold, design: .rounded)).foregroundStyle(.white)
        }
        .frame(width: size, height: size)
        .overlay(Circle().stroke(Color.white.opacity(0.14), lineWidth: 1))
    }
}

struct SectionHeading: View {
    let title: String
    var trailing: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.system(size: 23, weight: .bold, design: .rounded)).tracking(-0.5)
            Spacer()
            if let trailing {
                Text(trailing).font(.system(size: 13, weight: .semibold)).foregroundStyle(NexusStyle.violet)
            }
        }
    }
}

struct IconButton: View {
    let icon: String
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 42, height: 42)
                .background(.white.opacity(0.065), in: Circle())
                .overlay(Circle().stroke(NexusStyle.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
