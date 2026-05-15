# TradeDeck — Project Status

Last updated: May 14, 2026 (post Sprint 1B)

Save this. Paste into any future Claude conversation to continue.

---

## What This Is

TradeDeck is an AI-powered admin tool for contractors and tradespeople. Drafts professional bilingual (English + Spanish) quotes and customer follow-up messages in seconds, with a planned CRM layer for clients/jobs/payments tracking.

- **Pricing plan:** Free (5 quotes/month) · Pro $49/month · Team $99/month
- **Target:** $2,000–$5,000/month from a small base of paying contractors
- **Stage:** Live MVP behind auth; 1 confirmed paying tester ($49/mo), backend migration in progress
- **Goal type:** Side project that generates income, not full-time business
- **Long-term:** Wrap in Capacitor for App Store + Google Play distribution

## Tech Stack (Current)

- **Frontend:** Single `index.html` file — vanilla JS, no framework, no build step
- **AI:** Anthropic API via server-side Edge function proxy at `/api/generate.js`. Model `claude-sonnet-4-6`. SSE streaming preserved through the proxy.
- **API key:** `ANTHROPIC_API_KEY` env var in Vercel (Production + Preview + Development) — no longer in the browser
- **Auth:** Supabase magic-link email auth; session persisted in localStorage by the Supabase client
- **Supabase project:** `https://cqmctdhxticryelvhhze.supabase.co`
- **Publishable key:** `sb_publishable_YOWddbCqAPdFrg-9otLSzw_akBdoAPh` (safe in browser — RLS gates actual data)
- **PDF generation:** html2pdf.js (loaded from cdnjs)
- **Hosting:** Vercel (auto-deploys from GitHub `main` branch)
- **Live URL:** https://trade-deck-ten.vercel.app
- **Repo:** [paste github.com/yourusername/tradedeck URL]
- **Editor:** VS Code with Claude Code for inline edits, Git via GitHub Desktop
- **API safety:** $20/month spending cap set in Anthropic Console

## What's Built (Functional)

### Backend foundation ✨ (Sprint 1A + 1B)
- **Server-side Anthropic proxy** (`api/generate.js`): Vercel Edge function. POST `{model, max_tokens, prompt}`, attaches server-side `ANTHROPIC_API_KEY`, forwards to anthropic.com with `stream: true`, pipes the SSE response straight back to the browser. POST-only (405 otherwise), 500 if env var missing, 400 on bad JSON, upstream errors surfaced as JSON.
- **Supabase auth gate**: App wrapped in `<div id="appContainer" class="hidden">`, revealed only after a valid session. Login screen at `<div class="auth-screen">` collects email and calls `sb.auth.signInWithOtp` with `emailRedirectTo: window.location.origin`. `sb.auth.onAuthStateChange` listener toggles UI on session changes. Session persists across refreshes.
- **Sign out** nav item in sidebar Account section calls `sb.auth.signOut()`.
- **Quote content-language fix**: `quoteContentLang()` returns the language the quote was generated in (locked for monolingual quotes; follows `tdLang` for bilingual quotes). `applyQuoteContentLang()` runs as the final step of `applyLanguage()` and overrides every `[data-i18n]` inside `#quoteDoc`, the dynamic "+ Add line item" buttons, trade subheader rows, in-doc trade-meta, and tax row label. An English-only quote now stays fully English internally even when UI flips to Spanish.

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
- **Quote document labels lock to the quote's content language** — switching UI lang doesn't partially-translate a monolingual quote (see `quoteContentLang` / `applyQuoteContentLang` above)
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
- Free plan usage indicator (`quoteUsed` localStorage counter, max 5) — moving to server-side in Sprint 1C
- Upgrade to Pro button (placeholder, no Stripe yet)
- Sticky topbar with view-aware title and meta line
- Login screen at app boot (replaces the old API-key banner that was removed)
- Toast notifications for actions and errors
- Custom design system: Fraunces (display) + IBM Plex Sans (body) + JetBrains Mono (code), warm neutrals with amber accent

