# Nexus Web Prototype

**Presence over Noise**

Mobile-first social product prototype focused on intentional communication, privacy and user-owned spaces.

## Product modules

- Email/password signup, login, email confirmation, password recovery and tab-scoped sessions (available once Supabase is configured)
- Optional cloud social feed: private media uploads, posts with audience controls, likes, comments and deletion (requires a linked Supabase project)
- Profiles, posts, stories and profile privacy
- Public/private channels and channel posts
- Independent shops, product catalogs and local cart
- Short-form video clips
- Music playlists and movie/series watchlists linked to licensed providers
- Personal fitness, workout and nutrition tracking
- Local chat and notification prototypes

## Current implementation boundary

Interactive content is currently stored in the browser (IndexedDB/local storage). It does not sync across devices or accounts, while personal fitness and nutrition records are stored in a separate AES-256-GCM encrypted local vault protected by a user passphrase. Other prototype content is not encrypted and does not sync across devices or accounts. The Supabase/Postgres schema and RLS policies are prepared and covered by local tests, but have not yet been applied to a live Supabase project. Real authentication, cloud media, realtime messaging and orders are not active yet.

The in-app prototype branding remains unchanged while the product is being developed.

## Run locally

Open `index.html` or serve the folder:

```bash
npx serve .
```

For development checks:

```bash
npm install
npm test
```

The test suite includes static integrity checks, a PGlite Postgres/RLS simulation, and JSDOM UI smoke tests.

## Backend setup

See [backend architecture](docs/backend-architecture.md), [Supabase setup](docs/supabase-setup.md), and [product roadmap](docs/product-roadmap.md).

After creating and linking a Supabase project:
1. Apply the SQL migration in `supabase/migrations`.
2. Run `supabase test db` to execute the pgTAP security tests.
3. Configure Vercel environment variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`).
4. Never put a service-role/secret key in browser code.

