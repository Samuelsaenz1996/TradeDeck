# MyTradeDeck — Project Status

Last updated: May 15, 2026 (post Sprint 1D)

Save this. Paste into any future Claude conversation to continue.

---

## What This Is

MyTradeDeck is an AI-powered admin tool for contractors and tradespeople. Drafts professional bilingual (English + Spanish) quotes and customer follow-up messages in seconds, with a planned CRM layer for clients/jobs/payments tracking.

- **Pricing plan:** Free (5 quotes/month, server-enforced) · Pro $49/month · Team $99/month
- **Target:** $10,000–$15,000/month from a small base of paying contractors, or more if possible
- **Stage:** Live MVP with server-enforced quota, custom-domain magic-link email, branded as MyTradeDeck. 1 confirmed paying tester ($49/mo). Domain purchased; Vercel point-at and bypass retirement pending.
- **Goal type:** Side project that generates a lot of income, not full-time business. Maybe full time if generating enough
- **Long-term:** Wrap in Capacitor for App Store + Google Play distribution

## Tech Stack (Current)

- **Frontend:** Single `index.html` file — vanilla JS, no framework, no build step
- **AI:** Anthropic API via server-side Edge function proxy at `/api/generate.js`. Model `claude-sonnet-4-6`. SSE streaming preserved through the proxy.
- **API key:** `ANTHROPIC_API_KEY` env var in Vercel (Production + Preview + Development) — no longer in the browser
- **Auth:** Supabase magic-link email auth; session persisted in localStorage by the Supabase client
- **Email delivery:** Resend SMTP via verified subdomain `mail.mytradedeck.com`. Supabase configured with custom SMTP (host `smtp.resend.com`, port 465, sender `hello@mail.mytradedeck.com`, sender name `MyTradeDeck`). Rate limit: 30/hr (up from default 2/hr).
- **Quota enforcement:** Postgres `profiles` table + RLS + two SECURITY DEFINER RPCs (`get_quote_status`, `consume_quote_credit`). Free tier 5/month cap atomic and server-enforced.
- **Supabase project:** `https://cqmctdhxticryelvhhze.supabase.co`
- **Publishable key:** `sb_publishable_YOWddbCqAPdFrg-9otLSzw_akBdoAPh` (safe in browser — RLS gates actual data)
- **Domain:** `mytradedeck.com` purchased at GoDaddy. Not yet pointed at Vercel (Sprint 1E task).
- **PDF generation:** html2pdf.js (loaded from cdnjs)
- **Hosting:** Vercel (auto-deploys from GitHub `main` branch)
- **Current live URL:** https://trade-deck-ten.vercel.app
- **Repo:** [paste github.com/yourusername/tradedeck URL]
- **Editor:** VS Code with Claude Code for inline edits, Git via GitHub Desktop
- **API safety:** $20/month spending cap set in Anthropic Console

## What's Built (Functional)

### Backend foundation ✨ (Sprints 1A + 1B + 1C + 1D)
- **Server-side Anthropic proxy** (`api/generate.js`): Vercel Edge function. POST `{model, max_tokens, prompt}`, attaches server-side `ANTHROPIC_API_KEY`, forwards to anthropic.com with `stream: true`, pipes the SSE response straight back to the browser. POST-only (405 otherwise), 500 if env var missing, 400 on bad JSON, upstream errors surfaced as JSON.
- **Supabase auth gate**: App hidden inside `<div id="appContainer" class="hidden">`, revealed only after a valid session. Login screen sends magic links. `sb.auth.onAuthStateChange` toggles UI on session changes.
- **Server-enforced free-tier quota (Sprint 1C):**
  - `profiles` table with `user_id`, `plan` ('free'/'pro'/'team'), `quotes_used`, `period_start` (always first of current month), timestamps. RLS on, no policies — all access via RPCs.
  - Trigger `on_auth_user_created` on `auth.users` creates a profile row on signup. Backfill ran for existing users.
  - `get_quote_status()` RPC — read + lazy reset if calendar month flipped. Called by the frontend on every auth change via `refreshQuoteUsedFromServer`.
  - `consume_quote_credit()` RPC — atomic check + reset + increment. Called by `consumeQuotaOrShowError()` before every `generateQuote` / `generateFollowup`. On quota_exceeded, blocks before any Anthropic spend.
  - Dev-bypass path on login still uses localStorage (intentionally preserved; obsolete since Sprint 1D — slated for retirement in Sprint 1F).
