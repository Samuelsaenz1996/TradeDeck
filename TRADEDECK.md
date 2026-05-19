# MyTradeDeck — Project Status

Last updated: May 19, 2026 (post Sprint 2-E.2)

Save this. Paste into any future Claude conversation to continue.

---

## What This Is

MyTradeDeck is an AI-powered admin tool for contractors and tradespeople. Drafts professional bilingual (English + Spanish) quotes and customer follow-up messages in seconds, with a working CRM layer where jobs are the central work-tracking entity — clients, quotes, and follow-ups can hang off a job, or hang directly off a client without a job.

- Pricing plan: Free (5 quotes/month, server-enforced) · Pro $49/month · Team $99/month
- Target: $10,000–$15,000/month from a small base of paying contractors, or more if possible
- Stage: Live at https://mytradedeck.com. Server-enforced quota, custom-domain magic-link email, full flat-rate / per-unit pricing flexibility, persisted quotes + follow-ups + clients + first-class jobs with bidirectional CRM workflow. 1 confirmed paying tester ($49/mo), 1 actively testing.
- Goal type: Side project that generates a lot of income, not full-time business.
- Long-term: Wrap in Capacitor for App Store + Google Play distribution.

## Tech Stack (Current)

- Frontend: Single index.html file — vanilla JS, no framework, no build step
- AI: Anthropic API via server-side Edge function proxy at /api/generate.js. Model claude-sonnet-4-6. SSE streaming preserved.
- API key: ANTHROPIC_API_KEY env var in Vercel — never in the browser
- Auth: Supabase magic-link email auth; session persisted in localStorage
- Email delivery: Resend SMTP via verified subdomain mail.mytradedeck.com. 30/hr rate limit.
- Quota enforcement: Postgres profiles table + RLS + two SECURITY DEFINER RPCs. Free tier 5/month cap atomic and server-enforced.
- Persistence: clients, quotes, jobs, followups tables in Postgres. Standard RLS pattern (4 policies per table scoped to auth.uid()). Cross-entity FKs all use ON DELETE SET NULL.
- Supabase project: https://cqmctdhxticryelvhhze.supabase.co
- Publishable key: sb_publishable_YOWddbCqAPdFrg-9otLSzw_akBdoAPh (RLS gates data)
- Domain: mytradedeck.com at GoDaddy, A record 216.198.79.1 + CNAME www. Subdomain mail.mytradedeck.com for Resend.
- PDF generation: html2pdf.js (cdnjs)
- Hosting: Vercel (auto-deploys from GitHub main)
- Live URLs: https://mytradedeck.com (primary), https://www.mytradedeck.com (307 → apex), https://trade-deck-ten.vercel.app (fallback)
- API safety: $20/month Anthropic Console cap

## Data Model (Current)

clients (top-level: people and companies)
  - jobs (optional work container; created on demand, not auto)
      - quotes (a job can have multiple quotes — re-quotes, change orders)
      - followups (messages about the work)
  - quotes (can stand alone, no job needed — speculative quotes)
  - followups (can stand alone — relationship messages, no job needed)

- A quote is a proposal. Can be standalone (tied to client only) OR linked to a job via quote.job_id.
- A job is a container for tracked work. Optional. User explicitly promotes a quote to a job via the "Create job" button on the quote view, or creates one manually (future sprint).
- A follow-up can be tied to a client, a quote, a job, or any combination.
- Jobs are NOT auto-created when a quote is generated — that auto-create behavior was removed in Sprint 2-E.2.

## What's Built (Functional)

### Backend foundation (Sprints 1A–1E)
- Server-side Anthropic proxy (api/generate.js)
- Supabase auth gate (app hidden until session)
- Server-enforced quota via profiles table + RPCs (get_quote_status, consume_quote_credit). Quotes and follow-ups share the 5/month counter.
- Custom SMTP via Resend with mail.mytradedeck.com
- Rebrand to MyTradeDeck (Sprint 1D-0)
- Custom domain at mytradedeck.com (Sprint 1E) via DNS records at GoDaddy
- Sign out in sidebar Account section
- Open Graph + Twitter meta tags (Sprint 1G — shipped, doc previously had it as parked)

