# Building a new app on the platform — AI agent playbook

**Who this is for.** Any AI agent (fresh session, no memory of prior work) picking up a new industry app — Dentex, Tress-Lounge, Realtors, Insurance, or whatever comes next. Read this before writing a line of business logic. Worked examples below use Dentex because it exists today; the pattern is identical for every app.

**Source of truth.** The *Platform Architecture Plan: Hub, Platform and Apps (V3.1)* governs every decision here. If anything in this playbook conflicts with that plan, the plan wins — stop and flag the conflict rather than picking one silently.

---

## 1. The mental model, in one paragraph

Four repo kinds. `platform/hub` is the only code that talks to outside providers (Stripe, Razorpay, Twilio, SES, AI models, Cognito's backing calls) and holds their keys. `platform/core` is one Turborepo holding the foundation (identity adapter, tenancy, hierarchy, roles, core records) plus one package per shared module (scheduling, CRM/lead, GTM, LMS, communication, tasks/forms), all loaded into one `platform-api` service per region. `spoke-template` is the starter every new app is cloned from. Your app is a fourth repo, built from `spoke-template`, that owns only what's genuinely industry-specific — nothing else.

**The one rule that decides almost everything**: your app repo never imports a provider SDK, never copies module code, and never talks to a database directly. It talks to `platform-api` over HTTP with a signed identity token, and `platform-api` talks to `hub-api` on your behalf when a provider operation (send an email, charge a card, call an AI model) is needed. You never see a provider credential. You never see another tenant's data. You never bypass a permission check by hand-rolling one in your app.

---

## 2. Before you write any code

1. **Read the plan.** At minimum, the sections: "Building a new app," "Accounts and tenants," "Identity, tenants, users and roles," and the acceptance-tests table. If you don't have a copy, ask for it — don't proceed from memory of a summary.
2. **Read `AI-WORK-ORDER.md`** in `platform/hub` and `platform/core` to see what's actually shipped versus planned. The plan describes the target architecture; the work order describes current reality. They will disagree in places — reality wins for "what can I call today," the plan wins for "what should this look like eventually."
3. **Write a one-page brief for the app** (the plan calls for this explicitly): list every feature, and sort each one into exactly one of three buckets — *foundation/shared module* (platform/core), *provider integration* (platform/hub), or *industry-specific* (your app). If a feature doesn't obviously sort, that's a flag to resolve before coding, not during.
4. **Check what already exists.** Before building anything, check whether `platform/core` already has the module you need (scheduling, lead/CRM, communication, GTM, learning as of this writing) and whether `platform-api` already exposes a route for it. Building a second copy of something that exists in a module is exactly the mistake the plan's layering exists to prevent.

---

## 3. Creating the app repo

```bash
# spoke-template has no customer history to preserve — a plain clone + rename is correct here
# (contrast with the Gate 1 extractions, which used git-filter-repo to preserve history
# pulled out of expadio; this is a fresh app, so that doesn't apply)
git clone https://github.com/johnniemarbles/spoke-template <new-app-name>
cd <new-app-name>
rm -rf .git && git init
# update package.json name, README, architecture.config.json's app identifier
```

Confirm `architecture.config.json` and `scripts/architecture/check.ts` came over from the template — these are what enforce rule #1 above. Run `pnpm run check:architecture` immediately after cloning, before adding any code, so you know the baseline is clean.

---

## 4. Deciding where a feature's code lives

Run every feature through this in order — stop at the first "yes":

1. **Does it talk to an external provider** (send an SMS, charge a card, call an LLM, verify a domain)? → `platform/hub`. Your app never does this directly, ever, including through a "just for this app" exception — exceptions are limited to the plan's named list (browser integrations, presigned uploads, customer-run egress), not general provider access.
2. **Would a second app plausibly need the same capability** (scheduling, a CRM record, sending a templated email, a lead pipeline, course content)? → a `platform/core` module. If the module doesn't exist yet, that's a Gate 3-style extraction/build, not something you inline into your app to move faster — inlining it means Tress-Lounge or Realtors rebuilds it from scratch later instead of reusing it.
3. **Everything else** — the industry-specific business logic, screens, and rules that make Dentex a dental-chair booking app rather than a hair-salon app — lives in your app repo.

If you're unsure whether something is shared or industry-specific, default to industry-specific first (your app repo) and extract it into a module later once a second app actually needs it. Don't speculatively build shared infrastructure for apps that don't exist yet.

---

## 5. How your app talks to the platform — the actual flow

This is built and proven today (Dentex-v2, verified end to end against Railway staging). The shape:

```
Browser (your app's SPA)
    │  1. sign in via Cognito (amazon-cognito-identity-js, or hosted UI later)
    ▼
Cognito user pool (one per region — your app shares it with every other app in that region)
    │  2. returns an ID token
    ▼
Your app's SDK (apps/web/src/platform/sdk.ts in your repo)
    │  3. calls platform-api with  Authorization: Bearer <ID token>
    ▼
platform-api  (platform/core/apps/platform-api — shared service, not yours to fork)
    │  4. verifies the ID token, resolves your tenant + membership + permissions
    │  5. for anything needing a provider, mints a short-lived scope token and calls the hub
    ▼
hub-api  (platform/hub/apps/hub-api — never called directly by your app)
```

**Your app's own code only ever touches step 3.** You write a thin typed client, modeled on what's already in `dentex-v2/apps/web/src/platform/`:

- `cognito.ts` — wraps sign-in/sign-out/`getIdToken()`. Copy this file as-is into a new app; it has no Dentex-specific logic.
- `sdk.ts` — a `PlatformApi` class with one typed method per `platform-api` route you need. Start with `.me()` (already built, proves the pipeline), then add one method per route your app actually calls. Each method is a few lines — see the existing `.me()` implementation as the template for the request/response shape (`{ok, traceId, result}`, unwrapped into the typed result or thrown as `PlatformApiError`).
- `index.ts` — a singleton wiring `baseUrl` + `getIdToken` together, exported for the rest of the app to import.

**You do not write code that reaches `hub-api`.** If a feature needs a provider operation (send a confirmation email, charge a card), you call a `platform-api` route, and `platform-api`'s handler mints the scope token and calls the hub — that logic lives in `platform-api`, not in your app. This is also true for your app's own "backend," if it has one — the app layer has no provider credentials of any class, ever.

---

## 6. When `platform-api` doesn't have the route you need

This will happen constantly early on — right now `platform-api` exposes exactly `GET /v1/me`. You have three honest options, and the choice follows the same sort from Section 4:

**(a) It's a thin, industry-specific route** (e.g. Dentex's "create a booking" endpoint, which is industry logic — scheduling a dental chair — wrapping a shared module's primitive): add a route under `platform-api/src/routes/`, scoped to your app's permission keys, following the existing `me.ts` route's shape (read the verified claims off `HandlerContext`, do the work inside the transaction `withRequestContext` already opened for you, return a plain object). This is the right place for "Dentex's booking creates a row via `@platform/core/scheduling` and asks the hub to send a confirmation" — that's what the existing `POST /v1/bookings` design in the Gate 4 Wave 1b handoff does.

Important nuance as of today: `platform-api` currently hardcodes `PLATFORM_APP_ID` as a single value per deployment. The plan's actual shape is **one `platform-api` per region, shared by every app** — not one per app. Before a second app (e.g. Tress-Lounge) goes live, this needs fixing: `appId` should come from the resolved tenant/host, not a fixed env var, and routes should be registered per-app rather than assumed single-app. Flag this explicitly if you're the agent that onboards app #2 — don't just bump the env var and ship two separate `platform-api` deployments; that silently defeats the "one login works across every app a tenant has switched on" design goal.

**(b) It needs a module that doesn't exist yet** (e.g. nothing like scheduling exists for a concept your app needs): this is a `platform/core` module build, scoped and tested like the existing modules (scheduling, lead, gtm, learning). It depends only on foundation + core-records + contracts — never on another module directly. Write it as its own package, with its own migration, before wiring a `platform-api` route to it.

**(c) It needs a new provider**: this is a `platform/hub` addition — a new adapter package or an extension of `@platform/hub/communication`/`provider-registry`, plus a `connector_grants` row scoping which tenants/apps can use it. Your app never imports the provider's SDK even transitively through this path; it only ever sees the result through `platform-api`.

In all three cases: write the route/module/adapter, write its tests (pglite for DB-touching code, matching the existing test patterns), run `check:architecture`, and only then wire your app's SDK method to call it.

---

## 7. Fetching platform data — concrete patterns

Three honest categories, all going through `platform-api`:

- **Identity/profile data** (who is this user, what tenant, what permissions): `platform.me()`. Already built. Call it once after sign-in and cache the result for the session; don't re-fetch on every screen.
- **Module data** (a scheduling slot, a CRM lead, a course, a sent message): a typed method on your SDK calling a `platform-api` route that itself calls the module's exported functions inside the request's transaction. The module enforces tenant isolation via the server-set Postgres GUCs — you never pass a tenant ID from the client; it's derived server-side from the verified identity token on every request. Trying to pass your own `tenantId` in a request body and have the server trust it is exactly the vulnerability the whole scope-token design exists to prevent — don't do it, and don't build a route that accepts one.
- **Provider-backed data** (did this email actually get delivered, what's this customer's subscription status): still a `platform-api` route, which internally calls the hub with a scope token. You never get a direct answer from Resend, Stripe, or Twilio in your app code.

If you find yourself writing a SQL query in your app repo, or an `import ... from 'stripe'` / `'twilio'` / `'resend'` anywhere outside `platform/hub`, stop — that's the architecture guard's job to catch, and it will fail the build; don't work around it.

---

## 8. Local dev workflow

- `platform-api` and `hub-api` both run locally with `pnpm run dev` against a local Postgres (or pglite for tests — no real database needed to run the test suites).
- For working against real staging infrastructure instead of standing up your own: point your app's `VITE_PLATFORM_API_URL` at the Railway staging URL for `platform-api`, and sign in with a seeded dev-pool test user. Staging holds **test data only** — never point a real customer flow at it.
- Scope tokens are HS256 in dev, Ed25519 in prod. You should never need to touch scope-token signing directly from your app — that's internal to `platform-api`. If you find yourself needing to sign a scope token from app code, something is architecturally wrong; routes, not apps, mint scope tokens.
- Every new route/module ships with tests in the same commit — pglite-backed integration tests for anything touching the database, following the existing test files (`apps/platform-api/test/*.test.ts`, `packages/scheduling/test/*.test.ts`) as the pattern to copy.

---

## 9. Checklist before merging business logic

Straight from the plan's own "Gate before launch" bullet, applied at the level of a single feature PR, not just a whole-app launch:

- [ ] Every piece of this feature is mapped to exactly one layer (hub / module / app) — no "temporarily inline it, extract later" without a tracked follow-up.
- [ ] No provider SDK import anywhere in the app repo (`pnpm run check:architecture` passes).
- [ ] No copied module code — if you needed something a module has, you called it, you didn't paste it.
- [ ] No caller-supplied tenant ID, user ID, or role name trusted anywhere — every check is a permission-key check against server-resolved identity.
- [ ] Tests exist and pass for the new route/module code, including the relevant denial case (wrong tenant, wrong app, missing permission) where applicable.
- [ ] If this feature touches a shared module, it was tested against that module's own test suite too, not just your app's integration test.

---

## 10. Anti-patterns — do not do these

| Don't | Why | Do instead |
|---|---|---|
| `import Stripe from 'stripe'` in an app | Breaks the provider-SDK ban; the credential would need to live in the app | Call a `platform-api` billing route |
| Query Postgres directly from the app | Bypasses tenant isolation entirely | Call `platform-api`; let server-set GUCs scope the query |
| Pass `tenantId` in a request body and trust it | Exactly the vulnerability scope tokens prevent | Derive tenant from the verified identity token, server-side, always |
| Copy a module's source file into your app "to customize it" | Forks logic that should stay shared; next app rebuilds it again | Extend the module, or add an app-specific route that composes module calls |
| Check `if (user.role === 'admin')` in app code | Roles are data, not code; this is the plan's rule #4 violated directly | Check a permission key the server already resolved onto the membership |
| Sign a scope token from app code | Scope tokens are `platform-api`'s job, never the app's | Add a `platform-api` route that does the minting server-side |
| Hardcode a second app's `PLATFORM_APP_ID` as a workaround to "just ship it" | Defeats the one-platform-api-per-region design; silently breaks shared login | Fix the appId resolution to come from tenant/host (Section 6a), or flag it as blocking |

---

## 11. Worked example: Dentex's booking feature, start to finish

This traces the actual decisions for Dentex's "book a patient into a chair" feature. As of this writing, steps 1–3 and the identity/`\`.me()`\`` slice of steps 4–6 are shipped and test-passing; the booking route itself (steps 4–7) is a designed, not-yet-executed plan (see the Gate 4 Wave 1b handoff) — included here because it's the clearest worked example of the full pattern, not because it's already live. Check the relevant repo's current state before assuming any specific step is done.

1. Brief line: "a dentist can book a patient into a chair and the patient gets a confirmation." Sorted: *scheduling* (shared — `@platform/core/scheduling`), *confirmation email* (provider — hub communication), *the actual booking form and chair-selection UX* (industry-specific — Dentex app).
2. Module already existed (`@platform/core/scheduling`, extracted at Gate 3). No new module needed.
3. Hub route already existed (`POST /v1/communications/email/send`, built at Gate 4 Wave 1a). No new hub work needed.
4. Plan: add one `platform-api` route, `POST /v1/bookings` — creates the scheduling row, mints a least-privilege scope token (`communication.email.send` only, narrowed from the membership's full permission set), calls the hub.
5. Plan: add one SDK method, `PlatformApi.createBooking(input)`.
6. Plan: add one Dentex-specific page, `BookingsNew.tsx` — the chair picker, the date/time UI, the chief-complaint field. This is the only genuinely Dentex-shaped code in the whole feature.
7. Plan: pglite integration tests on the `platform-api` route (permission denial, cross-tenant RLS, idempotent email dispatch), manual end-to-end through the actual SPA.

That's the pattern. Everything above Section 11 is how to reproduce steps 1–6 correctly for whatever your app's next feature is — and how to tell, before you start, which steps someone has already done versus which are still just a plan on paper.
