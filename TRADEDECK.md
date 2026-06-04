# MyTradeDeck — Project Status

Last updated: June 4, 2026 (**email-verification export gate LIVE — all 5 stages shipped**; quota dropped 5→3; onboarding card; sidebar scroll fix; Profile→Settings rename. Next up: Pro upgrade popup + free-tier feature gates.)

Save this. Paste into any future Claude conversation to continue.

> Reconstructed from current code + recent sessions. Sanity-check tester names (placeholders) and exact IDs against your own Stripe/Supabase if you need precision. The contractor login used throughout was samuelsaenz1996@gmail.com.

---

## 🆕 This session (Jun 4): Email-verification export gate — LIVE, all 5 stages shipped

**The feature:** Anti-farming. A user can sign up easily (email + password) and draft up to **3** free quotes/follow-ups, but **cannot download or send** anything until they confirm a real email. Fake-email farmers get useless drafts and nothing more. Paying (Pro) users are never gated.

**Why a custom system (not Supabase native):** Supabase gives a hard binary — "Confirm email" ON = unconfirmed users can't get a session at all; OFF (current) = every signup is auto-confirmed instantly (`email_confirmed_at` populated ~24-38ms after creation, no email sent). There is NO "unconfirmed-but-let-in" state. Verified by live console tests on fresh signups. So we built our own verification flag instead of gating on native `email_confirmed_at`.

### Stage 1 — DB foundation (SQL, done & verified)
Added to `public.profiles`:
- `email_verified_by_us boolean NOT NULL DEFAULT false` — the field the gate checks
- `verify_token text`, `verify_token_expires_at timestamptz`
- Partial index `profiles_verify_token_idx` on `verify_token WHERE NOT NULL`
- **Backfilled ALL existing users to `true`** (grandfathered — nobody/no tester/owner locked out). Only new signups start `false`. Verified: 4 existing rows all `true`, 0 `false`.

### Stage 2 — Backend endpoints (done & proven live)
- **`api/verify/send.js`** (POST `/api/verify/send`): Bearer auth, loads profile, if already verified returns `{alreadyVerified:true}` (no email); else `randomBytes(32).toString('hex')` token + 24h expiry stored on profiles, builds link `${APP_URL}/verify?token=...`, sends via **Resend HTTP API** (fetch to `https://api.resend.com/emails`, from `MyTradeDeck <noreply@mail.mytradedeck.com>`, to `user.email`, bilingual HTML). 502 on Resend failure, else `{sent:true}`.
- **`api/verify/confirm.js`** (POST `/api/verify/confirm`): **NO Bearer** (token IS the credential — link may open logged-out). Reads `req.body.token`; missing/invalid/expired/already each return spec'd response; on success flips `email_verified_by_us=true` AND nulls token+expiry (single-use); `{verified:true}`.
- Match existing endpoint pattern exactly (Node serverless, `res.json` style, `getUser(token)` Bearer, profiles keyed on `user_id`).
- **Proven live:** real email sent → arrived in inbox → confirm with real token → flag flipped + token nulled. Single-use + idempotency confirmed.

### Stage 3 — Export gate (front-end, done & proven)
- `requireVerifiedEmail()` helper: allow if `(profileCache.plan && plan!=='free')` **OR** `email_verified_by_us===true`; **null profileCache → allow** (defensive, never block on transient load); else open verify modal + return false.
- Guard `if(!requireVerifiedEmail())return;` at top of all **8 export functions**: `downloadPdf`, `sendQuoteEmail`, `sendQuoteText`, `downloadInvoicePdf`, `sendInvoiceEmail`, `sendInvoiceText`, `copyFollowupMessage`, `sendFollowupMessage`.
- Verify modal: "Confirm your email to send & download" + "Send me the link" (calls `/api/verify/send`) + "I've confirmed — refresh" (re-pulls `loadProfileCache`, re-checks, closes if now verified) + cancel. All `verify.modal.*` i18n EN+ES.
- **Pro/Team always bypass** the gate (paying customer obviously has a real email; never block them).
- Harness `__testExportGate()` → 16/16. Proven end-to-end on Preview (blocked → modal → resend → verify → refresh → unblocked → export works).

