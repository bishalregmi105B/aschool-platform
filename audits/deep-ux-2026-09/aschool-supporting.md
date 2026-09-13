# ASchool Supporting Systems (hardware / IEMIS templates / Nepal textbooks) — Deep Audit (2026-09-13)

**Auditor scope:** `hardware/`, `iemis_templates/`, `nepal_textbooks/` at repo root, and their literal wiring into backend / frontend / mobile / live DB (postgres via `aschool-postgres-1`, API at `http://localhost:5003`).
**Method:** every claim below was verified by opening the file, grepping the wiring, or querying the live DB/API on 2026-09-13. Prior documents were used as leads only and re-verified at source. The live `/iemis/validate` calls in §3 are dry-run (code-verified no-DB-write path); nothing in any source or data file was modified.

---

## 1. Executive Summary

| System | What it is | Wiring verdict | Live data | One-line truth |
|---|---|---|---|---|
| `hardware/` (ESP32 GPS tracker) | 331-line Arduino firmware + wiring/BOM docs for a Rs 2,900/bus tracker | **Wired (code-complete end-to-end), unproven on real devices** | 0 buses, 0 GPS logs, 0 routes, 0 stops | The device→Firebase→Celery→Socket.IO/API→three-parent-surface chain is real and mutually consistent, but no device has ever reported; Firebase env values are placeholders; `hardware/README.md` describes a stale architecture (dead file paths, wrong poll cadence, wrong parent-app transport) |
| `iemis_templates/` (2 XLSX) | Real Nepal MoE IEMIS portal exports (22-col school report; 308-row student namewise report with real PII) | **Import direction: wired and live-verified. Export direction: partially wired** | 0 imports, 0 compliance reports, 0 EMIS exports, 0 students | The importer matches the government templates header-for-header (16/16 and 22/22) and validated 308/308 rows live; the two XLSX files themselves are referenced by *nothing* in code; the compliance/EMIS *export* half is an orphaned task plus a frontend page rendering fields the API never returns |
| `nepal_textbooks/` (656 files, 2.2 GB) | 320 real CDC PDFs (grades 1–12, editions BS 2076–2080) + 319 raw-text sidecars + 4 catalogs + teacher guides/spec grids/frameworks | **Partially wired — schema and tooling exist, zero ingestion executed** | textbook_corpora/pages/chapters/assets: 0; content_sources/units/chunks: 0; question_papers: 0; curriculum_frameworks: 50 (skeleton); learning_outcomes: 0 | A genuinely valuable offline corpus with a designed-but-never-run ingestion pipeline: the "ingestion script" writes nothing to the DB, the S12 content spine is empty, the only live curriculum data is a 50-row hand-written skeleton, and the 319 `.txt` sidecars are un-transcoded Preeti mojibake |

**Nepal-moat bottom line (§6):** the IEMIS importer and the CDC corpus + working Preeti→Unicode transcoder are real, differentiated assets no audited competitor has. But of the three "moat" systems, only IEMIS import is usable product today; the textbook moat is an inventory awaiting its pipeline, and the hardware moat is firmware awaiting its first bus.

---

## 2. hardware/ — What Ships and How It Wires

### 2.1 What physically ships

Three files, 531 lines total:

| File | Lines | Content |
|---|---|---|
| `hardware/README.md` | 114 | Architecture diagram (ESP32+NEO-6M+SIM800L → Firebase RTDB → parent app + Celery), NPR cost table (Rs 2,900 one-time/bus, Rs 150/mo SIM), flashing steps, Firebase security rules, LED codes, troubleshooting |
| `hardware/ESP32_GPS_tracker/firmware.ino` | 331 | Complete Arduino firmware: TinyGPS++ parsing, SIM800L AT-command GPRS, optional WiFi fallback, 15 s send interval, 60 s heartbeat |
| `hardware/ESP32_GPS_tracker/wiring_diagram.md` | 86 | Component BOM in NPR (ESP32 900 / NEO-6M 500 / SIM800L 600 / LM2596 150 / 18650 350 / IP65 box 200), pin map, power design, antenna placement, NTC/Ncell APN guidance |

The firmware is not a toy. Evidence of real engineering care:

- **Config guard** (`firmware.ino:70-81`): refuses to boot-loop with placeholder `SCHOOL_ID_HERE` / `FIREBASE_SECRET_HERE` / default `BUS_001` — SOS-blinks forever instead of "silently poison[ing] tenant data".
- **Honest timestamps** (`firmware.ino:167-175`): uses the GPS-derived UTC epoch, explicitly commenting that `millis()` is uptime and never an epoch.
- **Transport asymmetry handled** (`firmware.ino:218-263`): SIM800L `HTTPACTION` supports only GET/POST/HEAD, so the GPRS path POSTs (appending RTDB push-children) while WiFi PUTs (replacing the node) — and the backend poller deliberately understands both shapes (see §2.2).
- **Response checking** (`firmware.ino:239-260`): parses `+HTTPACTION: <method>,<status>,<len>` and counts non-200 as failure, driving GSM re-init after 20 failures (`firmware.ino:154-158`).
- **Nepal-localized defaults**: APN `ntc` for Nepal Telecom (`firmware.ino:37`), wiring doc names NTC/Ncell data SIMs and prices in NPR (`wiring_diagram.md:58-63`).

### 2.2 The literal wiring: device → endpoint → tasks → models → UI

**Step 1 — Device → Firebase.** Firmware writes a JSON fix to `/schools/{SCHOOL_ID}/buses/{BUS_ID}/location.json` with `lat/lng/speed/heading/hdop/satellites/ts/bus_id` (`firmware.ino:161-198`), heartbeat to `.../heartbeat.json` (`firmware.ino:265-278`). There is **no direct device→ASchool endpoint**; Firebase RTDB is the ingestion buffer. (A direct HTTP ingest also exists as a parallel source: `POST /api/v1/transport/gps-logs`, `backend/app/api/v1/transport.py:284-315`, UUID + tenant + lat/lng-range validated.)

**Step 2 — Celery beat → poller.** Beat entry `poll-firebase-gps` runs every **15 s** on queue `gps` with a 14 s expiry (`backend/app/__init__.py:352-357`). `poll_firebase_gps` (`backend/app/tasks/gps_firebase_poller.py:46-127`):
- queries `Bus` rows where `is_active` and `gps_device_id` non-empty (`gps_firebase_poller.py:59-64`; column defined at `backend/app/models/transport.py:44`),
- GETs `{FIREBASE_DATABASE_URL}/schools/{bus.school_id}/buses/{bus.gps_device_id}/location.json` per bus (line 81-83),
- `_pick_latest_fix` (lines 25-43) handles **both** the WiFi-PUT flat-object shape and the GPRS-POST push-children shape (newest child by `ts`) — mirroring the firmware's comment exactly, which is the strongest evidence the two files were co-designed,
- dedupes against `max(GPSLog.timestamp)` per bus (lines 107-113), then dispatches `process_gps_data` and `check_geofence_alerts` (lines 115-124).

The poller's module docstring explicitly cites `hardware/ESP32_GPS_tracker/firmware.ino` as the upstream contract (`gps_firebase_poller.py:3-4`) — the only place in the backend that references the hardware directory, and it's the right place.

