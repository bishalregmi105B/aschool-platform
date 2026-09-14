# Wave D — Communication & Compliance Rewrite (notices, notifications, communications, sms, compliance, iemis-import, bulk-uploads, faqs)

Date: 2026-09-14 · Agent: Wave D · Owner dirs: `frontend/app/dashboard/{notices,notifications,communications,sms,compliance,iemis-import,bulk-uploads,faqs}/**`

## 0. Research notes (2 lines/page, fetched before rewriting)

Search tooling in this session is WebFetch-only (no WebSearch); several vendor docs 404'd —
sources actually retrieved are cited per row, plus the in-repo corpus audits (InstiKit §8,
eSchool §8) which are the benchmark the plan itself names for these screens.

- **Notices** — InstiKit/eSchool benchmark (plan 16.1): audience = class/section multi-select + guardians, one screen ≤4 fields. NN/g status-tracker #3/#6: say what the user needs and what will happen → channel-fanout preview line + "requires update" honesty bar on the class picker.
- **Notifications** — NN/g status-tracker guidance (fetched, 16 rules): newest first, plain-language labels, per-item status, deep-link from update to detail. Category filter → URL param so a filtered view is shareable.
- **Broadcast/SMS** — SMS Galaxy bulk-sending guide (fetched): recipient choice, editable variables, visible credits, pre-send cost calculation. Encoded: segment × recipient credit estimate, template picker, honest per-channel E122 toasts kept.
- **IEMIS import / bulk CSV** — NN/g "Error Messages: 4 guidelines" (fetched): human-readable, specific, constructive, no blame → per-row error list after run with row numbers, plain-language server errors surfaced in wizard step gating, retry does not restart validation.
- **Compliance** — GOV.UK/audit corpus (4.3-6, DUAL §4): failed/absent jobs must be *visible* — EMIS history now shows "No file yet" chip honestly instead of a dead button; every column maps to a real serializer key.
- **FAQs** — backend 6.1-5 fixed roles to school_admin+; corpus rule (37-state honesty): non-admins get a browse-mode infobar, not a 403.
- **WhatsApp** — plan 6.1-10 (server now validates + persists): client must show skipped/error outcomes, never a blanket "sent". Config page gains a Test-connection action (48.5 pattern) via the existing POST /whatsapp-bot/send.

## 1. Per-page changes