## What's NOT Built (Roadmap)

| Feature | Priority | Notes |
|---|---|---|
| Server-side `quoteUsed` enforcement | High | Sprint 1C — move from localStorage to `profiles` table column |
| Persisted quotes (database) | High | Sprint 2 — `quotes` table with RLS, real "My quotes" history |
| Real CRM (replacing mockups) | High | Sprint 2 — `clients`, `jobs` tables, swap mockups for real queries |
| Stripe billing | High | Sprint 3 — Stripe Checkout hosted page + `/api/stripe-webhook` to update plan column |
| Capacitor wrap (iOS + Android) | Medium | Sprint 4+ — reader-app pattern (signup on web, app authenticates) |
| Custom SMTP via Resend | Medium | Supabase default email is 2/hr — blocks onboarding more testers; needs verified domain |
| Convert-to-invoice | Medium | Currently a placeholder button |
| Switch to Haiku option | Low | Faster/cheaper alternative for users who don't need Sonnet quality |
| Deduplicate `TRADE_GUIDANCE` keys | Low | Some redundancy across trade-specific instructions |

## Key Decisions Made

- **Stack: vanilla HTML + Supabase + Vercel Edge + Stripe Checkout + Capacitor** — explicitly NOT Next.js. Vanilla SPAs wrap cleanly in Capacitor for the App Store; Next.js does not.
- **Reader-app pattern for IAP avoidance** — signup and payment on the web; mobile apps just authenticate existing accounts. Standard B2B SaaS pattern (Notion, Slack, Linear).
- **Supabase over alternatives** — auth and Postgres in one SDK, generous free tier, RLS does security so the publishable key is safe to expose in the browser
- **Magic link over password** — friendlier for contractors who won't remember passwords; trades one email round-trip for one less thing to forget
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
- Status: 1 confirmed paying, backend migration in progress to enable real billing

## Open Issues / Known Quirks

- **Supabase default email: 2/hr on free tier** — blocks onboarding more than 2 testers per hour. Fix is custom SMTP via Resend with a verified domain (deferred).
- Quote generation takes ~30–60s on Sonnet 4.6 — streaming progress bar improves perceived speed
- `quoteUsed` 5-quote free limit still lives in localStorage, easily bypassed (Sprint 1C fixes this)
- No persistence of past quotes or follow-ups yet (Sprint 2)
- Convert-to-invoice button is still a placeholder

## Architectural Path Forward

- ✅ **Sprint 1A** (DONE): Server-side Anthropic proxy. API key moved out of browser. SSE streaming preserved.
- ✅ **Quote language fix** (DONE): Quote document labels lock to content language.
- ✅ **Sprint 1B** (DONE): Supabase magic-link auth gate. App hidden behind login.
- ⏳ **Sprint 1C** (NEXT): Move `quoteUsed` from localStorage to a Supabase `profiles` table column. Server-side enforcement of the 5-quote free limit.
- ⏳ **Sprint 2**: Schema for `quotes`, `clients`, `jobs` tables with RLS. Persist generated quotes. Real "My quotes" history. Swap CRM mockups for real queries.
- ⏳ **Sprint 3**: Stripe Checkout via `/api/create-checkout`. Webhook at `/api/stripe-webhook` updates `users.plan`. Plan gating (free=5/mo, pro=unlimited).
- ⏳ **Sprint 4+**: Capacitor wrap for App Store + Google Play. Reader-app pattern (signup on web, app authenticates).

## Code Conventions / Notes