**Step 3 — Persist + broadcast + trip ingest.** `process_gps_data` (`backend/app/tasks/gps_processing.py:46-140`):
- resolves the bus by internal UUID *or* by `gps_device_id` as the firmware sends it (lines 71-79),
- persists a `GPSLog` row (`firebase_synced=True`, lines 83-95),
- emits Socket.IO `gps_update` to room `school-{school_id}` through the Redis message queue so Celery workers can reach browser clients (lines 16-44, 97-108),
- **dual ingest (S-A4/A-10)**: if the bus has a *running* `TransportTripInstance` today, the same fix is fed through `transport_service.ingest_position` (lines 110-133) — so the ESP32 and the driver phone (`POST /transport/instances/<id>/position`, `transport.py:719`) drive the *same* trip geofence engine. "Hardware is optional, not exclusive" (code comment at `gps_processing.py:110-113`).

`check_geofence_alerts` (`gps_processing.py:143-213`): haversine distance to the nearest stop of the bus's route, 2.0 km corridor, `send_push_to_school` to roles admin/principal/transport_manager on deviation.

**Step 4 — Admin UI.** `frontend/app/dashboard/transport/map/page.tsx:47-68` connects the socket, subscribes `onGPSUpdate` (`frontend/lib/socket.ts:100-101`), and merges into live positions with a 15 s react-query poll of `/transport/gps-logs` as fallback; `frontend/components/transport/LiveBusMap.tsx:1-10` renders Leaflet with stale-bus graying (5-minute threshold, lines 46-49). Backend socket auth requires the JWT handshake (`backend/app/realtime.py:7-13, 103`). Supporting admin surfaces all gated on `gps_tracking`: the GPS Logs page reads `/transport/gps-logs` with CSV export (`frontend/app/dashboard/transport/logs/page.tsx:28-29,104`); the trip Monitor page renders per-trip last-fix status ("GPS {fix}" / "No GPS fix", `monitor/page.tsx:282`); Trips manager at `trips/page.tsx` (all under `PluginGate slug="gps_tracking"`, lines 93/121).

**Step 5 — Parent surfaces (two).**
- Flutter: `flutter_parent/lib/features/bus_tracker/bus_tracking_screen.dart` loads `/parent/bus-info` then polls `/parent/bus-location/{bus_id}` **every 15 s** (lines 35-36, 73-96) onto a FlutterMap with OpenStreetMap tiles.
- Web: `frontend/app/parent/bus/page.tsx` does the same two calls with `refetchInterval: 15_000` (lines 29-47).
- Backend `parent_bus_info` / `parent_bus_location` (`backend/app/api/v1/parent_app.py:610-685, 688-741`) read the latest `GPSLog` per bus with a route-link authorization check (parent's ward must have a stop on that bus's route, lines 700-710).

**Step 6 — Plugin gating / monetization.** Every transport route is behind `@plugin_required("gps_tracking")` (e.g. `transport.py:44, 274, 287`). The `gps_tracking` plugin (`backend/app/plugins/modules/gps_tracking/manifest.yaml`) is priced **Rs 299/mo / Rs 2,990/yr**, declares `api_blueprint: app.api.v1.transport`, `services: [app.tasks.gps_firebase_poller]`, `tasks: [app.tasks.gps_processing]`, full nav (Live Map/Routes/Buses/Stops/Trips/Monitor/GPS Logs/Reports) and mobile folders. The plugin's `__init__.py` is a one-line stub — the "plugin" is a gate/pricing/nav shell over the transport domain, which is coherent with how entitlements work here. The Flutter `PluginGate(pluginSlug: 'bus_tracking')` (`bus_tracking_screen.dart:126,132`) is correctly aliased to the canonical slug (`aschool_shared/lib/services/plugin_provider.dart:28`: `'bus_tracking': ['gps_tracking', 'transport']`).

### 2.3 Traced flow (end-to-end, as it would run)

```
ESP32+NEO-6M fix (firmware.ino:161-198)
  → HTTPS PUT/POST https://<rtdb>/schools/{sid}/buses/{did}/location.json?auth=<secret>
  → [beat 15s, app/__init__.py:353-357] poll_firebase_gps (gps_firebase_poller.py:48)
  → _pick_latest_fix (line 90) → dedupe vs GPSLog (107-113)
  → process_gps_data (gps_processing.py:47)
      → GPSLog row (83-95)                       [postgres: verified table exists, 0 rows]
      → Socket.IO gps_update → school room (97-108)   [realtime.py + lib/socket.ts:100]
      → transport_service.ingest_position for running trip (110-133)
  → check_geofence_alerts (gps_processing.py:144) → push if >2 km off-route (196-206)
  → Consumers:
      admin live map (transport/map/page.tsx:47-68 → LiveBusMap.tsx)
      parent Flutter (bus_tracking_screen.dart:73-96 → /parent/bus-location)
      parent web (app/parent/bus/page.tsx:39-47, 15 s poll)
      GPS Logs dashboard (transport.py:271-281)
```

Every hop above was verified at file:line level. The chain is internally consistent — including the subtle WiFi-PUT vs GPRS-POST shape handling on both sides.

### 2.4 Defects and gaps (evidence)

1. **Stale architecture in `hardware/README.md`:**
   - Cites `backend/tasks/gps_tasks.py` as the poller (`hardware/README.md:85`) — **no such file exists** (actual: `app/tasks/gps_firebase_poller.py` + `app/tasks/gps_processing.py`).
   - Cites `flutter_parent/lib/features/bus_tracking/bus_tracking_screen.dart` (`README.md:92`) — actual path is `features/bus_tracker/`.
   - Claims the parent Flutter app subscribes to Firebase RTDB in real time (`README.md:19-23`) — **false**: both parent surfaces poll the ASchool API, and no Flutter package includes the RTDB SDK (only `firebase_core`/`firebase_messaging` for push, `aschool_shared/pubspec.yaml`).
   - Says the Celery worker "polls Firebase every 30 seconds" (`README.md:21-22`) — beat is 15 s (`app/__init__.py:355`), matching the firmware's 15 s cadence.
2. **Placeholder Firebase config in the live environment:** `.env:85-86` = `FIREBASE_DATABASE_URL=https://aschool-gps.firebaseio.com`, `FIREBASE_SECRET=your-firebase-secret` (confirmed inside `aschool-flask-1` env). The poller's guard only checks that the URL is *present* (`gps_firebase_poller.py:52-54`), so the beat fires every 15 s against a placeholder host and silently no-ops (`resp.status_code != 200: continue`, line 84-85). Harmless but dead weight — and it means the "unconfigured" log path can never trigger with placeholder strings.
3. **Zero live data:** `buses`=0, `gps_logs`=0, `routes`=0, `bus_stops`=0 (live DB). No demo path exercises any of it; the map page will always show an empty map in the demo tenant.
4. **Web parent bus page field mismatch:** `frontend/app/parent/bus/page.tsx:22-25,76-82` expects `speed_kmph`, `updated_at`/`recorded_at`, but `/parent/bus-location` returns `speed`, `last_updated`, `status_text` (`parent_app.py:719-729`). `lat`/`lng` match so the Live badge and coordinates work, but speed and updated-at silently render nothing / "—" on web. The Flutter app reads the correct keys (`bus_tracking_screen.dart:84-89`).
5. **ETA is fake:** `eta_minutes` is populated from `bus.route.estimated_time_mins` — a static route attribute, not a computed arrival (`parent_app.py:681, 724`). The manifest sells "parent ETA alerts" (`gps_tracking/manifest.yaml:10-11`); nothing computes a live ETA from position.
6. The firmware's heartbeat path (`heartbeat.json`) has **no backend consumer** — no code reads the heartbeat node (grep across backend: only location.json is fetched).

### 2.5 Verdict

