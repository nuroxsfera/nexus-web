# Nexus backend architecture

## Chosen foundation
Supabase Free for the first live backend: PostgreSQL, Auth, private object storage and Realtime. It is a starting tier, not a production guarantee: Free projects can pause after inactivity and have finite database, storage and egress quotas. Review current quotas before launch.

## Product boundaries
- Profiles, channels, shops and organizations are separate entities.
- A company/organization may own multiple channels and shops.
- A shop is a catalog and order surface, not a channel disguised as a shop.
- Posts may belong to a profile or channel; media is stored separately.
- Stories expire after 24 hours.
- Conversations have explicit membership; only members can read messages.
- User identity and login credentials live in Supabase Auth, not in public profile rows.

## Privacy and security defaults
- Every application table in the initial migration has Row Level Security enabled.
- The migration revokes table privileges from signed-out users and grants only the authenticated role.
- Private profiles and follower-only content are checked in PostgreSQL policies.
- Blocks are enforced when reading profiles, posts and shops.
- Conversation reads and writes require conversation membership.
- Media buckets are private. A later server endpoint must mint short-lived signed URLs only after checking the user's access to the parent post, story or conversation.
- Never expose a Supabase service-role/secret key in browser code, GitHub, or client environment variables.
- Do not treat a publishable key as a substitute for RLS. Test both allowed and denied cases before production.

## Migration
Apply files in `supabase/migrations` using the Supabase CLI after a project is created and linked. Run database security tests before connecting the UI.

## Rollout order
1. Auth and profiles.
2. Profile privacy, follows and blocks.
3. Posts, media and stories.
4. Channels and channel membership.
5. Organizations and role management.
6. Shops and products.
7. Conversations, messages and notifications.
8. Reports, moderation and audit trail.
9. Video, music and streaming only after core privacy and storage rules are stable.

## Not implemented yet
This migration is the data/security foundation only. The existing UI still uses local demo data. Cross-device sync, authentication screens, signed media delivery, realtime chat and real orders must be connected in later milestones.
