# The desktop build

`apps/desktop` turns this repo into something a person can download and open.
The installed copy carries its own Postgres and its own JavaScript runtime, so
there is no database to provision, no Docker, and no account to create anywhere.

Nothing here changes how the hosted install works. The desktop build is a
different way to run the same `apps/api` and `apps/app`.

## What is in the box

| Piece | Where it comes from | Size |
| --- | --- | --- |
| Bun | `oven-sh/bun` release zip, pinned in `scripts/vendor.ts` | 60 MB |
| Postgres 18 | `@embedded-postgres/<target>` on npm | 74 MB |
| The API | `bun build apps/api/src/main.ts`, one file | 15 MB |
| The interface | `next build` with `output: "standalone"` | 109 MB |
| The migrations | `packages/db/prisma/migrations`, copied | 228 KB |

That is 243 MB unpacked and 74 MB as the `payload.tar.gz` the installer ships.

**The agent (`apps/agent`) is not in the payload.** It needs a model key to do
anything, and eve wants its own runtime. The CRM works without it: the API
writes `AgentTask` rows either way, and they wait.

## Building one

```sh
bun run --filter=desktop build:installer
```

That vendors the runtimes for this machine, builds both servers, packs the
payload, and hands it to Tauri. The result is in
`apps/desktop/src-tauri/target/release/bundle`.

**Build each installer on the system it is for.** The Next.js trace picks up
`@img/sharp-<platform>`, which is a native library, and neither a dmg nor an
NSIS installer can be produced from the other side. `scripts/build.ts` refuses a
cross-target build rather than producing one that fails on the user's machine.

## What happens on first launch

1. Tauri unpacks `payload.tar.gz` into the application-support folder. It
   unpacks again whenever the app version differs from the stamp it left.
2. `runtime/supervisor.ts` generates a database password and an auth secret,
   `initdb`s a cluster, and starts it on a free port.
3. It applies the migrations itself and records them in `_prisma_migrations`,
   exactly as `prisma migrate deploy` would.
4. It starts the API and the interface on two more free ports and waits for
   both to answer.
5. It prints `ready <url>`; the window navigates there.

Everything the install owns is under one folder:

| System | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/OPENVZ CRM` |
| Windows | `%APPDATA%\OPENVZ CRM` |
| Linux | `~/.local/share/openvz-crm` |

`OPENVZ_CRM_HOME` moves it. Deleting it is a factory reset, and it takes the
user's data with it.

`settings.env` in that folder is how an installed copy is configured. The
supervisor writes it on first run as a commented template and reads it on every
start, because a GUI application inherits no environment a person can edit. It
is where `ALLOWED_SIGN_IN` goes to let a second person in, and where Google
credentials go if somebody wants to sign in that way instead. It cannot set
`DATABASE_URL`, `API_URL` or `BETTER_AUTH_SECRET` — the supervisor owns those,
and it strips them.

## Signing in

A downloaded copy has no Google project behind it, so `AUTH_LOCAL_ACCOUNTS=1`
turns on email and password. The rule is in `packages/auth/src/auth.ts`:

- With no `ALLOWED_SIGN_IN`, **exactly one** account can be created — the first.
  It becomes the workspace owner.
- Everybody after them needs to be on `ALLOWED_SIGN_IN`, which an installed copy
  reads from `settings.env`.

So an install that somebody else can reach does not hand itself out, and the
person who installed it does not need to write a config file to get in.

## Things that were learned the hard way

- **Wait for a child to exit, not for its output to end.** `pg_ctl start` leaves
  the postmaster holding the stdout and stderr handles it inherited, so on
  Windows the stream never closes and a wait on that never returns — the cluster
  comes up and the supervisor sits there. On POSIX `pg_ctl` detaches the
  postmaster onto the log file, which is why it only shows up on Windows.
- **No unix socket.** The socket path is capped at 103 bytes, and a home
  directory a few levels deep exceeds it on its own. Everything connects over
  `127.0.0.1`.
- **`sslmode=disable` is on the connection string.** It is a loopback connection
  to a cluster this install started, so TLS buys nothing — and on Windows the
  first connection hung without it. Bun's client and the Prisma driver adapter
  both read the parameter themselves rather than sending it to the server.
- **No `?schema=public` on the connection string.** Prisma parses that
  parameter itself, but the driver adapter and Bun's client hand unknown
  parameters to the server as settings, and there is no setting called
  `schema`. The connection is refused before it opens.
- **The npm Postgres tarball has no symlinks.** npm does not carry them, and
  the package rebuilds them in a postinstall we do not run. `vendor.ts` rebuilds
  them from the `pg-symlinks.json` the package ships. Without them the dylibs
  cannot find each other and Postgres aborts at startup.
- **One migration opens its own transaction.** The applier wraps each migration
  in a transaction, but `20260731210000_forward_only_sync` starts with `BEGIN;`.
  Wrapping that one nests a transaction inside a transaction: Postgres warns and
  ignores the inner `BEGIN`, and the inner `COMMIT` then ends the outer one, so
  the wrapper commits nothing and warns again on the way out. `managesItsOwnTransaction`
  detects it and lets it run unwrapped.
- **The standalone build is copied with `dereference` on Windows.** Next traces
  the workspace packages in as symlinks, and creating a symlink on Windows needs
  elevation, so a plain recursive copy is EPERM. macOS keeps the links.
- **The trace also contains links that lead nowhere.** Bun's isolated layout
  leaves symlinks into `node_modules/.bun` that Next did not trace a target for,
  and following one is another EPERM. The copy filters out anything that does not
  `stat`, which is the same thing as "this link has no target to copy".
- **`npm` is `npm.cmd` on Windows.** `Bun.spawn` does not apply PATHEXT, so
  spawning `npm` there is ENOENT. The payload script names the right one.
- **Do not create the directory you are about to rename onto.** POSIX replaces
  an empty destination directory; Windows returns EPERM. `vendor.ts` creates the
  parent and lets the rename make the directory itself.
- **The macOS Postgres binaries are universal.** `lipo -thin` halves them, from
  144 MB to 74 MB.
- **`express` has to stay external and be installed beside the bundle.**
  `@thallesp/nestjs-better-auth` reaches it through `createRequire`, which
  cannot see inside a bundle. This is the same trap the Vercel build hit.
- **Secure cookies follow the scheme, not `NODE_ENV`.** The API and the
  interface are two processes, and they only agree on which cookie to read if
  they agree on that. `packages/auth/src/env.ts` derives it from `API_URL`.
- **The children run with their own working directory.** `@openvz/env/load`
  walks up looking for a `package.json` with `workspaces`, and from inside a
  checkout it would find the developer's `.env` and hand an installed copy
  somebody else's Google credentials.