**Wired (code), unproven (reality).** The full chain exists, is gated, priced, tested at the route level, and co-designed between firmware and poller down to the RTDB shape subtleties. But: no device has ever connected (placeholder Firebase config, zero rows), the parent-facing README architecture is wrong in three specifics, and the root README's own honest status ("GPS hardware loop is wired end-to-end in code but unproven against live devices", `README.md:11-12`) remains accurate. What "wired" still requires: a real Firebase project + secret, one flashed device on one demo bus, a seeded route/stop/bus in the demo tenant, and the web parent page field fix.

---

## 3. iemis_templates/ — Contents and the Compliance Flow

### 3.1 What the two XLSX files actually contain

Opened with openpyxl (data_only). Both are **real exports from the Nepal MoE IEMIS portal**, not synthetic templates:

**`School_Level_Report_20260423.xlsx`** — 1 sheet `School_Level_Report`, 22 columns, 1 data row:
- Columns (exact, R1): `S.N, Iemis Code, School Name, School Type, School Sub Type, Province, District, Municipality, Ward, Tole, Head Teacher Name, Head Teacher Contact Number, School Email, Eced Establishment Date, Basic Level (1–5) Establishment Date, Basic Level (6–8) Establishment Date, Secondary Level (9–10) Establishment Date, Secondary Level (11–12) Establishment Date, SEE Code, HSEB Code, Class Registered Upto, School Level`
- Row 2: Bright Star English Boarding School, IEMIS code `710140006`, Private/Private Trust, Sudurpashchim Province, Kailali, Godawari Municipality-5, head teacher "Dharma Raj Regmi" with real phone/email, BS establishment dates (2051-02-28 etc.), SEE code 73157, class up to 10, level Secondary.
- Note the **en-dash** characters in "Basic Level (1–5)…" — the importer's column map matches them byte-for-byte (see 3.2).

**`Student_Namewise_Report20260423.xlsx`** — 1 sheet `Student_Namewise_Report`, 16 columns, **308 real student rows**:
- Columns (exact, R1): `S.N, IEMIS Code, Current School, Student Id, Full Name, Gender, Class, DOB, Age, Father Name, Mother Name, Guardian Name, Guardian Contact Number, Section, Permanent Address, Temporary Address`
- All 308 rows are IEMIS code 710140006 / Bright Star English Boarding School (Kailali). Class distribution: ECD/PPC 74, Grade 1: 28, 2: 19, 3: 27, 4: 22, 5: 24, 6: 34, 7: 22, 8: 25, 9: 14, 10: 19. Gender F 106 / M 202. DOBs are **Bikram Sambat strings** (2068–2074). 263 guardian phone entries (201 unique). Permanent/temporary addresses are real ward-level addresses ("Godawari - 5, Kailali", "Dhangadhi Sub - 15, Kailali").

**Privacy finding (material):** these two files contain real, named, addressable student PII — full names, BS birthdates, guardian names, guardian mobile numbers, home addresses — checked into the repository root. Nothing in the repo references these files (see 3.3), so they serve no functional purpose in the product; they are dev fixtures. Under Nepal's Individual Privacy Act 2075 (and general child-data caution) this is a compliance liability: 308 minors' records with guardian phone numbers, in git history. Recommendation in §8.

**Filename dating:** `20260423` (≈ BS 2082-01) is the export date from the IEMIS portal. There is **no version linkage to code** — no code reads, hashes, or pins these files; "versioning" exists only insofar as the importer's `FORMAT_MAP` matches their headers (which it does, exactly).

### 3.2 How the templates map to code (exact header diff)

`backend/app/api/v1/iemis_importer.py` (1,238 lines) defines three formats:

| Format code | Column map | Sheet expected | XLSX match |
|---|---|---|---|
| `student_namewise` | `STUDENT_NAMEWISE_COLUMNS` (`iemis_importer.py:43-60`) | `Student_Namewise_Report` | **16/16 headers identical** (programmatically diffed — zero extras either way) |
| `school_level` | `SCHOOL_LEVEL_COLUMNS` (`iemis_importer.py:62-85`) | `School_Level_Report` | **22/22 headers identical**, including both `IEMIS Code` vs `Iemis Code` casing variants per sheet and the en-dash establishment-date columns |
| `staff_details` | `STAFF_DETAILS_COLUMNS` (`iemis_importer.py:87-100`) | `Staff_Details` | **no shipped template** — format is live in the API but `iemis_templates/` has no sample, and the frontend UI offers only the two (§3.4) |

The `iemis_importer` plugin manifest (`backend/app/plugins/modules/iemis_importer/manifest.yaml`) mirrors the same column lists for both formats, declares `iemis.import_completed` emission, nav at `/dashboard/iemis-import`, and is one of only 4 manifests repo-wide carrying a `version:` field (1.0.0, per RECON_MAP §3.1).

The importer is free (`is_free: true`); the **compliance** plugin (`backend/app/plugins/modules/compliance/manifest.yaml`) is the paid side (Rs 149/mo) and points at `app.api.v1.compliance` + `app.services.compliance.moe_reports`.

### 3.3 Are the template files versioned/served? (No)

- Grep for `iemis_templates` across `backend/`, `frontend/`, all Flutter apps, `docs/`, `README.md`: **zero references**. The directory is an orphaned fixture — the product's actual template surface is the dynamic generator `GET /iemis/template` (`iemis_importer.py:983-1051`), which builds a header-exact workbook with one honest sample row ("Sample Student", `2065-04-15` DOB) per format on demand.
- Consequence: if the MoE changes the IEMIS export layout, nothing detects drift against these files. The files' only de-facto role is as test fixtures for manual validation — which works (see 3.5).

### 3.4 The importer flow (traced + live-verified)

**Frontend — three entry points, verified:**
1. `frontend/app/dashboard/iemis-import/page.tsx` (546 lines) — the primary surface: format list from `GET /iemis/formats` (line 114-117), 3-step upload→preview→done wizard, validate + import mutations (`lib/services/iemis.service.ts:53-81`), history sidebar, quick-links matching the manifest's nav subitems (lines 85-89), template download links for both formats (lines 304, 316), and file-vault integration via `FilePicker` + `fetchManagedFileAsFile` (lines 160-172). History detail page at `app/dashboard/iemis-import/history/`.
2. `frontend/app/dashboard/bulk-uploads/iemis/page.tsx` (202 lines) — a compact direct-import form (file + format select → `POST /iemis/import`, lines 42-49), linked from the bulk-uploads hub which also renders `/iemis/history` (`bulk-uploads/page.tsx:22,40`).
3. `frontend/app/dashboard/bulk-uploads/csv/page.tsx` (272 lines) — the generic CSV uploader offering all three IEMIS formats with labels from the live `/iemis/formats` response (lines 39-43) and template download driven by the same API (comment at 53-56: "No fake toast: this downloads") — this is the frontend that motivated the backend CSV parser twin.

**Mobile — declared but absent:** the `iemis_importer` manifest declares `mobile.admin.feature_folder: iemis_import` with Import/History tabs, but grep for "iemis" across all five Flutter apps + `aschool_shared` returns **zero matches** — no `iemis_import` feature folder exists in `flutter_admin/lib/features/` (36 features listed, none IEMIS). The admin app does have a `compliance` feature whose screen posts `type: 'emis'` (`flutter_admin/lib/features/compliance/compliance_screen.dart:85`), but IEMIS import is web-only today.

**Backend flow (one trace, file:line):**

