# TCN Newsroom setup and deployment

The newsroom UI and source files are committed in this repository. Authentication, private storage, Edge Functions, and scheduled publication become live only after a Supabase project is selected/configured and the repository secrets below are added.

## Files added
- `newsroom.html` — private sign-in and author/editor workspace (no public sign-up).
- `newsroom.js` and `newsroom-config.js` — client application and public Supabase configuration.
- `supabase/migrations/20261020_newsroom.sql` — tables, triggers, and row-level security.
- `supabase/functions/newsroom-admin/index.ts` — editor-only author account creation.
- `supabase/functions/publish-queue/index.ts` — secret-protected approved-content export.
- `.github/workflows/publish-newsroom.yml` — hourly publishing job (and manual dispatch).
- `scripts/publish-newsroom.mjs` — generates static article pages from approved records.
- `published-content.json` — public feed consumed by the front page and Elections page.

## 1. Choose a Supabase project
The currently connected Supabase account shows two projects marked INACTIVE. Neither has been reactivated because I can't safely assume which project you intend to use or whether restoring it may incur usage charges. Use a project you already own and intend for TCN, or create a dedicated project after reviewing its current pricing.

## 2. Apply the database schema
In the chosen Supabase project's SQL Editor, run the complete SQL from `supabase/migrations/20261020_newsroom.sql`. Verify all three tables exist: `newsroom_profiles`, `newsroom_articles`, and `newsroom_elections`. RLS must remain enabled.

## 3. Create the first editor account
1. In Supabase Dashboard → Authentication → Users, create your own user with your email and a strong password.
2. In the SQL Editor, run the following after replacing the email and display name with your own values:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"editor"}'::jsonb
where email = 'YOUR_EMAIL@example.com';

insert into public.newsroom_profiles (id, display_name)
select id, 'Editor-in-chief'
from auth.users
where email = 'YOUR_EMAIL@example.com'
on conflict (id) do update set display_name = excluded.display_name;
```

3. Confirm exactly one intended account was updated, then sign out and sign back in to refresh its app-metadata role claim. Do not grant the editor role through user-editable metadata.

## 4. Configure the web client
In Supabase Dashboard → Project Settings → API, copy the Project URL and publishable key. Edit `newsroom-config.js`:
- `supabaseUrl` = Project URL
- `supabasePublishableKey` = publishable key (safe to expose in browser when RLS is correct)

Never place the service-role key in `newsroom-config.js`, HTML, or any browser JavaScript.

## 5. Deploy the Edge Functions
Deploy `newsroom-admin` with JWT verification enabled (default). It verifies the signed-in caller and permits account creation only for editor/admin app-metadata roles.

Deploy `publish-queue` with the Supabase gateway's JWT verification disabled because the scheduled GitHub runner does not sign in as a user; the function itself validates a long random secret in the `x-newsroom-publish-secret` header. Do not expose that secret publicly.

Set the Edge Function secret `NEWSROOM_PUBLISH_SECRET` in Supabase secrets. Use the same random value as the GitHub repository secret below. The function also needs the project service-role key in its server-side environment; Supabase normally provides `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Verify this exists in the function's environment before deploying.

## 6. Configure GitHub Actions secrets
In GitHub → Settings → Secrets and variables → Actions → New repository secret, add:
- `SUPABASE_URL` — the chosen Supabase Project URL.
- `NEWSROOM_PUBLISH_SECRET` — the same strong random secret configured in Supabase.

The workflow uses the repository's built-in `GITHUB_TOKEN` to commit approved content to `main`; it needs no personal access token. Under Settings → Actions → General → Workflow permissions, allow read and write permissions so the workflow can push its commit.

## 7. Publish the site
Ensure GitHub Pages (or the site's deployment integration) builds from `main`. Visit `/newsroom.html` on the hosted TCN site. Sign in with the initial editor account, create author accounts, and test with a non-sensitive article first. You can run the publisher immediately from Actions → Publish approved TCN newsroom content → Run workflow; otherwise it runs hourly at minute 7.

Approved articles and published election records are exported into `published-content.json`, and generated article pages are written to `published-articles/`. That feed is public by design, so only approve information intended for public release. Drafts and pending submissions remain in Supabase and are not exported.

## Security and operating notes
- There is no public account-registration form.
- Authors can see their own articles; editor access is based on trusted `auth.app_metadata.role` claims, not user metadata.
- The first editor must be provisioned manually in Supabase as described above.
- Use HTTPS and strong passwords. Configure email/password policies and MFA for editors in Supabase if available.
- The hourly job may take a few minutes after the top of the hour. GitHub Actions scheduled runs can be delayed by platform load.
- This workflow writes approved stories to the repository's public branch. Review article content and image URLs before approval.
