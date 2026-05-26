# MyTradeDeck — Project Status

Last updated: May 26, 2026 (post Sprint PAY-B)

Save this. Paste into any future Claude conversation to continue.

> Reconstructed from current code + the PAY-A/PAY-B build sessions. Sanity-check the tester names (placeholders) and the exact profiles/invoices migration SQL against your Supabase if you need precision.

---

## What This Is

MyTradeDeck is an AI-powered admin tool for contractors and tradespeople. Drafts professional bilingual (English + Spanish) quotes and customer follow-up messages in seconds, with a CRM layer where jobs are the central work-tracking entity — clients, quotes, follow-ups, and invoices hang off a job or directly off a client. Contractors can now also **get paid online**: send an invoice with a pay link and the client pays by card on a Stripe-hosted page, money landing in the contractor's own Stripe account.

- Pricing plan: Free (5 quotes/month, server-enforced) · Pro $49/month · Team $99/month
- Online payments fee: contractor's client pays the invoice; the contractor's Stripe nets it minus Stripe's processing fee + a **1% MyTradeDeck platform fee capped at $25/invoice**.
- Target: $10,000–$15,000/month, primarily from $49/mo subscriptions; payment fees are a secondary, stickiness-driven stream.
- Stage: Live at https://mytradedeck.com. Quotes, full CRM (clients/jobs/quotes/follow-ups/invoices), archive + bulk across entities, Stripe subscriptions, password auth, profile/branding, invoice list view, and **Stripe Connect payment collection (built, proven in test mode, on main but not yet launched to real users)**.
- Goal type: Side project that generates a lot of income, not full-time business.
- Long-term: Capacitor wrap for App Store + Google Play.

## Tech Stack (Current)