1. `POST /iemis/validate` (`iemis_importer.py:1054-1108`): multipart file, ext whitelist xlsx/xls/csv, 20 MB cap, format param **or auto-detect** — `_detect_format` (932-955) reads the first 3 rows and keys on `Student Id`/`Iemis Code`+`School Name`/`Teacher Id`+`Designation`.
2. `_parse_tabular` → `_parse_excel` (124-176): openpyxl, header-row discovery (first non-empty row), exact-match header→field mapping, unknown-column warnings. CSV twin (179-227) exists because "the frontend previously faked the upload because only .xlsx was accepted" (code comment 180-184) for the generic bulk-uploads page.
3. `_import_students` dry-run (`iemis_importer.py:315-656`): full_name required (405-410), naive name split (412-415), `_gender_normalize` accepts `M/MALE/BOY/पुरुष` and `F/FEMALE/GIRL/महिला` (237-245), `_parse_dob` keeps the BS string as `dob_bs` and returns `None` for AD ("AD conversion would need nepalicalendar lib", 290-297), `_normalize_grade` strips "Class " prefixes (300-309), preview rows (430-446).
4. `POST /iemis/import` (1111-1210): creates `IemisImportLog(status="processing")` first (1144-1152), then live-imports per row inside `begin_nested()` savepoints (453): server-side **student-cap** enforcement against `School.max_students` (E2, 373-403), dedupe by IEMIS `student_id` (456-461), auto-create `Class`/`Section` matching the IEMIS `Class`/`Section` values (466-489), `ensure_student_numbers` backfills enrollment/roll with a FOR UPDATE lock (E235, 519-543), creates the student `User` with deterministic placeholder phone `9800000xxxx` when the row has no number (254-287, 563-576) and `stud.{iemis_id}@{slug}.import.local` email, upserts Guardian (father/mother/guardian) and links/creates the parent `User` by phone (583-637). Log updated to completed/partial/failed with capped error list; `iemis.import_completed` emitted (1180-1186).
5. Listener `on_iemis_imported` (`backend/app/plugins/listeners.py:485-500`) pushes "✅ IEMIS Import Complete" to `school_admin` — this was the B-13 fix (listener previously subscribed to a name the emitter never used).
6. Model: `IemisImportLog` (`backend/app/models/iemis.py:8-44`) — `format_code`, counts, status enum pending/processing/completed/partial/failed, errors JSONB, school-scoped.

**Live verification (2026-09-13, dry-run only — no DB writes, code-verified at `iemis_importer.py:448-450`):**
- `GET /api/v1/iemis/formats` → 3 formats, correct sheets and column counts (16/22/12).
- `POST /api/v1/iemis/validate` with the **shipped** `Student_Namewise_Report20260423.xlsx` → `total_rows: 308, valid_rows: 308, warnings: []`, first preview row correctly parsed (`Anjal Pariyar`, grade 5, female, `dob_bs` set).
- Same call with `School_Level_Report_20260423.xlsx` and **no format param** → auto-detected `school_level`, 1/1 valid.
- Live DB: `iemis_import_logs` = 0, `students` = 0, `users` with `.import.local` email = 0 — the demo tenant has never run a live import.

**Export direction (the compliance half) — traced and found hollow:**
- `MoEReportService.build_emis_csv` (`backend/app/services/compliance/moe_reports.py:17-43`): a 9-column EMIS CSV header `Class, Grade, Total, Male, Female, Other, Dalit, Janajati, Disabled` — genuinely Nepal-specific disaggregation.
- `export_emis_data` Celery task (`backend/app/tasks/report_generation.py:258-360`): computes per-class enrollment with dalit/janajati substring matching on `Student.ethnicity` and `Student.disability` (291-293), staff summary, writes the CSV through the platform's storage (`upload_file`, 333-340) and an `EMISExport` row with `file_key`; download endpoint `GET /compliance/emis/<id>/download` (`backend/app/api/v1/compliance.py:156-190`) streams local or presigns R2. **But grep for callers of `export_emis_data` across app/, scripts/, frontend/, mobile: none.** No route, no beat entry, no UI button dispatches it. The task is orphaned.
- `POST /compliance/emis/generate` (`compliance.py:134-153`) doesn't generate anything — it stores whatever JSON the client posts into `export_data`.
- `POST /compliance/reports/generate` (79-118) computes exactly two numbers (student count, staff count).
- **Frontend compliance page is contract-mismatched:** `frontend/app/dashboard/compliance/page.tsx` renders `c.name || c.requirement`, `c.category`, `c.due_date`, `c.updated_at` (lines 78-83) — none of which exist in `_report_dict` (`compliance.py:231-240`, which returns `report_type/academic_year/data/status/notes/...`). Its KPI logic filters on statuses `compliant`/`overdue`/`expired` (lines 33, 66-67) — the DB enum is `draft/submitted/accepted` (`backend/app/models/compliance.py:15`). The "Generate MoE Report" button (line 60) has **no onClick handler**. The page will always show an empty, mislabeled table.
- Flutter admin `compliance_screen.dart:85` posts `type: 'emis'` — same shallow surface on mobile.
- Live DB: `compliance_reports` = 0, `emis_exports` = 0.

### 3.5 Verdict

- **IEMIS *import* (iemis_importer plugin): wired and live-verified.** Header-exact against real government files, dry-run validated 308/308 live, full student/parent/class/guardian creation chain, eventing, history UI. This is the strongest of the three supporting systems.
- **Compliance/EMIS *export*: partially wired.** Models + a Nepal-correct CSV format + a download endpoint exist, but the generating task has no caller, the API "generate" routes don't generate, the frontend renders a different contract than the API returns, and nothing has ever run (0 rows everywhere).
- The `iemis_templates/` directory itself is **orphaned as files** (zero code references) — its value is as fixtures and as a PII liability.

---

## 4. nepal_textbooks/ — Catalogs and the Ingestion Flow

### 4.1 Corpus inventory (verified on disk)

656 files, 2.2 GB total (`find | wc -l`, `du -sh`):

| Location | Files | Content |
|---|---|---|
| `Grade_01/` … `Grade_12/` | 242 (121 PDF + 121 TXT) | Official CDC textbooks: मेरो नेपाली, मेरो गणित, मेरो अंग्रेजी, हाम्रो सेरोफेरो, विज्ञान, सामाजिक अध्ययन + translated editions (अनुवादित संस्करण) + स्वाध्याय सामग्री (self-study materials), editions BS 2076–2080 |
| `nepal_educational_materials/Teacher_Guides/` | 229 | शिक्षक निर्देशिका (teacher guides) per grade/subject, incl. CDC Bhaktapur archive items (some ZIP) |
| `nepal_educational_materials/Model_Questions_and_Grids/` | 144 | Model questions and specification grids (विशिष्टीकरण तालिका) incl. Grade 11/12 NEB grids |
| `nepal_educational_materials/Evaluation_and_Curriculum/` | 37 | National Curriculum Framework विद्यालय शिक्षाको राष्ट्रिय पाठ्यक्रम प्रारूप २०७६/२०६३ etc. |
| root catalogs | 3 JSON | see 4.2 |
| `nepal_educational_materials/catalog.json` | 1 JSON | 212 binary entries |

PDF text-layer reality check (PyMuPDF): Grade 5 नेपाली २०८० has a usable Unicode text layer (845 chars sampled); **Grade 1 मेरो नेपाली २०७६'s text layer is Preeti-encoded ASCII mojibake** (`d]/f] g]kfnL` for "मेरो नेपाली"). The 319 `.txt` sidecars are raw extractions — I byte-compared a PDF page against the sidecar: the sidecar is the same Preeti mojibake, **no Devanagari present** (checked `\u0900-\u097f` over the sample). So the ".txt corpus" is not directly usable for Nepali NLP.

