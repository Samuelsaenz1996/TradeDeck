# MyTradeDeck — Project Status

Last updated: May 18, 2026 (post Sprint 2-D.7.1)

Save this. Paste into any future Claude conversation to continue.

---

## What This Is

MyTradeDeck is an AI-powered admin tool for contractors and tradespeople. Drafts professional bilingual (English + Spanish) quotes and customer follow-up messages in seconds, with a working CRM layer for clients tied to their quotes, jobs, and follow-ups.

- **Pricing plan:** Free (5 quotes/month, server-enforced) · Pro $49/month · Team $99/month
- **Target:** $10,000–$15,000/month from a small base of paying contractors, or more if possible
- **Stage:** Live at `https://mytradedeck.com`. Server-enforced quota, custom-domain magic-link email, full flat-rate / per-unit pricing flexibility, **persisted quotes + follow-ups + clients with full bidirectional CRM workflow**. 1 confirmed paying tester ($49/mo), 1 actively testing.
- **Goal type:** Side project that generates a lot of income, not full-time business.
- **Long-term:** Wrap in Capacitor for App Store + Google Play distribution.

## Tech Stack (Current)

- **Frontend:** Single `index.html` file — vanilla JS, no framework, no build step
- **AI:** Anthropic API via server-side Edge function proxy at `/api/generate.js`. Model `claude-sonnet-4-6`. SSE streaming preserved.
- **API key:** `ANTHROPIC_API_KEY` env var in Vercel — never in the browser
- **Auth:** Supabase magic-link email auth; session persisted in localStorage
- **Email delivery:** Resend SMTP via verified subdomain `mail.mytradedeck.com`. 30/hr rate limit.
- **Quota enforcement:** Postgres `profiles` table + RLS + two SECURITY DEFINER RPCs. Free tier 5/month cap atomic and server-enforced.
- **Persistence (Sprint 2):** `clients`, `quotes`, `jobs`, `followups` tables in Postgres. Standard RLS pattern (4 policies per table scoped to `auth.uid()`).
- **Supabase project:** `https://cqmctdhxticryelvhhze.supabase.co`
- **Publishable key:** `sb_publishable_YOWddbCqAPdFrg-9otLSzw_akBdoAPh` (RLS gates data)
- **Domain:** `mytradedeck.com` at GoDaddy, A record `216.198.79.1` + CNAME `www`. Subdomain `mail.mytradedeck.com` for Resend.
- **PDF generation:** html2pdf.js (cdnjs)
- **Hosting:** Vercel (auto-deploys from GitHub `main`)
- **Live URLs:** `https://mytradedeck.com` (primary), `https://www.mytradedeck.com` (307 → apex), `https://trade-deck-ten.vercel.app` (fallback)
- **API safety:** $20/month Anthropic Console cap

## What's Built (Functional)

### Backend foundation (Sprints 1A–1E)
- **Server-side Anthropic proxy** (`api/generate.js`)
- **Supabase auth gate** (app hidden until session)
- **Server-enforced quota** via `profiles` table + RPCs (`get_quote_status`, `consume_quote_credit`). Quotes and follow-ups share the 5/month counter.
- **Custom SMTP via Resend** with `mail.mytradedeck.com`
- **Rebrand to MyTradeDeck** (Sprint 1D-0)
- **Custom domain at mytradedeck.com** (Sprint 1E) via DNS records at GoDaddy
- **Sign out** in sidebar Account section

### Quote generator
- 10 trades with emojis
- Multi-trade quotes with per-trade input state via `tradePricingState`
- 7 pricing modes with auto-switching panels

#### Pricing input behavior (Sprint 1.5-A)
- All pricing inputs default to 0. No pre-filled assumptions.
- Optional pricing components left at $0 don't appear in the quote.
- Defensive zero-filter on AI output.

#### Phase-based line items (Sprint 1.5-A.1)
- AI generates 3–5 line items per trade reflecting phases of the work, not 1:1 mapping of pricing components.

