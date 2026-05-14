# TradeDeck — Project Status

Last updated: May 14, 2026

Save this. Paste into any future Claude conversation to continue.

---

## What This Is

TradeDeck is an AI-powered admin tool for contractors and tradespeople. Drafts professional bilingual (English + Spanish) quotes and customer follow-up messages in seconds, with a planned CRM layer for clients/jobs/payments tracking.

- **Pricing plan:** Free (5 quotes/month) · Pro $49/month · Team $99/month
- **Target:** $2,000–$5,000/month from a small base of paying contractors
- **Stage:** Live MVP with active testers; both testers said "would pay" (intent confirmation pending)
- **Goal type:** Side project that generates income, not full-time business

## Tech Stack (Current)

- **Frontend:** Single `index.html` file — vanilla JS, no framework, no build step
- **AI:** Anthropic API, model `claude-sonnet-4-6`, called direct from browser using `anthropic-dangerous-direct-browser-access: true` header, with SSE streaming enabled
- **PDF generation:** html2pdf.js (loaded from cdnjs)
- **API key:** Read from localStorage (`anthropicKey`), entered via banner at top
- **Hosting:** Vercel (auto-deploys from GitHub `main` branch)
- **Live URL:** [paste trade-deck-ten.vercel.app or your custom URL]
- **Repo:** [paste github.com/yourusername/tradedeck URL]
- **Editor:** VS Code with Claude Code for inline edits, Git via GitHub Desktop
- **API safety:** $20/month spending cap set in Anthropic Console

## What's Built (Functional)

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
- `generateQuotePdfBlob()` is the single source — reused by:
  - `downloadPdf()` — direct file download
  - `sendQuoteEmail()` — attaches the PDF via Web Share API when supported; otherwise downloads the file and opens a pre-filled mailto:
  - `sendQuoteText()` — same pattern with sms:
- CSS uses `page-break-inside: avoid` on key blocks (totals, footer grid, notes, table rows, trade sub-headers) to control pagination
- Filename built from quote ID + client name (sanitized)

### Streaming responses
- Both quote and follow-up generation use SSE streaming (`stream: true` on the API call)
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
- **Payments:** 12 fake invoices in `MOCK_PAYMENTS` + 8 weeks of fake cash receipts in `MOCK_PAYMENT_WEEKS`, simple inline SVG bar chart, status pills with overdue row highlight
- Each mockup screen has a dismissible "Preview — sample data" banner
- "Preview" badges on Clients/Jobs/Payments nav items

### UI / UX
- Sidebar nav grouped into Workspace (Quotes, Follow-ups, Clients, Jobs, Payments) and Account (Profile, Settings)
- Free plan usage indicator (`quoteUsed` localStorage counter, max 5)
- Upgrade to Pro button (placeholder, no Stripe yet)
- Sticky topbar with view-aware title and meta line
- API key banner at top, key saved to localStorage
- Toast notifications for actions and errors
- Custom design system: Fraunces (display) + IBM Plex Sans (body) + JetBrains Mono (code), warm neutrals with amber accent

## What's NOT Built (Roadmap)

| Feature | Priority | Notes |
|---|---|---|
| Backend (Next.js + Vercel API route) | High | Required to charge customers; move API call server-side |
| Auth (Supabase) | High | Required for real metering and payments |
| Stripe billing | High | $49/mo Pro plan, $99/mo Team |
| Real CRM (replacing mockups) | Medium | After backend + auth land, swap fake data for real DB-backed views |
| Persistence of past quotes/follow-ups | Medium | No backend yet; quotes vanish on refresh |
| Convert-to-invoice | Medium | Currently a placeholder button |
| PWA setup (manifest, service worker, icons) | Medium | "Add to home screen" support |
| Switch to Haiku option | Low | Faster/cheaper alternative for users who don't need Sonnet quality |
| Deduplicate `TRADE_GUIDANCE` keys | Low | Some redundancy across trade-specific instructions |

## Key Decisions Made

- Mobile-first PWA approach over native — faster to ship
- Single HTML file for MVP — no build step, easy to iterate with Claude
- Browser-direct API calls for now — knowingly insecure for paying users, fine for trusted testers
- $20/month spending cap on Anthropic Console — protects against worst case
- Each tester pastes their own / shared key in browser — no auth yet
- Trucking, Logistics, Painting, Flooring, Roofing get their own pricing panels (different billing models)
- Plumbing, Electrical, HVAC, General, Landscaping all use generic hourly/flat — got "smarter" via `TRADE_GUIDANCE` AI prompts, not new UI
- **Multi-trade in one quote** instead of one-trade-per-quote — single source of truth for combined jobs, per-trade subtotals visible inline, AI is forced to tag each line item with its trade so totals stay coherent
- **Bilingual EN/ES baked in from the start** — target market includes a meaningful share of Spanish-speaking contractors and homeowners; cheaper to build it now than retrofit later
- **Three quote output languages** (EN / ES / both) — "both" keeps a single PDF the contractor can hand to either party
- **PDF via html2pdf.js direct from the live DOM** — no separate template, no clone, lets the user's inline edits land in the PDF as-is. html2canvas opts kept deliberately minimal — adding `windowWidth` or position overrides caused reflow/clipping in earlier attempts.
- Side project goal, not full-time — strategy weighted toward sustainability over scale
- CRM section currently a mockup to test concept before backend investment

