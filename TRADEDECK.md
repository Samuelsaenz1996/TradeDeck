# MyTradeDeck — Project Status

Last updated: June 9, 2026 (**Pro upgrade popup + free-tier gates LIVE**; 5 new trades shipped — Gutters, Siding, Framing, Windows (multi-row repeater), Drywall (most complex panel in the app); **Account management LIVE** — change password w/ old-password reauth + change email + delete account with full server-side teardown; upgrade modal redesigned twice; one cleanup sprint attempted + reverted. **13 harnesses passing. Free quota = 3 LIFETIME (not per-month — no reset).**)

Save this. Paste into any future Claude conversation to continue.

> Reconstructed from current code + recent sessions. Sanity-check tester names (placeholders) and exact IDs against your own Stripe/Supabase if you need precision. The contractor login used throughout was samuelsaenz1996@gmail.com.

---

## 🆕 This session (Jun 5–9): Pro upgrade popup, free-tier gates, 5 trades, account management

### Pro upgrade popup + free-tier feature gates (shipped)
- **`requirePro()` helper** — small gate: returns true if `profileCache.plan && plan !== 'free'`; otherwise opens the upgrade modal and returns false. Null `profileCache` → returns true (defensive — never block on transient load). Mirror of `requireVerifiedEmail()` shape.
- **`jobsViewForPlan()` pure helper** — returns `'teaser'` for free, `'real'` for Pro; lets Jobs view branch without scattering plan checks across the renderer.
- **Pro-gating** added to 5 export functions (PDFs/emails/text for quotes + invoices + follow-ups — all behind both verify gate AND `requirePro()` where appropriate), Stripe Connect onboarding (`startConnectOnboarding`), and the Jobs view (free users see a marketing teaser, Pro users see real jobs).
- **Free-tier client cap (1 max)** — `requirePro()` + `can_create_client` RPC gate on the client-create flow. Cap re-checked at button entry (`enterNewClientMode`) NOT just at save time so users don't fill out a form just to be rejected. Save-time check kept as defense-in-depth.
- **Upgrade modal (v1):** added a Free-vs-Pro comparison table with sub-lines below each row; Pro column tinted with `--accent-soft`; ⭐ Pro header; green ✓ for "included." Wired to monthly/annual toggle + existing Stripe checkout (one payment path, no parallel popup). Cap-blocked "Generate again" now opens this modal instead of a toast.
- **"Continue to payment" → "Get Pro"** — softer CTA, no "payment" word until they're already on Stripe's page.
- Harnesses: `__testProGates` 11/11 assertions, `__testClientCap` 11/11 assertions, `__testUpgradePopup` (extended to 17/17 assertions after redesign).