#### Flat-rate sub-mode (Sprint 1.5-B)
- Each specialty panel has `[ Per-unit | Flat rate ]` sub-toggle
- Trade-specific unit dropdowns with "Custom..." escape hatch
- `pricingStructure: 'per-unit' | 'flat-rate'` per trade

#### Self-balancing flat-rate math (Sprint 1.5-C)
- `currentQuote.tradePricingTargets[tradeName]` captures `target = flat + material` at generation
- Editing/deleting/adding line items proportionally redistributes
- Clamp at $0; overflow toast in EN/ES
- Zero-amount filter lives in `renderQuote` (preserves user-added $0 lines)

#### Other quote generator features
- Trade-specific placeholders, tax, timeline, configurable deposit %
- Inline editable everything; live recalculation
- Trade-aware AI prompts via `TRADE_GUIDANCE`

### Quotes persistence + list view (Sprints 2-A, 2-B, 2-C)

- **`quotes` table** with denormalized columns (`client_name`, `client_addr`, `total`, `trades`, `status`) + full `payload jsonb` for bilingual content
- **Auto-persist** on quote generation via `persistGeneratedQuote()` (uses captured `client_id` from autocomplete first, then `.ilike` find-or-create fallback)
- **Three-mode navigation** (`list` | `compose` | `view`) with header bar (back button + "+ New Quote")
- **My Quotes list** — search by client name, click row to open in view mode, inline edit autosaves with 1.5s debounce, Delete button with confirm
- **Form auto-clears on + New Quote** (silent — Sprint 2-D.5.1)
- **Full EN/ES translation** of list + status pills (Sprint 2-C.4)

### Clients view + detail screen + manual creation (Sprints 2-D.1 → 2-D.7.1)

- **`clients` table** with `type` (person/company), `contact_name`, `contact_title`, `notes`, `status`, contact info, addr, timestamps. RLS standard 4-policy pattern.
- **Auto-create from quotes** — generating a quote with a new client name auto-creates a `clients` row (status='lead', type='person' default). Case-insensitive matching via `.ilike` prevents duplicates from casing differences ("richard watson" finds "Richard Watson").
- **Real Clients list view** (Sprint 2-D.2) — replaced `MOCK_CLIENTS` entirely. Renders person/company icon, smart contact column (companies show contact_name + email/phone), real job count, real revenue (sum of paid+complete jobs), last-activity timestamp (max across jobs+quotes+followups). Search by name/contact/email/phone. Reset to list on nav re-click.
- **Client detail screen** (Sprint 2-D.3) — editable form with person/company segmented toggle, contact fields conditionally visible, status dropdown, notes. Field edits debounce-save back via UPDATE. Back button flushes pending save. Related quotes + jobs cards (read-only tables, click row → opens source quote in Quotes view).
- **"Follow-ups for this client" card** (Sprint 2-D.4) — third card on detail screen, parallel to quotes/jobs.
- **Client autocomplete via `<datalist>`** (Sprint 2-D.5) — shared lookup powers both the quote form's client name AND the follow-up form's customer name. Captures `selectedClientIdForQuote` / `selectedClientIdForFollowup` on match so persistence uses the id directly. Auto-fills address on quote form. Cache refreshes on auth, after auto-create, after list reload.
- **Launcher buttons in detail cards** (Sprint 2-D.6) — each related-records card has a contextual "+ New X" button in its title row. Buttons:
  - **"+ New Quote for this client"** → switches to Quotes compose mode with name + address pre-filled, `selectedClientIdForQuote` set to client's id. Smart format for companies: `Patel Construction LLC (Attn: Raj Patel)`.
  - **"+ New Follow-up for this client"** → switches to Follow-ups compose, pre-fills customer name, sets `selectedClientIdForFollowup`. Bonus: pre-fills amount from most recent quote's total.
  - **"+ New Job for this client"** → placeholder toast until Sprint 2-E (real Jobs view).