- **Custom SMTP via Resend (Sprint 1D):** Magic links delivered through verified domain `mail.mytradedeck.com`. Auto-DNS via Resend's GoDaddy integration (Entri-powered). 30/hr rate limit. Magic links now reach any email, not just Supabase project team members.
- **Rebrand to MyTradeDeck (Sprint 1D-0):** Product name, page title, sidebar/auth wordmarks, brand-mark icon letter (T→M), and i18n strings all updated. The substring `TradeDeck` only appears inside `MyTradeDeck` in user-facing positions.
- **Sign out** nav item in sidebar Account section calls `sb.auth.signOut()`.
- **Quote content-language fix**: `quoteContentLang()` returns the language the quote was generated in (locked for monolingual quotes; follows `tdLang` for bilingual quotes). `applyQuoteContentLang()` runs as the final step of `applyLanguage()`.

### Quote generator
- 10 trades with emojis: 🔧 Plumbing, ⚡ Electrical, ❄️ HVAC, 🏠 Roofing, 🔨 General, 🖌️ Painting, 🪵 Flooring, 🌿 Landscaping, 🚛 Hauling & Trucking, 📦 Logistics
- **Multi-trade quotes** — pick any combination of trades for one quote. Each trade carries its own job description, pricing panel, and saved input state via `tradePricingState`. A tab strip appears when 2+ trades are selected; switching tabs preserves inputs per trade.
- 7 pricing modes: hourly, flat, trucking, logistics, painting, flooring, roofing — each with its own panel and live subtotal preview
- Auto-switch: selecting a measurement-based trade swaps to the right pricing panel automatically
- Trade-specific job description placeholders (`TRADE_DESC_EXAMPLES` / `TRADE_DESC_EXAMPLES_ES`)
- Tax: optional with custom rate and label
- Timeline: Standard / Priority / Emergency, with conditional rush surcharge field that applies to the combined total
- **Configurable deposit percentage** — `depositPercent` input (0–100), persisted to localStorage, fed into payment terms template via `{{depositPct}}`, `{{depositAmt}}`, `{{balanceAmt}}` placeholders
- AI output: scope, line items grouped by trade with per-trade subtotals (4 line items per trade in multi-trade quotes), payment terms template, warranty
- Trade-aware AI prompts via `TRADE_GUIDANCE` (per-trade conventions, terminology, payment norms)
- Multi-trade prompt logic: when 2+ trades are selected, the prompt instructs scope and warranty as blank-line-separated per-trade paragraphs and forces each line item to carry a `trade` field matching one of the selected trades
- Output JSON-parsed and rendered as a fully editable quote
- Inline editable: company name, tagline, dates, client info, scope, line items (add/delete per trade group), payment terms, warranty, notes
- Per-trade "+ Add line item" buttons in the line items table
- Live recalculation of subtotals, tax, total, and payment-terms placeholders whenever any amount changes

### Bilingual EN / ES support
- **UI language toggle** in the topbar — flips the entire static interface between English and Spanish (`I18N` dictionary, `data-i18n` / `data-i18n-html` / `data-i18n-placeholder` / `data-i18n-aria` attributes, `applyLanguage()` function)
- **Quote output language toggle** — separate from UI: English / Spanish / English + Spanish. Persisted as `tdQuoteLanguages`.
- AI generates bilingual content into `{en, es}` slot pairs (`scope`, `lineItems[].name`, `lineItems[].desc`, `paymentTerms.template`, `warranty`); `pickLang()` picks the right language at render time
- Edits in EN write back to `currentQuote.<field>.en`; edits in ES write to `.es` (per-language blur capture so neither language overwrites the other)
- Language can be switched after generation — re-renders the existing quote in the other language without losing user edits in either
- **Quote document labels lock to the quote's content language** — switching UI lang doesn't partially-translate a monolingual quote
- Banner appears when the current UI language doesn't have content (e.g. viewing in ES but the quote was generated EN-only) prompting regeneration
- Spanish vocab tuned for US/Mexican contractor usage (anticipo, mano de obra, tablaroca, cuadros de teja, etc.) — not formal Castilian
- Status pills, dates (`localeForDate`), and trade names all localized

