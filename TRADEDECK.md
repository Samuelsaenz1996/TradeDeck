# TradeDeck — Project Status

Last updated: [today's date]

Save this. Paste into any future Claude conversation to continue.

---

## What This Is

TradeDeck is an AI-powered admin tool for contractors and tradespeople. Drafts professional quotes and customer follow-up messages in seconds, with a planned CRM layer for clients/jobs/payments tracking.

- **Pricing plan:** Free (5 quotes/month) · Pro $49/month · Team $99/month
- **Target:** $2,000–$5,000/month from a small base of paying contractors
- **Stage:** Live MVP with active testers; both testers said "would pay" (intent confirmation pending)
- **Goal type:** Side project that generates income, not full-time business

## Tech Stack (Current)

- **Frontend:** Single `index.html` file — vanilla JS, no framework, no build step
- **AI:** Anthropic API, model `claude-sonnet-4-6`, called direct from browser using `anthropic-dangerous-direct-browser-access: true` header
- **API key:** Read from localStorage (`anthropicKey`), entered via banner at top
- **Hosting:** Vercel (auto-deploys from GitHub `main` branch)
- **Live URL:** [paste trade-deck-ten.vercel.app or your custom URL]
- **Repo:** [paste github.com/yourusername/tradedeck URL]
- **Editor:** VS Code, Git via GitHub Desktop
- **API safety:** $20/month spending cap set in Anthropic Console

## What's Built (Functional)

### Quote generator
- 10 trades with emojis: 🔧 Plumbing, ⚡ Electrical, ❄️ HVAC, 🏠 Roofing, 🔨 General, 🖌️ Painting, 🪵 Flooring, 🌿 Landscaping, 🚛 Hauling & Trucking, 📦 Logistics
- 7 pricing modes: hourly, flat, trucking, logistics, painting, flooring, roofing — each with own panel where applicable, live subtotal preview
- Auto-switch: selecting a measurement-based trade swaps to the right pricing panel automatically
- Trade-specific job description placeholders (`TRADE_DESC_EXAMPLES` object)
- Tax: optional with custom rate and custom label
- Timeline: Standard / Priority / Emergency, with conditional rush surcharge field
- AI-generated output: scope, 4 line items, payment terms, warranty
- Trade-aware AI prompts via `TRADE_GUIDANCE` object (per-trade conventions, terminology, payment norms)
- Output JSON-parsed and rendered as fully editable quote
- Inline editable: company name, tagline, dates, client info, scope, line items (add/delete), payment terms, warranty, notes
- Line item totals auto-recalculate

### Follow-ups screen
- Trade selector (same trades grid as quotes)
- Customer name, quote amount, original job reference
- Signature panel: name, business, contact — saved to localStorage as `tdSigName`/`tdSigBusiness`/`tdSigContact`, collapses to summary bar once saved
- Scenario chips (6 options): No reply yet · Still thinking it over · Said yes, no deposit yet · Declined the quote · Job complete, asking for review · Past customer check-in
- Quote age chips (1 day / 3 days / 5 days / 1 week)
- Tone chips: Friendly · Professional · Direct
- Channel toggle: Email · Text
- AI-generated message with editable subject + body
- Live character counter for Text channel (warns over 160)
- Copy formatted message to clipboard
- Regenerate button

### Mobile navigation
- Hamburger menu in topbar (mobile only)
- Slide-in drawer reuses sidebar markup
- Backdrop tap, × button, and ESC key all close
- Body scroll locked while drawer open
- ARIA labels and focus management implemented

### CRM mockups (visual only, fake data)
- **Clients:** 12 fake clients in `MOCK_CLIENTS`, table with avatar/contact/jobs/revenue/last-contact/status
- **Jobs:** 15 fake jobs in `MOCK_JOBS`, status filtered, with stat cards
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
| PDF export (real, not browser print) | Low | Currently the "Download PDF" button just prints |
| Convert-to-invoice | Medium | Currently a placeholder button |
| PWA setup (manifest, service worker, icons) | Medium | "Add to home screen" support |
| Email/SMS direct send | Low | Currently copy-paste only |
| Streaming responses | Low | Currently waits ~60s; streaming would feel much faster |
| Switch to Haiku option | Low | Faster/cheaper alternative for users who don't need Sonnet quality |

## Key Decisions Made

- Mobile-first PWA approach over native — faster to ship
- Single HTML file for MVP — no build step, easy to iterate with Claude
- Browser-direct API calls for now — knowingly insecure for paying users, fine for trusted testers
- $20/month spending cap on Anthropic Console — protects against worst case
- Each tester pastes their own / shared key in browser — no auth yet
- Trucking, Logistics, Painting, Flooring, Roofing get their own pricing panels (different billing models)
- Plumbing, Electrical, HVAC, General, Landscaping all use generic hourly/flat — got "smarter" via `TRADE_GUIDANCE` AI prompts, not new UI
- Side project goal, not full-time — strategy weighted toward sustainability over scale
- CRM section currently a mockup to test concept before backend investment

## Active Testers

- [Tester 1 name] — [their trade, e.g. "logistics company owner"]
- [Tester 2 name] — [their trade]
- Status: Both said "this is awesome, would pay" — pending firmer commitment via direct $49 question
- Next step: Confirm payment intent, then start backend migration

## Open Issues / Known Quirks

- Quote generation takes ~60 seconds on Sonnet 4.6 (acceptable for now, plan to address with streaming or Haiku swap later)
- 5-quote free limit lives in localStorage, easily bypassed (acceptable for trusted testers, will be enforced server-side later)
- API key visible in browser devtools (acceptable for trusted testers only)
- No persistence of past quotes or follow-ups (no backend yet)
- Convert-to-invoice and PDF download buttons are placeholders


## Architectural Path Forward

When ready to charge customers (gated on confirmed "yes I'll pay $49" from at least one tester):

1. **Weekend 1:** Convert single `index.html` → Next.js project. Move Anthropic API call to server route (`/api/generate-quote`, `/api/generate-followup`). API key as env var on Vercel. Deploy to same domain.
2. **Weekend 2:** Add Supabase auth + database. Track `quotes_used_this_month` per user. Enforce 5-quote free limit on server.
3. **Weekend 3:** Stripe Checkout + webhook. Free → Pro upgrade flow. First paying customer.
4. **Post-Stripe:** Replace CRM mockups with DB-backed real data (clients, jobs, payments). Build invoice converter. Add PDF export.

## Code Conventions / Notes

- Model name: `claude-sonnet-4-6` (used in both `generateQuote` and `generateFollowup`)
- API call uses `anthropic-dangerous-direct-browser-access: true` header
- `pricingMode` global: `'hourly'` | `'flat'` | `'trucking'` | `'logistics'` | `'painting'` | `'flooring'` | `'roofing'`
- `taxMode` global: `'none'` | `'custom'`
- `selectedTrade` and `selectedFollowupTrade` store the emoji + name string (e.g. "🔧 Plumbing")
- `TRADES` array drives every trade selector across the app
- `TRADE_GUIDANCE` object provides trade-specific AI prompt context
- `TRADE_DESC_EXAMPLES` object provides trade-specific placeholder text
- `MOCK_CLIENTS`, `MOCK_JOBS`, `MOCK_PAYMENTS`, `MOCK_PAYMENT_WEEKS` are top-level constants for easy DB swap later
- localStorage keys: `anthropicKey`, `quoteUsed`, `tdSigName`, `tdSigBusiness`, `tdSigContact`
- CSS uses custom properties (`--ink`, `--accent`, `--line`, `--surface`, `--surface-2`, etc.) — reuse, don't redefine
- Display font: Fraunces. Body font: IBM Plex Sans. Mono: JetBrains Mono.
- Mobile breakpoint: 900px (sidebar becomes drawer below this)

## Open Questions for Next Session

- Did testers confirm $49/month commitment when asked directly?
- Should we deduplicate `TRADE_GUIDANCE` keys before backend migration?
- Time to install Claude Code for VS Code, or stay in claude.ai chat?
- Backend migration: start Weekend 1 immediately, or wait for more tester usage?