### Quote generator
- 10 trades with emojis
- Multi-trade quotes with per-trade input state via tradePricingState
- 7 pricing modes with auto-switching panels

#### Pricing input behavior (Sprint 1.5-A)
- All pricing inputs default to 0. No pre-filled assumptions.
- Optional pricing components left at $0 don't appear in the quote.
- Defensive zero-filter on AI output.

#### Phase-based line items (Sprint 1.5-A.1)
- AI generates 3–5 line items per trade reflecting phases of the work, not 1:1 mapping of pricing components.

#### Flat-rate sub-mode (Sprint 1.5-B)
- Each specialty panel has [ Per-unit | Flat rate ] sub-toggle
- Trade-specific unit dropdowns with "Custom..." escape hatch
- pricingStructure: 'per-unit' | 'flat-rate' per trade

#### Self-balancing flat-rate math (Sprint 1.5-C)
- currentQuote.tradePricingTargets[tradeName] captures target = flat + material at generation
- Editing/deleting/adding line items proportionally redistributes
- Clamp at $0; overflow toast in EN/ES
- Zero-amount filter lives in renderQuote (preserves user-added $0 lines)

#### Other quote generator features
- Trade-specific placeholders, tax, timeline, configurable deposit %
- Inline editable everything; live recalculation
- Trade-aware AI prompts via TRADE_GUIDANCE

### Quotes persistence + list view (Sprints 2-A, 2-B, 2-C)

- quotes table with denormalized columns (client_name, client_addr, total, trades, status) + full payload jsonb for bilingual content. job_id FK added in 2-E.2 (nullable, ON DELETE SET NULL).
- Auto-persist on quote generation via persistGeneratedQuote() (uses captured client_id from autocomplete first, then .ilike find-or-create fallback). No longer auto-creates a job (removed in 2-E.2).
- Three-mode navigation (list | compose | view) with header bar (back button + "+ New Quote")
- My Quotes list — search by client name, click row to open in view mode, inline edit autosaves with 1.5s debounce, Delete button with confirm
- Form auto-clears on + New Quote (silent — Sprint 2-D.5.1)
- Full EN/ES translation of list + status pills (Sprint 2-C.4)
- "Create job from this quote" button on actions bar (Sprint 2-E.2) — visible when quote has no job_id, hidden when linked. Click inserts a job tied to the quote's client + total, sets quote.job_id, navigates to job detail.

### Clients view + detail screen + manual creation (Sprints 2-D.1 → 2-D.7.1)

- clients table with type (person/company), contact_name, contact_title, notes, status, contact info, addr, timestamps. RLS standard 4-policy pattern.
- Auto-create from quotes — generating a quote with a new client name auto-creates a clients row (status='lead', type='person' default). Case-insensitive matching via .ilike prevents duplicates from casing differences.
- Real Clients list view (Sprint 2-D.2) — replaced MOCK_CLIENTS entirely. Renders person/company icon, smart contact column, real job count, real revenue (sum of paid+complete jobs), last-activity timestamp. Search by name/contact/email/phone.
- Client detail screen (Sprint 2-D.3) — editable form with person/company segmented toggle, contact fields conditionally visible, status dropdown, notes. Debounce autosave. Related quotes + jobs cards (click row → opens source quote in Quotes view).
- "Follow-ups for this client" card (Sprint 2-D.4)
- Client autocomplete via <datalist> (Sprint 2-D.5) — shared lookup powers both the quote form's client name AND the follow-up form's customer name. Auto-fills address on quote form.
- Launcher buttons in detail cards (Sprint 2-D.6) — "+ New Quote / + New Follow-up / + New Job for this client". New Job is still a placeholder toast pending Sprint 2-E.4.
- Manual "+ New Client" form (Sprint 2-D.7) — opens detail screen in "new mode" with blank form via isCreatingNewClient flag. First non-trivial edit triggers INSERT.
- Explicit Save button on client form (Sprint 2-D.7.1) — 💾 Save button at bottom. Autosave remains as silent safety net.