The backend ships a **working Preeti→Unicode transcoder** (`backend/app/utils/preeti_transcoder.py`); verified live inside the flask container: `preeti_to_unicode('d]/f] g]kfnL, sIff !')` → `'मेरो नेपाली, कक्षा १'`, `is_preeti_encoded` → `True`. This is a genuine, tested Nepal-specific asset.

### 4.2 The three catalogs — roles, diffed

| Catalog | Shape | Role (verified) | Integrity |
|---|---|---|---|
| `catalog.json` (121 entries) | list of `{grade, subject, book_name, edition, page_url, pdf_url, filename, dest_path, file_size_bytes, file_size_mb}` | **The working catalog** of the 121 CDC textbooks. `page_url` values are `moecdc.gov.np/content/<id>/...` and `pdf_url` are `giwmscdcone.gov.np` CDN links — i.e., this was scraped from the official CDC site. Filenames are normalized (subject prefix stripped: `Grade_05_नेपाली_२०८०.pdf`). | **121/121 `dest_path`s exist on disk.** `subject` is the generic "सबै (विषय अनुसार)" for every row (no per-subject tagging). |
| `catalog_resolved.json` (121 entries) | same keys minus file_size | **Pre-normalization intermediate**: filenames carry the raw scraped subject prefix (`Grade_01_सबै_(विषय_अनुसार)_मेरो_नेपाली_२०७६.pdf`). | **0/121 paths exist** — kept as a pipeline artifact only. |
| `resources_catalog.json` (13 keys: Grade 01–12 + National/Framework) | dict of category → list of `{ref, title, ext}` | **Reference-only scrape** of moecdc teacher-guide/model-question listings (ref = gov site content IDs, HTML entities unescaped in titles). No paths, no files. | Not path-bearing; corresponds to the materials that were later downloaded into `nepal_educational_materials/`. |
| `nepal_educational_materials/catalog.json` (212 entries) | list of `{category, grade_folder, filename, path, format, file_size_*}` | Catalog of the 212 binaries (121 Teacher_Guides, 72 Model_Questions_and_Grids, 19 Evaluation_and_Curriculum). | **All 212 `path` values are broken**: they point to `/home/bishal-regmi/Desktop/ASchool/nepal_educational_materials/...` — a directory that does not exist. The files actually live at `nepal_textbooks/nepal_educational_materials/...`. Repointing the prefix fixes **212/212**. The ingestion script works around this at runtime (`ingest_textbook_catalog.py:126-130` re-resolves the path), so it's latent, not fatal. |

Grade coverage (catalog.json counts): G1:6, G2:6, G3:6, G4:9, G5:8, G6:9, G7:9, G8:9, **G9:23, G10:21**, G11:9, G12:6. All 12 grades are present; depth is heavily weighted to SEE-critical grades 9–10. Core subjects (Nepali/Math/English/Science/Social) dominate; optional subjects appear in 9–12. No subject metadata in the catalog itself — subject is only recoverable from Devanagari titles.

### 4.3 The ingestion path — what exists vs. what runs

**Claimed ingester: `backend/scripts/ingest_textbook_catalog.py` (207 lines).** Its docstring says it "registers TextbookCorpus records with idempotency" (line 6). **It does not** — there is no import of any model, no `db`, no session, no commit anywhere in the file. What it actually does:
1. `load_all_publications` (91-150): reads `catalog.json` (with dest-path fallback to a computed relative path, 103-105) and the materials catalog **with the broken-path fix** (126-130) — the fix exists only here, the JSON on disk stays broken.
2. `detect_pdf_characteristics` (30-88): PyMuPDF forensics — page count, text-layer presence, classification `unicode|preeti|scanned|english` using the real transcoder (67-77), sample raw + cleaned text.
3. Prints an encoding census; optional `--output-json` report. The `--dry-run` flag exists but there is no non-dry-run behavior to distinguish — nothing ever writes.

So this is a **forensic census tool mislabeled as an ingester**. (Its output would make a good pre-flight for the real loader, though.)

**Physical-grounding schema: `backend/app/models/textbook.py` (165 lines).** `TextbookCorpus` → `TextbookChapter` → `TextbookSection` + `TextbookPage` (printed page numbers, bbox-ready, raw vs unicode-clean text, 300-DPI WebP path) + `TextbookAsset` (geometry/circuit/anatomy/chart/map/formula crops with normalized bboxes, SVG paths, AI vision descriptions). This matches the multimodal architecture doc (§4.5). **Live DB: all five tables = 0 rows.** The only code that reads these models is `backend/app/services/ai/curriculum_context_builder.py:27` — whose own tenancy-guard comment admits: "this builder is dormant (no route wiring yet)" (lines 32-33). No API route touches `TextbookCorpus` (grep across `app/api/`: zero).

**S12 content spine (the newer, real path).** `backend/app/models/content_spine.py`: `content_sources` (sha256-deduped, `kind` = textbook|teacher_guide|spec_grid|model_question|past_paper|syllabus|curriculum_doc|oer|school_upload, board, edition BS/AD, `ingest_status` ladder registered→…→published, coverage manifest; `school_id NULL` = platform corpus) → `content_units` (aligned to `curriculum_units`) → `content_chunks` (page-anchored, kind-tagged, verbatim; HNSW+GIN vector) plus `question_papers`/`paper_questions` (1:1 reprint archive) and golden-set/eval tables. The **only DB writer** is `backend/app/content_loader.py` (747 lines): a CLI (`validate|ingest|status` per staged `book_dir` of agent-produced JSON per `aw-page@1`/`aw-verify@1`/`aw-book-manifest@1` schemas) with a 98 %-coverage + zero-unresolved-flags publish gate (content_loader.py:1-24). Admin surface: `backend/app/api/v1/content_admin.py` (list/get/chunks/publish/review endpoints) + `frontend/app/dashboard/content-review/page.tsx` (wired to `/content/sources...`, lines 87-126). Migration `s12_spine_01` + 10/10 tests recorded in AUDIT_INDEX (2026-09-11). **Live DB: content_sources = content_units = content_chunks = question_papers = 0.** The pilot (Grade 10 Science + Math, per AUDIT_INDEX) has not been run.

**Curriculum seed (the only live curriculum data).** `backend/app/services/ai/curriculum_seed.py` self-describes as "Research-derived skeleton for grades 1-10 core subjects (CDC basic-level curriculum 2078)" (lines 1-5) — hand-written unit title tuples (e.g. English G1 "My Body and Health/मेरो शरीर र स्वास्थ्य", lines 9-48), **not** parsed from the actual framework PDFs sitting in `nepal_educational_materials/Evaluation_and_Curriculum/`. Seeded at startup (`backend/app/__init__.py:650-652`). Live DB: 50 `curriculum_frameworks` (board=cdc, grades 1–10 × ENGLISH/MATH/SCI/SOC/NEP), 170 `curriculum_units`, **0 `learning_outcomes`, 0 `curriculum_concepts`, 0 `teaching_sections`, 0 `question_bank_items`**. NEB 11-12 exists only as 8 `SubjectOffering` rows (curriculum_seed.py:53-61) — no frameworks/units for 11-12 despite the corpus covering them.