### Follow-ups screen
- Trade selector (same trades grid as quotes)
- Customer name, quote amount, original job reference
- Signature panel: name, business, contact — saved to localStorage as `tdSigName`/`tdSigBusiness`/`tdSigContact`, collapses to a summary bar once saved
- Scenario chips (6 options): No reply yet · Still thinking it over · Said yes, no deposit yet · Declined the quote · Job complete, asking for review · Past customer check-in
- Quote age chips (1 day / 3 days / 5 days / 1 week)
- Tone chips: Friendly · Professional · Direct
- Channel toggle: Email · Text
- Bilingual AI output (same EN/ES pattern as quotes)
- Editable subject + body, language-switchable
- Live character counter for Text channel (warns over 160)
- Copy formatted message to clipboard
- Regenerate button
- **Consumes a quota credit like quote generation does** — the 5/month cap is shared between quotes and follow-ups

### PDF export (working)
- "Download PDF" generates a real letter-size PDF via html2pdf.js
- Pipeline: blur active input → `await document.fonts.ready` → save scroll, scroll to top → hide UI chrome (per-group +Add buttons, empty Notes block) → render with html2canvas (scale 2, white background, no `windowWidth` / `x` / `y` / `scrollX` / `scrollY` overrides) → wrap in jsPDF letter portrait → restore everything in a `finally` block
- `generateQuotePdfBlob()` is the single source — reused by `downloadPdf()`, `sendQuoteEmail()` (Web Share API → mailto fallback), `sendQuoteText()` (sms fallback)
- CSS uses `page-break-inside: avoid` on key blocks
- Filename built from quote ID + client name (sanitized)

### Streaming responses
- Both quote and follow-up generation use SSE streaming via the `/api/generate` proxy
- `streamCompletion()` parses `content_block_delta` events and accumulates text incrementally
- Progress bar fills as tokens stream, capped at 90% until completion; flushes to 100% on done

### Mobile navigation
- Hamburger menu in topbar (mobile only, ≤900px)
- Slide-in drawer reuses the sidebar markup
- Backdrop tap, × button, and ESC key all close
- Body scroll locked while drawer open
- ARIA labels and focus management implemented
- iOS auto-zoom on focus prevented (inputs are `font-size: 16px` on mobile)

### CRM mockups (visual only, fake data)
- **Clients:** 12 fake clients in `MOCK_CLIENTS`, table with avatar/contact/jobs/revenue/last-contact/status
- **Jobs:** 15 fake jobs in `MOCK_JOBS`, status pills, with stat cards
- **Payments:** 12 fake invoices in `MOCK_PAYMENTS` + 8 weeks of fake cash receipts in `MOCK_PAYMENT_WEEKS`, simple inline SVG bar chart
- Each mockup screen has a dismissible "Preview — sample data" banner
- "Preview" badges on Clients/Jobs/Payments nav items

### UI / UX
- Sidebar nav grouped into Workspace (Quotes, Follow-ups, Clients, Jobs, Payments) and Account (Profile, Settings, Sign out)
- **Free plan usage indicator now reads from the server profile** (not localStorage) for authenticated users — bypass users still use localStorage
- **Brand mark:** "M" in 32×32 dark square. Wordmark: "My\<em\>TradeDeck\</em\>" (italic+orange on TradeDeck portion).
- Upgrade to Pro button (placeholder, no Stripe yet)
- Sticky topbar with view-aware title and meta line
- Login screen at app boot
- Toast notifications for actions and errors
- Custom design system: Fraunces (display) + IBM Plex Sans (body) + JetBrains Mono (code), warm neutrals with amber accent

## What's NOT Built (Roadmap)

