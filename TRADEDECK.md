# MyTradeDeck — Project Status

<<<<<<< Updated upstream
Last updated: May 26, 2026 (post Sprint INV-A)
=======
Last updated: May 26, 2026 (post Sprint PAY-C)
>>>>>>> Stashed changes

Save this. Paste into any future Claude conversation to continue.

> Reconstructed from the current `index.html` on May 26 after the doc had drifted ~1 week behind the code. Sprint labels/dates for recently shipped work (archive, Stripe, password auth, invoices) were inferred from the code — sanity-check the exact labels and fill in the tester names.

---

## What This Is

MyTradeDeck is an AI-powered admin tool for contractors and tradespeople. Drafts professional bilingual (English + Spanish) quotes and customer follow-up messages in seconds, with a working CRM layer where jobs are the central work-tracking entity — clients, quotes, follow-ups, and now invoices can hang off a job, or hang directly off a client without a job.

- Pricing plan: Free (5 quotes/month, server-enforced) · Pro $49/month · Team $99/month
<<<<<<< Updated upstream
- Target: $10,000–$15,000/month from a small base of paying contractors, or more if possible
- Stage: Live at https://mytradedeck.com. Server-enforced quota, custom-domain email auth (password + magic link), full flat-rate / per-unit pricing flexibility, persisted quotes + follow-ups + clients + first-class jobs + invoices, archive system across all entities, Stripe checkout + billing portal, full profile/branding screen. 1 confirmed paying tester ($49/mo), 1 actively testing.
=======
- Online payments fee: contractor's client pays the invoice; the contractor's Stripe nets it minus Stripe's processing fee + a **1% MyTradeDeck platform fee capped at $25/invoice**.
- Target: $10,000–$15,000/month, primarily from $49/mo subscriptions; payment fees are a secondary, stickiness-driven stream.
- Stage: Live at https://mytradedeck.com. Quotes, full CRM (clients/jobs/quotes/follow-ups/invoices), archive + bulk across entities, Stripe subscriptions, password auth, profile/branding, invoice list view, and **Stripe Connect payment collection with the full pay → webhook → auto-mark-paid loop wired up in test mode (built, on a preview branch, not yet launched to real users)**.
>>>>>>> Stashed changes
- Goal type: Side project that generates a lot of income, not full-time business.
- Long-term: Wrap in Capacitor for App Store + Google Play distribution.

## Tech Stack (Current)

<<<<<<< Updated upstream
- Frontend: Single index.html file — vanilla JS, no framework, no build step
- AI: Anthropic API via server-side Edge function proxy at /api/generate.js. Model claude-sonnet-4-6. SSE streaming preserved.
- API key: ANTHROPIC_API_KEY env var in Vercel — never in the browser
- Auth: Supabase email auth — password-primary (sign up / sign in / forgot / recovery) with magic-link fallback. Session persisted in localStorage. Dev bypass button (localhost only, hidden + inert in production).
- Email delivery: Resend SMTP via verified subdomain mail.mytradedeck.com. 30/hr rate limit.
- Quota enforcement: Postgres profiles table + RLS + SECURITY DEFINER RPCs (get_quote_status, consume_quote_credit). Free tier 5/month cap atomic and server-enforced. Pro = unlimited (gated by profiles.plan).
- Billing: Stripe Checkout (monthly $49 / annual $490) + billing portal, via /api/create-checkout and /api/create-portal. Webhook updates profiles.plan. Post-redirect handled by handleCheckoutReturn (?checkout=success|cancel, ?portal=return).
- Persistence: clients, quotes, jobs, followups, invoices tables in Postgres. Standard RLS pattern (4 policies per table scoped to auth.uid()). Cross-entity FKs all use ON DELETE SET NULL.
- File storage: Supabase Storage 'logos' bucket — per-user company logo at {user_id}/logo, public URL stored on profiles.logo_url.
- Supabase project: https://cqmctdhxticryelvhhze.supabase.co
- Publishable key: sb_publishable_YOWddbCqAPdFrg-9otLSzw_akBdoAPh (RLS gates data)
- Domain: mytradedeck.com at GoDaddy, A record 216.198.79.1 + CNAME www. Subdomain mail.mytradedeck.com for Resend.
- PDF generation: html2pdf.js (cdnjs)
- Hosting: Vercel (auto-deploys from GitHub main)
- Live URLs: https://mytradedeck.com (primary), https://www.mytradedeck.com (307 → apex), https://trade-deck-ten.vercel.app (fallback)
- API safety: $20/month Anthropic Console cap
=======
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
- **STRIPE_CONNECT_WEBHOOK_SECRET (NEW — PAY-C)** — the signing secret for the *Connect* webhook endpoint (connected-account events), separate from STRIPE_WEBHOOK_SECRET (which is the subscription/platform webhook). Currently set on **Preview** for testing; **must be set on Production with the live Connect endpoint's secret before go-live.**
- Note: pay/connect endpoints derive their return/base URL from the request origin (APP_URL fallback), so Preview-initiated flows return to Preview.
>>>>>>> Stashed changes

## Data Model (Current)

clients (top-level: people and companies)
  - jobs (optional work container; created on demand, not auto)
      - quotes (a job can have multiple quotes — re-quotes, change orders)
      - followups (messages about the work)
      - invoices (billed work, created from a quote)
  - quotes (can stand alone, no job needed — speculative quotes)
  - followups (can stand alone — relationship messages, no job needed)
  - invoices (created from a quote via RPC; carries quote_id)