- Frontend: Single index.html — vanilla JS, no framework, no build step.
- AI: Anthropic API via /api/generate.js (Edge proxy). Model claude-sonnet-4-6. SSE streaming.
- Auth: Supabase email auth — password (sign up/in/forgot/recovery) + magic-link fallback. Dev bypass localhost-only.
- Billing (subscriptions): Stripe Checkout + portal via /api/create-checkout, /api/create-portal; webhook → profiles.plan. STRIPE_WEBHOOK_SECRET set.
- **Payments (NEW — Stripe Connect):** STANDARD connected accounts, DIRECT charges on the connected account, platform `application_fee_amount` (1% capped at $25), Stripe-HOSTED Checkout. Contractor is merchant of record (owns disputes/refunds/Stripe fees). Standard ⇒ no extra Connect fees to the platform.
- Persistence: clients, quotes, jobs, followups, invoices, profiles in Supabase Postgres. Standard RLS (4 policies/table on auth.uid()). Cross-entity FKs ON DELETE SET NULL.
- File storage: Supabase Storage 'logos' bucket; public URL on profiles.logo_url.
- Email/text delivery: Resend SMTP via mail.mytradedeck.com; invoice/quote send via Web Share → mailto/sms fallback.
- Supabase project: https://cqmctdhxticryelvhhze.supabase.co · Publishable key sb_publishable_YOWddbCqAPdFrg-9otLSzw_akBdoAPh.
- Domain: mytradedeck.com (GoDaddy, A 216.198.79.1 + CNAME www; subdomain mail. for Resend).
- PDF: html2pdf.js (cdnjs).
- Hosting: Vercel, auto-deploys from GitHub main. Serverless functions under /api (nested + dynamic routes supported, e.g. /api/connect/*, /api/pay/[token]).
- API safety: $20/month Anthropic Console cap.

### Vercel environment variables (current)
- STRIPE_SECRET_KEY — **SPLIT by environment**: Production = LIVE key, Preview = TEST key (sk_test). This is how Preview tests Stripe safely without touching live.
- SUPABASE_SERVICE_ROLE_KEY — used by subscription webhook AND all the Connect/pay endpoints to write status/tokens bypassing RLS.
- PLATFORM_FEE_PERCENT — the platform fee %, currently 1. Defaults to 0 in code if unset (fail-open to no fee). **Must be set on Production before going live or you earn $0 on payments.**
- PLATFORM_FEE_CAP_CENTS — optional override; defaults to 2500 ($25) in code.
- APP_URL, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, STRIPE_PRICE_ID_ANNUAL, STRIPE_PRICE_ID_MONTHLY, ANTHROPIC_API_KEY.
- Note: pay/connect endpoints derive their return/base URL from the request origin (APP_URL fallback), so Preview-initiated flows return to Preview.

## Data Model (Current)

clients → jobs → (quotes, followups, invoices); quotes/followups/invoices can also hang directly off a client.
- A quote is a proposal (standalone or job-linked).
- A job is an optional work container; created on demand (never auto).
- An invoice is created from a quote via the create_invoice_from_quote RPC (idempotent); flips quote.status → 'invoiced'. Payment tracking + the online pay link live on the invoice row.
- A follow-up can attach to client/quote/job.

## What's Built (Functional)

### Foundation, quotes, CRM (Sprints 1x–2x) — all shipped
Server Anthropic proxy; Supabase auth gate; server-enforced quota (get_quote_status / consume_quote_credit); Resend SMTP; custom domain; OG/Twitter meta. 10 trades, 7 pricing modes, flat-rate sub-mode, self-balancing flat-rate math, phase-based AI line items, trade-aware prompts. Quotes/Follow-ups persistence + list views (three-mode nav, search, inline edit/autosave, status dropdowns, delete). Clients list + detail + manual create + autocomplete + launchers. Jobs first-class: list (live stat cards + filter tabs), detail, explicit-Save create-from-quote, manual "+ New Job". Full EN/ES. Mobile drawer nav. (See git history for per-sprint detail.)

### Auth, billing, profile — shipped
Email+password (+magic-link), recovery flow. Stripe subscription checkout + billing portal + webhook. Full Profile/branding screen: company info, logo upload, brand color, default deposit %, per-language warranty defaults, plan & usage, activity stats. Profile identity flows onto rendered quotes + invoices.

### Archive + bulk + delete + confirm — shipped
archived_at on all four core tables; Active/Archived tabs; generic BULK selection system (select-all + bulk archive/unarchive/delete); row+detail delete everywhere; promise-based confirmModal with focus trap.

### Invoices — INV-A + INV-B (shipped)
- INV-A: convert-to-invoice (create_invoice_from_quote RPC, idempotent, sequential invoice_number, tax snapshot baked on). Invoice doc view reusing profile identity. Payment-tracking panel OUTSIDE #invoiceDoc (so excluded from PDF): status (unpaid/partial/paid), amount-paid, due-date, derived OVERDUE (invoiceEffectiveStatus). PDF/email/text send. Convert button relabels to "View invoice."
- INV-B: **Invoices LIST view** + revealed #navInvoices. Read-only list (#INV-#### / client / total / effective-status pill / date), search, click → doc. Context-aware Back (invoiceReturnTo: 'list' vs 'quote'). No delete/bulk/archive/status-dropdown in the list (by design). enterInvoiceView(invoice, returnTo) threaded. 11 i18n keys ×2.

### Payments collection — PAY-A + PAY-B (built, proven in TEST mode)
- **PAY-A — Connect onboarding (Standard).** Profile "Get paid" card with 3 states (not-connected / incomplete / connected-green). Endpoints: /api/connect/create-account-link (creates a Standard account if none, returns hosted onboarding link; origin derived from request) and /api/connect/account-status (retrieves account, persists charges/details/payouts booleans). Status booleans are a UI cache only — the authoritative gate re-checks live. Proven end-to-end in the sandbox (onboard → return → green "Connected").
- **PAY-B — collect payments (hosted Checkout, direct charges).** Contractor clicks "Create payment link" on an invoice (gated on cached charges_enabled) → /api/invoice/create-pay-link (authed; mints a random pay_token, returns origin-based payUrl). The emailed/texted link points to /api/pay/[token] (PUBLIC) which: looks up the invoice by token (service role), does a LIVE accounts.retrieve charges_enabled check, computes balance due, creates a Checkout Session ON THE CONNECTED ACCOUNT ({ stripeAccount }) with application_fee_amount (1% capped $25) + metadata.invoice_id on session + payment_intent, and 302-redirects to Stripe. /api/pay-result is a minimal public thank-you/canceled page. Send functions append "Pay online: {payUrl}" only when connected + unpaid.
  - **Proven in test mode:** $87,500 test invoice → charge landed on the connected account, application fee = $25 (cap correctly clamped 1%=$875 down to $25), Stripe ~$2,537.80, contractor netted $84,937.20.

### Payments dashboard view — STILL MOCK
MOCK_PAYMENTS / MOCK_PAYMENT_WEEKS. "Preview" badge still on the Payments nav. This is the last mock surface; the real data source (invoices + paid_at via PAY-C) is now nearly in place.

## What's NOT Built (Roadmap)

| Feature | Priority | Notes |
|---|---|---|
| PAY-C — payment webhook → mark invoice paid | High (next) | Stripe webhook on checkout.session.completed / payment_intent.succeeded; read metadata.invoice_id; set amount_paid / status='paid' / paid_at / stripe_payment_intent_id; reconcile with manual tracking. WITHOUT THIS, a paid invoice still shows "unpaid" in-app. Needs a Connect webhook endpoint + its own webhook secret. |
| Go-live for payments | High | Production currently has the code but: set PLATFORM_FEE_PERCENT on Production; enable Connect + branding + capabilities on LIVE (not just sandbox); re-onboard on the live key (sandbox acct_… don't carry to live). |
| Real Payments dashboard | Med-High | Replace MOCK_PAYMENTS with real invoice data (Σtotal / Σamount_paid / Σbalance). "Avg days to pay" now computable once paid_at is populated by PAY-C. Decide INV-B-vs-Payments merge (lean: Payments becomes the rollup over the same invoice list). |
| Auto-link follow-up to job | Low-Med | ~2-line fix in persistGeneratedFollowup. |
| Sweep orphan i18n keys | Low | toast.invoicePlaceholder (INV-A) and invoice.viewTitleHtml (orphaned by INV-B's plural topbar). |
| Retire dev bypass | Low | localhost-gated; parked. |
| Custom Supabase email templates | Med | Polish. |
| Capacitor wrap | Med | Sprint 4+. |
| Team plan ($99) seats | TBD | Priced but no multi-seat logic. |

## Key Decisions Made

### Payments architecture (PAY epic)
- **Stripe Connect, STANDARD accounts** (not Express/Custom): least liability + least support burden for a solo operator — the contractor owns their Stripe dashboard, payouts, disputes, refunds, compliance; no per-account platform fees. (Stripe's Dec-2025 "Accounts v2" exists; chose the well-documented v1 Standard path to ship.)
- **DIRECT charges on the connected account** (not destination/transfers): the contractor is merchant of record and the money never touches the platform balance → avoids money-transmitter status. Platform revenue is purely the `application_fee_amount`.
- **Stripe-HOSTED Checkout** (no public payment page to build/secure). The emailed link is a stable link to our own /api/pay/[token] redirect endpoint, which mints a *fresh* Checkout Session on each click — this sidesteps Checkout Session 24h expiry so invoices can be paid days later.
- **Fee = 1% capped at $25/invoice.** Low + capped because Stripe's ~3% already stacks on the contractor, and because payments are a stickiness/value-add for the $49/mo subscription, not the profit center. The cap keeps big jobs fair (a $30k invoice costs the contractor $25, not $300). Fee is an env var (changeable without redeploy), cap defaults to $25 in code.
- **Security posture:** cached charges_enabled is UI-only; the public pay endpoint always re-checks the live account before creating a session. Endpoints never accept an account/invoice id from the client without verifying ownership (or, for the public pay route, an unguessable token). Connect status + pay tokens are written server-side via the service role.

### Earlier (carried forward)
- Single JSON payload on quotes/followups/invoices + denormalized list columns. client_id captured at form-fill. Three-mode UI patterns. Jobs first-class, optional, on-demand. Archive is timestamp-based (orthogonal to status). Invoice conversion idempotent; tax snapshot baked; OVERDUE derived not stored; payment panel excluded from PDF. INV-B kept as a standalone Invoices surface (nav item shipped hidden in INV-A, revealed in INV-B).

## Active Testers
- [Tester 1 name] — confirmed $49/month ✓
- [Tester 2 name] — actively testing

## Open Issues / Known Quirks
- **PAY-B is on `main` (Production) but NOT launched.** Money can't actually move yet: the only connected account is a sandbox/test acct the live key can't use, so the live gate fails closed. Do NOT point real testers at payments until go-live steps are done. (Decision was to leave it on main rather than revert.)
- **No webhook yet (PAY-C):** after a successful online payment the invoice still shows "unpaid" in-app; mark-paid is manual until PAY-C.
- **Test data in prod profiles:** sandbox PAY-A onboarding wrote a TEST stripe_account_id + charges_enabled=true to the real profiles row (single Supabase project). On the live site the Get-paid card may show "Connected," but any live pay attempt correctly refuses. Going live = re-onboard on the live key (overwrites it).
- Single-invoice doc view shows "Invoices" (plural) in the topbar (VIEW_TOPBAR is view-keyed). Cosmetic.
- Orphan i18n keys: toast.invoicePlaceholder, invoice.viewTitleHtml.
- Browser autofill can drop a real card into Stripe test checkout (real cards decline in test mode) — type 4242 4242 4242 4242 by hand when testing.
- New follow-ups don't auto-link to job_id. Datalist UX on iOS needs 1 char. Address auto-fill overwrites on client pick. quotesHistoryCount dead ref (guarded). SEMA Zscaler intercepts link previews. Quote gen ~30–60s on Sonnet.

## Architectural Path Forward
- ✅ 1x–2x foundation, quotes, full CRM (clients/jobs/quotes/follow-ups)
- ✅ Auth expansion (password), Stripe subscriptions (Sprint 3), Profile/branding
- ✅ Archive + bulk + delete + confirmModal
- ✅ INV-A: convert-to-invoice + doc + payment tracking + PDF/email/text
- ✅ INV-B: Invoices list view + revealed nav
- ✅ PAY-A: Stripe Connect onboarding (Standard) — proven in test mode
- ✅ PAY-B: hosted-Checkout payment collection (direct charges + 1%/$25 fee) — proven in test mode, on main, not launched
- ⏳ PAY-C (next): webhook → mark invoice paid (amount_paid/status/paid_at/payment_intent id) + reconcile
- ⏳ Payments go-live: Connect on live key, Production fee var, re-onboard
- ⏳ Real Payments dashboard (replace MOCK_PAYMENTS); decide INV-B/Payments merge
- ⏳ Polish: orphan-key sweep, follow-up→job auto-link, email templates
- ⏳ Sprint 1F (parked): retire dev bypass
- ⏳ Sprint 4+: Capacitor

## Code Conventions / Notes

### Globals
sb; pricingMode/taxMode/tdLang/quoteLanguages; selectedTrades/activeTradeIndex/tradePricingState; currentQuote/currentFollowup/currentInvoice; currentQuote.tradePricingTargets; currentQuote.job_id/.status; profileCache (incl. stripe_account_id, stripe_charges_enabled, etc.); profileWarrantyDraft {en,es}; depositPercent; upgradeInterval; savedInvoicesCache; invoiceReturnTo ('list'|'quote'); BULK config; viewingArchived* flags.

### Sub-view state
quotesSubView/clientsSubView/followupsSubView/jobsSubView; invoicesSubView ('list'|'doc'); per-entity caches + save timers; isCreatingNew* flags; selectedClientIdFor*; activeClientId/activeJobId + data.

### Helpers (added in INV-B / PAY-A / PAY-B)
- Invoices list: loadInvoices, renderInvoicesList, switchInvoicesSubView (toggles back-btn + loads on list), enterInvoiceView(invoice, returnTo), openInvoice.
- Connect: startConnectOnboarding, refreshConnectStatus, renderConnectCard, handleConnectReturn (?connect=return|refresh).
- Pay: ensureInvoicePayLink, renderInvoicePayBlock (pre-fills link on reload if pay_token exists), invoicePayLineForSend (returns '' when not eligible); send funcs append the pay line.
- (Plus all prior quote/followup/client/job/invoice/archive/bulk/profile/billing helpers.)

### Backend endpoints (/api)
generate; create-checkout; create-portal; subscription webhook; **connect/create-account-link**; **connect/account-status**; **invoice/create-pay-link**; **pay/[token]** (public, dynamic); **pay-result** (public). All Connect/pay endpoints: Node/ESM, JWT-verify pattern from create-checkout, service-role Supabase client, stripe apiVersion '2024-06-20'.

### Tables (current)
- clients / quotes / jobs / followups — as before, all with archived_at; standard 4-policy RLS; FKs ON DELETE SET NULL.
- invoices — invoice_number, issue_date, due_date, status('unpaid','partial','paid'), amount_paid, subtotal, tax, total, client_name, client_addr, trades, quote_id, payload, **pay_token (unique, indexed)**, **stripe_checkout_session_id**, **stripe_payment_intent_id (unused until PAY-C)**, **paid_at (unused until PAY-C)**. create_invoice_from_quote RPC (SECURITY DEFINER, idempotent). No archived_at yet.
- profiles — quota RPCs + plan + personal/business fields + logo_url + brand_color + deposit/warranty defaults + Stripe subscription fields + **stripe_account_id, stripe_charges_enabled, stripe_details_submitted, stripe_payouts_enabled, stripe_connect_updated_at**. Read/written directly by the app (own-row RLS) and by server endpoints (service role).
- Storage 'logos' bucket.

### Gotchas
- PDF: generateQuotePdfBlob/generateInvoicePdfBlob single source each; html2canvas {scale:2,useCORS:true,logging:false,backgroundColor:'#FFFFFF'}; do NOT add windowWidth/x/y/scroll*. Invoice pay/payment controls live OUTSIDE #invoiceDoc.
- Line-item filter lives in renderQuote (preserves user-added $0 rows).
- Vercel env changes apply only to NEW builds — redeploy after editing env vars.
- switchView('invoices') defaults to the list; enterInvoiceView overrides to 'doc' after.
- Claude Code on Windows host has awk (Git Bash) but no node binary.

## Workflow Preferences
- Small incremental sprints. Prompts in fenced blocks for Claude Code in VS Code. 4-section format (Manual setup → Changes → Self-tests → Test plan). "X/X passed" before deploy. Explicit negative constraints. **Push to a branch → Vercel Preview → verify → merge to main** (PAY-B deviated: it went straight to main, tested via a pay-b-preview branch). Migrations as a separate SQL block BEFORE code. Multi-phase manual procedures one step at a time. Windows host c:\ST\GitHub\TradeDeck\TradeDeck\index.html.

## Open Questions for Next Session
- PAY-C scope: which event(s) (checkout.session.completed vs payment_intent.succeeded), Connect webhook endpoint + secret, partial-payment reconciliation (online pay charges the balance due → amount_paid += amount, recompute status), idempotency on replays.
- Payments go-live checklist: Connect on live, Production fee var, re-onboard, then announce to testers.
- Real Payments dashboard: merge with the Invoices list, or keep separate?
- Confirm PLATFORM_FEE_PERCENT is set on Production.
- Sweep the two orphan keys + the plural-topbar cosmetic in one polish pass.