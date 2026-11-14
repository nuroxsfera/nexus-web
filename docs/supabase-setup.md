# Supabase setup

The database migration and access tests are ready. No live Supabase project is linked yet.

## Create and link a project

1. Create a Supabase project in the Supabase dashboard.
2. Install the Supabase CLI and authenticate with `supabase login`.
3. From the repository root, link the project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

4. Apply the schema:

```bash
supabase db push
```

5. Run the database security tests:

```bash
supabase test db
```

The migration creates the application tables, RLS policies, private media buckets, and owner-only health storage.

## Vercel environment

Set these server-side environment variables in the Vercel project:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (preferred) or `SUPABASE_ANON_KEY`

The `/api/config` endpoint returns only the publishable/anon key and project URL to the browser. Never add a service-role or secret key to frontend code, GitHub, or the public config endpoint.

## Auth redirect URLs

After the first Vercel preview is available, add its exact domain to Supabase Authentication → URL Configuration → Redirect URLs. Add the production domain only when the production deployment is approved.

## Storage

The migration creates private buckets:

- `nexus-avatars` — profile images
- `nexus-media` — post/story/clip media
- `nexus-health` — owner-only health files

Storage RLS checks the account folder and, for social media, the visibility of the parent content. Signed URLs should be short-lived.