### Stage 4 — `/verify` landing page (done & proven LIVE on production)
- Standalone **`verify.html`** at project root (NOT part of index.html, no Supabase session needed — token is the credential). Reads `?token=` from URL, calls `/api/verify/confirm`, shows bilingual result: success / expired / invalid-or-already / generic-error / no-token states. On-brand (same palette `#FAF7F2`/`#1A1F2E`/`#E6DFD2`, Fraunces+Inter). Language from `localStorage.tdLang` (defaults EN for fresh browsers).
- **`vercel.json`** created at root (there was none before) with ONE narrowly-scoped rewrite: `/verify` → `/verify.html`. No catch-all, no `/api/*` rewrite — default static + serverless routing intact.
- **Gotcha learned:** the email link points at production `www.mytradedeck.com/verify`, so `verify.html` + `vercel.json` had to be **merged to production** before the link worked — testing on Preview/branch isn't enough since the email always goes to prod.

### Stage 5 — Polish (done)
- Subtle **sidebar reminder** ("Confirm your email to send & download" + "Send link") shown ONLY when `profileCache && !verified && (free/no plan)`. Hidden for Pro/verified/null. Refresh hooked at TOP of `updateUsageDisplay()` so it runs regardless of free/Pro branch and disappears immediately after verify.
- **Post-signup nudge** toast (`verify.signup.nudge`) on signup success — toast only, no auto-modal, no auto-send-email (keeps signup instant).
- Single resend code path: `sendVerificationLink(btn)` used by BOTH modal and sidebar (one `fetch('/api/verify/send')` site).
- Harness `__testVerifyPolish()` → 4/4.

### Test account
`samuelsaenz20+verifytest2@gmail.com` (Gmail +alias → lands in `samuelsaenz20@gmail.com` inbox). To re-test the UNVERIFIED path, flip it back to false:
```sql
update public.profiles set email_verified_by_us = false
where user_id = (select id from auth.users where email = 'samuelsaenz20+verifytest2@gmail.com');
```

---

## 🆕 Also this session (Jun 4): smaller shipped items

- **Free quote cap dropped 5 → 3.** SQL: `CREATE OR REPLACE` on `consume_quote_credit` (`free_limit int := 3`) and `get_quote_status` (`limit_val = 3` for free). Front-end: `updateUsageDisplay` `quoteUsed/3`, `consumeQuotaOrShowError` bypass `>=3`, i18n `sidebar.quotesSuffix` "/3 quotes"+"/3 cotizaciones", `status.limit` fallback →3. Server-enforced (RPC keyed on `auth.uid()`). NOTE: existing free users who already made 3+ this month are over cap until monthly reset — no data harm, server just blocks next.
- **Post-signup onboarding card.** Dismissible centered bilingual card; first name REQUIRED, last/company/phone optional; "Finish later" + "Save and continue"; writes to existing `profiles` columns (first_name, last_name, company_name, phone). Trigger = `profileCache.first_name` empty/null (self-resolving — reappears next login if skipped, never returns once saved). Harness `__testOnboarding()`.
- **Sidebar scroll fix.** Base `.sidebar` got `overflow-y:auto` (was `height:100vh` no overflow → bottom content/Upgrade button clipped on short desktop screens). Mobile drawer rule untouched.
- **Profile → Settings rename.** Cosmetic only. `navProfile` relabeled to `nav.settings` (gear icon), dead duplicate Settings nav item deleted, `profile.title` EN/ES = "Settings"/"Configuración". Internals unchanged (`switchView('profile')`, `#profileView`, view key `'profile'`, `loadProfileData` all kept).

---

## 🔜 NEXT UP (decided Jun 4, not yet built): Pro upgrade popup + free-tier feature gates