| Page | Archetype | What changed |
|---|---|---|
| `notices/page.tsx` | A1 | **Flagship.** Create dialog now has: bilingual title, body, type, audience role chips + **"Also notify parents" switch** (wired → `target_roles`), class MultiSelect (see §2), pin/publish switches, Advanced expander (Nepali body, publish-at, expires-at). Hand-rolled tab strip → `ui/tabs` (`?tab=` URL state, plan 33 rule 2). Card lists → `DataTable` with server pagination, search/type/status filters (`useUrlFilters` + `useDebounced`), CSV export, `undoableDelete`, publish/unpublish inline, StatusChips, skeleton/empty/filtered states, ≤7 visible fields. Channel fan-out text links to `/dashboard/notifications/matrix`. All labels `t(en,ne)`. |
| `notifications/page.tsx` | A1 | Manual state fetch → react-query; category chips stay but drive `?cat=` URL filter; delete → `undoableDelete`; manual pulse divs → `Skeleton`; `EmptyState`/`ErrorState`; unread count badge on the "All" chip; bilingual. |
| `notifications/matrix/page.tsx` | A8 | Already conformant (effective-state switch grid, reset-override) — verified, no changes needed. |
| `communications/page.tsx` (hub) | A5 | Now the hub per §7: added **"SMS & Credits"** quick link (route kept); rest of the launcher grid verified. |
| `communications/broadcast/page.tsx` | A3 | Recipients: raw "Enter class ID" UUID input → **EntityPicker over /academics/classes**; template picker (`/communications/templates`) that injects content; SMS segment meter; admin-gate note (endpoint is school_admin-only — composer browsable, Send hidden for others); "Channel rules (Matrix)" link in header. |
| `communications/{announcements,diary,diary/categories,gallery,sliders,templates}` | A1 | Verified kit-conformant from earlier waves (DataTable/EmptyState/loading/dialogs). Fixes: lucide `Image` icon renamed to `ImageIcon` in gallery+sliders (killed 4 jsx-a11y warnings); `no-img-element` warnings left (remote storage URLs, next/image would need remotePatterns — flagged as infra, not ours). |
| `sms/page.tsx` | A1 hub-lite | 716 → ~640 lines; hand-rolled tab strip → `ui/tabs` with `?tab=` + Templates badge count; raw `<table>`s → `DataTable` × 2 (templates, history) with CSV export; dead `StatCard` removed; direct-send gains estimated-credit cost line (`segments × recipients`) and a pointer to Broadcast for audience sends (audience pickers don't belong on a phone-list page); admin-gated send (backend `role_required`); all labels bilingual; links **to** Communications hub (federate one direction only). |
| `communications/whatsapp/page.tsx` (settings) | A8 | Save button now change-detected (disabled + "Saved" when clean); added **Test connection** card (existing `POST /whatsapp-bot/send`) with inline infobar for `skipped`/`error`/success — the 48.5 "send test" action without a new endpoint; header links to Conversations + AI settings; bilingual. |
| `communications/whatsapp/conversations/page.tsx` | A2-ish split | Honest send outcome (6.1-10): `skipped → "not configured"` and `error → API message` toasts instead of unconditional "Reply sent"; bilingual reply-flow strings. |
| `communications/whatsapp/{templates,ai-settings,analytics}` | A1/A8 | Verified: templates already uses `useConfirm` (no native confirm), ai-settings/analytics hit real endpoints with empty/loading states. No delta beyond the family's cross-links. |
| `compliance/page.tsx` | A1+tabs | **Rebuilt against the real contract** (was the audit's "hollow paid plugin" page): the old Requirement/Category/Due-date table and "Generate MoE Report" dead button are gone. Tabs **Reports / EMIS Export (badge) / Audit Log** via `?tab=`; Reports = real `ComplianceReport` fields with working generate dialog (`POST /compliance/reports/generate` — counts students/staff) + Mark-submitted (`PUT /reports/:id`); EMIS = `GET /compliance/emis` history with blob-download per export (auth-gated endpoint), "No file yet" chip when `file_url` null; Audit = `GET /compliance/audit-logs` (previously invisible in admin UI); Import links out to the IEMIS wizard. DataTable × 3, bilingual. |
| `iemis-import/page.tsx` | A4 | Hand-rolled step state → **`ui/wizard` 3 steps (Upload → Detect → Preview & Commit)**; detection is the real `/iemis/validate` dry-run as an async step gate (server-detected format, honest counts, warnings); **new: device file input** (previously File-Manager-only — schools get these files by e-mail); completion screen shows the import log's **per-row errors** (`row + error`, capped at 50 like the API) instead of a bare success message; template download row for all 3 formats; bilingual. History page already conformant (DataTable). |
| `bulk-uploads/page.tsx` (hub) | A5 | Removed the nested full page render (`<CsvUploadPage/>` inside the hub = double header/scroll); proper launcher + one "latest jobs" DataPanel per A5 rule. |
| `bulk-uploads/csv/page.tsx` | A4 | Same 3-step wizard pattern as iemis-import (reuses `/iemis/validate|import` — it always posted there anyway); device upload + FilePicker; result screen shows real `imported/skipped/errors` keys. |
| `bulk-uploads/iemis/page.tsx` | pointer | **Route kept, form removed**: it rendered `total_processed/successful/failed` — fields the API never returns (the same hollow-contract bug as compliance). Now an honest merged-pointer page (DUAL §4) to the canonical wizard + history + compliance. |
| `bulk-uploads/history/page.tsx` | A1 | Raw table → `DataTable` (server pagination, CSV export, BS dates), `ErrorState` w/ retry, per-row error dialog now labels errors "Row N: reason" plain-language; bilingual. |
| `faqs/page.tsx` | A1 | **Role-gated UI reflects the admin-only backend**: non-admins browse with an infobar, Add CTA / edit / delete column hidden entirely; delete now `useConfirm`; bilingual. |

## 2. NOTICES targeting — backend status (the required flag)

**FLAGGED — not fully wired.** Verified against `backend/app/api/v1/notices.py` + `app/models/notice.py`:

- `target_roles` → `Notice.target_audience` (ARRAY): **accepted by `_populate_notice`, serialized back as `target_roles`** → role chips + parents toggle are **fully wired (real)**.
- `Notice.target_class_ids` (ARRAY UUID): column **exists in the model but the API never reads it from the payload and never returns it in `_notice_dict`**. Class/section targeting therefore **cannot persist today**.
- Per hard-rule 5: implemented the **full UI selector** (MultiSelect of classes, incl. section names in hints) that posts the existing payload **plus best-effort `target_class_ids`**, and gated it with a visible warning infobar: "Requires backend update — the notice API does not persist class targeting yet, so the notice reaches the whole audience." (Honest; not a fake success.)

**Backend follow-up (small, ~1 h):** add `"target_class_ids"` to the `_populate_notice` whitelist + `list(...)` UUID coercion, and echo it in `_notice_dict`. No migration needed (column + array type already exist). Section-level ids would need a new column (suggested only once class-level lands).

## 3. Other backend needs flagged (view-layer-only rule respected)

1. **`export_emis_data` Celery task has no caller** (`app/tasks/report_generation.py:258`): `POST /compliance/emis/generate` records a row with empty `export_data` and no `file_url` → EMIS tab shows the truthful "No file yet" chip. Wiring the task (it already writes CSVs per `app/services/compliance/moe_reports.py` mapping) makes those Download buttons light up with zero frontend change.
2. **`/iemis/validate` drops `error_list`** from its response (computes it, returns only counts+preview): the wizard's Detect step had to show "N rows will be skipped" without reasons. Surface `errors: result["error_list"][:50]` to get per-row messages *before* commit.
3. **WhatsApp `send-bulk` has no dedicated UI**: covered via Broadcast channel=whatsapp (server already validates+persists per 6.1-10). A rejected-numbers list inline on Broadcast would need the broadcast response to echo `rejected` like send-bulk does.
4. **FAQ ordering** — `sort_order` exists; no bulk-reorder endpoint. Left as-is.
5. **`next/image` remotePatterns** for gallery/sliders storage URLs (lint advisory).

## 4. Rules compliance check

- Single primary action per page ✓ (Add/New/Generate/Import/Save-Broadcast/Run-Import).
- ≤7 visible dialog fields with Advanced expander ✓ (notices, events).
- `useConfirm`/`undoableDelete`, zero `window.confirm` in all my dirs ✓ (grep-verified).
- EmptyState (never-used/filtered) + ErrorState + skeleton/DataTable everywhere ✓.
- Tabs with badges ✓ (notices Notices/Events, sms Templates badge, compliance EMIS badge) — all route-addressable via `?tab=`.
- Bilingual `t(en,ne)` ✓ on every page touched (comm children already had EN-only kit labels from prior waves — their headings untouched to avoid cross-wave conflicts, my edited strings are bilingual).
- Routes kept everywhere (`bulk-uploads/iemis` dematerialized to pointer, not deleted) ✓. No shared-component edits ✓.
- Endpoints/payloads unchanged except additive `target_class_ids` best-effort field ✓.
- **`tsc --noEmit`: zero errors in all 8 dirs** ✓; `next lint` on my dirs: zero warnings except two intentional `no-img-element` advisories ✓.

## 5. Files touched (16)

notices/page.tsx · notifications/page.tsx · communications/page.tsx · communications/broadcast/page.tsx ·
communications/gallery/page.tsx · communications/sliders/page.tsx · sms/page.tsx ·
compliance/page.tsx · iemis-import/page.tsx · bulk-uploads/{page,csv/page,iemis/page,history/page}.tsx ·
faqs/page.tsx · communications/whatsapp/page.tsx · communications/whatsapp/conversations/page.tsx