- **Manual "+ New Client" form** (Sprint 2-D.7) — replaces placeholder toast on Clients list header button. Opens detail screen in "new mode" with blank form via `isCreatingNewClient` flag. First non-trivial edit (name non-empty + 1.5s debounce) triggers INSERT; returned id becomes `activeClientId` and subsequent edits flow through UPDATE autosave path. Refreshes lookup cache on insert success. Toasts "Client created."
- **Explicit Save button on client form** (Sprint 2-D.7.1) — `💾 Save` button at bottom of form card. Validates name non-empty (toasts error + focuses field if empty). Cancels pending debounce, immediately calls `saveClientEdits()`. Toasts "Client saved" for existing-client updates (existing "Client created" toast still fires for new inserts). Autosave remains as silent safety net.

### Follow-ups persistence + list + client tie (Sprint 2-D.4)

- **`followups` table** with `client_id` FK (nullable, set null on delete), `quote_id` FK (nullable, set null), denormalized `customer_name`, `channel` ('email'/'text'), `scenario`, full `payload jsonb`. Indexes on user_id, (user_id, created_at desc), client_id, quote_id. Standard 4-policy RLS.
- **Auto-persist** on generation via `persistGeneratedFollowup()` (mirrors quote pattern: captured id first, then `.ilike` name fallback)
- **Three-mode navigation** like Quotes: `list` | `compose` | `view`. Header bar with back + "+ New Follow-up". Empty state with 💬 icon.
- **My Follow-ups list** — search by customer name, 5 columns (customer/scenario/channel/date/delete), click row to re-open in view mode, inline edits autosave, delete with confirm.
- **Form auto-clears on + New Follow-up** (Sprint 2-D.5.1) — customer name, job ref, amount cleared; pill selections (trade, scenario, tone, channel) preserved as settings-like.
- **Full EN/ES translation** of list

### Bilingual EN / ES support
- UI language toggle (full `I18N` dictionary with `data-i18n` attributes)
- Quote output language toggle (English / Spanish / Both)
- AI generates bilingual `{en, es}` slot pairs
- Per-language blur capture so neither overwrites the other
- Quote document labels lock to content language
- Banner when UI lang doesn't have content
- Spanish vocab tuned for US/Mexican contractor usage

### PDF export
- `generateQuotePdfBlob()` — single source, html2canvas opts deliberately minimal
- CSS uses `page-break-inside: avoid`
- Filename built from quote ID + client name

### Streaming responses
- SSE streaming via `/api/generate`
- `streamCompletion()` parses `content_block_delta` events
- Progress bar capped at 90% until completion

### Mobile navigation
- Hamburger menu, slide-in drawer, backdrop tap / ESC close, body scroll lock, ARIA, iOS auto-zoom prevented

### CRM mockups (REMAINING — Jobs + Payments only)
- ~~**Clients:** replaced with real data (Sprint 2-D.2)~~ ✅
- **Jobs:** 15 fake jobs in `MOCK_JOBS` — Sprint 2-E target
- **Payments:** 12 fake invoices + 8 weeks of fake cash receipts — future sprint

### UI / UX
- Sidebar nav grouped into Workspace and Account
- Free plan usage indicator reads from server profile
- Brand mark "M" + wordmark `My<em>TradeDeck</em>`
- Sticky topbar, toast notifications
- Custom design system: Fraunces + IBM Plex Sans + JetBrains Mono

## What's NOT Built (Roadmap)

| Feature | Priority | Notes |
|---|---|---|
| Delete Client button | Low-Medium | Sprint 2-D.8 — small polish, gives users a way to clean up junk rows. Jobs/quotes/follow-ups survive (FKs `on delete set null`). |
| Real Jobs view | **High (next)** | Sprint 2-E — replace MOCK_JOBS, status filter tabs, inline status pill cycling, click row → opens source quote, "+ New Job" launcher becomes functional |
| Real Payments view | Medium | Future sprint — replace MOCK_PAYMENTS |
| Retire dev bypass button | Low | Sprint 1F — drafted and parked. Samuel keeping for now. |
| Open Graph meta tags | Medium | Sprint 1G — drafted and parked |
| Stripe billing | High | Sprint 3 — Checkout + webhook to update `profiles.plan`. Plan gating already wired in `consume_quote_credit`. |
| Custom-branded Supabase email templates | Medium | Polish item |
| Capacitor wrap (iOS + Android) | Medium | Sprint 4+ — reader-app pattern |
| Convert-to-invoice | Medium | Placeholder button |
| Switch to Haiku option | Low | Faster/cheaper alternative |