- Model name: `claude-sonnet-4-6` (used in both `generateQuote` and `generateFollowup`)
- API call goes to `/api/generate` (no more `api.anthropic.com` direct, no Anthropic headers in browser, no `apiKey` param to `streamCompletion`)
- `sb` global = `window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)` at top of inline script
- Auth functions: `initAuth()` / `updateAuthUI(session)` / `handleSignIn()` / `handleSignOut()`; called from bottom of script as `init(); initAuth();`
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
- `TRADES` array drives every trade selector across the app
- `TRADE_LABELS_ES` — Spanish display names for trades
- `TRADE_GUIDANCE` — trade-specific AI prompt context (embedded in prompt, English only)
- `TRADE_DESC_EXAMPLES` / `TRADE_DESC_EXAMPLES_ES` — trade-specific placeholder text for job description
- `I18N` — full UI dictionary, en/es. `t(key, vars)` is the lookup helper. New `auth.*` keys and `nav.signOut` added in Sprint 1B.
- `MOCK_CLIENTS`, `MOCK_JOBS`, `MOCK_PAYMENTS`, `MOCK_PAYMENT_WEEKS` — top-level constants for easy DB swap later
- `PRICING_INPUTS_BY_MODE` + `PRICING_DEFAULTS` — drive the snapshot/restore for per-trade pricing input state
- localStorage keys: `quoteUsed`, `tdSigName`, `tdSigBusiness`, `tdSigContact`, `tdLang`, `tdDepositPercent`, `tdQuoteLanguages` (NOTE: `anthropicKey` is GONE since the API call moved server-side)
- Supabase auth session is automatically persisted to localStorage by the Supabase client (key starts with `sb-cqmctdhxticryelvhhze-`)
- Payment terms template uses `{{depositPct}}`, `{{depositAmt}}`, `{{balanceAmt}}` placeholders interpolated client-side by `renderPaymentTerms()`. Once the user edits the rendered text, the template is locked off (`userEdited: true`) and literal text is stored per-language.
- CSS uses custom properties (`--ink`, `--accent`, `--line`, `--surface`, `--surface-2`, etc.) — reuse, don't redefine
- New CSS classes from Sprint 1B: `.auth-screen`, `.auth-card`, `.auth-brand`, `.auth-title`, `.auth-sub`, `.auth-input`, `.auth-btn`, `.auth-status`
- Display font: Fraunces. Body font: IBM Plex Sans. Mono: JetBrains Mono.
- Mobile breakpoint: 900px (sidebar becomes drawer below this)
- Removed in Sprint 1A: API key banner HTML + `.api-banner*` CSS, `bindApiKey` / `refreshApiStatus` functions, `apiKey` global, 9 obsolete `api.*` / `toast.api*` i18n keys; sticky offsets adjusted (banner was 44px tall — sidebar/topbar now stick to top: 0)
- **PDF pipeline gotcha:** `generateQuotePdfBlob()` is the single source. html2canvas opts deliberately minimal (`scale: 2, useCORS: true, logging: false, backgroundColor: '#FFFFFF'`). Do **not** add `windowWidth`, `x`, `y`, `scrollX`, or `scrollY` — earlier attempts to "improve" them caused content clipping.
- **Tooling note:** Claude Code on this Windows host has `awk` (via Git Bash) but no `node` binary — JS syntax checks fall back to careful manual review

## Workflow Preferences

- **Small incremental steps** over big-bang changes
- **Prompts wrapped in fenced code blocks** for one-click copy into Claude Code in VS Code
- **4-section prompt format**: Manual setup → The changes → Self-tests (Claude Code runs against its own diff) → Test plan for the user
- **Self-tests baked in**: Claude Code reports "X/X passed" before the user proceeds to deployment
- **Explicit negative constraints** when prior attempts failed ("do NOT do X")

## Open Questions for Next Session

- Sprint 1C: should `quoteUsed` reset by calendar month (1st of month) or rolling 30 days?
- Sprint 3 Stripe: confirm hosted Stripe Checkout over custom-built (faster, simpler, less PCI surface)
- Custom domain for TradeDeck (needed for Resend SMTP + less amateur look) — when to buy?
- Capacitor timing — wait until Sprint 3 is done, or start in parallel?
- rememember to remove dev bypass on login