**What the AI actually grounds on today:** `document_chunks` = 6 rows, all `source_type='policy'` (an ICT-in-Education policy doc — "Understanding ICT in Education Policy… Teachers", verified by sampling text). The AI tutor/workbench chain (`tutor_engine.py`, `workbench.py`) has no textbook, no teaching-section, and no content-chunk rows to ground on. RAG is, as the 2026-09-05 research put it, "effectively half-dead outside policy/framework seeding" — still true.

### 4.4 Traced flow: catalog row → teacher/student-visible surface

**There is no complete flow today.** The honest partial trace:

```
catalog.json row (Grade_05_नेपाली_२०८₀, moecdc.gov.np provenance)
  → file on disk (verified 121/121)
  → [STOP: ingest_textbook_catalog.py analyzes but writes nothing to any DB]
  → intended path A (textbook.py models): 0 rows, no API, sole reader dormant
  → intended path B (S12): content_loader ingest <staged book_dir>  — never run (0 rows)
  → would-be surfaces, all verified empty:
      GET /content/sources (content_admin.py:18) → content-review dashboard page (empty)
      AI tutor grounding (teaching_sections=0, content_chunks=0)
      elibrary (serves admin-uploaded `books`, table = 0 rows — not this corpus at all)
  → the ONLY live downstream of the curriculum domain:
      curriculum_seed.py → 50 frameworks + 170 units (skeleton) → consumed by
      timetable/lesson-plan/question-paper services via framework/unit lookups
```

The one *complete* Nepal-curriculum flow that exists is the seed skeleton → framework/unit consumers chain; it does not pass through `nepal_textbooks/` at all.

### 4.5 The design docs (context, not implementation)

`docs/CURRICULUM_MULTIMODAL_INGESTION_ARCHITECTURE.md` (999 lines) is a research specification: parsing-paradigm SOTA, a genuinely deep Preeti/Devanagari typography analysis (§1.2), ColPali-vs-hybrid-RAG tradeoffs, a Pedagogical Knowledge Graph schema, a Celery pipeline blueprint with QTI 3.0 exercise extraction. Its cost/CER claims ($0.00018/page, <0.8 % CER) were already flagged as hypotheses by the 2026-09-05 research. The operative successor docs are `docs/AI_WORKSPACE_FINAL_PLAN_2026-09-10.md` + `docs/ai_workspace_prompts/AGENT_INGESTION_BRIEF.md` (v2.0). The brief is a genuinely rigorous operator runbook — evidence the *process* is ready even though it hasn't run:

- **Golden rules** (`AGENT_INGESTION_BRIEF.md:48-71`): verbatim fidelity ("Transcribe exactly what is printed… Devanagari numerals stay Devanagari in `*_printed` fields; ASCII mirrors go in `*_ascii`"), "Never guess — Illegible → `[illegible]`", LaTeX math "exactly as printed", provenance on every block (`page_no`, `bbox` 0–1000, keyed by `sha256(page_image)+prompt_version+model_id`), one-book-at-a-time staging under `staging/<book_slug>/`.
- **Per-source-kind outcomes** (mission table, lines ~27-31): textbooks → content_sources/units/chunks; teacher guides → same spine + `audience: "teacher"` blocks; **specification grids → `paper_blueprints` rows** (unit × question-type × marks × count × Bloom, as printed); model questions/SEE/NEB papers → `question_papers` + `paper_questions` organized for 1:1 reprint.
- **Preeti routing rule** (line ~46): use vision on rendered PNGs for any page whose text layer fails `is_preeti_encoded` or is scanned — the exact failure mode I reproduced in the Grade 1 PDF.
- **Loader-first discipline** (lines ~38-41): "If the loader is not yet built, STOP after staging and report — never hand-write SQL inserts."

### 4.6 Verdict

**Partially wired.** Assets are real and substantial: 320 genuine CDC PDFs with official provenance URLs, a working Preeti transcoder, a forensic quality census tool, a well-designed physical-grounding schema, and a tested S12 spine + loader + review UI. But **zero ingestion has executed**: every corpus-adjacent table is empty, the "ingestion script" doesn't ingest, the older textbook schema is dormant with no API, and the only live curriculum data is a hand-written 50-framework skeleton whose source of truth is a developer's research notes rather than the 37 curriculum-framework PDFs in the corpus. "Wired" requires: run the agent extraction pilot on the chosen Grade 10 books, `content_loader ingest --publish` them, fix the materials-catalog paths, and connect at least one consumer (tutor grounding or the student reader).

---

## 5. Wiring Verdicts (per system)

### 5.1 hardware/ — WIRED (code) / UNPROVEN (reality)

- **Evidence for wired:** beat entry (app/__init__.py:352-357) → poller that cites the firmware file (gps_firebase_poller.py:3-4, 46-127) → dual-shape fix parsing mirroring the firmware's PUT/POST asymmetry (gps_firebase_poller.py:25-43 ↔ firmware.ino:218-263) → persistence + Socket.IO broadcast + shared trip engine (gps_processing.py:46-140) → three live consumers (admin map page, Flutter parent, web parent) → plugin gate + Rs 299/mo pricing on every route. Direct-ingest and driver-phone alternative sources both land in the same `GPSLog`/geofence engine (transport.py:284-315, 719; flutter_user driver_run_screen.dart + transport_repository.dart:128).
- **Evidence for unproven:** live env Firebase values are placeholders (`.env:85-86`, confirmed in container env); 0 buses / 0 gps_logs / 0 routes / 0 stops in the live DB; poller silently no-ops against the placeholder host; README.md:11-12's own admission.
- **To be fully wired:** real Firebase project + secret; one flashed unit on a demo bus; seed route/stop/bus rows; fix hardware/README.md's three stale specifics (§2.4.1); fix the web parent bus page field mismatch (§2.4.4).

### 5.2 iemis_templates/ — import WIRED (live-verified); export PARTIAL; the files themselves ORPHANED

- **Import wired:** header-exact FORMAT_MAP (16/16 + 22/22 verified diff) ↔ real government exports; live dry-run of the shipped student file returned 308/308 valid with zero warnings; full write chain (students, users, guardians, classes, sections, import log, event, push) code-traced; deep frontend wizard + history + template generator.
- **Export partial:** `MoEReportService` + `export_emis_data` + `EMISExport` download all exist, but the task has **no caller** (grep-verified across backend/frontend/mobile), `/compliance/emis/generate` is a passthrough, and `dashboard/compliance/page.tsx` renders a field contract the API doesn't return with a dead "Generate MoE Report" button. 0 rows in all three tables.
- **Files orphaned:** zero references to `iemis_templates/` anywhere in code; the product's template surface is the dynamic `/iemis/template` generator. The XLSX files are fixtures — and PII-bearing ones (§3.1).
- **To be fully wired:** dispatch `export_emis_data` from a compliance UI action; rewrite the compliance page against `_report_dict`; either wire the shipped files in as contract tests (CI opens them and asserts headers ⊆ FORMAT_MAP) or remove them from the repo and git history.

### 5.3 nepal_textbooks/ — PARTIALLY WIRED (schema yes, data no)

- **Evidence for partial:** corpus + 3 catalogs + working transcoder + forensic script + two full schemas (textbook.py, content_spine.py) + tested loader CLI + content_admin API + content-review UI — the entire *receiving end* exists.
- **Evidence against:** every table empty (textbook_corpora 0; content_sources/units/chunks 0; question_papers 0); `ingest_textbook_catalog.py` writes nothing despite its docstring; the only TextbookCorpus reader is self-declared dormant; the 212 materials-catalog paths are broken on disk; the live curriculum seed is hand-written, covers only G1–10 core subjects, and has zero outcomes/concepts; the only document_chunks are a 6-chunk policy doc.
- **To be wired:** execute the documented agent pilot (Grade 10 Science + Math) through `content_loader ingest --publish`; fix materials-catalog paths; extend the seed (or generate it) from the actual framework PDFs; connect a consumer (AI tutor grounding, student reader, or spec-grid → paper blueprint materialization).

