# Deploying this install

Everything here runs on two accounts that already exist: **Vercel** and
**Supabase**. Four deployments and a database.

| Piece | Where | Notes |
| --- | --- | --- |
| `apps/app` | Vercel | Next.js. Root directory `apps/app`. |
| `apps/api` | Vercel | One Node serverless function — `apps/api/api/index.ts` boots Nest once per cold start and hands the request to its Express instance. `vercel.json` beside it declares the crons. |
| `apps/agent` | Vercel | `eve build` emits a Nitro output. Its own deployment, its own schedule. |
| Postgres | Supabase | Project `openvz-crm`, ref `yyrjclgbeahuhqtccpry`, region `ap-northeast-1`. |
| Images | Cloudflare R2 | Bucket `openvz-crm`. See `environment.md`. |

## The two things a person has to do

Everything else is configuration that can be scripted. These two cannot: both
mint a credential inside somebody else's console.

### 1. The database password

Supabase generates it at project creation and never shows it again through the
API — the management connection is not a superuser, so it cannot be reset with
SQL either.

**Settings → Database → Reset database password**, then build two URLs:

```
DATABASE_URL="postgresql://postgres.yyrjclgbeahuhqtccpry:<PASSWORD>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://postgres.yyrjclgbeahuhqtccpry:<PASSWORD>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

Three details, each of which costs an hour to rediscover:

- **`DATABASE_URL` is the transaction pooler (:6543)**, because a serverless
  function that opens a direct connection per invocation exhausts Postgres long
  before it exhausts Vercel.
- **`DIRECT_DATABASE_URL` is the *session* pooler (:5432), not the direct host.**
  Migrations cannot run through a transaction pooler — `prisma migrate deploy`
  against :6543 hangs rather than failing, which reads as a network problem. And
  Supabase's direct host, `db.<ref>.supabase.co`, **resolves over IPv6 only**
  unless the project buys the IPv4 add-on; on an IPv4-only machine it does not
  resolve at all. The session pooler is IPv4 and accepts migrations.
- **`prisma.config.ts` is what reads these.** It prefers `DIRECT_DATABASE_URL`,
  then `POSTGRES_URL_NON_POOLING`, then `DATABASE_URL`.

Then, once:

```sh
bun run db:deploy
```

### Close the PostgREST door first

Supabase puts a PostgREST API in front of every project and hands out a
deliberately public `anon` key. This schema has no row-level security — it was
written for a plain Postgres where the application is the only client — so on
Supabase every table is readable by anyone holding that key. Contacts, email
bodies, deal amounts.

This install does not use PostgREST or the Supabase client libraries at all. It
connects to Postgres directly, as the table owner. So the fix is to take the
door away rather than to guard it:

```sql
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
```

Three things worth knowing about that:

- **The `ALTER DEFAULT PRIVILEGES` lines are the ones that keep working.** They
  apply to objects created by the role that ran them, so run them as the same
  role Prisma migrates with — `postgres`, which is also the table owner. A
  migration that adds a table months from now is covered without anyone
  remembering this file.
- **`USAGE` on the schema stays granted anyway**, through `PUBLIC`. That is
  fine: `USAGE` only permits looking an object up. Reading needs a table grant,
  and there are none.
- **Prefer this to enabling RLS with no policies.** Both close the hole, but RLS
  on 59 tables is 59 statements that a new table silently escapes, and it leaves
  a reader wondering which policies were intended.

Run the revokes before the first real row exists, and verify with
`SET LOCAL ROLE anon` that a select on `company` raises `insufficient_privilege`.

### 2. A Google OAuth client

`ALLOWED_SIGN_IN` plus one identity provider is the entire authorisation model.
With no provider there is no way in at all, and the sign-in page says so rather
than showing an empty screen.

[Google Cloud console](https://console.cloud.google.com/apis/credentials) →
**Credentials** → **Create credentials** → **OAuth client ID** → **Web
application**. Add `https://<api-host>/api/auth/callback/google` as an authorised
redirect URI, enable the Gmail and Calendar APIs, and copy the pair into
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

The same client reads Gmail and Calendar, which is where the agent's best
evidence comes from — a reply from the person's own address is something no data
vendor sells.

## Everything else, in order

```sh
vercel link          # once per app directory
vercel env add ...   # the values below
vercel --prod --yes --archive=tgz
```

`--archive=tgz` matters: the CLI otherwise sends one HTTP request per file, and
on a slow uplink the request count costs more than the bytes.

| Variable | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`. **The same value in the app and the API**, or the API mints a cookie the app cannot verify and sign-in becomes a redirect loop rather than an error. |
| `ALLOWED_SIGN_IN` | `openvzai.com` |
| `API_URL` / `APP_URL` | The two real origins. |
| `AUTH_COOKIE_DOMAIN` | `.openvzai.com`, only if the two are subdomains of one parent. |
| `R2_*` (five) | Bucket `openvz-crm`. See `environment.md`. |
| `CRON_SECRET` | Guards `/internal/sync/*`. Required before the crons do anything. |
| `IS_MARKETING` | `true` on the app only if you want the landing page at `/`. |

## The crons are cut down to fit Hobby

Vercel's Hobby plan allows **two** cron jobs, each **at most once a day**. The
schedule this codebase wants does not fit, so `apps/api/vercel.json` keeps the
two that earn their slot and drops the rest:

| Path | Was | Now | Why |
| --- | --- | --- | --- |
| `/internal/sync/mailboxes` | every 5 min | daily 01:00 | The one that matters. Daily is a real loss — see below. |
| `/internal/sync/rates` | daily 06:00 | unchanged | Deal amounts in other currencies go stale without it. |
| `/internal/telemetry/rollup` | daily 07:00 | **removed** | Telemetry is off by default here, so it had nothing to roll up. |
| `/internal/tracking/retention` | daily 04:00 | **removed** | Only does work once website tracking is switched on. Put it back in the same change that enables tracking, or old visitor rows are never pruned. |

**Daily mailbox sync is a downgrade, not a setting.** The premise of the agent is
that it reads your threads and calendar; at daily granularity a reply that
arrives after the run is invisible until tomorrow. Two ways back to five minutes,
neither of which needs a code change:

- **Vercel Pro.** Unlocks 40 crons at any frequency.
- **Any external scheduler**, which is what `CRON_SECRET` exists for. A GitHub
  Actions workflow on `*/5 * * * *` doing
  `curl -H "Authorization: Bearer $CRON_SECRET" -X POST https://<api-host>/internal/sync/mailboxes`
  is enough. This is the arrangement the README describes — "point a scheduler
  at it" — so nothing about it is a workaround.

## What is not decided here

**The hostname.** `crm.openvzai.com` needs a CNAME, and the DNS for
`openvzai.com` is at julydns rather than Cloudflare or Vercel — so a subdomain
is a manual step in a console this repository cannot reach. The alternative is a
rewrite from the marketing site at `www.openvzai.com/crm/app`, which works but
brings the whole `assetPrefix` and CSP list with it.

Until one of those is done, the deployment lives on its `.vercel.app` URL, which
is a real URL and a fine place to finish the setup from.