| Feature | Priority | Notes |
|---|---|---|
| Point mytradedeck.com at Vercel | **High (next)** | Sprint 1E — add custom domain in Vercel, add DNS records at GoDaddy, update Supabase Site URL + redirect URLs. ~15 min. |
| Retire dev bypass button | **High (next)** | Sprint 1F — obsolete since Resend SMTP unblocks magic links to any email. ~5 min code change. |
| Persisted quotes (database) | High | Sprint 2 — `quotes` table with RLS, real "My quotes" history |
| Real CRM (replacing mockups) | High | Sprint 2 — `clients`, `jobs` tables, swap mockups for real queries |
| Stripe billing | High | Sprint 3 — Stripe Checkout hosted page + `/api/stripe-webhook` to update `profiles.plan` |
| Custom-branded Supabase email templates | Medium | Authentication → Emails → Templates. Default templates work fine for now; polish item. |
| Capacitor wrap (iOS + Android) | Medium | Sprint 4+ — reader-app pattern (signup on web, app authenticates) |
| Convert-to-invoice | Medium | Currently a placeholder button |
| Switch to Haiku option | Low | Faster/cheaper alternative for users who don't need Sonnet quality |
| Deduplicate `TRADE_GUIDANCE` keys | Low | Some redundancy across trade-specific instructions |

## Key Decisions Made

- **Stack: vanilla HTML + Supabase + Vercel Edge + Stripe Checkout + Capacitor** — explicitly NOT Next.js. Vanilla SPAs wrap cleanly in Capacitor for the App Store; Next.js does not.
- **Reader-app pattern for IAP avoidance** — signup and payment on the web; mobile apps just authenticate existing accounts. Standard B2B SaaS pattern (Notion, Slack, Linear).
- **Supabase over alternatives** — auth and Postgres in one SDK, generous free tier, RLS does security so the publishable key is safe to expose in the browser
- **Magic link over password** — friendlier for contractors who won't remember passwords; trades one email round-trip for one less thing to forget
- **Server-enforced quota via Postgres RPC, not Edge function (Sprint 1C)** — atomic check + reset + increment in one transaction, no race condition between check and consume, uses `auth.uid()` natively, one less moving part than a `/api/check-quota` endpoint.
- **Calendar-month reset (Sprint 1C)** — `period_start` always set to first of current month. Aligns with eventual Stripe billing periods, more intuitive than rolling 30 days.
- **Quotes and follow-ups share the 5/month counter** — every generation eats one credit. Simplest schema, follow-ups still cost real Anthropic spend, easy to split later.
- **RLS-locked-down profiles table** — no policies, all access via SECURITY DEFINER RPCs. Minimal attack surface, single source of truth for quota logic.
- **Resend as SMTP provider (Sprint 1D)** — 3,000 emails/mo free tier, fastest Supabase integration, auto-DNS via Entri for GoDaddy. Alternatives evaluated: AWS SES (more setup), Brevo (larger free tier but clunkier), Postmark (too small free tier).
- **Subdomain for email sending** — `mail.mytradedeck.com` isolates email sending reputation from main domain. Standard industry practice.
- **Rebrand to MyTradeDeck (Sprint 1D-0)** — `tradedeck.com` was $65k from squatter. `.app` and `.io` read as low-credibility to contractor audience. URL/brand match for word-of-mouth growth (MyFitnessPal/MyChart precedent for "My-" prefix).
- **`.com` over alternative TLDs for credibility** — contractor audience uses .com by muscle memory; non-`.com` TLDs erode trust.
- Mobile-first PWA approach over native rewrite — Capacitor wraps the existing HTML
- Single HTML file for MVP — no build step, easy to iterate with Claude
- $20/month spending cap on Anthropic Console — protects against worst case
- Trucking, Logistics, Painting, Flooring, Roofing get their own pricing panels (different billing models)
- Plumbing, Electrical, HVAC, General, Landscaping all use generic hourly/flat — got "smarter" via `TRADE_GUIDANCE` AI prompts, not new UI
- **Multi-trade in one quote** instead of one-trade-per-quote — single source of truth for combined jobs
- **Bilingual EN/ES baked in from the start** — target market includes a meaningful share of Spanish-speaking contractors and homeowners
- **Three quote output languages** (EN / ES / both) — "both" keeps a single PDF the contractor can hand to either party
- **Quote document labels lock to content language** — switching UI lang doesn't partial-translate a monolingual quote
- **PDF via html2pdf.js direct from the live DOM** — no separate template, no clone. html2canvas opts kept deliberately minimal — adding `windowWidth` or position overrides caused reflow/clipping in earlier attempts.
- Side project goal, not full-time — strategy weighted toward sustainability over scale
- CRM section currently a mockup to test concept before backend investment