## Key Decisions Made (additions from Sprint 2)

- **Single JSON payload column on quotes/followups** over normalized tables — faster to ship, fully bilingual content survives schema migrations, edits are still queryable via the denormalized columns. Normalize later if/when CRM queries need it.
- **Denormalized columns for list views** (client_name, total, status on quotes; customer_name, channel, scenario on followups) — keeps the My X list views fast without needing JOINs, and lets list view work even if a client is deleted (FKs use `set null`).
- **Client_id captured at form-fill time, not save time** (Sprint 2-D.5) — `selectedClientIdForQuote` / `selectedClientIdForFollowup` set when user picks from datalist, used directly in persist. Falls back to `.ilike` lookup for free-text names. Case-insensitive prevents casing-based duplicates.
- **Three-mode UI pattern** (`list` | `compose` | `view`) for both Quotes and Follow-ups, with header bar that swaps Back button for "+ New" — consistent navigation pattern.
- **Form auto-clear on "+ New X"** (Sprint 2-D.5.1) — entering compose mode silently clears form + resets `selectedClientId*`. Pill selections preserved on follow-up as settings-like. Quote form clears everything via existing `clearForm(true)` path.
- **Person/Company segmented toggle** for client type — swaps which fields show (contact_name + contact_title visible only for company). Name field label changes ("Name" → "Company name").
- **Smart name format on launchers** — companies with contact render as `Company (Attn: Person)` in the launched quote/follow-up's customer-facing string. Saved canonical client row keeps the company name + contact separate.
- **Manual + New Client form reuses detail screen** (Sprint 2-D.7) — `isCreatingNewClient` flag flips behavior of `saveClientEdits` from UPDATE to INSERT. First successful save flips the flag back and captures the new id. Empty name + back = no junk row.
- **Explicit Save button + autosave coexist** (Sprint 2-D.7.1) — autosave for users who forget, Save button for users who want confirmation. Update path toasts via Save button only (autosave silent on updates); insert path toasts via either path.

## Active Testers

- [Tester 1 name] — confirmed $49/month commitment ✓
- [Tester 2 name] — actively testing flat-rate flow as of May 18

## Open Issues / Known Quirks

- **Dev bypass button still on the login screen** — Sprint 1F prompt drafted and parked
- **No Open Graph tags** — Sprint 1G drafted and parked
- **Supabase email templates are still defaults**, not custom-branded
- **Status pill CSS classes for `accepted`/`declined`/`invoiced` not defined** — render plain. Polish item.
- **Scenario column in followups stores English string** ("No reply yet"); Spanish UI shows it verbatim in list. Polish item.
- **Datalist UX on iOS Safari** requires typing 1+ char (other browsers show on focus). Could swap for custom dropdown in a polish sprint if needed.
- **No Delete Client button yet** — junk rows can't be removed via UI. Sprint 2-D.8 fix.
- **Address auto-fill on client pick replaces unconditionally** if matched client has addr (intentional, but can overwrite custom job-site addresses).
- Corporate networks (SEMA Zscaler) intercept link previews on `mytradedeck.com` — not fixable from our side
- Quote generation ~30–60s on Sonnet 4.6
- Convert-to-invoice button still a placeholder

## Architectural Path Forward