## Active Testers

- [Tester 1 name] — [their trade, e.g. "logistics company owner"]
- [Tester 2 name] — [their trade]
- Status: Both said "this is awesome, would pay" — pending firmer commitment via direct $49 question
- Next step: Confirm payment intent, then start backend migration

## Open Issues / Known Quirks

- Quote generation takes ~30–60s on Sonnet 4.6 — streaming progress bar improves perceived speed; full Haiku swap still on table
- 5-quote free limit lives in localStorage, easily bypassed (acceptable for trusted testers, will be enforced server-side later)
- API key visible in browser devtools (acceptable for trusted testers only)
- No persistence of past quotes or follow-ups (no backend yet)
- Convert-to-invoice button is still a placeholder

## Architectural Path Forward

When ready to charge customers (gated on confirmed "yes I'll pay $49" from at least one tester):

1. **Weekend 1:** Convert single `index.html` → Next.js project. Move Anthropic API call to server route (`/api/generate-quote`, `/api/generate-followup`). API key as env var on Vercel. Deploy to same domain.
2. **Weekend 2:** Add Supabase auth + database. Track `quotes_used_this_month` per user. Enforce 5-quote free limit on server.
3. **Weekend 3:** Stripe Checkout + webhook. Free → Pro upgrade flow. First paying customer.
4. **Post-Stripe:** Replace CRM mockups with DB-backed real data (clients, jobs, payments). Build invoice converter.

## Code Conventions / Notes

- Model name: `claude-sonnet-4-6` (used in both `generateQuote` and `generateFollowup`)
- API call uses `anthropic-dangerous-direct-browser-access: true` header and `stream: true`
- `pricingMode` global: `'hourly'` | `'flat'` | `'trucking'` | `'logistics'` | `'painting'` | `'flooring'` | `'roofing'`
- `taxMode` global: `'none'` | `'custom'`
- `tdLang` global: `'en'` | `'es'` — current UI language
- `quoteLanguages` global: `'en'` | `'es'` | `'both'` — AI output language for next generation
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
- `I18N` — full UI dictionary, en/es. `t(key, vars)` is the lookup helper.
- `MOCK_CLIENTS`, `MOCK_JOBS`, `MOCK_PAYMENTS`, `MOCK_PAYMENT_WEEKS` — top-level constants for easy DB swap later
- `PRICING_INPUTS_BY_MODE` + `PRICING_DEFAULTS` — drive the snapshot/restore for per-trade pricing input state
- localStorage keys: `anthropicKey`, `quoteUsed`, `tdSigName`, `tdSigBusiness`, `tdSigContact`, `tdLang`, `tdDepositPercent`, `tdQuoteLanguages`
- Payment terms template uses `{{depositPct}}`, `{{depositAmt}}`, `{{balanceAmt}}` placeholders interpolated client-side by `renderPaymentTerms()`. Once the user edits the rendered text, the template is locked off (`userEdited: true`) and literal text is stored per-language.
- CSS uses custom properties (`--ink`, `--accent`, `--line`, `--surface`, `--surface-2`, etc.) — reuse, don't redefine
- Display font: Fraunces. Body font: IBM Plex Sans. Mono: JetBrains Mono.
- Mobile breakpoint: 900px (sidebar becomes drawer below this)
- **PDF pipeline gotcha:** `generateQuotePdfBlob()` is the single source; `downloadPdf`, `sendQuoteEmail`, `sendQuoteText` all call it. html2canvas opts deliberately minimal (`scale: 2, useCORS: true, logging: false, backgroundColor: '#FFFFFF'`). Do **not** add `windowWidth`, `x`, `y`, `scrollX`, or `scrollY` — earlier attempts to "improve" them caused content clipping (windowWidth reflows the layout; x/y/scrollX/Y shifts the capture rectangle off-element). Let html2canvas use the element's natural bounds.

## Open Questions for Next Session

- Did testers confirm $49/month commitment when asked directly?
- Any bilingual edge cases the testers have hit in the wild (e.g. Spanish-speaking contractor sending an EN+ES quote to an English-only homeowner)?
- Backend migration: start Weekend 1 immediately, or wait for more tester usage data?
- Worth adding a "duplicate this quote" / "save as template" feature before backend, or only after persistence is real?