---

## 6. Nepal-Specificity Assessment (the moat, honestly)

These three directories are ASchool's claim to being *for Nepal* rather than a generic LMS localized for Nepal. Assessed against the 7 audited competitors (none of which ships an IEMIS importer, a CDC corpus, or local hardware economics):

### 6.1 Genuinely deep (product-grade)

1. **IEMIS import (iemis_importer plugin).** Header-for-header fidelity to real MoE portal exports — including the `Iemis Code` vs `IEMIS Code` casing difference between the two reports and en-dash column names — plus BS-date handling, Nepali gender tokens (पुरुष/महिला), `ECD/PPC` as a class value, SEE/HSEB codes, SEE-code-aware school metadata, Nepal-format placeholder phones (9800000xxxx reserved block), and student-cap entitlement integration. This is a real government-system integration, live-verified. No competitor has this. **The single most concrete moat asset of the three systems.**
2. **The CDC corpus + Preeti transcoder.** 320 real textbooks with `moecdc.gov.np` provenance, 2.2 GB, editions tracked in Bikram Sambat — plus a *working* Preeti→Unicode transcoder in the backend (verified live: mojibake → `मेरो नेपाली, कक्षा १`). The Preeti problem is real (I reproduced it in the Grade 1 PDF text layer), and owning a tested transcoding path is rare, genuinely hard-won local engineering. The corpus is a moat-in-waiting: no competitor could assemble this quickly, but ASchool also hasn't productized it yet.
3. **Hardware economics.** The Rs 2,900/bus BOM with NPR component prices, NTC/Ncell APN defaults, SIM800L power-spike handling, and "Rs 150/month" operating cost is real local sourcing knowledge. SchoolBusTrack — the one transport-focused competitor — sells tracking but not a self-buildable open hardware kit. The moat here is credibility with price-sensitive Nepali schools, contingent on one real deployment proving it.

### 6.2 Real but unrealized (infrastructure-grade)

4. **Textbook ingestion stack.** The S12 spine, loader with a 98 %-coverage publish gate, verbatim-text + bbox grounding schema, and question-paper 1:1-reprint contract are architecturally serious and *Nepal-shaped* (Preeti classification, Devanagari verification protocol in the operator brief). But with 0 rows ingested, a school buying "AI grounded in the national curriculum" today gets the 50-row skeleton and a 6-chunk policy doc. The gap between the 999-line architecture doc and the empty `content_sources` table is the biggest honesty gap in the product.
5. **EMIS export taxonomy.** Dalit/Janajati/Disabled disaggregation in `build_emis_csv` is exactly what MoE flash reports require — but it's unreachable (orphaned task).

### 6.3 Marketing-level (surface)

6. **"Government compliance" plugin (Rs 149/mo).** The compliance dashboard is a contract-mismatched shell over 0 rows, with a dead button. The *importer* (free) is the real compliance value; the paid plugin currently sells the weaker half.
7. **Live ETA / "parent ETA alerts."** Static route attribute, not computed — the manifest's promise isn't delivered by the code.
8. **hardware/README.md architecture.** Three factual errors (dead paths, wrong transport, wrong cadence) undercut the otherwise excellent firmware.

**Net:** the moat is real at the *asset* level (data, formats, transcoder, BOM) and hollow at the *experience* level (no ingested books, no devices, no generated reports). One executed textbook pilot, one bus with a tracker, and one EMIS export run would convert all three from story to substance — each is blocked on operations, not engineering.

---

## 7. Prior-Corpus Reconciliation (still true / fixed / worse / not reproducible)

| Prior claim | Source | Verdict today | Evidence |
|---|---|---|---|
| "nepal_textbooks contains 337 files: 320 PDFs, 12 ZIPs, 1 DOCX, 4 JSON catalogs, ~2.1 GB" | `audits_old/research/TEXTBOOK_AI_ARCHITECTURE_RESEARCH_2026-09-05.md:21` | **Changed (grown):** now 656 files / 2.2 GB — 320 PDF + **319 TXT sidecars** (added after that research) + 12 ZIP + 1 DOCX + 4 JSON | `find nepal_textbooks -type f` counts, 2026-09-13 |
| "pdftotext produced zero useful bytes… files range from valid Unicode to scans and legacy-font garbage" | same, :22 | **Still true** (and now precisely characterized): Grade 1 PDF text layer = Preeti mojibake; Grade 5 2080 = valid Unicode; sidecars are raw, un-transcoded | PyMuPDF extraction + byte-comparison, §4.1 |
| "catalog.json has only 121 records and generic subject values" | same, :25 | **Still true** — 121 records, every `subject` = "सबै (विषय अनुसार)" | §4.2 |
| "There is no textbook ingestion route, job model… RAG is effectively half-dead outside policy/framework seeding" | same, :33 | **Partially fixed / still true:** S12 spine + loader + content_admin route now exist (AUDIT_INDEX 2026-09-11), but 0 rows ingested and the only document_chunks remain a 6-chunk policy doc | §4.3; DB counts |
| "The seed is only a small skeleton, not the complete official syllabus" | same, :29 | **Still true** — 50 frameworks (G1–10 × 5 subjects), 170 units, 0 learning_outcomes, hand-written titles | `curriculum_seed.py:1-5`; DB counts |
| "656 files/2.2 GB, Nepali sidecars Preeti-mojibake" | `audits/AUDIT_INDEX.md:50-51` (2026-09-10) | **Still true** (reproduced) | §4.1 |
| "curriculum seed synthetic w/ zero outcomes" | `audits/AUDIT_INDEX.md:60` | **Still true** (learning_outcomes = 0) | §4.3 |
| S12 built: spine migration, `app/content_loader.py`, 10/10 tests | `audits/AUDIT_INDEX.md:164-188` (2026-09-11) | **Reproduced** — loader (747 lines), models, content_admin API, content-review page all present | §4.3 |
| "Founder starts extracting pilot books (Grade 10 Science + Math)" | `audits/AUDIT_INDEX.md:124` | **Not done** — content_sources = 0 | §4.3 |
| B-13: listener renamed `iemis.imported` → `iemis.import_completed` | `audits/AUDIT_INDEX.md:90` | **Fixed, verified** — `listeners.py:485-500` now matches the emit at `iemis_importer.py:1180` | §3.4 |
| B-16: gps_tracking unhidden, "built end-to-end" | `audits/AUDIT_INDEX.md:92` | **Verified** — `coming_soon: false` in manifest; end-to-end code confirmed (§2) but still 0 live data | §2 |
| A-10 dual ingest: driver-phone + ESP32 feed the same geofence engine | `audits/AUDIT_INDEX.md:299` | **Verified** — `gps_processing.py:110-133` + `transport.py:719` | §2.2 |
| "iemis_importer… 988 lines… 100% Fully Working" | `audits_old/ALL_57_PLUGINS_DEEP_DIVE_AUDIT_2026-08-27.md:345-353` | **Still substantially true, and grown:** 1,238 lines now (CSV path, dynamic template download, staff_details format, student caps, placeholder phones); live dry-run validated 308/308. Caveat: the audit predates the staff format and never exercised a live import — DB still has 0 imports | §3.4 |
| "GPS hardware loop is wired end-to-end in code but unproven against live devices" | root `README.md:11-12` | **Still true** — placeholder Firebase config, 0 rows | §2.4 |
| CURRICULUM doc's cost/CER benchmarks ($0.00018/page, <0.8 % CER) | `docs/CURRICULUM_MULTIMODAL_INGESTION_ARCHITECTURE.md` §Exec/§1.3 | **Not reproducible** (and already flagged as hypotheses by the 2026-09-05 research, :166) — no extraction has run to measure against | §4.5 |

