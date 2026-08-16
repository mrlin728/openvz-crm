# Changelog

## 1.0.0 (2026-08-17)

The first release of OPENVZ CRM.

This codebase is a derivative of an MIT-licensed project by Comp AI. Its release
history up to the fork is that project's, not this one's, so it is not restated
here. See LICENSE and NOTICE.

Changes made at the fork:

* Product identity: name, wordmark, icon set, and a colour system built on the
  OPENVZ cobalt `#2A2AFF` rather than the upstream green.
* Telemetry is off unless an operator opts in, and the upstream analytics key and
  host were removed. See `docs/telemetry.md`.
* The landing page no longer carries the upstream project's customer logos or
  staff photographs. Placeholder records render as initials.
* Workspace packages moved from `@crm/*` to `@openvz/*`. The database is
  `openvz_crm`. Telemetry variables are prefixed `OPENVZ_`.
* `engines.node` raised to `>=24`, which is what the agent runtime requires.