## Active Testers

- [Tester 1 name] — confirmed $49/month commitment ✓
- [Tester 2 name] — pending firmer commitment
- Status: 1 confirmed paying, backend infrastructure now ready for real billing once Sprint 3 lands

## Open Issues / Known Quirks

- **Dev bypass button still on the login screen** — obsolete since Sprint 1D made magic links work to any email. Slated for retirement in Sprint 1F (next).
- **`mytradedeck.com` not yet pointing at Vercel** — currently the app lives only at `trade-deck-ten.vercel.app`. Sprint 1E task (next).
- **Supabase email templates are still Supabase defaults**, not custom-branded for MyTradeDeck. Editable in Authentication → Emails → Templates. Polish item, not blocking.
- Quote generation takes ~30–60s on Sonnet 4.6 — streaming progress bar improves perceived speed
- Past quotes and follow-ups not persisted yet (Sprint 2 fixes)
- Convert-to-invoice button still a placeholder

## Architectural Path Forward

- ✅ **Sprint 1A** (DONE): Server-side Anthropic proxy. API key moved out of browser. SSE streaming preserved.
- ✅ **Quote language fix** (DONE): Quote document labels lock to content language.
- ✅ **Sprint 1B** (DONE): Supabase magic-link auth gate. App hidden behind login.
- ✅ **Sprint 1C** (DONE): Server-enforced 5/month quota via Postgres RPC. Three sub-sprints landed — DB foundation (1C-1), frontend read (1C-2), frontend cutover (1C-3).
- ✅ **Sprint 1D-0** (DONE): Rebrand to MyTradeDeck. Page title, wordmarks, brand-mark icon, i18n strings, HTML fallbacks all updated.
- ✅ **Sprint 1D** (DONE): Bought `mytradedeck.com` at GoDaddy. Verified `mail.mytradedeck.com` in Resend via auto-DNS. Supabase configured with Resend SMTP. Magic links to any email at 30/hr.
- ⏳ **Sprint 1E** (NEXT, ~15 min): Point `mytradedeck.com` at Vercel. Add custom domain, DNS records at GoDaddy (Vercel provides values), update Supabase Site URL + redirect URLs. Test that magic links redirect to `mytradedeck.com`.
- ⏳ **Sprint 1F** (NEXT, ~5 min): Retire dev bypass button. Delete HTML, i18n keys, onclick handler, bypass branch in `updateAuthUI`. Clean up auth flow.
- ⏳ **Sprint 2**: Schema for `quotes`, `clients`, `jobs` tables with RLS. Persist generated quotes. Real "My quotes" history. Swap CRM mockups for real queries.
- ⏳ **Sprint 3**: Stripe Checkout via `/api/create-checkout`. Webhook at `/api/stripe-webhook` updates `profiles.plan`. Plan gating already wired in `consume_quote_credit` (free=5/mo, pro/team=unlimited).
- ⏳ **Sprint 4+**: Capacitor wrap for App Store + Google Play. Reader-app pattern.

## Code Conventions / Notes

- Model name: `claude-sonnet-4-6` (used in both `generateQuote` and `generateFollowup`)
- API call goes to `/api/generate` (no `api.anthropic.com` direct from browser, no Anthropic headers in browser)
- `sb` global = `window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)` at top of inline script
- **Quota helpers (Sprint 1C):**
  - `consumeQuotaOrShowError()` — called before every generation. Real users → `sb.rpc('consume_quote_credit')`. Bypass users → localStorage `quoteUsed` increment. Returns true on success, false on quota-exceeded or error.
  - `refreshQuoteUsedFromServer()` — called from `updateAuthUI` whenever a real session lands (gated on `session.access_token`). Sets the `quoteUsed` global from the server.
