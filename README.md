# spoke-template

The starter every new industry app is created from.

Part of the shared platform described in **Platform Architecture Plan: Hub, Platform and Apps (V3.1)**, the source of truth for this repo. Four repo kinds: `platform-hub`, `platform-core`, `spoke-template`, and one repo per industry app. Dependencies run one way: apps use the platform and the hub; the platform uses the hub; the hub depends on neither.

## Layout

```text
<app-name>/               pnpm workspaces + turbo.json
  packages/               the industry's own features (tables, rules, compliance checks)
  apps/                   the app's frontends and its event receiver
```

Packages are named `@spoke/<name>`. Packages are added when they are needed, never ahead of demand.

## Rules enforced here

1. Apps never import provider SDKs and never copy module code. CI fails on either.
2. Apps reach the platform only through `@platform-core/sdk`, `@platform-core/ui` and `@platform-core/contracts`, and the hub only through `@platform-hub/sdk`.
3. Sign-in comes from the platform foundation; apps never import an identity SDK.
4. Roles are data: code checks permission keys, never role names or user IDs.
5. Industry tables link to module records instead of copying them.
6. Documented exceptions only: approved browser integrations (for example Stripe.js for card entry), presigned file transfers issued by the hub, and customer-run egress. No app can obtain or use a privileged provider credential.

The rules live in `architecture.config.json` and are checked by `scripts/architecture/check.ts` on every pull request.

## Commands

```bash
corepack enable
pnpm install
pnpm run check                 # architecture rules, their tests, typecheck, tests
pnpm run check:architecture    # layer rules only
pnpm turbo dev --filter=<package>
```

Requires Node 22 or later and pnpm 10.15 (pinned through `packageManager`).

## Environments

Development and staging run on Railway with **test data only**. Production regional cells (India, Canada, US, UK, Australia) follow the plan's residency rules and are opened when a country's first customer signs.
