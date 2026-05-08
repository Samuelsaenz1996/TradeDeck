# TradeDeck — Project Status

*Updated: [today's date]. Save this. Paste into any future Claude conversation to continue.*

---

## What This Is

TradeDeck is an AI-powered admin tool for contractors and tradespeople.
- **Pricing plan:** Free (5 quotes/mo) · Pro $49/mo · Team $99/mo
- **Target:** $2,000–$5,000/month from 30–50 contractors
- **Stage:** Live MVP with active testers (as of [date])

## Tech Stack (Current)

- **Frontend:** Single HTML file (`index.html`) — vanilla JS, no framework
- **AI:** Anthropic API, model `claude-sonnet-4-6`, called direct from browser with `anthropic-dangerous-direct-browser-access: true` header
- **Hosting:** Vercel (auto-deploys from GitHub main branch)
- **Live URL:** [paste your trade-deck-ten.vercel.app URL here]
- **Repo:** [paste your github.com/yourusername/tradedeck URL here]
- **Editor:** VS Code, Git via GitHub Desktop
- **API safety:** $20/month spending cap set in Anthropic Console

## What's Built

### Quote generator
- 10 trades with emojis: Plumbing, Electrical, HVAC, Roofing, General, Painting, Flooring, Landscaping, Hauling & Trucking, Logistics
- 5 pricing modes: hourly, flat, trucking (per load/yard/etc.), logistics (per pallet/cwt/etc.)
- Hauling and Logistics have custom panels with live subtotal preview
- Tax: optional with custom rate and label
- Timeline: Standard / Priority / Emergency
- AI generates: scope, 4 line items, payment terms, warranty
- Output JSON-parsed and rendered as editable quote

### Inline editing
- Every field on the rendered quote is contenteditable
- Line items: add, edit, delete with × on hover
- Totals auto-recalculate
- Notes section for client-facing additions

### Quote actions
- Copy as text (works)
- Download PDF (placeholder — uses print dialog)
- Convert to invoice (placeholder)

### UI
- Sidebar nav (Quotes active, Follow-ups, Invoices, Profile, Settings)
- Free plan usage indicator (5 quotes counter, localStorage)
- Upgrade button (placeholder, no Stripe yet)
- API key banner at top, key saved to localStorage

## What's NOT Built (Roadmap)

| Feature | Priority | Notes |
|---|---|---|
| Trade-aware AI prompts | High | Prompt drafted, not yet implemented |
| Painting/Flooring/Roofing pricing panels | Medium | Prompt drafted, not yet implemented |
| Follow-ups screen | Medium | 6 scenarios defined, not yet built |
| Invoice generator | High | Convert quote → invoice |
| PWA setup (manifest, service worker, icons) | Medium | "Add to home screen" support |
| Stripe billing | High | Required before charging |
| Auth (Supabase) | High | Required before backend metering |
| Backend (Next.js + Vercel API route) | High | Required before scaling beyond trusted testers |
| PDF export (real, not browser print) | Low | Could use jsPDF or server-side |
| Email/SMS direct send | Low | Currently copy-paste only |

## Key Decisions Made

- Mobile-first PWA over native — faster to ship
- Single HTML file for MVP — no build step, easy to iterate with Claude
- Browser-direct API calls for now — knowingly insecure for paying users, fine for trusted testers
- $20/month spending cap on Anthropic Console — protects against worst case
- Each tester paste their own / shared key in browser — no auth yet
- Trucking and Logistics get their own pricing panels (different billing models)
- All other trades use generic hourly/flat (will get smarter via prompt updates, not new UI)

## Active Testers

- [Tester 1 name] — [their trade, e.g. "logistics company owner"]
- [Tester 2 name] — [their trade]
- Status: [e.g. "received URL [date], no feedback yet" or "found 3 issues, see open issues below"]

## Open Issues / Known Quirks

- Quote generation takes ~60 seconds (Sonnet 4.6 is thorough but slow). Streaming + Haiku swap planned.
- 5-quote free limit lives in localStorage, easily bypassed (acceptable for trusted testers)
- API key visible in browser devtools (acceptable for trusted testers)
- No way to save or revisit past quotes (no backend)
- Convert-to-invoice and PDF download buttons are placeholders

## Architectural Path Forward

When ready to charge customers (after validation):

1. **Weekend 1:** Convert single HTML → Next.js project. Move Anthropic API call to server route (`/api/generate-quote`). Deploy to Vercel.
2. **Weekend 2:** Add Supabase auth + database. Track quotes_used per user. Enforce 5-quote free limit on server.
3. **Weekend 3:** Stripe Checkout + webhook. Free → Pro upgrade flow.

Don't start this work until at least one tester says "I'd pay for this."

## Code Conventions / Notes

- Model name: `claude-sonnet-4-6` (changed from older deprecated names)
- API call uses `anthropic-dangerous-direct-browser-access: true` header
- `pricingMode` global: `'hourly'` | `'flat'` | `'trucking'` | `'logistics'` (and 'painting'/'flooring'/'roofing' once those are built)
- `taxMode` global: `'none'` | `'custom'`
- `selectedTrade` stores the emoji + name string (e.g. "🔧 Plumbing")
- `recalcTotals()` reads all `.amt-cell` contenteditable values
- `addLineItemRow()` creates editable rows dynamically
- CSS uses custom properties (--ink, --accent, --line, etc.) — reuse, don't redefine
- Display font: Fraunces. Body font: IBM Plex Sans.

## Open Questions for Next Session

- Did testers' feedback validate the product? What did they say?
- Should we build the trade-aware prompts next, or another tester request?
- Time to install Claude Code for VS Code, or stay in claude.ai chat?