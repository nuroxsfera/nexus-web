# Nexus product roadmap

## Product principles
- Mobile-first, iPhone-first interaction; the web app should feel like a native product.
- Privacy is a default, not a premium feature. Sensitive health data is owner-only unless the user explicitly shares it.
- A profile, a channel, a business organization, and a shop are separate entities. One organization can own multiple channels and shops.
- User-created content must be escaped, access-controlled, and removable.
- Media storage must use private buckets and short-lived authorized access.
- Music and film features link to licensed providers; Nexus does not re-host copyrighted catalog content without rights.

## Module map

| Module | Product purpose | Current prototype | Backend foundation |
|---|---|---|---|
| Home & profiles | Personal identity, feed, stories, profile privacy | Feed, stories, profile editor, avatar/cover picker | Profiles, follows, blocks, posts, stories, RLS |
| Channels | Public/private creator spaces | Create/edit channel, cover, publish channel posts | Channels, channel members, organizations |
| Shops | Independent storefronts linked to organizations | Create/edit shop, add/edit/delete products, local cart | Shops, products, organization ownership |
| Clips | Short vertical videos | Local video picker, caption, playback, likes, discovery tab | Clips, clip likes, private media authorization |
| Music | Curated playlists and music discovery | Local playlists and tracks with HTTPS provider links | Playlists and playlist tracks |
| Cinema | Movie/series watchlists and legal provider links | Local watchlists and items | Watchlists and watchlist items |
| Fitness & nutrition | Training history, nutrition logs, body metrics | Basic local tracker: body metrics, workout logs, nutrition entries | Owner-only fitness, workout, nutrition and health tables |
| Messaging | Private conversations and notifications | Local demo chats | Conversations, members, messages, notifications, RLS |
| Organizations | Company identity, roles, linked channels and stores | Local organization creation, team roles, spaces, and channel/shop linking; invitations and fine-grained permissions next | Organizations, members, spaces, channels, shops |

## Delivery phases

### Phase 1 — Usable product prototype
- Finish consistent design language, responsive iPhone layouts, animations, empty states, loading states and accessibility.
- Complete local CRUD flows for profiles, channels, shops, products, clips, playlists, watchlists, workouts, nutrition and organization linking.
- Make all demo-only behavior clearly labeled.

### Phase 2 — Real accounts and cloud data
- Add a local encrypted health vault before inviting users to store sensitive personal measurements.
- Create and link a Supabase project.
- Apply the migration and run the pgTAP suite against the real database.
- Configure Vercel with the Supabase URL and publishable/anon key.
- Implement signup, login, email verification, password reset and session handling.
- Upload media to private Storage buckets and replace local IndexedDB media with cloud paths.
- Add account deletion and data export.

### Phase 3 — Real-time social features
- Realtime chat, read receipts, typing indicators, notifications and moderation.
- Follow requests, block/report workflows and privacy controls backed by RLS.
- Organization roles and permissions; multiple channels and shops per organization.
- Orders, inventory and payments only after a real order lifecycle and payment provider are selected.

### Phase 4 — Media and specialist modules
- Clip transcoding, adaptive streaming, thumbnails, moderation and CDN delivery.
- Music-provider linking and playlist synchronization where APIs and licenses allow.
- Movie catalog metadata and watch-provider availability; no unlicensed video hosting.
- Expand fitness and nutrition with progress charts, goals, meal templates and body-measurement history; keep records private by default.

## Current boundary
The current branch is a local interactive prototype plus a prepared/tested Postgres security foundation. Most browser-local demo data is not encrypted. Personal fitness and nutrition records are protected by a separate AES-256-GCM vault, but the app is still a prototype and not a certified medical-record system. It is not yet a multi-user cloud social network: no live Supabase project has been linked, and local IndexedDB content does not sync between devices or accounts.