- Auth functions: `initAuth()` / `updateAuthUI(session)` / `handleSignIn()` / `handleSignOut()`; called from bottom of script as `init(); initAuth();`
- Dev bypass click handler also zeroes `quoteUsed` localStorage so bypass testers always start clean
- `pricingMode` global: `'hourly'` | `'flat'` | `'trucking'` | `'logistics'` | `'painting'` | `'flooring'` | `'roofing'`
- `taxMode` global: `'none'` | `'custom'`
- `tdLang` global: `'en'` | `'es'` — current UI language
- `quoteLanguages` global: `'en'` | `'es'` | `'both'` — AI output language for next generation
- `quoteContentLang()` — returns the locked language for monolingual quotes, `tdLang` for bilingual
- `applyQuoteContentLang()` — overrides quote-internal labels using `quoteContentLang()`; called at end of `applyLanguage()`
- `selectedTrades` array (multi-trade): emoji + name strings (e.g. `["🔧 Plumbing", "🏠 Roofing"]`)
- `activeTradeIndex` — which trade tab is currently being edited
- `tradePricingState` object — keyed by trade name, holds `{ mode, jobDesc, ...pricingInputs }` per trade so switching tabs preserves inputs
- `selectedFollowupTrade` — same emoji+name format, single trade for the follow-up screen
- `currentQuote` / `currentFollowup` — bilingual payload held in memory so the language toggle can re-render without losing per-language edits
- `pickLang(field, fallback)` — returns the right-language string from a `{en, es}` field; defensive against legacy plain-string shape
- `depositPercent` global — percentage value driving payment terms template placeholders
- `quoteUsed` global — **bypass-only after Sprint 1C-3**. Real users get this overwritten by `refreshQuoteUsedFromServer()` on auth and by `consumeQuotaOrShowError()` on each generation.
- `TRADES` array drives every trade selector across the app
- `TRADE_LABELS_ES` — Spanish display names for trades
- `TRADE_GUIDANCE` — trade-specific AI prompt context (embedded in prompt, English only)
- `TRADE_DESC_EXAMPLES` / `TRADE_DESC_EXAMPLES_ES` — trade-specific placeholder text for job description
- `I18N` — full UI dictionary, en/es. `t(key, vars)` is the lookup helper. Brand strings updated to "MyTradeDeck" in Sprint 1D-0.
- `MOCK_CLIENTS`, `MOCK_JOBS`, `MOCK_PAYMENTS`, `MOCK_PAYMENT_WEEKS` — top-level constants for easy DB swap later (Sprint 2)
- `PRICING_INPUTS_BY_MODE` + `PRICING_DEFAULTS` — drive the snapshot/restore for per-trade pricing input state
- localStorage keys: `tdSigName`, `tdSigBusiness`, `tdSigContact`, `tdLang`, `tdDepositPercent`, `tdQuoteLanguages`. `quoteUsed` retained for the bypass path only; not authoritative for real users.
- Supabase auth session is automatically persisted to localStorage by the Supabase client (key starts with `sb-cqmctdhxticryelvhhze-`)
- Payment terms template uses `{{depositPct}}`, `{{depositAmt}}`, `{{balanceAmt}}` placeholders interpolated client-side by `renderPaymentTerms()`. Once the user edits the rendered text, the template is locked off (`userEdited: true`) and literal text is stored per-language.
- CSS uses custom properties (`--ink`, `--accent`, `--line`, `--surface`, `--surface-2`, etc.) — reuse, don't redefine
- Auth CSS classes: `.auth-screen`, `.auth-card`, `.auth-brand`, `.auth-title`, `.auth-sub`, `.auth-input`, `.auth-btn`, `.auth-status`, `.auth-btn-dev`
- Display font: Fraunces. Body font: IBM Plex Sans. Mono: JetBrains Mono.
- Mobile breakpoint: 900px (sidebar becomes drawer below this)
- **Brand mark:** "M" in 32×32 dark square. Wordmark: `My<em>TradeDeck</em>` (italic+orange on TradeDeck portion).
- **PDF pipeline gotcha:** `generateQuotePdfBlob()` is the single source. html2canvas opts deliberately minimal (`scale: 2, useCORS: true, logging: false, backgroundColor: '#FFFFFF'`). Do **not** add `windowWidth`, `x`, `y`, `scrollX`, or `scrollY` — earlier attempts to "improve" them caused content clipping.
- **Tooling note:** Claude Code on this Windows host has `awk` (via Git Bash) but no `node` binary — JS syntax checks fall back to careful manual review