- ✅ **Sprints 1A → 1.5-C** (DONE): backend, auth, quota, rebrand, custom domain, pricing flexibility, self-balancing flat-rate math
- ✅ **Sprint 2-A** (DONE): Schema migration for `clients`, `quotes`, `jobs` tables with RLS
- ✅ **Sprint 2-B** (DONE): Auto-persist quotes on generation with `client_id` linkage
- ✅ **Sprint 2-C series** (DONE): My Quotes list view with click/edit/delete, three-mode navigation, full EN/ES
- ✅ **Sprint 2-D.1** (DONE): Schema migration for client type/contact/notes
- ✅ **Sprint 2-D.2** (DONE): Real Clients list view
- ✅ **Sprint 2-D.3** (DONE): Client detail screen with editable form, person/company toggle, related quotes/jobs
- ✅ **Sprint 2-D.4** (DONE): Follow-ups table + persistence + My Follow-ups list + "Follow-ups for this client" card on detail screen
- ✅ **Sprint 2-D.5** (DONE): Client autocomplete via datalist for quote + follow-up forms
- ✅ **Sprint 2-D.5.1** (DONE): Form auto-clears on "+ New X" (no popup)
- ✅ **Sprint 2-D.6** (DONE): Launcher buttons on client detail (New Quote / New Follow-up / placeholder New Job)
- ✅ **Sprint 2-D.7** (DONE): Manual + New Client form via detail screen "new mode"
- ✅ **Sprint 2-D.7.1** (DONE): Explicit Save button on client form
- ⏳ **Sprint 2-D.8** (optional polish): Delete Client button
- ⏳ **Sprint 2-E** (next big): Real Jobs view — replace MOCK_JOBS, status filter tabs, inline pill cycling, click → opens source quote, "+ New Job" launcher functional
- ⏳ **Sprint 1F** (parked): Retire dev bypass
- ⏳ **Sprint 1G** (parked): Open Graph meta tags
- ⏳ **Sprint 3**: Stripe Checkout + webhook
- ⏳ **Sprint 4+**: Capacitor wrap

## Code Conventions / Notes

### Globals (updated)
- `sb` = `window.supabase.createClient(...)`
- `pricingMode`, `taxMode`, `tdLang`, `quoteLanguages` — established
- `selectedTrades`, `activeTradeIndex`, `tradePricingState` — multi-trade state
- `currentQuote` / `currentFollowup` — bilingual in-memory payload
- `currentQuote.tradePricingTargets` — per-trade flat-rate target map
- `depositPercent`, `quoteUsed` (bypass-only)

### Quotes/Clients/Follow-ups state (Sprint 2 additions)
- `quotesSubView` (`'list'|'compose'|'view'`), `savedQuotesCache`, `quotesSaveTimer`
- `clientsSubView` (`'list'|'detail'`), `clientsCache`, `activeClientId`, `activeClientData`
- `clientDetailQuotesCache`, `clientDetailJobsCache`, `clientDetailFollowupsCache`
- `clientsSaveTimer`, `isCreatingNewClient`
- `clientsLookupCache`, `selectedClientIdForQuote`, `selectedClientIdForFollowup`
- `followupsSubView` (`'list'|'compose'|'view'`), `savedFollowupsCache`, `followupsSaveTimer`

### Helpers (Sprint 2 additions)
- **Quote persistence:** `persistGeneratedQuote`, `loadSavedQuotes`, `renderQuotesList`, `openSavedQuote`, `deleteSavedQuote`, `scheduleQuoteSave`, `saveCurrentQuoteEdits`, `switchQuotesSubView`, `enterComposeMode`
- **Followup persistence:** `persistGeneratedFollowup`, `loadSavedFollowups`, `renderFollowupsList`, `openSavedFollowup`, `deleteSavedFollowup`, `scheduleFollowupSave`, `saveCurrentFollowupEdits`, `switchFollowupsSubView`, `enterFollowupComposeMode`
- **Client management:** `loadClients`, `renderClientsList`, `switchClientsSubView`, `openClientDetail`, `renderClientDetail`, `applyClientType`, `scheduleClientSave`, `saveClientEdits` (returns saved row | null), `clickClientDetailSave`, `enterNewClientMode`, `renderClientDetailQuotes`, `renderClientDetailJobs`, `renderClientDetailFollowups`, `jobStatusLabel`
- **Client lookup:** `refreshClientsLookupCache`, `renderClientsDatalist`, `findClientByName`, `bindClientLookupForQuote`, `bindClientLookupForFollowup`
- **Launchers:** `clientDisplayNameForForm`, `launchNewQuoteForActiveClient`, `launchNewFollowupForActiveClient`, `launchNewJobForActiveClient` (placeholder)
- **Helpers:** `capitalizeFirst`, `escapeHtml`, `formatRelativeDate`
- `clearForm(silent)` — silent param skips confirm popup; called as `clearForm(true)` from `enterComposeMode`