- A quote is a proposal. Can be standalone (tied to client only) OR linked to a job via quote.job_id.
- A job is a container for tracked work. Optional. User explicitly promotes a quote to a job via "Create job" on the quote view (explicit-Save flow), or creates one manually via the "+ New Job" launchers.
- A follow-up can be tied to a client, a quote, a job, or any combination.
- An invoice is created from a quote via the create_invoice_from_quote RPC (idempotent). Carries quote_id; flips the source quote's status to 'invoiced'. Payment tracking lives on the invoice row.
- Jobs are NOT auto-created when a quote is generated.

## What's Built (Functional)

### Backend foundation (Sprints 1A–1E)
- Server-side Anthropic proxy (api/generate.js)
- Supabase auth gate (app hidden until session)
- Server-enforced quota via profiles table + RPCs (get_quote_status, consume_quote_credit). Quotes and follow-ups share the 5/month counter.
- Custom SMTP via Resend with mail.mytradedeck.com
- Rebrand to MyTradeDeck (Sprint 1D-0)
- Custom domain at mytradedeck.com (Sprint 1E) via DNS records at GoDaddy
- Open Graph + Twitter meta tags (Sprint 1G)

### Auth (expanded beyond magic-link)
- Email + password: sign up (with confirm + email-verify), sign in, forgot password, password recovery flow (PASSWORD_RECOVERY → set new password → USER_UPDATED).
- Magic-link fallback ("Email me a link instead").
- Auth tabs (Sign in / Sign up), status messaging, full EN/ES.
- Sign out in sidebar Account section.
- Dev bypass button — localhost only, hidden + inert in production.

### Quote generator
- 10 trades with emojis
- Multi-trade quotes with per-trade input state via tradePricingState
- 7 pricing modes with auto-switching panels
- Pricing inputs default to 0; optional $0 components don't appear; defensive zero-filter on AI output (Sprint 1.5-A)
- Phase-based line items: 3–5 per trade reflecting phases, not 1:1 pricing components (Sprint 1.5-A.1)
- Flat-rate sub-mode per specialty panel with trade-specific unit dropdowns + "Custom..." (Sprint 1.5-B)
- Self-balancing flat-rate math: tradePricingTargets captures target; edits/deletes/adds proportionally redistribute; clamp at $0; overflow toast EN/ES (Sprint 1.5-C)
- Trade-specific placeholders, tax, timeline, configurable deposit %
- Inline editable everything; live recalculation
- Trade-aware AI prompts via TRADE_GUIDANCE
- Contractor identity pulled onto the rendered quote from the profile (company name, address, license, logo, brand-color accent bar) via applyProfileToQuoteHeader

### Quotes persistence + list view (Sprints 2-A, 2-B, 2-C)
- quotes table: denormalized columns (client_name, client_addr, total, trades, status) + full payload jsonb. job_id FK (nullable, ON DELETE SET NULL).
- Auto-persist on generation via persistGeneratedQuote() (captured client_id first, then .ilike find-or-create fallback). Does NOT auto-create a job.
- Three-mode navigation (list | compose | view) with header bar
- My Quotes list — search by client name, click row to open, inline edits autosave (1.5s debounce), row delete with confirm, inline status dropdown
- Form auto-clears on + New Quote (silent)
- Full EN/ES translation of list + status pills
- "Create job from this quote" button — explicit-Save flow (opens job detail in new mode pre-filled; Save commits INSERT + quote.job_id link). Hidden when quote already has a job_id.
- "Convert to invoice" button — see Invoices below.

<<<<<<< Updated upstream
### Clients view + detail + manual creation (Sprints 2-D.1 → 2-D.7.1)
- clients table with type (person/company), contact_name, contact_title, notes, status, contact info, addr, timestamps.
- Auto-create from quotes (status='lead', type='person'); .ilike dedupe.
- Real Clients list — person/company icon, smart contact column, real job count, real revenue (paid+complete jobs), last-activity. Search by name/contact/email/phone. Inline status dropdown.
- Client detail screen — editable form, person/company segmented toggle, conditional contact fields, status, notes. Debounce autosave + explicit Save. Related quotes + jobs + follow-ups cards (click row → opens source).
- Client autocomplete via <datalist> (shared by quote + follow-up forms; auto-fills address on quote form).
- Launcher buttons (+ New Quote / Follow-up / Job for this client) — all functional.
- Manual "+ New Client" via detail screen "new mode" (isCreatingNewClient).
- Explicit Save button; autosave as silent safety net.

### Follow-ups persistence + list + client tie (Sprint 2-D.4)
- followups table: client_id, quote_id, job_id FKs, denormalized customer_name, channel, scenario, payload jsonb.
- Auto-persist on generation via persistGeneratedFollowup(). (Does NOT yet auto-link to a job even when the quote has one — deferred polish.)
- Three-mode navigation; My Follow-ups list with search, click, autosave, row delete, archive.
- Full EN/ES translation.