### Pro upgrade popup (NOW — build next session)
Replace the small bottom toast (shown when a free user hits the 3-quote cap and presses Generate again) with a **proper upgrade popup**. **Reuse the EXISTING sidebar upgrade popup** (the one with the $49/mo ÷ $490/yr monthly↔annual toggle + working Stripe checkout) — do NOT build a parallel popup. Extend it with:
- A **Free-vs-Pro comparison table** (two columns — loss-aversion framing, shows what they're missing).
- The 3-quote-cap "Generate again" trigger opens **that same popup** (not the toast).
- Popup's upgrade button → **existing Stripe checkout** (toggle already picks monthly/annual). One payment path.
- **Feature list still needs final confirmation** before building (which of invoicing / follow-ups / branding / bilingual are free vs Pro-only). Confirmed Pro benefits so far: unlimited quotes (free=3/mo), unlimited clients (free=1), Jobs/project tracking (free=none), Get-Paid online payments (free=none).

### Free-tier feature gates (LATER — deliberate sprint, enforcement touches live code)
These are the limits the popup will advertise; ENFORCEMENT is a separate future sprint (UI + ideally server-side):
- **Free = max 1 client** (enforce in clients flow).
- **Free = no Jobs section** (hide/block the jobs area).
- **Free = no "Get Paid" / Stripe Connect access** (block Connect onboarding for free users — touches live payment code, treat carefully).

### Also explored, no decision (Jun 4): "try before signup"
Letting anonymous visitors try quote generation. Risk: exposes AI API to unauthenticated traffic (cost abuse, no quota since RPC needs `auth.uid()`, free Claude proxy). Options if revisited: (1) **canned/fake demo quote** — zero risk, zero AI cost, ~90% of the benefit, RECOMMENDED; (2) one real anon gen needing **both** Cloudflare Turnstile bot-check AND IP rate-limit; (3) skip — signup already near-frictionless. Parked, no decision.

---

## Carried-over open items (from prior sessions)

| Feature | Priority | Notes |
|---|---|---|
| Sidebar plan-card fix | Check if still needed | Prior spec: `updateUsageDisplay()` ran before `loadProfileCache()` resolved → "FREE PLAN / Unlimited / 5 quotes" contradiction for pro. May already be resolved by this session's `updateUsageDisplay` changes — verify on the pro account. `__testSidebar()` harness exists. |
| Account management (change pw / change email / delete account) | Med | Its OWN deliberate sprint. "Delete account" needs upfront decisions: cascade of clients/quotes/invoices rows + live Stripe Connect account + active subscription. NOT a casual bolt-on. |
| "Draft" label top-right of app | Low | User wants it removed. Need to `Ctrl+Shift+F "draft"` first to confirm it's not a load-bearing quote/invoice status badge before deleting. |
| Embedded card entry on our page | Med | Stripe Embedded Checkout (keeps token flow + PCI posture). Separate sprint. |
| Test the ANNUAL checkout path | Med | Monthly proven live via coupon; annual env var confirmed but never run end-to-end. Shares monthly code path (low risk). |
| Orphan i18n key sweep | Low | `toast.invoicePlaceholder`, `invoice.viewTitleHtml`, dead `followup.age`, plus now-unused `nav.profile` (harmless). |
| Single-invoice topbar shows "Invoices" (plural) | Low | Cosmetic. |
| Auto-link follow-up to job | Low-Med | ~2-line fix in `persistGeneratedFollowup`; source picker now exposes quote/invoice id at compose time. |
| PAY-C partial-payment idempotency | Low (deferred) | Multiple online partials + replayed event could double-count. |
| Account-level language preference | Low | Only if cross-device need surfaces; `tdLang` is localStorage/per-device today. |
| Retire dev bypass | Low | localhost-gated; parked. |
| Capacitor wrap | Med | Sprint 4+. |
| Delete `pay-b-preview` branch | Low | Safe to delete post-go-live. |

---

## 🟢 Payments + subscriptions: LIVE on Saenztech LLC

Platform account **Saenztech LLC** (`acct_1Tdvgh2LuFwvqrU8`), **live mode**. Both flows proven end-to-end with real money:
- **Payments (Connect):** real $1 invoice → hosted Checkout on connected account → 1% platform fee → Connect webhook 200 → invoice auto-flipped to paid (`paid_at` stamped). Full PAY-A/B/C loop live.
- **Subscriptions:** Upgrade → live Checkout against Saenztech LLC price IDs → webhook → `profiles.plan='pro'`, `subscription_status='active'`. Confirmed.

### Migration gotchas (keep — hard-won)
- **Webhook URLs MUST use `www.`** — apex 307-redirects, Stripe doesn't follow redirects on POST → silent 307 ERR. (Same gotcha bit the Stage 4 verify link — email points at prod www.)
- **Connect webhook listens on Connected accounts**, not just platform.
- **Stale cross-account IDs on prod `profiles`** block onboarding/checkout — clear Connect columns + `stripe_customer_id` to re-onboard fresh.
- **`profiles` PK is `user_id`, NOT `id`.** All profile SQL keys on `WHERE user_id = (SELECT id FROM auth.users WHERE email='...')`.
- **Live secret keys shown once.** Vercel masks sensitive var values — not a failed save.
- **Env var changes only apply to NEW builds** — redeploy/push after editing.

### Reset-to-free recipe (re-test upgrade flow)
```sql
UPDATE public.profiles
SET plan = 'free', stripe_subscription_id = NULL, subscription_status = NULL,
    stripe_customer_id = NULL
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'samuelsaenz1996@gmail.com');
```

---

## What This Is

MyTradeDeck is an AI-powered admin tool for contractors and tradespeople. Drafts bilingual (EN/ES) quotes and follow-ups, with a CRM layer (clients → jobs → quotes/follow-ups/invoices). Contractors can get paid online: send an invoice with a pay link, the client pays by card on a Stripe-hosted page, money lands in the contractor's own Stripe account; the invoice auto-marks paid via webhook.

- Pricing: **Free (3 quotes/mo, server-enforced; export gated behind email verification)** · Pro $49/mo (annual $490) · Team $99/mo (priced, no multi-seat logic).
- Payments fee: 1% MyTradeDeck platform fee capped at $25/invoice, on top of Stripe's processing fee. Contractor is merchant of record.
- Live at https://www.mytradedeck.com. Goal: a high-income side project, not full-time. Long-term: Capacitor wrap for the app stores.

## Tech Stack (current)
- Frontend: single `index.html`, vanilla JS, no framework, no build step + standalone `verify.html`. Host path `c:\ST\GitHub\TradeDeck\TradeDeck\index.html`.
- AI: Anthropic API via `/api/generate.js` (Edge proxy), model `claude-sonnet-4-6`, SSE streaming.
- Auth: Supabase email — password (+ magic-link fallback), recovery. "Confirm email" toggle OFF (auto-confirm); custom `email_verified_by_us` flag gates export. Dev bypass localhost-only.
- Billing: Stripe Checkout + portal, subscription webhook → `profiles.plan`.
- Payments: Stripe Connect Standard, direct charges, platform `application_fee_amount` (1% capped $25), hosted Checkout. Two webhooks (subscription vs Connect), separate secrets.
- Email: **Resend** — domain `mail.mytradedeck.com` VERIFIED. Used as Supabase SMTP provider AND now directly via Resend HTTP API from `/api/verify/send` (needs `RESEND_API_KEY`). Verify email from `noreply@mail.mytradedeck.com`.
- Persistence: Supabase Postgres (`clients`, `quotes`, `jobs`, `followups`, `invoices`, `profiles`), 4-policy RLS on `auth.uid()`, cross-entity FKs ON DELETE SET NULL. Project `cqmctdhxticryelvhhze`.
- Storage: Supabase `logos` bucket.
- Hosting: Vercel, auto-deploy from GitHub `main`. `vercel.json` has one rewrite (`/verify`→`/verify.html`). Domain on GoDaddy (apex 307s → www). PDF: html2pdf.js. API safety: $20/mo Anthropic cap.

### Vercel environment variables (Production)
- `STRIPE_SECRET_KEY` — Saenztech LLC live `sk_live_…` (Production); Preview = `sk_test`.
- `STRIPE_PRICE_ID_MONTHLY` = `price_1TdxD62LuFwvqrU89lp9r6GP` ($49/mo); `STRIPE_PRICE_ID_ANNUAL` = the $490/yr price.
- `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`.
- `PLATFORM_FEE_PERCENT` = 1; `PLATFORM_FEE_CAP_CENTS` defaults 2500 in code.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `ANTHROPIC_API_KEY`.
- **`RESEND_API_KEY`** — added Jun 4 for `/api/verify/send` (Production + Preview).

### Backend endpoints (/api)
`generate`; `create-checkout`; `create-portal`; `stripe-webhook`; `connect/create-account-link`; `connect/account-status`; `invoice/create-pay-link`; `pay/[token]` (public); `pay-result` (public); `webhooks/stripe-connect` (public, Connect); **`verify/send` (Bearer); `verify/confirm` (token-auth, no Bearer)**. All Node/ESM, JWT-verify pattern (except verify/confirm), service-role Supabase client, Stripe apiVersion '2024-06-20'.

## What's Built (functional)
- Foundation, quotes, full CRM (clients/jobs/quotes/follow-ups), 10 trades / 7 pricing modes, full EN/ES, mobile drawer.
- Auth (password + magic-link + recovery), Stripe subscriptions + portal, Settings/branding (formerly "Profile").
- Archive + bulk + delete + confirmModal across all four core tables + invoices.
- Invoices: INV-A + INV-B + active/archived toggle.
- Payments collection: PAY-A/B/C, all live on Saenztech LLC.
- Payments dashboard (real data): period-scoped + all-time + avg-days-to-pay; date-range; split-bar; chase list.
- Follow-up compose v2: source picker → searchable picker → dynamic scenarios → source-aware AI → sign-off appended in code. `__testFollowupPicker` 13/13.
- **Quota 3/mo (server-enforced).**
- **Email-verification export gate (custom flag, all 5 stages live).**
- **Post-signup onboarding card.**

## Data Model (current)
clients → jobs → (quotes, followups, invoices); quotes/followups/invoices can also hang directly off a client. Invoices created from a quote via idempotent `create_invoice_from_quote` RPC. `invoices` has `pay_token` (unique), `stripe_checkout_session_id`, `stripe_payment_intent_id`, `paid_at`, `archived_at` (nullable, indexed). `profiles` (PK = `user_id`) has quota RPCs (free cap now 3), plan, business/branding fields, Stripe subscription + Connect fields, and **`email_verified_by_us` / `verify_token` / `verify_token_expires_at`** (Jun 4). Onboarding writes to existing `first_name`/`last_name`/`company_name`/`phone`.

## Workflow preferences
Small incremental sprints. Prompts in fenced blocks for Claude Code in VS Code, 4-section format (Manual setup → Changes → Self-tests → Test plan), explicit negative constraints, "X/X passed" before deploy, functions referenced by name. Migrations as a separate SQL block BEFORE code. **Multi-phase manual procedures ONE step at a time — user gets confused by multi-step instructions, present exactly one action per message.** Push to a branch → Vercel Preview → verify → merge to main. (Reminder: features whose email/link points at production must be merged to PROD to test the link, not just Preview.)

## Open questions for next session
- **Build the Pro upgrade popup** (extend the existing $49/$490 toggle popup with a Free-vs-Pro comparison table; wire the 3-quote-cap "Generate again" to open it; confirm the final feature list first — which of invoicing/follow-ups/branding/bilingual are free vs Pro).
- Then schedule the **free-tier enforcement sprint** (1 client max, no Jobs, no Get-Paid).
- Confirm whether the prior **sidebar plan-card bug** is still present after this session's `updateUsageDisplay` changes.
- Remove the "Draft" label (search first — confirm it's not a status badge).
- Test the annual subscription path end-to-end.