### Follow-ups persistence + list + client tie (Sprint 2-D.4)

- followups table with client_id FK, quote_id FK, denormalized customer_name, channel, scenario, full payload jsonb. job_id FK added in 2-E.2 (nullable, ON DELETE SET NULL).
- Auto-persist on generation via persistGeneratedFollowup(). (Does NOT yet auto-link to a job even when the quote has one — deferred polish.)
- Three-mode navigation like Quotes
- My Follow-ups list — search by customer name, click row, inline edits autosave, delete with confirm.
- Form auto-clears on + New Follow-up (Sprint 2-D.5.1)
- Full EN/ES translation

### Jobs as first-class entities (Sprints 2-E.1, 2-E.2)

- jobs table updated in 2-E.2 with a notes column. Existing schema preserved (id, user_id, client_id, quote_id, description, trade, amount, status, timestamps).
- Real Jobs list view (Sprint 2-E.1) — replaced MOCK_JOBS entirely. Four stat cards compute from real data (Open quotes, In progress, Awaiting payment, Completed this month — the last filtered by updated_at >= start of current month). Five filter tabs (All / Quoted / In Progress / Complete / Paid) work client-side without re-fetching. Empty states: one for "no jobs yet," one for "no jobs match this filter."
- Job detail screen (Sprint 2-E.2) — three-mode pattern (list | detail) with view-header bar. Editable form (description, trade, amount, status, notes) with debounce autosave + explicit Save button. Three related-records cards underneath: linked client (click → client detail), quotes attached to this job (filtered by quote.job_id, click → quote view), follow-ups attached to this job (filtered by followup.job_id, click → follow-up view). All cross-view navigation flushes any pending autosave first.
- No more auto-create jobs on quote generation (Sprint 2-E.2) — the auto-job-creation block in persistGeneratedQuote was deleted. Jobs are explicitly created via the new "Create job from this quote" button on the quote view, or (future) the manual "+ New Job" launcher.
- "Create job from this quote" flow (Sprint 2-E.2) — current behavior is auto-commit on button click (INSERT happens, job opens in detail screen). Sprint 2-E.3 will switch this to explicit-Save-required: detail opens in new mode with pre-filled fields, Save commits the INSERT + the quote.job_id link. Button hidden when quote has a job_id.
- Click job row → opens job detail (replaced 2-E.1's click-to-source-quote behavior). Source quote is one click deeper, on the job detail's quotes card.

### Bilingual EN / ES support
- UI language toggle (full I18N dictionary with data-i18n attributes)
- Quote output language toggle (English / Spanish / Both)
- AI generates bilingual {en, es} slot pairs
- Per-language blur capture so neither overwrites the other
- Quote document labels lock to content language
- Banner when UI lang doesn't have content
- Spanish vocab tuned for US/Mexican contractor usage
- Job detail screen + all 23 new job-related i18n keys (2-E.2)

### PDF export
- generateQuotePdfBlob() — single source, html2canvas opts deliberately minimal
- CSS uses page-break-inside: avoid
- Filename built from quote ID + client name

### Streaming responses
- SSE streaming via /api/generate
- streamCompletion() parses content_block_delta events
- Progress bar capped at 90% until completion

### Mobile navigation
- Hamburger menu, slide-in drawer, backdrop tap / ESC close, body scroll lock, ARIA, iOS auto-zoom prevented

### CRM mockups (REMAINING — Payments only)
- Clients: replaced with real data (Sprint 2-D.2) ✅
- Jobs: replaced with real data (Sprint 2-E.1, 2-E.2) ✅
- Payments: 12 fake invoices + 8 weeks of fake cash receipts — future sprint

### UI / UX
- Sidebar nav grouped into Workspace and Account
- Free plan usage indicator reads from server profile
- Brand mark "M" + wordmark My<em>TradeDeck</em>
- Sticky topbar, toast notifications
- Custom design system: Fraunces + IBM Plex Sans + JetBrains Mono
- "Preview" badges remain only on Payments nav (removed from Jobs and Clients in 2-E.1)

## What's NOT Built (Roadmap)

| Feature | Priority | Notes |
|---|---|---|
| Delete buttons (jobs + clients, list + detail) | High (next) | Sprint 2-E.3 — bundles old 2-D.8 Delete Client polish. All FKs already ON DELETE SET NULL, so deletes don't orphan dependents. |
| Explicit-Save fix for Create-job-from-quote | High (next) | Sprint 2-E.3 — currently auto-commits on click. Switch to detail-opens-in-new-mode, Save commits INSERT + quote.job_id link. |
| Manual "+ New Job" launchers | High | Sprint 2-E.4 — header button + the client detail "+ New Job for this client" placeholder become functional. Detail-in-new-mode pattern, requires client selection. |
| Inline status pill cycling on jobs list | Medium | Sprint 2-E.5 — click pill on row cycles forward (quoted → in_progress → complete → paid), DB update + re-render stats. |
| Archive system (clients, quotes, jobs, follow-ups) | Medium-High | Sprint 2-F — archived_at TIMESTAMP NULL column on all four tables. Default queries filter archived_at IS NULL. Toggle on each list view shows archived. Archive/Unarchive button on each detail screen. |
| Auto-link follow-up to job when quote has one | Low-Medium | Polish — derive followup.job_id from quote.job_id at insert time in persistGeneratedFollowup. |
| Real Payments view | Medium | Future sprint — replace MOCK_PAYMENTS |
| Retire dev bypass button | Low | Sprint 1F — drafted and parked. Samuel keeping for now. |
| Stripe billing | High | Sprint 3 — Checkout + webhook to update profiles.plan. Plan gating already wired in consume_quote_credit. |
| Custom-branded Supabase email templates | Medium | Polish item |
| Capacitor wrap (iOS + Android) | Medium | Sprint 4+ — reader-app pattern |
| Convert-to-invoice | Medium | Placeholder button |
| Switch to Haiku option | Low | Faster/cheaper alternative |

## Key Decisions Made

### Sprint 2 foundations
- Single JSON payload column on quotes/followups over normalized tables — faster to ship, bilingual content survives schema migrations, edits queryable via denormalized columns.
- Denormalized columns for list views (client_name, total, status on quotes; customer_name, channel, scenario on followups) — fast list rendering without JOINs, works even if a client is deleted (FKs use set null).
- Client_id captured at form-fill time, not save time — selectedClientIdForQuote / selectedClientIdForFollowup set when user picks from datalist. Falls back to .ilike lookup for free-text names.
- Three-mode UI pattern (list | compose | view) for Quotes and Follow-ups; (list | detail) for Clients and Jobs. Consistent navigation pattern with view-header bar that swaps Back for "+ New".
- Form auto-clear on "+ New X" (Sprint 2-D.5.1) — entering compose mode silently clears form + resets selectedClientId*.
- Person/Company segmented toggle for client type — swaps which fields show. Smart name format on launchers: companies render as Company (Attn: Person) in the launched quote/follow-up's customer-facing string.
- Manual + New Client form reuses detail screen (Sprint 2-D.7) — isCreatingNewClient flag flips behavior of saveClientEdits from UPDATE to INSERT.
- Explicit Save button + autosave coexist (Sprint 2-D.7.1) — autosave for users who forget, Save button for confirmation. Update path toasts via Save button only; insert path toasts via either.

### Sprint 2-E architectural pivot (jobs as first-class)
- Jobs are the central work-tracking entity, optional — created on demand, not auto. A quote can exist without a job; a job can have multiple quotes (re-quotes, change orders) and multiple follow-ups; a follow-up can attach to a client/quote/job.
- Schema additions (2-E.2 migration): quotes.job_id, followups.job_id, jobs.notes. All FKs ON DELETE SET NULL. Backfill: every existing job's quote_id was used to populate quotes.job_id retroactively, and follow-ups inherited job_id through the quote chain.
- Auto-create dropped from quote generation — the auto-job-insert block in persistGeneratedQuote was deleted. Quotes are speculative by default now.
- "Create job from this quote" is the manual promotion path. Default behavior to be changed in Sprint 2-E.3: instead of auto-commit on click, open detail in new mode with pre-filled values from the quote, require explicit Save to commit the INSERT and the quote.job_id link.
- Hide-not-relabel pattern for the Create Job button — when a quote already has a job_id, the button is hidden entirely (not switched to "View job"). Users find the linked job via Jobs list or via the quotes card on the job detail.
- Job amount stored independently — defaults from the originating quote's total at create time, but editable. Job amount ≠ latest quote amount, because money on a job is the agreed price, not the draft price.
- Archive will be timestamp-based (planned for 2-F, not status-based) — archived_at TIMESTAMP NULL is orthogonal to business status. A "paid" job can also be "archived" without enum conflicts.

## Active Testers

- [Tester 1 name] — confirmed $49/month commitment ✓
- [Tester 2 name] — actively testing flat-rate flow as of May 18

## Open Issues / Known Quirks

- Create-job-from-quote auto-commits on button click without explicit Save — Sprint 2-E.3 fix.
- New follow-ups don't auto-link to job_id even when the quote has one. Deferred polish — easy fix is two lines in persistGeneratedFollowup.
- Dev bypass button still on the login screen — Sprint 1F prompt drafted and parked.
- Supabase email templates are still defaults, not custom-branded.
- Status pill CSS classes for accepted/declined/invoiced not defined — render plain. Polish item.
- Scenario column in followups stores English string ("No reply yet"); Spanish UI shows it verbatim in list. Polish item.
- Datalist UX on iOS Safari requires typing 1+ char (other browsers show on focus). Could swap for custom dropdown.
- No Delete buttons yet anywhere — junk rows can't be removed via UI. Sprint 2-E.3 fix (jobs + clients in one sweep).
- Address auto-fill on client pick replaces unconditionally if matched client has addr (intentional, but can overwrite custom job-site addresses).
- quotesHistoryCount dead reference in loadSavedQuotes (looks up an element that doesn't exist; harmless behind a guard). Cleanup candidate.
- Corporate networks (SEMA Zscaler) intercept link previews on mytradedeck.com — not fixable from our side.
- Quote generation ~30–60s on Sonnet 4.6.
- Convert-to-invoice button still a placeholder.

## Architectural Path Forward

- ✅ Sprints 1A → 1.5-C (DONE): backend, auth, quota, rebrand, custom domain, pricing flexibility, self-balancing flat-rate math
- ✅ Sprint 1G (DONE): Open Graph + Twitter meta tags
- ✅ Sprint 2-A (DONE): Schema migration for clients, quotes, jobs tables with RLS
- ✅ Sprint 2-B (DONE): Auto-persist quotes on generation with client_id linkage
- ✅ Sprint 2-C series (DONE): My Quotes list view with click/edit/delete, three-mode navigation, full EN/ES
- ✅ Sprint 2-D.1 (DONE): Schema migration for client type/contact/notes
- ✅ Sprint 2-D.2 (DONE): Real Clients list view
- ✅ Sprint 2-D.3 (DONE): Client detail screen
- ✅ Sprint 2-D.4 (DONE): Follow-ups table + persistence + My Follow-ups list + client detail card
- ✅ Sprint 2-D.5 (DONE): Client autocomplete via datalist
- ✅ Sprint 2-D.5.1 (DONE): Form auto-clears on "+ New X"
- ✅ Sprint 2-D.6 (DONE): Launcher buttons on client detail
- ✅ Sprint 2-D.7 (DONE): Manual + New Client form via detail screen "new mode"
- ✅ Sprint 2-D.7.1 (DONE): Explicit Save button on client form
- ✅ Sprint 2-E.1 (DONE): Real Jobs list (read-only) — MOCK_JOBS removed, stat cards live, filter tabs functional
- ✅ Sprint 2-E.2 (DONE): Job detail screen + first-class jobs — schema migration (quotes.job_id, followups.job_id, jobs.notes), stop auto-creating jobs, "Create job from this quote" action
- ⏳ Sprint 2-E.3 (next): Delete buttons (jobs list + jobs detail + clients list + clients detail) + explicit-Save fix for Create-job-from-quote. Rolls in old Sprint 2-D.8.
- ⏳ Sprint 2-E.4: Manual "+ New Job" launchers (header button + client detail launcher)
- ⏳ Sprint 2-E.5: Inline status pill cycling on jobs list
- ⏳ Sprint 2-F: Archive system across clients/quotes/jobs/follow-ups
- ⏳ Sprint 1F (parked): Retire dev bypass
- ⏳ Sprint 3: Stripe Checkout + webhook
- ⏳ Sprint 4+: Capacitor wrap

## Code Conventions / Notes

### Globals
- sb = window.supabase.createClient(...)
- pricingMode, taxMode, tdLang, quoteLanguages — established
- selectedTrades, activeTradeIndex, tradePricingState — multi-trade state
- currentQuote / currentFollowup — bilingual in-memory payload
- currentQuote.tradePricingTargets — per-trade flat-rate target map
- currentQuote.job_id — captured on open from DB row; null on fresh quote (Sprint 2-E.2)
- depositPercent, quoteUsed (bypass-only)

### Sub-view state (Sprint 2)
- quotesSubView ('list'|'compose'|'view'), savedQuotesCache, quotesSaveTimer
- clientsSubView ('list'|'detail'), clientsCache, activeClientId, activeClientData
- clientDetailQuotesCache, clientDetailJobsCache, clientDetailFollowupsCache
- clientsSaveTimer, isCreatingNewClient
- clientsLookupCache, selectedClientIdForQuote, selectedClientIdForFollowup
- followupsSubView ('list'|'compose'|'view'), savedFollowupsCache, followupsSaveTimer
- jobsSubView ('list'|'detail'), jobsCache, jobsFilter, activeJobId, activeJobData (Sprints 2-E.1, 2-E.2)
- jobDetailQuotesCache, jobDetailFollowupsCache, jobsSaveTimer (Sprint 2-E.2)

### Helpers (current)
- Quote persistence: persistGeneratedQuote (no longer auto-creates jobs), loadSavedQuotes, renderQuotesList, openSavedQuote (captures data.job_id), deleteSavedQuote, scheduleQuoteSave, saveCurrentQuoteEdits, switchQuotesSubView, enterComposeMode
- Followup persistence: persistGeneratedFollowup, loadSavedFollowups, renderFollowupsList, openSavedFollowup, deleteSavedFollowup, scheduleFollowupSave, saveCurrentFollowupEdits, switchFollowupsSubView, enterFollowupComposeMode
- Client management: loadClients, renderClientsList, switchClientsSubView, openClientDetail, renderClientDetail, applyClientType, scheduleClientSave, saveClientEdits (returns saved row | null), clickClientDetailSave, enterNewClientMode, renderClientDetailQuotes, renderClientDetailJobs, renderClientDetailFollowups, jobStatusLabel
- Client lookup: refreshClientsLookupCache, renderClientsDatalist, findClientByName, bindClientLookupForQuote, bindClientLookupForFollowup
- Launchers: clientDisplayNameForForm, launchNewQuoteForActiveClient, launchNewFollowupForActiveClient, launchNewJobForActiveClient (still placeholder, becomes functional in 2-E.4)
- Jobs (Sprints 2-E.1, 2-E.2): loadJobs, renderJobsView, renderJobsStats, renderJobsList, bindJobsFilterPills, switchJobsSubView, openJobDetail, renderJobDetailTradeOptions, renderJobDetail, renderJobDetailClient, renderJobDetailQuotes, renderJobDetailFollowups, scheduleJobSave, saveJobEdits, clickJobDetailSave, refreshQuoteCreateJobButton, createJobFromCurrentQuote
- Generic helpers: capitalizeFirst, escapeHtml, formatRelativeDate
- clearForm(silent) — silent param skips confirm popup

### Tables (current schemas)

clients — id, user_id (FK cascade), name, addr, email, phone, status check('lead','active','past') default 'lead', type check('person','company') default 'person', contact_name, contact_title, notes, timestamps. Indexes on user_id, (user_id, created_at desc). RLS standard 4 policies.

quotes — id, user_id (FK cascade), client_id (FK set null), job_id (FK set null — Sprint 2-E.2), client_name, client_addr, total numeric(12,2), trades text[], status check('draft','sent','accepted','declined','invoiced') default 'draft', payload jsonb, timestamps. Indexes on user_id, (user_id, created_at desc), client_id, job_id. RLS 4 policies.

jobs — id, user_id (FK cascade), client_id (FK set null), quote_id (FK set null), description, trade, amount numeric(12,2), status check('quoted','in_progress','complete','paid') default 'quoted', notes text (Sprint 2-E.2), timestamps. Indexes on user_id, (user_id, created_at desc), client_id, quote_id, (user_id, status). RLS 4 policies.

followups — id, user_id (FK cascade), client_id (FK set null), quote_id (FK set null), job_id (FK set null — Sprint 2-E.2), customer_name, channel check('email','text') default 'email', scenario, payload jsonb, timestamps. Indexes on user_id, (user_id, created_at desc), client_id, quote_id, job_id. RLS 4 policies. Uses shared set_updated_at trigger.

profiles (Sprint 1C) — RPC-only, RLS no policies, get_quote_status + consume_quote_credit SECURITY DEFINER.

### CSS additions (Sprint 2)
- .view-header, .view-header-spacer, .btn-ghost
- .card-title.with-action, .card-title-action — for launcher buttons in card titles
- .pricing-toggle (reused) for person/company segmented toggle
- Jobs status pill classes use the status- prefix with _ → - conversion (e.g., status-in-progress for in_progress).

### PDF pipeline gotcha
- generateQuotePdfBlob() single source. html2canvas opts: {scale: 2, useCORS: true, logging: false, backgroundColor: '#FFFFFF'}. Do NOT add windowWidth, x, y, scrollX, or scrollY.

### Line-item filter location (Sprint 1.5-C)
- Lives in renderQuote, not renderLineItemsTable. Preserves user-added "+ Add line item" rows at $0.

### Tooling note
- Claude Code on Windows host has awk (Git Bash) but no node binary

## Workflow Preferences

- Small incremental steps over big-bang changes
- Prompts wrapped in fenced code blocks for Claude Code in VS Code
- 4-section prompt format: Manual setup → Changes → Self-tests → Test plan
- Self-tests baked in: report "X/X passed" before deploy
- Explicit negative constraints ("do NOT do X")
- Push to Vercel preview, verify visually, then merge to main
- For multi-phase manual procedures: one phase at a time, wait for "phase N done"
- When a sprint involves a Supabase schema migration, present it as a separate SQL block to paste into the Supabase SQL editor BEFORE pasting the code changes into Claude Code.
- Windows host (c:\ST\GitHub\TradeDeck\TradeDeck\index.html)

## Open Questions for Next Session

- Sprint 2-E.3 scope confirmation — delete buttons (jobs + clients, list + detail) + explicit-Save fix for Create-job-from-quote in one sprint. Manual + New Job launchers move to 2-E.4. Confirm or split further?
- Sprint 2-F archive rollout — do all four entities (clients/quotes/jobs/follow-ups) in one cross-cutting sprint, or phase per entity? Single sprint is cleaner architecturally; phased is safer to test.
- Auto-link follow-up to job — fold the 2-line fix into 2-E.3, or save as separate polish?
- Sprint 3 Stripe — confirm hosted Stripe Checkout over custom-built
- Capacitor timing — wait until Sprint 3 is done, or start in parallel?
- Custom Supabase email templates — polish them now, or later?