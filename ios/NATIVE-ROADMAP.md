# Nexus Native iOS — delivery plan

## Product direction
The iPhone app is the primary client. SwiftUI is used for presentation and navigation; the existing web prototype is retained as a reference until native feature parity and backend integration are established.

## Native milestones

### 0. Foundation
- [x] SwiftUI app entry point and iOS 17 target
- [x] Shared dark design system and reusable components
- [x] Native tab navigation
- [x] First-pass feed, stories, profile and inbox surfaces
- [x] XcodeGen project specification
- [x] macOS simulator build workflow
- [ ] Run the first successful Xcode build and inspect on real iPhone hardware

### 1. Product shell
- [ ] Replace demo arrays with typed domain models and repositories
- [ ] Add onboarding, sign-in, sign-up and password recovery
- [ ] Build full post composer, media picker and story viewer
- [ ] Build conversation list, chat thread, attachments and message states
- [ ] Complete profile editing, privacy controls, blocks and follows
- [ ] Add accessibility labels, Dynamic Type and reduced-motion behavior

### 2. Backend and privacy
- [ ] Connect Supabase Auth using the public/publishable client key only
- [ ] Apply and validate the existing SQL migrations in a real Supabase project
- [ ] Implement repository layer for profiles, posts, stories, channels and shops
- [ ] Use private Storage buckets and short-lived signed media URLs
- [ ] Add realtime messaging only after conversation membership/RLS checks pass
- [ ] Keep fitness, nutrition and body metrics owner-only; use Keychain for local secrets
- [ ] Add account export and deletion flows

### 3. Ecosystem modules
- [ ] Channels with memberships and publishing
- [ ] Organization identities, roles, and multiple linked channels/shops
- [ ] Independent shop catalogs, product pages and cart
- [ ] Vertical clips with upload/transcoding pipeline
- [ ] Music playlists and licensed provider links
- [ ] Cinema watchlists and licensed provider links
- [ ] Private fitness and nutrition tracker

### 4. Release quality
- [ ] Unit and UI tests for critical flows
- [ ] VoiceOver, Dynamic Type, localization and accessibility audit
- [ ] Crash reporting, analytics with privacy-conscious defaults
- [ ] App icon, launch experience, screenshots and App Store metadata
- [ ] TestFlight distribution and staged rollout

## Architecture rules
- SwiftUI views stay presentation-focused.
- Domain models and repository protocols are independent of UI.
- Supabase calls live behind data services, never directly in view bodies.
- No service-role key, private API secret or encryption master key is bundled in the app.
- User-generated content is access-controlled and removable.
- Health and nutrition data is private by default.
- Music and film catalogs link to licensed providers; Nexus does not re-host copyrighted media without rights.

## Current truth
The screens currently use local sample content. They are a UI foundation, not a connected social network. Authentication, cross-device sync, media upload and realtime chat must not be presented as live until the backend is configured and tested.