## Supabase schema (Sprint 1C reference)

- `public.profiles`:
  - `user_id` uuid PK, FK to `auth.users(id) on delete cascade`
  - `plan` text not null default 'free', check in ('free','pro','team')
  - `quotes_used` int not null default 0
  - `period_start` date not null default `date_trunc('month', now())::date`
  - `created_at`, `updated_at` timestamptz
  - RLS enabled, **no policies** → table is RPC-only
- Trigger `on_auth_user_created` after insert on `auth.users` → `public.handle_new_user()` creates a profile row
- RPC `public.get_quote_status()` returns JSON: `{ plan, quotes_used, quotes_limit, period_start }`. Side-effect: resets `quotes_used` to 0 and rolls `period_start` if the month flipped.
- RPC `public.consume_quote_credit()` returns JSON: `{ allowed, plan, quotes_used, quotes_limit }` on success, or `{ allowed:false, reason:'quota_exceeded'|'not_authenticated', ... }`. Atomic check + reset + increment. Free=5/mo, pro/team=unlimited.
- Both RPCs: `SECURITY DEFINER`, `set search_path = public`, granted to `authenticated` only (revoked from `public, anon`).

## Resend integration (Sprint 1D reference)

- Resend account: samuelsaenz20@... (free tier)
- Verified domain: `mail.mytradedeck.com`, region us-east-1
- DNS managed by Resend's GoDaddy integration (auto-configured via Entri)
- API key in Supabase: `Supabase SMTP - MyTradeDeck` (Sending access, scoped to `mail.mytradedeck.com`)
- SMTP host: `smtp.resend.com`, port 465, username `resend`, password is the Resend API key
- Sender: `hello@mail.mytradedeck.com`, sender name `MyTradeDeck`
- Free tier limits: 3,000 emails/month, 100/day
- Supabase rate limit after custom SMTP enabled: 30/hr (can raise in Authentication → Rate Limits)

## Workflow Preferences

- **Small incremental steps** over big-bang changes
- **Prompts wrapped in fenced code blocks** for one-click copy into Claude Code in VS Code
- **4-section prompt format**: Manual setup → The changes → Self-tests (Claude Code runs against its own diff) → Test plan for the user
- **Self-tests baked in**: Claude Code reports "X/X passed" before the user proceeds to deployment
- **Explicit negative constraints** when prior attempts failed ("do NOT do X")
- After each prompt lands, push to a Vercel preview branch and verify visually before accepting
- For multi-phase manual procedures (Sprint 1D-style), one phase at a time, wait for "phase N complete" before sending the next

## Open Questions for Next Session

- **Sprint 1E and 1F order vs Sprint 2** — recommend knocking 1E and 1F out first (combined ~20 min), then Sprint 2 with clean slate.
- **Custom Supabase email templates** — polish them now, before launch, or never? Default templates are functional, just not branded.
- **Sprint 3 Stripe** — confirm hosted Stripe Checkout over custom-built (faster, simpler, less PCI surface).
- **Capacitor timing** — wait until Sprint 3 is done, or start in parallel?
- **Magic-link redirect URL** — once mytradedeck.com points at Vercel (Sprint 1E), should magic links redirect to `https://mytradedeck.com` or `https://www.mytradedeck.com`? Both need to be in Supabase's Redirect URLs list.