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
DIRECT_DATABASE_URL="postgresql://postgres:<PASSWORD>@db.yyrjclgbeahuhqtccpry.supabase.co:5432/postgres"
```

The pooled one is what the serverless function uses, because a function that
opens a direct connection per invocation exhausts Postgres long before it
exhausts Vercel. `DIRECT_DATABASE_URL` is for `prisma migrate deploy`, which
cannot run through a transaction pooler.

Then, once:

```sh
bun run db:deploy
```

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

## What is not decided here

**The hostname.** `crm.openvzai.com` needs a CNAME, and the DNS for
`openvzai.com` is at julydns rather than Cloudflare or Vercel — so a subdomain
is a manual step in a console this repository cannot reach. The alternative is a
rewrite from the marketing site at `www.openvzai.com/crm/app`, which works but
brings the whole `assetPrefix` and CSP list with it.

Until one of those is done, the deployment lives on its `.vercel.app` URL, which
is a real URL and a fine place to finish the setup from.