---

## 8. Strengths / Weaknesses / Recommendations

### Strengths (evidence-backed)

1. **The IEMIS importer is a real, live government-format integration** — header-exact against actual MoE exports (16/16, 22/22 columns), 308/308 rows dry-run validated live, with thoughtful Nepal-specific handling (BS dates, Nepali gender tokens, SEE/HSEB codes, deterministic placeholder phones in a reserved 9800000xxxx block). (`backend/app/api/v1/iemis_importer.py:43-118, 254-297, 315-656`.)
2. **The ESP32 firmware and poller are co-designed with unusual rigor** — the backend handles the exact PUT-vs-POST RTDB shape asymmetry the firmware documents (`gps_firebase_poller.py:25-43` ↔ `firmware.ino:218-263`), the firmware refuses to run with placeholder identity, and hardware + driver-phone feeds converge on one trip engine (`gps_processing.py:110-133`).
3. **A working Preeti→Unicode transcoder in the backend** (`backend/app/utils/preetti_transcoder.py`, verified live in-container) plus a PDF-forensics classifier (`ingest_textbook_catalog.py:30-88`) — the two hardest Nepal-specific text problems have working local tooling.
4. **The CDC corpus is genuine and well-provenanced** — 121/121 cataloged textbooks exist on disk with `moecdc.gov.np`/`giwmscdcone.gov.np` source URLs and BS editions (`nepal_textbooks/catalog.json`), covering all grades 1–12 with SEE-critical depth (G9: 23, G10: 21).
5. **The S12 receiving end is built and tested** — spine models with a sha256-dedup and publish ladder, a 747-line loader CLI with a 98 %-coverage gate, an admin API, and a review UI (`content_spine.py`, `content_loader.py`, `content_admin.py`, `app/dashboard/content-review/page.tsx`).

### Weaknesses

1. **Zero executed ingestion:** every textbook/content table is empty; `ingest_textbook_catalog.py`'s docstring claims DB registration that its code doesn't do (line 6 vs. the entire file); the only TextbookCorpus reader is self-declared dormant (`curriculum_context_builder.py:32-33`). The 999-line architecture doc describes a system that has processed zero books.
2. **The compliance export half is a shell:** `export_emis_data` has no caller anywhere; `/compliance/emis/generate` stores client-passed JSON; `dashboard/compliance/page.tsx` renders fields the API never returns and a dead button — while being the *paid* plugin (Rs 149/mo).
3. **Real student PII committed at repo root:** 308 named minors with guardian phones and addresses in `iemis_templates/Student_Namewise_Report20260423.xlsx`, referenced by no code.
4. **Stale hardware README** (`hardware/README.md:21-22, 85, 92`): dead `gps_tasks.py` path, wrong parent-app transport claim, wrong poll cadence — the onboarding doc for the exact audience (a school flashing its first device) is the least accurate doc in the chain.
5. **Broken paths in the materials catalog** (all 212 entries in `nepal_educational_materials/catalog.json` point outside the tree) and an orphaned `catalog_resolved.json` (0/121 paths) — catalog hygiene lags the corpus.
6. **Web parent bus page contract mismatch** (`app/parent/bus/page.tsx:22-25` vs `parent_app.py:719-729`) and a fake ETA (`estimated_time_mins` presented as live ETA, `parent_app.py:681,724`).
7. **Manifest-declared mobile surface that doesn't exist:** `iemis_importer/manifest.yaml` declares `mobile.admin.feature_folder: iemis_import` (Import/History tabs) but no Flutter app contains any IEMIS code — import is web-only.
8. **Demo-tenant emptiness:** 0 students, 0 buses, 0 imports, 0 books — none of the three moat systems has a demo path a sales demo could show.

### Recommendations (priority order)

1. **Run the textbook pilot (highest leverage):** execute the documented Grade 10 Science + Math extraction via `content_loader ingest --publish`, then surface one chunk-grounded answer in the AI tutor. This converts the entire "national-curriculum AI" story from architecture doc to product. Blocker is operations, not code.
2. **Purge the PII fixtures:** remove `iemis_templates/*.xlsx` from the working tree and git history (or replace with the dynamic `/iemis/template` output), and add a CI guard that fails if files with guardian-phone patterns (`98XXXXXXXX` + student names) appear at repo root. If real-school fixtures are needed, keep them out-of-repo and encrypted.
3. **Fix the compliance export chain (it's the paid plugin):** dispatch `export_emis_data` from a "Generate EMIS Export" action on the compliance page; rewrite `dashboard/compliance/page.tsx` against `_report_dict` (report_type/status draft-submitted-accepted); consider exposing the Dalit/Janajati/Disabled CSV columns in the UI preview.
4. **One real bus:** create a Firebase project, flash one unit, seed one demo route/stop/bus, and let the 15 s beat actually flow. Then update `hardware/README.md` (gps_tasks.py → app/tasks/gps_firebase_poller.py, bus_tracking → bus_tracker, "real-time Firebase listener" → "15 s API polling", 30 s → 15 s).
5. **Catalog hygiene:** regenerate `nepal_educational_materials/catalog.json` with corrected paths (one prefix change fixes 212/212); either delete `catalog_resolved.json` or add a README line explaining it's the pre-normalization artifact; add per-subject values to `catalog.json` (currently every row says "सबै (विषय अनुसार)").
6. **Transcode the .txt sidecars** through the existing `preeti_transcoder` (or drop them) so the 319 text files become usable for BM25/Nepali NLP instead of mojibake ballast.
7. **Wire the shipped IEMIS templates as contract tests** (after de-PII-ing): a CI test that opens the two XLSX headers and asserts equality with `STUDENT_NAMEWISE_COLUMNS`/`SCHOOL_LEVEL_COLUMNS` would catch MoE format drift — the thing the dated filenames imply someone cares about.
8. **Fix the web parent bus page field names** (`speed_kmph/updated_at` → `speed/last_updated`) and either compute a real ETA from position vs stop or relabel the field.
9. **Resolve the mobile IEMIS gap:** either build the declared `iemis_import` admin feature (even a thin history + template-download + validate-preview screen) or drop the `mobile:` block from the manifest so the plugin's advertised surfaces match reality.

---

### Appendix: live-DB row counts used in this report (2026-09-13, aschool-postgres-1)

| Table | Rows | Table | Rows |
|---|---|---|---|
| buses / gps_logs / routes / bus_stops | 0 / 0 / 0 / 0 | textbook_corpora / pages / chapters / sections / assets | 0 ×5 |
| iemis_import_logs | 0 | content_sources / content_units / content_chunks | 0 ×3 |
| compliance_reports / emis_exports | 0 / 0 | question_papers | 0 |
| students | 0 | curriculum_frameworks / curriculum_units | 50 / 170 |
| users (`.import.local`) | 0 | learning_outcomes / curriculum_concepts | 0 / 0 |
| books (elibrary) | 0 | document_chunks | 6 (policy doc) |