### Tables (Sprint 2 schemas)

**clients** — id, user_id (FK cascade), name, addr, email, phone, status check('lead','active','past') default 'lead', type check('person','company') default 'person', contact_name, contact_title, notes, timestamps. Indexes on user_id, (user_id, created_at desc). RLS standard 4 policies.

**quotes** — id, user_id (FK cascade), client_id (FK set null), client_name, client_addr, total numeric(12,2), trades text[], status check('draft','sent','accepted','declined','invoiced') default 'draft', payload jsonb, timestamps. Indexes on user_id, (user_id, created_at desc), client_id. RLS 4 policies.

**jobs** — id, user_id (FK cascade), client_id (FK set null), quote_id (FK set null), description, trade, amount numeric(12,2), status check('quoted','in_progress','complete','paid') default 'quoted', timestamps. Indexes on user_id, (user_id, created_at desc), client_id, quote_id, (user_id, status). RLS 4 policies.

**followups** — id, user_id (FK cascade), client_id (FK set null), quote_id (FK set null), customer_name, channel check('email','text') default 'email', scenario, payload jsonb, timestamps. Indexes on user_id, (user_id, created_at desc), client_id, quote_id. RLS 4 policies. Uses shared `set_updated_at` trigger.

**profiles** (Sprint 1C) — RPC-only, RLS no policies, `get_quote_status` + `consume_quote_credit` SECURITY DEFINER.

### CSS additions (Sprint 2)
- `.view-header`, `.view-header-spacer`, `.btn-ghost`
- `.card-title.with-action`, `.card-title-action` — for launcher buttons in card titles
- `.pricing-toggle` (reused) for person/company segmented toggle

### PDF pipeline gotcha
- `generateQuotePdfBlob()` single source. html2canvas opts: `{scale: 2, useCORS: true, logging: false, backgroundColor: '#FFFFFF'}`. Do NOT add `windowWidth`, `x`, `y`, `scrollX`, or `scrollY`.

### Line-item filter location (Sprint 1.5-C)
- Lives in `renderQuote`, not `renderLineItemsTable`. Preserves user-added `+ Add line item` rows at $0.

### Tooling note
- Claude Code on Windows host has `awk` (Git Bash) but no `node` binary

## Workflow Preferences

- Small incremental steps over big-bang changes
- Prompts wrapped in fenced code blocks for Claude Code in VS Code
- **4-section prompt format:** Manual setup → Changes → Self-tests → Test plan
- Self-tests baked in: report "X/X passed" before deploy
- Explicit negative constraints ("do NOT do X")
- Push to Vercel preview, verify visually, then merge to main
- For multi-phase manual procedures: one phase at a time, wait for "phase N done"
- Windows host (`c:\ST\GitHub\TradeDeck\TradeDeck\index.html`)

## Open Questions for Next Session

- **Sprint 2-D.8 (Delete Client) — do it or skip to Sprint 2-E?** Small polish (~10 min), useful for cleanup. Skip if you want to push to Jobs faster.
- **Sprint 2-E approach** — single big sprint replacing MOCK_JOBS, status filter tabs, inline pill cycling, click → opens source quote, "+ New Job" launcher functional? OR split into 2-E.1 (list view), 2-E.2 (detail/status), 2-E.3 (launcher) for safer testing?
- **Sprint 3 Stripe** — confirm hosted Stripe Checkout over custom-built
- **Capacitor timing** — wait until Sprint 3 is done, or start in parallel?
- **Custom Supabase email templates** — polish them now, or later?
- **OG meta tags (Sprint 1G)** — small win, ~5 min. Worth knocking out before more sharing happens?