### Upgrade modal redesign #2 — kill "highlighter orange" (later in session)
- User feedback: the v1 Pro column read as "highlighter orange" — too garish.
- Added `.modal-card.modal-card-wide { max-width: 540px }` variant (only applied to upgrade modal — other modals stay at 420px). On mobile both still go full-width via the existing breakpoint.
- Pro column redesigned to a **premium tile**: dark `--ink` (#1A1F2E charcoal) header instead of solid burnt-orange; **gold ★** instead of yellow ⭐ (uses existing `--gold` #B88A2C); body cells now **warm cream `--surface-2`** (#F4EFE7) instead of peachy `--accent-soft`; **3px gold left-rail** running the full Pro column; rounded top-right + bottom-right corners so the column reads as a lifted tile.
- Free column widened 70→80px, Pro 78→110px (more room for "Unlimited" without wrapping). Cell padding bumped 12×8 → 13×10. Font 13→13.5px.
- Confirmed live (screenshot Jun 9): charcoal header + gold ★ + cream column + gold rail; row sub-lines present; "Accept card payments" wording; "What you get with Pro" heading; "$49 / month" + Monthly/Annual toggle + "Get Pro" CTA. Every row maps to a real enforced gate.
- `__testUpgradePopup` still passes (no element IDs changed, only CSS + copy).

### Pricing-input "0" prefill fix
- `PRICING_DEFAULTS` numeric values for every specialty trade changed from `'0'` strings → `''` (empty). `restorePricingInputs()` reads these on fresh trade selection — with `'0'` literal the user would type `5` and get `05`. With `''`, the `placeholder="0"` shows through; typing `5` gives `5`. Math (`parseFloat(...) || 0`) treats empty as 0 so totals and AI prompts are unaffected. Select/method/unit defaults kept (e.g. `paintCoats: '2'`).
- NOTE: the initial pass missed that `restorePricingInputs` re-injects defaults on trade-select; fixed by ensuring the empty `''` defaults restore correctly. Confirmed working.

### Three new trades — Gutters, Siding, Framing
Per the established trade-panel pattern (per-unit + flat-rate substruct toggle, with Framing's deliberately-different single-mode treatment). Each adds a full pricing panel, EN+ES i18n (trade name, field labels, dropdowns, flat-rate unit names), TRADE_GUIDANCE block (4-5 sentences of real contractor terminology — fascia/downspouts, fiber-cement/J-channel/housewrap, 2×4 vs 2×6 OC spacing), TRADE_DESC_EXAMPLES (EN+ES), defaultModeForTrade entry, PRICING_INPUTS_BY_MODE + PRICING_DEFAULTS rows, buildContextForTradeState branch + buildPrompt modeNote.
- **Gutters** (🌧️ / "Canaletas") — linear-feet + downspout count/rate + gutter-guard ft/rate + disposal. Substruct toggle. Material dropdown (Aluminum/Vinyl/Steel/Copper) + style dropdown (K-style/Half-round/Seamless) feed AI wording only.
- **Siding** (🧱 / "Revestimiento") — wall area + material dropdown (vinyl/aluminum/fiber-cement/wood/engineered/steel/other) + material rate + install rate + waste factor + tear-off + trim. Substruct toggle. Only field with help text: `siding.wasteHelp` "Typically 10%."
- **Framing** (🧰 / "Armazón") — area + rate + lumber. **NO substruct toggle** (deliberate — kept simple as a one-mode "per area" panel). When Framing is the active trade, a third "📐 Per area" button is added to the app-wide Hourly/Flat toggle so the toggle never sits with zero buttons active.
- **Specialty-mode arrays** — added `'gutters'` and `'siding'` to all 6 sites that drive substruct/flat-rate machinery (snapshotPricingInputs, restorePricingInputs, init bind loop, setPricingMode toggle-display, buildContextForTradeState flat-rate block, clearForm reset). Framing intentionally excluded — it has no substruct.
- **AI dropped-trade safety net** — when multi-trade quotes hit the AI, occasionally the AI returns line items only for one trade. Added: (a) strengthened multi-trade prompt with a `⚠ CRITICAL — TRADE TAGGING` bullet + 4-step `VERIFY BEFORE RETURNING` checklist in `buildPrompt`; (b) defensive client-side injection in `generateQuote` — after `parseModelOutput`, any trade with `> $0` subtotal but zero matching line items gets a placeholder line item injected carrying that trade's full subtotal (`name = "${trade} work"`, desc = first 200 chars of jobDesc, amount = trade total). Console-warns the dropped trades for visibility. NOTE: this safety net operates at TRADE granularity, not ROW granularity (relevant to the Windows multi-row anti-collapse work below).
- **$0 validation** — `toast.addPricingForTrade` warns if a selected trade has zero priced fields.

### Windows trade (🪟 / "Ventanas") — count-based, then refactored to multi-row repeater
- **Initial implementation:** per-window pricing (count × (unitCost + laborPerWindow) + disposal), single set of fields. Window type dropdown (Double-hung default, Single-hung, Casement, Sliding, Picture, Awning, Bay or bow, Other), frame material (Vinyl default, Aluminum, Wood, Fiberglass, Composite), install type (Insert/pocket default, Full-frame) — all three dropdowns feed AI wording only, never the arithmetic. Substruct flat-rate path uses unit options `[windows, openings, sashes, units, custom]` (added 4 new `flat.unitNames.*` keys EN+ES). Naming asymmetry preserved: per-unit fields `window*` (singular), flat-rate fields `windows*` (plural), mirroring the trucking convention.
- **Then refactored to multi-row repeater** so users can quote multiple window types in one go (e.g. 6 double-hung + 2 casement + 1 bay). Each row is a compact bordered card with its own count/type/frame/install/unitCost/labor fields. Disposal stays panel-level (one per job). + Add window type button + ✕ per-row remove (disabled when only 1 row remains, not hidden). One quote LINE ITEM per row.
- **State model:** `PRICING_INPUTS_BY_MODE.windows` dropped the 6 per-row IDs (no longer global); custom snapshot/restore via `out.windowsRows` + `setWindowsRows()` rebuilds row cards from the saved array on tab round-trip. Row HTML uses **no global IDs** — class + `data-field` markers (`.windows-row` + `[data-field="count"]` etc.) — avoids collisions when adding rows.
- **Math:** `computeWindowsSubtotal(rows, disposal)` pure helper — DOM-free, harness-testable. Each row also shows its own live "count × $rate = $sub" subtotal in the card.
- **Anti-collapse AI instruction** — buildPrompt modeNote strengthened with `CRITICAL — MULTI-ROW HANDLING` bullet telling the AI to emit ONE line item per row (not aggregate), and buildContextForTradeState emits one `ROW N: count× Type Material Install windows at $per/window = $sub.` line per row plus disposal line. (Needed because the dropped-trade safety net is trade-granular, not row-granular — it can't catch the AI merging rows.)
- **Language toggle hook** — `applyLanguage()` re-calls `renumberWindowRowHeaders()` so dynamic "Window type N" headers re-translate on EN ↔ ES switch.
- Harness `__testWindowsRepeater` 15/15.

### Drywall trade (⬜ / "Tablaroca") — most complex panel in the app
- **3-level selectors** plus a conditional dropdown:
  - **Scope** (3 buttons): Hang / Finish / Hang+Finish (default Both)
  - **Unit** (3 buttons): Per sheet / Per sq ft / Flat rate (default Per sq ft)
  - **Finish level** dropdown (3/4/5, default 4) — shown only when scope includes Finish; feeds AI wording only, never math
- **Conditional fields:** quantity (sheetCount when unit=sheet, area when unit=sqft, hidden when unit=flat); hang rate + finish rate (per-unit modes); hang flat + finish flat (flat-rate mode, two summed fields to show the split). `renderDrywallFields()` is the single source of truth for visibility — reads current scope + unit and toggles 4 field-groups in one place, also sets rate-label `data-i18n` to `drywall.hangRate.${unit}` or `drywall.finishRate.${unit}` for dynamic `$/sheet ↔ $/sq ft` swap.
- **Math:** `computeDrywallSubtotal({scope, unit, sheetCount, area, hangRate, finishRate, hangFlat, finishFlat})` pure helper — 9 scope × unit combinations, all DOM-free. `parseFloat(...) || 0` everywhere, empty → 0, no NaN.
- **State:** Drywall is NOT in the 7 specialty-mode array sites — manages its own state independently. `PRICING_INPUTS_BY_MODE.drywall` has only the 7 input/select IDs (drywallSheetCount, drywallArea, drywallHangRate, drywallFinishRate, drywallHangFlat, drywallFinishFlat, drywallFinishLevel). Custom snapshot/restore captures `out.drywallScope` and `out.drywallUnit` (button-active states); restore calls `applyDrywallScope/Unit + renderDrywallFields`. `'drywall'` added to ONLY one specialty array — the setPricingMode toggle-display hide check — leaving the other 6 sites untouched.
- TRADE_GUIDANCE covers: hanging vs finishing as distinct crews, sheet sizes (4×8 std, 4×10/4×12), 1/2" walls vs 5/8" Type-X ceilings/garages, Levels 0-5 (4 standard, 5 critical lighting), paper vs mesh tape, corner bead, texture options.
- Harness `__testDrywall` 18/18 (9 combos × 2 = math + empty-inputs round-trip).

### Gutters substruct toggle bug fix
- Symptom: Gutters Per-unit ↔ Flat-rate toggle did nothing.
- Root cause: HTML IDs were singular (`gutterSubstructToggle`, `gutterPerUnitFields`, `gutterFlatQty`, etc.) but `applyPricingStructure` / `bindSubstructToggle` construct `${trade}SubstructToggle` from the trade-mode name `'gutters'` (plural) — `getElementById('guttersSubstructToggle')` returned null, click handler never bound. Gutters was the ONLY specialty trade with this prefix mismatch; every other trade's substruct prefix matches its mode name (truckingFlatQty/paintingFlatQty/etc.).
- Fix: renamed the 10 substruct/flat-rate IDs to plural to match convention. Per-unit field IDs (`gutterLinearFt`, `gutterRate`, etc.) kept singular — those are referenced directly by `bindGutterInputs`/`updateGutterSubtotal` and work fine. Updated PRICING_INPUTS_BY_MODE.gutters + PRICING_DEFAULTS.gutters + clearForm FIELD_DEFAULTS to match.

---

## 🆕 Also this session (Jun 5–9): Account management — change password, change email, delete account

### `api/delete-account.js` (NEW endpoint, 13th total in /api)
Mirrors `create-portal.js` shape: POST + bearer auth + no body trust, user ID derived ONLY from `supabaseAdmin.auth.getUser(token)`. Five phases in order:
1. **Cancel Stripe subscription** if one exists (best-effort, try/catch — already-canceled subs return `resource_missing`, log and continue). Do NOT delete the Stripe customer record — financial records remain attached to the customer for accounting/refund handling.
2. **Break circular FK** before deletes — `quotes.job_id ↔ jobs.quote_id` is circular in the schema. Null both directions via `UPDATE quotes SET job_id=null WHERE user_id=X` and `UPDATE jobs SET quote_id=null WHERE user_id=X`. Safe regardless of actual cascade rules.
3. **Hard-delete user data in dependency order:** followups → invoices → jobs → quotes → clients → profiles. Each wrapped so partial failure logs but continues to maximize cleanup.
4. **Storage cleanup:** `supabaseAdmin.storage.from('logos').remove(["${user.id}/logo"])` (no-op when file doesn't exist).
5. **Delete auth user LAST** via `supabaseAdmin.auth.admin.deleteUser(user.id)`. Failure mode is recoverable — user retries; next call no-ops through already-deleted data and retries the auth delete. Reverse order would leave orphaned data with no owner.
- Audit log line at entry: `console.log("delete-account: user_id=${user.id} email=${user.email}")` — paper trail if a user later emails support claiming they didn't delete.
- **Schema cascade still unverified** — repo has no SQL migrations. The endpoint runs explicit pre-null + ordered deletes regardless, so safe to ship. But before this hits a real account, confirm in Supabase dashboard whether `user_id` FKs are CASCADE/SET NULL/RESTRICT.

### Front-end: Settings → Account section
Three actions inside the existing Account card in `#profileView`:
- **Change password** — three full-width stacked fields (Current / New / Confirm). Each has an inline **Show / Hide** text toggle (right edge of input). Live match indicator under Confirm (hidden when empty, green ✓ "Passwords match" when equal, amber "Passwords don't match yet" otherwise). Inline error block (red box, persists until next keystroke). Validation cascade: empty old → new < 8 → mismatch → same-as-old. **Old password verified** via `signInWithPassword({email, password: oldPw})` BEFORE calling `updateUser({password: newPw})` — same reauth pattern as delete-account. Magic-link-only users (no password set) get explicit guidance: "If you signed in with a magic link, you don't have a password set yet — sign out and use Forgot password on the sign-in screen to create one."
- **Change email** — single field + format check. On success calls `sb.auth.updateUser({email})` (Supabase sends a confirmation link to the new address) AND resets our custom verification: `email_verified_by_us=false`, `verify_token=null`, `verify_token_expires_at=null`. Without this reset, a Pro user could change email and keep export access on the new address without going through the verify gate. Toast warns user about both confirmations.
- **Delete account (danger zone)** — light-red bordered box at bottom of the card. Click opens custom `#deleteAccountBackdrop` modal with: DELETE-text input (confirm button stays disabled until typed exactly `"DELETE"`, case-sensitive), password input, inline error area. On confirm: reauths via `signInWithPassword`, then POSTs to `/api/delete-account`. Loading state during call ("Deleting…", buttons disabled). On success: `sb.auth.signOut()` wrapped in try/catch (auth user already gone, signOut may error — ignored), then redirect to `/`. Magic-link-only users get the same fallback message.
- **Manage subscription** already existed (`profileManageSubBtn` at [index.html:4281], Pro-gated by `loadProfileData`) — wired to existing `openBillingPortal` → `create-portal` endpoint. No changes needed. (This is the keep-data cancel path — Stripe's hosted billing portal handles cancel-at-period-end; the subscription webhook flips plan→free when the eventual `subscription.deleted` event fires.)
- All copy in EN + ES (30 new `account.*` keys per language). Reuses existing `auth.pwTooShort`, `auth.pwMismatch`, `modal.cancel`.

---

## 🆕 Cleanup sprint (Jun 9) — attempted, REVERTED
Three items, all rolled back to `611411b`:
- **Item 1 — "Draft" label removal:** Investigated 3 cosmetic surfaces (topbar meta on quotes/followups views via VIEW_TOPBAR map; status-chips inside quote actions bar + followup actions bar). All confirmed cosmetic-only (load-bearing `status.Draft` key, `.status-draft` CSS, and DB `'draft'` enum left untouched). Removed all 3 surfaces + 3 orphan i18n keys × 2 dicts.
- **Item 2 — Orphan i18n key sweep:** Audited 904 EN keys via `(a) t('key') count + (b) data-i18n="key" count + (c) substring count`. Identified 60 confirmed-dead keys (a=0, b=0, exact-quoted count=2 — only their own EN/ES definitions). 9 keys flagged "uncertain" initially due to substring overlap with longer valid keys (`followup.sub` vs `followup.sub2`/`.subject`; `payments.range` vs `payments.range.30d`; etc.) — re-audit with word-boundary anchor confirmed all 60 truly dead. Removed 120 lines via individual Edit calls (NOT a full-file rewrite — see encoding lesson below). EN 904→844, ES 904→844, sync diff = 0. Spot-check confirmed 8 still-live keys intact across followup/clients/payments/auth/invoices screens.
- **Item 3 — Auto-link follow-up to job:** 2-line fix in `persistGeneratedFollowup`. Added `jobId: data.job_id || null` to `followupPickedRecord` shape (mirroring existing `clientId` capture pattern), and propagated to followup insert as `job_id: ...`. Updated shape comment.

**Regression caught on Preview:** follow-up generation failed with `"Failed to fetch"` after the 3 changes shipped. IMPORTANT — cause is UNCONFIRMED and the original "job_id column" theory is probably wrong: the error fired on the **"write my own"** path too, which has `followupSource === 'manual'` and never sets `job_id` (it's guarded by `=== 'quote'`). So it's in the SHARED generation path, not the job_id insert alone. Leading suspect: a removed i18n key consumed during prompt/payload assembly (e.g. the `followup.tones.*` / `followup.age` / `followup.tone` family — the audit cleared these as UI-unreferenced, but if the generation code reads them to build the prompt, removing them throws before the fetch). DIAGNOSE BEFORE RE-ATTEMPTING: reproduce with the Console open (catch the JS error + line) AND the Network tab open (read the actual response body) — "Failed to fetch" hides the real error. Reverted all 3 items to `611411b` as the safe path back. All three remain open for a future deliberate sprint, and Item 3 should be diagnosed + separated from the (cosmetic, low-risk) Item 1 + Item 2 work before any re-attempt.

### Encoding lesson learned (worth keeping)
First attempt at the i18n sweep used PowerShell 5.1's `Get-Content`/`Set-Content` cycle to delete keys in bulk. Result: every UTF-8 multi-byte character in the file got mangled into mojibake (em-dash `—` → `â€"`, Spanish ñ → `Ã±`, emoji `🪟` → `ðŸªŸ`) plus a stray BOM at line 1. Root cause: `Get-Content` defaults to system codepage (Windows-1252) when reading; `Set-Content -Encoding utf8` then re-encoded the already-mangled in-memory string as UTF-8, double-encoding it. **Rule for next time:** never use `Set-Content` on this file. Use the `Edit` tool (preserves encoding), or `[System.IO.File]::ReadAllText/WriteAllText` with `[System.Text.UTF8Encoding]::new($false)` (explicit no-BOM), or bash `grep -v`/`sed` (byte-preserving). After the encoding incident was caught + reverted, the successful second attempt did all 120 deletions through individual `Edit` calls, with explicit grep verification of em-dash / ñ / á / 🪟 counts before merge. Then Item 3's regression triggered the full revert anyway.

---

## 🆕 This session (Jun 4): Email-verification export gate — LIVE, all 5 stages shipped

**The feature:** Anti-farming. A user can sign up easily (email + password) and draft up to **3** free quotes/follow-ups (lifetime), but **cannot download or send** anything until they confirm a real email. Fake-email farmers get useless drafts and nothing more. Paying (Pro) users are never gated.

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
- Guard `if(!requireVerifiedEmail())return;` at top of all **8 export functions**: `downloadPdf`, `sendQuoteEmail`, `sendQuoteText`, `downloadInvoicePdf`, `sendInvoiceEmail`, `sendInvoiceText`, `copyFollowupMessage`, `sendFollowupMessage`. (Later, the 5 invoice + follow-up exports also got `requirePro()` stacked UNDER the verify gate, verify-first; the 3 quote exports stay verify-only — quote export is the deliberate conversion path, never Pro-gated.)
- Verify modal: "Confirm your email to send & download" + "Send me the link" (calls `/api/verify/send`) + "I've confirmed — refresh" (re-pulls `loadProfileCache`, re-checks, closes if now verified) + cancel. All `verify.modal.*` i18n EN+ES.
- **Pro/Team always bypass** the gate (paying customer obviously has a real email; never block them).
- Harness `__testExportGate()` → 29/29 assertions (extended from 16 to also assert verify-before-pro ordering on the 5 Pro-gated functions + that the 3 quote exports do NOT have `requirePro`). Proven end-to-end on Preview.

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

- **Free quote cap = 3 LIFETIME** (changed from 5, then made lifetime — NO monthly reset). SQL: `CREATE OR REPLACE` on `consume_quote_credit` (`free_limit int := 3`) and `get_quote_status` (`limit_val = 3` for free), with the monthly-reset block removed so `quotes_used` accumulates permanently (the `period_start` column is left in place but no longer drives any reset). Front-end: `updateUsageDisplay` `quoteUsed/3`, `consumeQuotaOrShowError` bypass `>=3`, i18n `sidebar.quotesSuffix` "/3 quotes"+"/3 cotizaciones". Copy is deliberately period-agnostic everywhere — no "per month" / "al mes" near the FREE quote limit (confirmed in the live upgrade popup, which reads "3 free quotes to get started"). Pro billing copy ($49/month, $490/year, Mensual/Anual) and genuine monthly stats (jobs "this month", clients "active this month") are untouched. Server-enforced (RPC keyed on `auth.uid()`). A free user who has used 3 is capped permanently until upgrade. To reset a test account: `update public.profiles set quotes_used=0 where user_id=(select id from auth.users where email='TEST')`.
- **Post-signup onboarding card.** Dismissible centered bilingual card; first name REQUIRED, last/company/phone optional; "Finish later" + "Save and continue"; writes to existing `profiles` columns (first_name, last_name, company_name, phone). Trigger = `profileCache.first_name` empty/null (self-resolving — reappears next login if skipped, never returns once saved). Harness `__testOnboarding()`.
- **Sidebar scroll fix.** Base `.sidebar` got `overflow-y:auto` (was `height:100vh` no overflow → bottom content/Upgrade button clipped on short desktop screens). Mobile drawer rule untouched.
- **Profile → Settings rename.** Cosmetic only. `navProfile` relabeled to `nav.settings` (gear icon), dead duplicate Settings nav item deleted, `profile.title` EN/ES = "Settings"/"Configuración". Internals unchanged (`switchView('profile')`, `#profileView`, view key `'profile'`, `loadProfileData` all kept).

---

## Carried-over open items

| Feature | Priority | Notes |
|---|---|---|
| Diagnose the followup "Failed to fetch" regression | High before re-attempting cleanup | Fired on BOTH manual and quote-linked follow-up generation, so it's in the SHARED generation path, NOT the job_id insert alone (manual never sets job_id). Suspect a removed i18n key used in prompt/payload assembly. Reproduce with Console + Network tab open to read the real error before any second attempt. The Item 1 (Draft) + Item 2 (i18n) work is cosmetic/low-risk and can likely proceed once Item 3 is separated and diagnosed. |
| Schema cascade verification (for delete-account) | High before real-account use | Repo has no migrations — actual `ON DELETE` behavior on `user_id` / `quote_id` / `client_id` / `job_id` FKs unknown. The endpoint runs explicit pre-null + ordered deletes regardless so it's safe to ship, but confirm in Supabase dashboard before merge to flag whether the explicit deletes are doing the real work or are redundant. |
| Test the delete-account endpoint end-to-end | High | Use a THROWAWAY account, not a real one. Verify: all 6 tables' rows for that user_id removed, logo deleted from storage, subscription canceled in Stripe (customer record kept), `auth.users` row gone. |
| Sidebar plan-card fix | Check if still needed | Prior spec: `updateUsageDisplay()` ran before `loadProfileCache()` resolved → "FREE PLAN / Unlimited / quotes" contradiction for pro. May already be resolved by this session's `updateUsageDisplay` changes — verify on the pro account. `__testSidebar()` harness exists. |
| "Draft" label top-right of app | Low | Investigated Jun 9 — confirmed cosmetic at 3 surfaces (topbar meta + 2 status chips), removal attempted as part of cleanup sprint then REVERTED with the other items. Still open. |
| Orphan i18n key sweep | Low | 60 confirmed-dead keys identified Jun 9 (full list in cleanup-sprint section above), removed then REVERTED with the cleanup. The audit + key list still valid for next attempt — don't re-run the audit. BUT before deleting: the audit only checked UI references (`t()`, `data-i18n`), NOT keys consumed in prompt/payload assembly — grep the generation/prompt-building functions for each candidate first. That blind spot is the leading suspect for the Item-3 regression. |
| Auto-link follow-up to job | Low-Med (now blocked) | 2-line fix attempted Jun 9 (jobId capture in followupPickedRecord + propagation to insert), REVERTED after triggering "Failed to fetch" on followup generation. Diagnose cause (Console + Network) before re-attempting; if `followups.job_id` doesn't exist or RLS rejects it, the fix is server-side (SQL) — but confirm that's actually the cause first, since the error also fired on the manual path. |
| Embedded card entry on our page | Med | Stripe Embedded Checkout (keeps token flow + PCI posture). Separate sprint. |
| Test the ANNUAL checkout path | Med | Monthly proven live via coupon; annual env var confirmed but never run end-to-end. Shares monthly code path (low risk). |
| Windows-repeater pattern for other trades | Low-Med | The multi-row repeater (array state + custom snapshot/restore + anti-collapse AI instruction) is now solved once on Windows. Rolling it to flooring/siding/roofing is mostly mechanical repetition of that pattern if heterogeneous line items are wanted there. |
| Single-invoice topbar shows "Invoices" (plural) | Low | Cosmetic. |
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
- **Never use PowerShell `Set-Content` on `index.html`** — it reads as Windows-1252 and re-encodes as UTF-8, mojibaking every non-ASCII char (— → â€", ñ → Ã±, 🪟 → ðŸªŸ) plus a stray BOM. Use the Edit tool, or `[System.IO.File]::ReadAllText/WriteAllText` with `[System.Text.UTF8Encoding]::new($false)`, or bash `grep -v`/`sed`. Always grep-verify an em-dash / ñ / á / 🪟 after any bulk edit.
- **"Failed to fetch" is misleading** — it surfaces RLS rejects, schema errors, and pre-fetch JS exceptions all as the same string. ALWAYS read the Network response body + Console error before theorizing about cause.
- **The i18n "dead key" audit has a blind spot** — it checks UI references (`t('key')`, `data-i18n="key"`) but NOT keys consumed in prompt/payload assembly. A key can be "UI-dead" but still used to build the AI prompt. Grep the generation/prompt-building functions specifically before re-running the orphan-key sweep.

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

- Pricing: **Free (3 quotes LIFETIME, no reset, server-enforced; export gated behind email verification)** · Pro $49/mo (annual $490) · Team $99/mo (priced, no multi-seat logic).
- Payments fee: 1% MyTradeDeck platform fee capped at $25/invoice, on top of Stripe's processing fee. Contractor is merchant of record.
- Live at https://www.mytradedeck.com. Goal: a high-income side project, not full-time. Long-term: Capacitor wrap for the app stores.

## Tech Stack (current)
- Frontend: single `index.html`, vanilla JS, no framework, no build step + standalone `verify.html`. Host path `c:\ST\GitHub\TradeDeck\TradeDeck\index.html`.
- AI: Anthropic API via `/api/generate.js` (Edge proxy), model `claude-sonnet-4-6`, SSE streaming.
- Auth: Supabase email — password (+ magic-link fallback), recovery. "Confirm email" toggle OFF (auto-confirm); custom `email_verified_by_us` flag gates export. Dev bypass localhost-only.
- Billing: Stripe Checkout + portal, subscription webhook → `profiles.plan`.
- Payments: Stripe Connect Standard, direct charges, platform `application_fee_amount` (1% capped $25), hosted Checkout. Two webhooks (subscription vs Connect), separate secrets.
- Email: **Resend** — domain `mail.mytradedeck.com` VERIFIED. Used as Supabase SMTP provider AND directly via Resend HTTP API from `/api/verify/send` (needs `RESEND_API_KEY`). Verify email from `noreply@mail.mytradedeck.com`.
- Persistence: Supabase Postgres (`clients`, `quotes`, `jobs`, `followups`, `invoices`, `profiles`), 4-policy RLS on `auth.uid()`, cross-entity FKs ON DELETE SET NULL (client_id) — note `quotes.job_id ↔ jobs.quote_id` is circular (handled explicitly in delete-account). Project `cqmctdhxticryelvhhze`.
- Storage: Supabase `logos` bucket.
- Hosting: Vercel, auto-deploy from GitHub `main`. `vercel.json` has one rewrite (`/verify`→`/verify.html`). Domain on GoDaddy (apex 307s → www). PDF: html2pdf.js. API safety: $20/mo Anthropic cap.

### Vercel environment variables (Production)
- `STRIPE_SECRET_KEY` — Saenztech LLC live `sk_live_…` (Production); Preview = `sk_test`.
- `STRIPE_PRICE_ID_MONTHLY` = `price_1TdxD62LuFwvqrU89lp9r6GP` ($49/mo); `STRIPE_PRICE_ID_ANNUAL` = the $490/yr price.
- `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`.
- `PLATFORM_FEE_PERCENT` = 1; `PLATFORM_FEE_CAP_CENTS` defaults 2500 in code.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `ANTHROPIC_API_KEY`.
- **`RESEND_API_KEY`** — added Jun 4 for `/api/verify/send` (Production + Preview).

### Backend endpoints (/api) — 13 functions
`generate`; `create-checkout`; `create-portal`; `stripe-webhook`; `connect/create-account-link`; `connect/account-status`; `invoice/create-pay-link`; `pay/[token]` (public); `pay-result` (public); `webhooks/stripe-connect` (public, Connect); **`verify/send` (Bearer); `verify/confirm` (token-auth, no Bearer); `delete-account` (Bearer)**. All Node/ESM, JWT-verify pattern (except verify/confirm), service-role Supabase client, Stripe apiVersion '2024-06-20'. `delete-account` mirrors `create-portal` shape exactly.

## What's Built (functional)
- Foundation, quotes, full CRM (clients/jobs/quotes/follow-ups), **15 trades** (Plumbing/Electrical/HVAC/Roofing/General/Painting/Flooring/Landscaping/Hauling/Logistics + Gutters/Siding/Framing/Windows/Drywall), full EN/ES, mobile drawer.
- Auth (password + magic-link + recovery), Stripe subscriptions + portal, Settings/branding (formerly "Profile").
- **Account management** — change password (with old-password reauth + Show/Hide toggles + live match indicator), change email (with custom-verify reset), delete account (custom modal + DELETE-typed gate + password reauth + server-side teardown).
- Archive + bulk + delete + confirmModal across all four core tables + invoices.
- Invoices: INV-A + INV-B + active/archived toggle.
- Payments collection: PAY-A/B/C, all live on Saenztech LLC.
- Payments dashboard (real data): period-scoped + all-time + avg-days-to-pay; date-range; split-bar; chase list.
- Follow-up compose v2: source picker → searchable picker → dynamic scenarios → source-aware AI → sign-off appended in code. `__testFollowupPicker` 13/13.
- **Quota 3 LIFETIME (server-enforced, no reset).**
- **Email-verification export gate** (custom flag, all 5 stages live).
- **Post-signup onboarding card.**
- **Pro upgrade popup with Free-vs-Pro comparison table** (charcoal-header + gold-rail premium tile look; every row maps to a real enforced gate).
- **Free-tier feature gates** — `requirePro()` helper applied across 5 export functions, Connect onboarding, Jobs view (teaser), client cap (1 max via `can_create_client` RPC).
- **Pure helpers for harness-testable math:** `computeDrywallSubtotal`, `computeWindowsSubtotal`, `jobsViewForPlan` — DOM-free, called by both the live update functions and the test harnesses.
- **13 test harnesses passing:** Payments, FollowupSend, FollowupPicker (13/13), Sidebar (10/10), Onboarding, ExportGate (29/29), ProGates (11/11), UpgradePopup (17/17), VerifyPolish (4/4), ClientCap (11/11), Drywall (18/18), WindowsRepeater (15/15). (Per-harness numbers are assertion counts, not the harness total — the total number of harnesses is 13.)

## Data Model (current)
clients → jobs → (quotes, followups, invoices); quotes/followups/invoices can also hang directly off a client. Invoices created from a quote via idempotent `create_invoice_from_quote` RPC. `invoices` has `pay_token` (unique), `stripe_checkout_session_id`, `stripe_payment_intent_id`, `paid_at`, `archived_at` (nullable, indexed). `profiles` (PK = `user_id`) has quota RPCs (free cap = 3 lifetime), plan, business/branding fields, Stripe subscription + Connect fields, and **`email_verified_by_us` / `verify_token` / `verify_token_expires_at`** (Jun 4). Onboarding writes to existing `first_name`/`last_name`/`company_name`/`phone`. NOTE: `quotes.job_id ↔ jobs.quote_id` is a circular FK (handled by pre-nulling both directions in delete-account).

## Workflow preferences
Small incremental sprints. Prompts in fenced blocks for Claude Code in VS Code, 4-section format (Manual setup → Changes → Self-tests → Test plan), explicit negative constraints, "X/X passed" before deploy, functions referenced by name. Migrations as a separate SQL block BEFORE code. **Multi-phase manual procedures ONE step at a time — user gets confused by multi-step instructions, present exactly one action per message.** Push to a branch → Vercel Preview → verify → merge to main. (Reminder: features whose email/link points at production must be merged to PROD to test the link, not just Preview.) **Commit promptly after each verified change — don't let large uncommitted edits sit (the cleanup-sprint corruption was harder to recover because changes were uncommitted).**

## Open questions for next session
- **Diagnose the followup "Failed to fetch" regression** before any second attempt — reproduce with Console + Network tab open to capture the real error. It fired on BOTH the manual and quote-linked paths, so the cause is in the shared generation path (suspect a removed i18n key used in prompt assembly), NOT the job_id insert alone. Don't assume `followups.job_id` schema/RLS without confirming.
- **Confirm schema cascade rules** for the delete-account endpoint via the Supabase dashboard before any real-account use (which FKs cascade vs SET NULL vs RESTRICT).
- **Test the delete-account flow end-to-end** on a throwaway account: data wipe across all 6 tables, logo gone from storage, subscription canceled in Stripe (customer kept), auth.users row deleted.
- Confirm whether the prior **sidebar plan-card bug** is still present after this session's `updateUsageDisplay` changes.
- Test the **annual subscription path** end-to-end (still never run live; shares monthly code path so low-risk).
- Re-attempt the **cleanup sprint** (Draft removal + 60 dead i18n keys) — Item 1 + Item 2 are cosmetic/low-risk; the regression was Item 3 (followup job_id) which must be diagnosed and separated before merging the i18n + Draft work. Before deleting i18n keys, grep the prompt-building functions for each candidate (the audit's blind spot).