### Jobs as first-class entities (Sprints 2-E.1 → 2-E.4)
- jobs table: client_id, quote_id FKs, description, trade, amount, status, notes, timestamps.
- Real Jobs list — four live stat cards (Open quotes, In progress, Awaiting payment, Completed this month). Five filter tabs (client-side). Two empty states.
- Job detail screen (list | detail) — editable form (description, trade, amount, status, notes), debounce autosave + explicit Save. Related cards: linked client, quotes (by job_id), follow-ups (by job_id). Cross-view nav flushes pending autosave.
- Jobs are explicitly created — never auto-created on quote generation.
- "Create job from this quote" uses explicit-Save flow (detail opens in new mode pre-filled; Save commits INSERT + quote.job_id link). Button hidden when quote has a job_id.
- Manual "+ New Job" launchers (Jobs header button + client-detail launcher) functional via enterNewJobMode.
- Click job row → job detail.

### Invoices (Sprint INV-A)
- invoices table: invoice_number (sequential per user), issue_date, due_date, status check('unpaid','partial','paid') default 'unpaid', amount_paid, subtotal, tax, total, payload jsonb, client_name, client_addr, trades, quote_id FK, user_id, timestamps.
- create_invoice_from_quote RPC — SECURITY DEFINER, idempotent (re-converting the same quote returns the same invoice), mints sequential invoice_number, copies quote content, flips quote.status → 'invoiced'.
- convertToInvoice() — converts (or, if already invoiced, opens the existing invoice). Bakes a tax snapshot (_invoiceTaxLabel + subtotal/tax/total) onto a freshly created invoice so it renders self-contained.
- Invoice document view — reuses profile identity/logo/brand color; Bill-to block; line items grouped by trade; totals with Amount paid + Balance due; Issue/Due dates; status pill.
- Payment tracking panel (deliberately OUTSIDE #invoiceDoc so it's excluded from the PDF): status select (Unpaid / Partial / Paid), amount-paid field (revealed on partial, clamped to [0, total]), due-date picker. Auto status logic. Persists to DB.
- Derived "overdue" — invoiceEffectiveStatus renders OVERDUE (red) when past due_date and unpaid; stored status stays unpaid.
- PDF / Email / Text send (generateInvoicePdfBlob, buildInvoicePdfFilename "INV-####-Client.pdf", downloadInvoicePdf, sendInvoiceEmail, sendInvoiceText) mirroring the quote machinery (Web Share → download + mailto/sms fallback).
- Quote "Convert to invoice" button relabels to "View invoice" once invoiced (refreshQuoteConvertInvoiceButton). openSavedQuote copies data.status so a reopened invoiced quote reads correctly.
- Invoices nav item added but kept HIDDEN; invoicesView has a list sub (placeholder for INV-B) + doc sub.
- Bilingual (26 invoice i18n keys × EN/ES).

### Archive system (all four entities)
- archived_at TIMESTAMP NULL on clients, quotes, jobs, followups. Default queries filter archived_at IS NULL.
- Active / Archived segmented tabs on all four list views.
- Archive / Unarchive buttons on detail screens + quote/follow-up action bars.
- setArchivedState helper; per-entity archive/unarchive functions; toggleArchiveCurrentQuote/Followup; refreshQuote/FollowupArchiveButton.

### Bulk selection (all four lists)
- Generic system driven by the BULK config object (one entry per entity). Row checkboxes + select-all header checkbox + bulk action bar (count, Archive/Unarchive, Delete). refreshBulkBar, refreshSelectAll, reapplyBulkSelection, clearBulkSelection, bulkArchive, bulkUnarchive, bulkDelete.

### Delete + status + confirm modal
- Row + detail delete buttons everywhere (deleteSavedQuote/Followup/Client/Job), all gated by confirmModal.
- Inline status <select> dropdowns on lists (statusSelectHtml + persistEntityStatus + per-surface update fns). (Implemented as dropdowns, not the originally-planned pill cycling.)
- confirmModal — generic promise-based modal with focus trap + ESC/Enter/Tab handling. Used for all destructive actions + clear-form.

### Profile + branding (full screen)
- Identity card (avatar, email, plan badge). Personal info (first/last name, phone). Business (company name, address, license number, logo upload to Storage, custom brand color). Workflow defaults (default deposit %, default warranty per-language EN/ES). Plan & Usage (reads get_quote_status; Pro = unlimited). Activity stats (clients/jobs/quotes/followups counts). Account (email, member since).
- loadProfileData, loadProfileCache, saveProfileHandler, handleLogoUpload, handleLogoRemove, renderProfileLogoPreview, bindProfileBrandControls, renderWarrantyBox, captureWarrantyDraft.
- Profile feeds new-quote deposit pre-fill + contractor identity on rendered quotes + invoices.

### Stripe billing (Sprint 3)
- Upgrade modal (monthly/annual toggle, price display). startCheckout → /api/create-checkout. openBillingPortal → /api/create-portal. handleCheckoutReturn for redirect params. Pro detection from profiles.plan. Manage-subscription button on profile when Pro.

### Bilingual EN / ES support
- UI language toggle (full I18N dictionary, data-i18n attributes)
- Quote output language toggle (English / Spanish / Both)
- AI generates bilingual {en, es} slot pairs; per-language blur capture
- Quote/invoice document labels lock to content language
- Banner when UI lang doesn't have content
- Spanish vocab tuned for US/Mexican contractor usage

### PDF export
- generateQuotePdfBlob() / generateInvoicePdfBlob() — single source each, html2canvas opts deliberately minimal
- CSS page-break-inside: avoid; filenames built from ID + client name

### Streaming responses
- SSE via /api/generate; streamCompletion() parses content_block_delta; progress bar capped at 90% until completion

### Mobile navigation
- Hamburger menu, slide-in drawer, backdrop tap / ESC close, body scroll lock, ARIA, iOS auto-zoom prevented

### CRM mockups (REMAINING — Payments only)
- Clients: real (2-D.2) ✅ · Jobs: real (2-E.1/2) ✅ · Invoices: real (INV-A) ✅
- Payments: STILL MOCK — MOCK_PAYMENTS (12 fake invoices) + MOCK_PAYMENT_WEEKS (8 weeks fake cash). "Preview" badge remains on Payments nav only.
=======
### Payments collection — PAY-A + PAY-B + PAY-C (built, exercised in TEST mode)
- **PAY-A — Connect onboarding (Standard).** Profile "Get paid" card with 3 states (not-connected / incomplete / connected-green). Endpoints: /api/connect/create-account-link (creates a Standard account if none, returns hosted onboarding link; origin derived from request) and /api/connect/account-status (retrieves account, persists charges/details/payouts booleans). Status booleans are a UI cache only — the authoritative gate re-checks live. Proven end-to-end in the sandbox (onboard → return → green "Connected").
- **PAY-B — collect payments (hosted Checkout, direct charges).** Contractor clicks "Create payment link" on an invoice (gated on cached charges_enabled) → /api/invoice/create-pay-link (authed; mints a random pay_token, returns origin-based payUrl). The emailed/texted link points to /api/pay/[token] (PUBLIC) which: looks up the invoice by token (service role), does a LIVE accounts.retrieve charges_enabled check, computes balance due, creates a Checkout Session ON THE CONNECTED ACCOUNT ({ stripeAccount }) with application_fee_amount (1% capped $25) + metadata.invoice_id on session + payment_intent, and 302-redirects to Stripe. /api/pay-result is a minimal public thank-you/canceled page. Send functions append "Pay online: {payUrl}" only when connected + unpaid.
  - **Proven in test mode:** $87,500 test invoice → charge landed on the connected account, application fee = $25 (cap correctly clamped 1%=$875 down to $25), Stripe ~$2,537.80, contractor netted $84,937.20.
- **PAY-C — webhook → auto-mark-paid.** New PUBLIC endpoint /api/webhooks/stripe-connect.js — a SECOND, Connect-type webhook distinct from the subscription webhook (direct-charge events fire on the *connected* account, so they need their own endpoint + STRIPE_CONNECT_WEBHOOK_SECRET). Hardened: (1) verifies the signature against the RAW request body (buffer + bodyParser:false) using the Connect secret, 400 only on signature failure; (2) loads the invoice owner's profile and confirms profile.stripe_account_id === event.account before any write (mismatch → log + 200 no-op); (3) idempotent on payment_intent (already-recorded PI → 200 no-op). On checkout.session.completed it reconciles in cents (status 'paid' when paid ≥ total, else 'partial'; stamps paid_at when fully paid; persists payment_intent + checkout_session ids). Front-end shows "Paid on {date}" (i18n pay.paidOn) once paid_at is present — no manual marking. Built + committed to the pay-b-preview branch (b383741), Connect webhook endpoint created in the sandbox, STRIPE_CONNECT_WEBHOOK_SECRET set on Preview, branch redeployed. **Known limitation (deferred):** idempotency keys on the LAST stored PI only — fine for the full-payment case, but multiple online PARTIAL payments + a late retry of an earlier event could double-count; revisit if/when multiple online partials are enabled.

### Payments dashboard view — STILL MOCK
MOCK_PAYMENTS / MOCK_PAYMENT_WEEKS. "Preview" badge still on the Payments nav. This is the last mock surface; the real data source (invoices + paid_at, now populated by the PAY-C webhook) is in place — this is the next real build.
>>>>>>> Stashed changes

## What's NOT Built (Roadmap)

| Feature | Priority | Notes |
|---|---|---|
<<<<<<< Updated upstream
| Invoices LIST view + reveal nav (INV-B) | High (next) | Build #invoicesListSub (currently a placeholder div) and un-hide #navInvoices. Today an invoice is only reachable from its originating quote. Heavy overlap with the Payments view — decide whether to merge. |
| Real Payments view | High (next) | Replace MOCK_PAYMENTS / MOCK_PAYMENT_WEEKS with real invoices data. Stat cards map to Σtotal / Σamount_paid / Σ(total−amount_paid). NOTE: "Avg days to pay" needs a paid_at timestamp the invoices table doesn't have yet — add it (set on flip to paid) or drop the stat. |
| Auto-link follow-up to job when quote has one | Low-Medium | Polish — derive followup.job_id from quote.job_id at insert in persistGeneratedFollowup (~2 lines). |
| Retire dev bypass button | Low | Sprint 1F — drafted/parked. Currently localhost-gated, so inert in prod. Samuel keeping for now. |
| Custom-branded Supabase email templates | Medium | Polish item. |
| Capacitor wrap (iOS + Android) | Medium | Sprint 4+ — reader-app pattern. |
| Switch to Haiku option | Low | Faster/cheaper alternative model. |
| Team plan ($99) features / seats | TBD | Plan tier named in pricing but no multi-seat logic yet. |
=======
| Go-live for payments | **High (next)** | Production currently has the PAY-A/PAY-B code but: merge pay-b-preview (PAY-C) cleanly to main; set PLATFORM_FEE_PERCENT on Production; enable Connect + branding + capabilities on LIVE (not just sandbox); create the LIVE Connect webhook endpoint + set STRIPE_CONNECT_WEBHOOK_SECRET on Production; re-onboard on the live key (sandbox acct_… don't carry to live). |
| Real Payments dashboard | Med-High | Replace MOCK_PAYMENTS with real invoice data (Σtotal / Σamount_paid / Σbalance). "Avg days to pay" now computable once paid_at is populated by PAY-C. Decide INV-B-vs-Payments merge (lean: Payments becomes the rollup over the same invoice list). |
| Auto-link follow-up to job | Low-Med | ~2-line fix in persistGeneratedFollowup. |
| Sweep orphan i18n keys | Low | toast.invoicePlaceholder (INV-A) and invoice.viewTitleHtml (orphaned by INV-B's plural topbar). |
| Retire dev bypass | Low | localhost-gated; parked. |
| Custom Supabase email templates | Med | Polish. |
| Capacitor wrap | Med | Sprint 4+. |
| Team plan ($99) seats | TBD | Priced but no multi-seat logic. |
>>>>>>> Stashed changes

## Key Decisions Made

### Sprint 2 foundations
- Single JSON payload column on quotes/followups/invoices over normalized tables — faster to ship, bilingual content survives schema changes, edits queryable via denormalized columns.
- Denormalized columns for list views — fast rendering without JOINs, survives client deletion (FKs set null).
- client_id captured at form-fill time, not save time (selectedClientIdForQuote/Followup), with .ilike fallback for free-text names.
- Three-mode UI pattern (list | compose | view) for Quotes/Follow-ups; (list | detail) for Clients/Jobs; (list | doc) for Invoices. Consistent view-header bar.
- Form auto-clear on "+ New X".
- Person/Company toggle swaps visible fields; launchers render companies as "Company (Attn: Person)".
- Manual + New X reuses the detail screen via an isCreatingNew* flag (UPDATE↔INSERT).
- Explicit Save + autosave coexist.

### Jobs as first-class
- Jobs are the central work-tracking entity, optional, created on demand. A quote can exist without a job; a job can have many quotes + follow-ups + invoices.
- All cross-entity FKs ON DELETE SET NULL (deletes never orphan dependents).
- "Create job from this quote" uses explicit-Save (no auto-commit). Hide-not-relabel for the button when a job_id exists.
- Job amount stored independently (agreed price ≠ draft quote price).

### Invoices (INV-A)
- Conversion is a SECURITY DEFINER RPC, idempotent — re-convert returns the same invoice, never a duplicate. RPC flips quote.status → 'invoiced'.
- Tax snapshot baked onto the freshly created invoice (subtotal/tax/total + _invoiceTaxLabel in payload) so the invoice renders self-contained, independent of the quote form's later state.
- "Overdue" is DERIVED at render (invoiceEffectiveStatus), never stored — keeps stored status orthogonal, like archive.
- Payment panel kept OUTSIDE #invoiceDoc so it never lands in the PDF.
- INV-B (list view) deliberately deferred; nav item shipped hidden.

### Archive
- Timestamp-based (archived_at), orthogonal to business status — a "paid" job can also be "archived" with no enum conflict.

## Active Testers

- [Tester 1 name] — confirmed $49/month commitment ✓
- [Tester 2 name] — actively testing flat-rate flow

## Open Issues / Known Quirks
<<<<<<< Updated upstream

- INV-B not built — an invoice is only reachable from its source quote; no standalone Invoices list, nav item hidden.
- invoices table has no paid_at — "Avg days to pay" on a real Payments view can't be computed until it's added (set when status flips to paid).
- toast.invoicePlaceholder is now an orphaned i18n key (the stub it served was replaced in INV-A). Harmless; can be swept.
- New follow-ups don't auto-link to job_id even when the quote has one. ~2-line fix in persistGeneratedFollowup.
- Dev bypass button still present on login (localhost-gated). Sprint 1F retire still parked.
- Supabase email templates still default, not custom-branded.
- Scenario column in followups stores English string; Spanish UI shows it verbatim in list. Polish.
- Datalist UX on iOS Safari requires typing 1+ char. Could swap for custom dropdown.
- Address auto-fill on client pick replaces unconditionally if matched client has addr (can overwrite custom job-site addresses).
- quotesHistoryCount dead reference in loadSavedQuotes (harmless behind a guard). Cleanup candidate.
- Corporate networks (SEMA Zscaler) intercept link previews on mytradedeck.com — not fixable our side.
- Quote generation ~30–60s on Sonnet 4.6.

## Architectural Path Forward

- ✅ Sprints 1A → 1.5-C: backend, auth, quota, rebrand, custom domain, pricing flexibility, self-balancing flat-rate math
- ✅ Sprint 1G: Open Graph + Twitter meta tags
- ✅ Sprint 2-A → 2-C: quotes schema, auto-persist, My Quotes list, three-mode nav, full EN/ES
- ✅ Sprint 2-D.1 → 2-D.7.1: clients schema, list, detail, follow-ups table + list, autocomplete, auto-clear, launchers, manual New Client, explicit Save
- ✅ Sprint 2-E.1 → 2-E.2: real Jobs list, job detail, first-class jobs schema, stop auto-creating jobs, create-job-from-quote
- ✅ Sprint 2-E.3: delete buttons (jobs + clients, list + detail) + explicit-Save fix for create-job-from-quote
- ✅ Sprint 2-E.4: manual "+ New Job" launchers
- ✅ Sprint 2-E.5: inline status editing on lists (shipped as dropdowns rather than pill cycling)
- ✅ Sprint 2-F: archive system across clients/quotes/jobs/follow-ups + bulk selection
- ✅ Sprint 3: Stripe Checkout + billing portal + webhook (profiles.plan)
- ✅ Auth expansion: email+password (sign up/in/forgot/recovery) + magic-link fallback
- ✅ Profile + branding screen (logo upload, brand color, warranty/deposit defaults)
- ✅ Sprint INV-A: convert-to-invoice + invoice document + payment tracking + PDF/email/text (LIST view deferred to INV-B)
- ⏳ Sprint INV-B (next): Invoices LIST view + reveal #navInvoices — decide merge vs. keep-separate with the Payments view
- ⏳ Real Payments view (next): replace MOCK_PAYMENTS with real invoice data; add paid_at if keeping "avg days to pay"
- ⏳ Polish: auto-link follow-up→job; sweep orphaned i18n key; custom email templates
=======
- **PAY-B is on `main` (Production); PAY-C is on the `pay-b-preview` branch only — neither is launched.** Money can't actually move yet: the only connected account is a sandbox/test acct the live key can't use, so the live gate fails closed. Do NOT point real testers at payments until go-live steps are done. Go-live includes a clean merge of pay-b-preview (PAY-C) → main.
- **Webhook idempotency edge (PAY-C):** mark-paid keys on the last stored payment_intent — solid for full payments, but multiple online partial payments + a replayed earlier event could double-count. Deferred until multiple online partials are actually enabled.
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
- ✅ PAY-C: Connect webhook → auto-mark invoice paid (status/paid_at/payment_intent + reconcile) — built, wired in test mode, on the pay-b-preview branch
- ⏳ Payments go-live (next): merge PAY-C to main, Connect on live key, Production fee var, live Connect webhook + secret, re-onboard
- ⏳ Real Payments dashboard (replace MOCK_PAYMENTS); decide INV-B/Payments merge
- ⏳ Polish: orphan-key sweep, follow-up→job auto-link, email templates
>>>>>>> Stashed changes
- ⏳ Sprint 1F (parked): retire dev bypass
- ⏳ Sprint 4+: Capacitor wrap

## Code Conventions / Notes

### Globals
- sb = window.supabase.createClient(...)
- pricingMode, taxMode, tdLang, quoteLanguages
- selectedTrades, activeTradeIndex, tradePricingState — multi-trade state
- currentQuote / currentFollowup / currentInvoice — in-memory payloads
- currentQuote.tradePricingTargets — per-trade flat-rate target map
- currentQuote.job_id / currentQuote.status — captured on open from the DB row
- profileCache, profileWarrantyDraft {en, es}
- depositPercent, quoteUsed (bypass-only), upgradeInterval

### Sub-view state
- quotesSubView ('list'|'compose'|'view'), savedQuotesCache, quotesSaveTimer
- clientsSubView ('list'|'detail'), clientsCache, activeClientId, activeClientData, clientDetail*Cache, clientsSaveTimer, isCreatingNewClient
- clientsLookupCache, selectedClientIdForQuote/Followup/Job
- followupsSubView ('list'|'compose'|'view'), savedFollowupsCache, followupsSaveTimer
- jobsSubView ('list'|'detail'), jobsCache, jobsFilter, activeJobId, activeJobData, jobDetail*Cache, jobsSaveTimer, isCreatingNewJob
- invoicesSubView ('list'|'doc'), currentInvoice
- BULK — config object driving bulk selection for all four list entities
- viewingArchived{Clients,Jobs,Quotes,Followups}

<<<<<<< Updated upstream
### Helpers (current)
- Quotes: persistGeneratedQuote, loadSavedQuotes, renderQuotesList, openSavedQuote, deleteSavedQuote, scheduleQuoteSave, saveCurrentQuoteEdits, switchQuotesSubView, enterComposeMode
- Follow-ups: persistGeneratedFollowup, loadSavedFollowups, renderFollowupsList, openSavedFollowup, deleteSavedFollowup, scheduleFollowupSave, saveCurrentFollowupEdits, switchFollowupsSubView, enterFollowupComposeMode
- Clients: loadClients, renderClientsList, switchClientsSubView, openClientDetail, renderClientDetail, applyClientType, scheduleClientSave, saveClientEdits, clickClientDetailSave, enterNewClientMode, renderClientDetail{Quotes,Jobs,Followups}, jobStatusLabel
- Client lookup: refreshClientsLookupCache, renderClientsDatalist, findClientByName, bindClientLookupForQuote/Followup/Job
- Launchers: clientDisplayNameForForm, launchNewQuoteForActiveClient, launchNewFollowupForActiveClient, launchNewJobForActiveClient
- Jobs: loadJobs, renderJobsView, renderJobsStats, renderJobsList, bindJobsFilterPills, switchJobsSubView, openJobDetail, renderJobDetailTradeOptions, renderJobDetail, renderJobDetail{Client,Quotes,Followups}, scheduleJobSave, saveJobEdits, clickJobDetailSave, enterNewJobMode, refreshQuoteCreateJobButton, createJobFromCurrentQuote
- Invoices: convertToInvoice, openInvoiceForQuote, openInvoice, enterInvoiceView, switchInvoicesSubView, invoiceEffectiveStatus, invoiceStatusLabel, renderInvoiceLineItems, renderInvoice, bindInvoicePaymentControls, persistInvoiceFields, onInvoiceStatusChange, onInvoiceAmountPaidChange, onInvoiceDueDateChange, generateInvoicePdfBlob, buildInvoicePdfFilename, downloadInvoicePdf, sendInvoiceEmail, sendInvoiceText, refreshQuoteConvertInvoiceButton
- Status/archive/bulk: statusSelectHtml, persistEntityStatus, update*Status (per surface), setArchivedState, archive/unarchive{Client,Job,Quote,Followup}, toggleArchiveCurrent{Quote,Followup}, refresh{Quote,Followup}ArchiveButton, refreshBulkBar, refreshSelectAll, reapplyBulkSelection, clearBulkSelection, bulkArchive, bulkUnarchive, bulkDelete
- Profile/billing: loadProfileCache, loadProfileData, saveProfileHandler, handleLogoUpload, handleLogoRemove, renderProfileLogoPreview, bindProfileBrandControls, renderWarrantyBox, captureWarrantyDraft, applyProfileToQuoteHeader, openUpgradeModal, closeUpgradeModal, renderUpgradePrice, startCheckout, openBillingPortal, handleCheckoutReturn
- Auth: initAuth, updateAuthUI, setAuthMode, handleSignUp, handleSignInPassword, handleForgotPassword, handleMagicLink, handleRecovery, handleSignOut
- Generic: capitalizeFirst, escapeHtml, formatRelativeDate, fmt, parseAmount, confirmModal, showToast
- clearForm(silent) — silent param skips confirm popup

### Tables (current schemas)

clients — id, user_id (FK cascade), name, addr, email, phone, status check('lead','active','past') default 'lead', type check('person','company') default 'person', contact_name, contact_title, notes, archived_at, timestamps. RLS 4 policies.
=======
### Helpers (added in INV-B / PAY-A / PAY-B)
- Invoices list: loadInvoices, renderInvoicesList, switchInvoicesSubView (toggles back-btn + loads on list), enterInvoiceView(invoice, returnTo), openInvoice.
- Connect: startConnectOnboarding, refreshConnectStatus, renderConnectCard, handleConnectReturn (?connect=return|refresh).
- Pay: ensureInvoicePayLink, renderInvoicePayBlock (pre-fills link on reload if pay_token exists), invoicePayLineForSend (returns '' when not eligible); send funcs append the pay line. PAY-C adds a "Paid on {date}" display (i18n pay.paidOn) shown when paid_at is set.
- (Plus all prior quote/followup/client/job/invoice/archive/bulk/profile/billing helpers.)

### Backend endpoints (/api)
generate; create-checkout; create-portal; subscription webhook; **connect/create-account-link**; **connect/account-status**; **invoice/create-pay-link**; **pay/[token]** (public, dynamic); **pay-result** (public); **webhooks/stripe-connect** (public — PAY-C; raw-body sig verify against STRIPE_CONNECT_WEBHOOK_SECRET, account-match guard, PI idempotency). All Connect/pay endpoints: Node/ESM, JWT-verify pattern from create-checkout, service-role Supabase client, stripe apiVersion '2024-06-20'.

### Tables (current)
- clients / quotes / jobs / followups — as before, all with archived_at; standard 4-policy RLS; FKs ON DELETE SET NULL.
- invoices — invoice_number, issue_date, due_date, status('unpaid','partial','paid'), amount_paid, subtotal, tax, total, client_name, client_addr, trades, quote_id, payload, **pay_token (unique, indexed)**, **stripe_checkout_session_id**, **stripe_payment_intent_id (set by the PAY-C webhook)**, **paid_at (stamped by the PAY-C webhook on full payment)**. create_invoice_from_quote RPC (SECURITY DEFINER, idempotent). No archived_at yet.
- profiles — quota RPCs + plan + personal/business fields + logo_url + brand_color + deposit/warranty defaults + Stripe subscription fields + **stripe_account_id, stripe_charges_enabled, stripe_details_submitted, stripe_payouts_enabled, stripe_connect_updated_at**. Read/written directly by the app (own-row RLS) and by server endpoints (service role).
- Storage 'logos' bucket.
>>>>>>> Stashed changes

quotes — id, user_id (FK cascade), client_id (FK set null), job_id (FK set null), client_name, client_addr, total numeric(12,2), trades text[], status check('draft','sent','accepted','declined','invoiced') default 'draft', payload jsonb, archived_at, timestamps. RLS 4 policies.

jobs — id, user_id (FK cascade), client_id (FK set null), quote_id (FK set null), description, trade, amount numeric(12,2), status check('quoted','in_progress','complete','paid') default 'quoted', notes, archived_at, timestamps. RLS 4 policies.

followups — id, user_id (FK cascade), client_id (FK set null), quote_id (FK set null), job_id (FK set null), customer_name, channel check('email','text') default 'email', scenario, payload jsonb, archived_at, timestamps. RLS 4 policies. Shared set_updated_at trigger.

invoices — id, user_id (FK cascade), quote_id (FK set null), invoice_number (sequential per user), issue_date, due_date, status check('unpaid','partial','paid') default 'unpaid', amount_paid numeric(12,2) default 0, subtotal numeric(12,2), tax numeric(12,2), total numeric(12,2), client_name, client_addr, trades text[], payload jsonb, timestamps. RLS 4 policies. create_invoice_from_quote RPC (SECURITY DEFINER, idempotent). NO paid_at yet (needed for "avg days to pay"). NO archived_at yet (archive not extended to invoices).

profiles — RPC-gated quota (get_quote_status, consume_quote_credit SECURITY DEFINER) PLUS columns for: plan, first_name, last_name, phone, company_name, business_address, license_number, logo_url, brand_color, default_deposit_percent, default_warranty_en, default_warranty_es, Stripe customer/subscription fields. Updated by Stripe webhook + profile save.

Storage — 'logos' bucket, per-user object at {user_id}/logo, public URL on profiles.logo_url.

### CSS notes
- .view-header, .view-header-spacer, .btn-ghost
- .card-title.with-action, .card-title-action
- .pricing-toggle reused for segmented toggles
- Status pill/select classes defined for: active/past/lead/quoted/in-progress/complete/paid/pending/overdue/unpaid/partial/draft/sent/accepted/declined/invoiced (_ → - conversion). (The old "accepted/declined/invoiced undefined" quirk is fixed.)
- .bulk-bar / .bulk-cb-col / bulk action buttons; archive tabs reuse .pricing-toggle; .modal-backdrop / .modal-card for confirmModal + upgrade modal.

### PDF pipeline gotcha
- generateQuotePdfBlob() / generateInvoicePdfBlob() single source each. html2canvas opts: {scale: 2, useCORS: true, logging: false, backgroundColor: '#FFFFFF'}. Do NOT add windowWidth, x, y, scrollX, or scrollY. Invoice payment panel is a sibling of #invoiceDoc so it stays out of the PDF.

### Line-item filter location
- Lives in renderQuote, not renderLineItemsTable. Preserves user-added "+ Add line item" rows at $0.

### Tooling note
- Claude Code on Windows host has awk (Git Bash) but no node binary.

## Workflow Preferences
<<<<<<< Updated upstream

- Small incremental steps over big-bang changes
- Prompts wrapped in fenced code blocks for Claude Code in VS Code
- 4-section prompt format: Manual setup → Changes → Self-tests → Test plan
- Self-tests baked in: report "X/X passed" before deploy
- Explicit negative constraints ("do NOT do X")
- Push to Vercel preview, verify visually, then merge to main
- For multi-phase manual procedures: one phase at a time, wait for "phase N done"
- Schema migrations: present as a separate SQL block to paste into the Supabase SQL editor BEFORE the code changes
- Windows host (c:\ST\GitHub\TradeDeck\TradeDeck\index.html)

## Open Questions for Next Session

- INV-B vs Payments — merge them (Payments view becomes the real invoices list + financial rollup) or keep Invoices as a per-row list and Payments as a separate dashboard? Leaning merge to avoid two invoice surfaces.
- If keeping "Avg days to pay" on Payments — add invoices.paid_at now (set on flip to paid) as part of the same migration.
- Extend archive to invoices? (invoices currently has no archived_at.)
- Auto-link follow-up to job — fold the 2-line fix into the next sprint or keep as standalone polish?
- Team plan ($99) — when do seats/multi-user actually get built vs. just being a price on the page?
- Capacitor timing — start in parallel or after Payments?
- Custom Supabase email templates — now or later?
=======
- Small incremental sprints. Prompts in fenced blocks for Claude Code in VS Code. 4-section format (Manual setup → Changes → Self-tests → Test plan). "X/X passed" before deploy. Explicit negative constraints. **Push to a branch → Vercel Preview → verify → merge to main** (PAY-B deviated: it went straight to main, tested via a pay-b-preview branch; PAY-C (b383741) currently lives on that pay-b-preview branch and still needs a clean merge to main at go-live). Migrations as a separate SQL block BEFORE code. Multi-phase manual procedures one step at a time. Windows host c:\ST\GitHub\TradeDeck\TradeDeck\index.html.

## Open Questions for Next Session
- **Confirm the PAY-C loop went green** (30-sec check if not already eyeballed): in the sandbox the checkout.session.completed delivery to the Connect endpoint shows **200**, and the test invoice flipped to **paid** with "Paid on …" in-app.
- Payments go-live checklist: merge pay-b-preview (PAY-C) → main, Connect on live, Production fee var, live Connect webhook + secret, re-onboard, then announce to testers.
- Real Payments dashboard: merge with the Invoices list, or keep separate? (lean: Payments becomes the rollup over the same invoice list.)
- Confirm PLATFORM_FEE_PERCENT is set on Production.
- Revisit the PAY-C partial-payment idempotency edge if/when multiple online partials are enabled.
- Sweep the two orphan keys + the plural-topbar cosmetic in one polish pass.
>>>>>>> Stashed changes
