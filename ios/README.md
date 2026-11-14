# Nexus for iOS

Native iPhone app built with SwiftUI. Minimum deployment target: iOS 17.

## Generate the Xcode project
Install Xcode and XcodeGen, then run from this directory:

```sh
brew install xcodegen
xcodegen generate
open Nexus.xcodeproj
```

Select an iPhone simulator or a connected iPhone and run the Nexus scheme.

## Architecture
- `NexusApp.swift` — app entry point
- `AppRootView.swift` — navigation and tab shell
- `DesignSystem.swift` — shared colors, spacing and reusable UI
- `FeedView.swift`, `MessagesView.swift`, `ProfileView.swift` — first native product surfaces

This is the first native UI foundation. Seed content is local demo data; authentication, cloud sync, media storage and realtime messaging are not connected yet. The existing Supabase schema and security policies remain in the parent repository as backend groundwork. No secrets belong in the iOS bundle.
