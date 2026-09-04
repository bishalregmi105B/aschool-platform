# Competitor Landscape — School Management SaaS in Nepal (for ASchool)

Research date: 2026-09-04. Method: direct fetch of competitor sites (curl + WebFetch), Play Store / iTunes Search API scraping, DuckDuckGo result sweep. Everything marked "not published" was genuinely not found publicly; nothing here is invented. URLs cited inline.

---

## 1. DEEP PROFILES

### 1.1 Veda (inGrails Pvt. Ltd.) — the market leader
Site: https://veda-app.com/ · Company: https://ingrails.com/ · Jawalakhel, Lalitpur

**Positioning & traction**
- "School and College Management System — Veda MIS & ERP for Schools"; "the best all-in-one cloud-based school software and digital learning system for growing, big and ambitious names in education."
- Claims **1,300+ schools/colleges/preschools across Nepal**, "99% client renewal rate for more than 6 years", "market leader in 32 major cities", "up & running within 10 days", 15+ support staff available 24h (https://veda-app.com/).
- Clients page lists flagship schools: St. Xavier's, St. Mary's, Rato Bangla, Galaxy Public, Brihaspati Vidyasadan, The Excelsior, Rupy's, and dozens of out-of-valley schools (https://veda-app.com/clients).
- Founded Mar 2015; first school St. Xavier's (May 2016); first school outside Nepal (Brunei) Jan 2022; directors include Dilip Agrawal (WorldLink co-founder) and Amit Agrawal (Khalti co-founder) (https://veda-app.com/about).
- Runs a **dealer/reseller program** for distribution (https://veda-app.com/dealership).

**Products advertised (homepage)**
- Veda (core MIS/web), Veda Guru (teacher app), Veda Student, **Veda Founder's App** (multi-school owner dashboard), Veda Billing (IRD-verified invoicing), Veda Finance (accounting), Veda Attendance (staff), Veda Academics, Veda Inventory (beta).
- Trust badges: "UGC Integrated System", "IRD Verified Billing System", "ISO certified management system".

**Full advertised feature list (https://veda-app.com/features)**
- Process automation: lunch attendance (billing-linked), bus attendance, leave notes by parents, teacher's daily report, homework + homework checking with graphs, class attendance from mobile.
- Online learning: class reminders, discussion forum, assignment evaluation with annotation, assignment PDF/image/link submission, objective exams (quiz) with auto-grading, e-classroom content, Zoom-integrated online classes.
- Communication: chat (parents/students ↔ teachers/school), automated birthday wishes, news & blog, feedback system, Smart SMS (SMS+push merging to save cost), push notifications.
- Student management: student groups, result record & analysis, homework records, parent visit records, past data, attendance/leave records, full student profile (health etc.), notification logs.
- Performance: SPA (student performance analysis), Continuous Assessment System (CAS), teacher remarks, class/general evaluation, merit/demerit log.
- Results: multi-mode result entry (web/app/excel), online results, **custom per-school result print design**, result analysis, past results, exam schedule, entrance-card printing.
- Billing: invoices, instant invoice/payment, online billing + dues in app, online payment in app, discounts/scholarships, day-book/balance/due reports, in-app billing history, bus & lunch fare auto-calculation, bill-raise notifications, **feature barring for non-payers**, QR "parents' card" quick payment.
- Accounting: all voucher types, budget-based accounting, report printing, usage logs.
- Documents: ID card generation (student/parent/teacher), document storage, certificate generation (SEE/character/sports), data download/printing.
- Staff: staff details, leave notes, access levels, staff notifications, daily reports, work schedules, teacher performance analysis.
- Library: QR issue/return, book pre-booking from app, auto fine (added to bill), issue/return history, return reminders.
- Transport: bus live tracking, speed/over-speeding/distance logs, in-bus attendance, fare calculation.
- Reception: visitor log.

**Apps (store data)**
- "Veda - Students App" (com.ingrails.veda_combine, Play): 50K+ downloads, rated 3.9; iTunes (id1183813244): **2.9 stars, 946 ratings**, updated 2026-07-21 (itunes.apple.com/np/app/veda-students-app/id1183813244).
- "Veda Guru - Teacher's App" (com.ingrils.organisatiom.activity.teacherapp, Play): 100K+ downloads, 4.1 stars (~654 review counts); iTunes: 3.4 stars, updated 2026-08-24.
- "Veda Students Demo" 10K+ (3.9) demo app; **dozens of white-label per-school apps** under com.ingrails.* (e.g. com.ingrails.marys, com.ingrails.unitedschool — Play Store search).
- "Veda Monitoring App" (owner/monitoring, iOS) by Sanjan Piya.
- Pattern: single codebase re-skinned per school (typical of white-label distribution in this market).

**Pricing**
- **Not published.** Homepage has "Explore Plans"/"Start for Free" CTAs and /register?plan=15, but the plans page 404s (checked 2026-09-04). Registration requires school logo, registration certificate and head application letter (https://veda-app.com/register) — a gated, sales-led funnel. Third-party price points could not be verified; treat market intel like "per-student/month" as unconfirmed.

**Compliance/UX signals**
- Sells IRD-verified billing, UGC integration, ISO process. No public mention of IEMIS export, Bikram Sambat calendar, or Nepali-language UI on marketing pages (the site is English-only). No public API docs. No AI features advertised today (about page mentions "Veda Now: focusing on AI based learning", Apr 2020 — nothing shipped publicly since). Support hours listed 8AM–5PM Sun–Fri despite "24 hours" claim — a small credibility gap. iOS rating of 2.9 is a visible weakness.

---

### 1.2 Paathshala (Paathshala Software / Soft Lab Inc.)
Site: https://paathshala.com.np/ (JS SPA; content extracted from its JS bundle) · Old Baneshwor, Kathmandu · info@paathshala.com.np · 9801854143 / 9801854141 · WhatsApp 9860805126 · Sun–Fri 7AM–5:30PM

**Positioning**
- "Smart Digital School Management System — Paathshala Software"; claims **14+ years experience, 1,200+ schools & colleges, "Nepal's most trusted" (नेपालकै भरपर्दो)**, ISO 27001:2022 certified, IRD verified, "EMIS compliant". Self-describes as "Paathshala EMIS Software — cloud-based management system."

**Pricing model — the distinctive move**
- **"100% निशुल्क" — software, services AND hardware all free** for schools: free mobile apps (student/parent/teacher/staff), professional school website included, **free GPS tracking**, **free ZKTeco biometric attendance device**, free RFID hardware.
- Revenue = **paid Smart RFID Student ID Card** sold to students: "यो ID Card ले Attendance, Access Control, Library, Canteen, र Payment सबै काम गर्छ" (one card for attendance, access control, library, canteen, payments). Site FAQ even answers "If everything is free, how do you make money?" — answer: card monetization. Exact card price: **not published**.
- This is a hardware-subsidized, card-revenue model — the inverse of Veda's SaaS model.

**Advertised modules** (homepage bundle text)
- School management (admission → result publishing), complete student data (photos/documents/history), **biometric + RFID + GPS attendance**, fee & accounting with online payment support, result/exam management with **marksheet, grade cards and EMIS reporting**, payroll & HR (salary, leave, attendance), **hostel & canteen**, library, SMS & mobile app notifications, **EMIS (government) reporting**, digital payments (canteen, library fines, fees), student ID with QR verification, transport (GPS tracking, route planning, driver management, parent alerts).

**Apps**
- "Paathshala EMIS" (com.pathshala.emis, Play): 10K+ downloads, **4.4 stars** (325×5★, 59×4★, 49×3★, 27×2★), updated 2026-07-23.
- "Paathshala MIS" iOS (id6738320045, Soft Lab Inc.): 3.7 stars, 63 ratings, updated 2026-07-23.
- Site is bilingual-by-default (Nepali headline copy with English module names) — the most Nepali-forward marketing of any player reviewed.

**Weaknesses visible**
- Distribution still phone/WhatsApp-led; no published pricing anywhere; no public API/docs; no AI features advertised; marketing pages thin on LMS/teaching tools (strong on admin/hardware/safety, light on pedagogy); SPA site has almost no SEO surface (sitemap last modified 2019).

---

### 1.3 Other Nepali / regional players

- **e-School by eZone International** (https://eschool.ezone.com.np/, https://erp.ezone.com.np/) — the only Nepali player with **published per-student pricing**: Quick Start **Rs. 0 lifetime-free** (single admin, SIS, attendance, timetable, exams/gradebook, homework, messaging), Lite **Rs. 10/student/month**, Standard **Rs. 20/student/month**, Enterprise **Rs. 40/student/month** (banner advertises "50% off for 3 years", so listed figures may be post-discount). Standard/Enterprise include eSewa + Khalti payments, **FonePay/ConnectIPS bank integration**, biometric staff attendance, transport route-wise fees, LMS, library with barcode, inventory, payroll with GON rules, online admission CRM. App "eSchool App by eZone" (iOS, 4.3★, 6 ratings; Play presence small).
- **Mero School (Podamibe Nepal)** (https://mero.school/) — consumer online learning platform, not a school ERP: 100+ courses, 25,000+ videos, 200,000+ learners; plans like **Rs. 999/30 days**; classes 1–10, SEE, 11–12, engineering entrance, skills, IELTS. iOS app 3.6★. Competes for the *student learning* wallet, not the school's back office. **Kullabs.com now redirects to Mero School** — the old Kullabs Smart School brand is effectively folded into it.
- **MiDas eCLASS (Midas Education)** (https://midaseclass.com/) — pivoted from classroom digitization (interactive boards/e-library) to **online tuition for LKG–Grade 10** (Science, Maths, English, Nepali, Opt. Maths; 5–9PM, 6 days/week; money-back guarantee; free orientation classes). B2C tuition pricing not published on site. Not an ERP competitor, but competes for the same "digital education" budget.
- **eSchool Nepal (eschoolnepal.com.np)** — small portal-style SIS with staff/teacher/student/parent login; advertises attendance & grade tracking, enrollment, financial records. Thin public information; no published pricing.
- **Edusanjal** (https://edusanjal.com/) — education portal/listings + AI counselor; not an ERP; relevant only as a channel for reaching schools/colleges.
- **Vidyalaya (Sapphire Software Solutions, India)** (https://www.vidyalayaschoolsoftware.com/) — 25+ years, 2000+ clients, 40+ modules, claims 1600+ "global" clients; **AI-branded modules across the suite** (AI timetable generator, AI lesson-plan generator, AI fees, AI attendance, AI exam seating, AI transport…), biometric/UHF hardware, Tally integration, WhatsApp integration, 3 apps. India-focused; no Nepal presence found; pricing not published.
- **Fedena (Foradian, India)** (https://fedena.com/pricing-and-plans) — global open-source-heritage ERP; published pricing: **Standard $999/yr, Premium $1,399/yr, Ultimate $1,699/yr** (SaaS, web or web+mobile), Enterprise custom with source code; unlimited users; 20 core modules + premium ones (hostel, library, transport, placement…); API playground. Used by some Nepali schools historically, but no Nepal-specific compliance (IEMIS/IRD/BS) out of the box.
- **Entab CampusCare (India)** (https://www.entab.in/) — premium India ERP (Aditya Birla group of schools claim); positioning now "school intelligence/AI", automation, admissions CRM; pricing not published; premium pricing model (per-student, sales-led).
- **Teachmint** (https://www.teachmint.com/en-np) — in Nepal sells **Teachmint X**: AI-powered interactive whiteboard hardware (EduAI assistant, Vision X cameras, quiz generation) + classroom platform for schools/coaching; hardware-led, price on demo. Its India SaaS ERP is not the Nepal pitch.
- **Eduware** — Nepali school-ERP brand that surfaced in market chatter; no reachable website found in searches (eschool-style SMS+accounts product). Public data insufficient — treat as "verify in person".
- **Vendors checked with no findable school-ERP product today:** Softbenz (IT agency, builds custom systems), AVAX (site now redirects to Softbenz content), Janaki Technology (apps/IT services), Fusion SoftTech, Broadways, Semantro, Infinity Infosys, LPT, Nest Tech — nothing school-ERP-specific publicly discoverable on 2026-09-04; several appear to do custom builds for individual schools rather than a productized SaaS.

### 1.4 International benchmarks (summary; used for the matrix)
- **PowerSchool** — the global SIS standard: SIS + assessment + special-programs + analytics; deep compliance reporting; ecosystem of partners/APIs.
- **Blackbaud (Education Management)**, **Veracross** — independent/private-school suites: admissions CRM, tuition/billing, LMS, advancement/alumni, parent portals; Veracross known for one-database cleanliness.
- **Arbor / Bromcom / iSAMS (UK)** — UK MIS cloud leaders; Bromcom/Arbor bundle finance+HR+MAT dashboards and strong assessment; iSAMS strong in international schools.
- **Google Classroom** — free LMS: assignments, originality reports, guardian summaries; endless integrations; no fees/SIS.
- **Microsoft Teams for Education** — LMS+SIS hooks, assignments, rubrics, Calling; education pricing via A1/A3/A5.
- **Canvas (Instructure)** — HE-grade LMS with LTI plugin ecosystem; **Seesaw** — K-5 portfolio/journal UX that parents adore; **ClassDojo** — behaviour points + parent comms with class story; **Remind** — SMS-first two-way messaging.
- **Toddle** — IB/PYP teaching platform (planning, portfolios, reports) built with educators; **ManageBac** — IB curriculum/marks/IA compliance.
- **Khan Academy + Khanmigo** — free practice + AI tutor that Socratically coaches instead of answering. **MagicSchool.ai** — 80+ teacher AI tools (lesson plans, rubrics, IEPs). **Brisk Teaching** — Chrome-extension AI that works inside Google Docs/Slides to grade/give feedback. **Gradescope** — AI-assisted grading of paper exams with rubric reuse. **Century Tech** — AI personal-pathway learning (neuroscience-based).

---

## 2. SECTION A — FEATURE COMPARISON MATRIX

Legend: ●●● strong/flagship · ●● present · ● partial/claimed · ○ third-party/custom only · ✗ absent/not found. Data from vendor sites, app bundles, store listings (2026-09-04). "not pub." = not published.

| Feature area | Veda | Paathshala | eZone e-School | Mero School | Vidyalaya (IN) | Intl benchmark |
|---|---|---|---|---|---|---|
| Admissions/CRM | ●● online admissions | ●● admission module | ●● online inquiries+CRM (Enterprise) | ✗ (consumer) | ●●● admission CRM | ●●● (Veracross/Entab) |
| Attendance | ●●● class/bus/lunch from app | ●●● biometric+RFID+GPS | ●● + biometric sync | ✗ | ●●● AI-branded | ●●● (biometric+BLE) |
| Fees/billing | ●●● IRD-verified, QR parent card, feature-barring | ●● online payments | ●●● eSewa/Khalti/FonePay/ConnectIPS | ✗ | ●● AI fees | ●●● tuition mgmt |
| Exams/marksheets | ●●● excel entry, custom print design, entrance cards | ●●● marksheets+grade cards | ●●● transcripts, board exams | ✗ | ●●● | ●●● |
| Timetable | ●● | ● (implied) | ●● | ✗ | ●●● AI generator | ●●● |
| LMS/assignments | ●●● Zoom classes, quiz, annotation, e-classroom | ● (light) | ●● LMS module (Std+) | ●●● (consumer courses) | ●● LMS product | ●●●● (Classroom/Canvas) |
| Library | ●●● QR issue/return, booking, fines→bill | ●● RFID library | ●● barcode (Std+) | ✗ | ●● | ●● |
| Transport/GPS | ●●● live tracking, in-bus attendance, fare calc | ●●● free GPS, route planning, alerts | ●● route-wise fees (Std) | ✗ | ●● AI transport | ●●● |
| HR/payroll | ●● staff mgmt, performance | ●● payroll+leave | ●●● payroll w/ GON rules (Ent) | ✗ | ●●● payroll | ●●● |
| Inventory/canteen | ●● Veda Inventory (beta) | ●●● canteen payments on RFID | ●● inventory (Std+) | ✗ | ●● AI inventory | ●● |
| Communication/SMS/push | ●●● Smart SMS (cost-merged), chat, push | ●● SMS+app | ●● SMS integration | ✗ | ●● WhatsApp | ●●●● (Remind) |
| Parent app | ●●● 50K+ DL, but iOS 2.9★ | ●●● 4.4★ Android | ●● | ●● (parenting content) | ●●● | ●●●● (Seesaw/Dojo UX) |
| Student app | ●●● | ●● | ●● | ●●● core product | ●● | ●● |
| Teacher app | ●●● 100K+ DL Guru app | ●● staff app | ●● | ✗ | ●● | ●●● (Toddle/MagicSchool) |
| Website builder | ✗ (not advertised) | ●●● free professional website included | ●● website integration (Std) | ✗ | ● website design service | ○ |
| Analytics/reports | ●● SPAs/CAS graphs | ●● real-time reports | ●● | ✗ | ●●● MIS+AI insights | ●●●● (PowerSchool) |
| IEMIS/EMIS compliance | ○ claims UGC integration only | ●●● "EMIS compliant" marketing | ✗ (not advertised) | ✗ | ✗ (India CBSE) | n/a |
| IRD/tax billing | ●●● IRD-verified billing | ●● IRD verified | ●● (implied) | ✗ | ✗ (India GST) | n/a |
| Biometric hardware | ○ third-party | ●●● free ZKTeco included | ●● biometric sync (Lit+), multi-device (Ent) | ✗ | ●●● + UHF | ○ |
| Hostel | ✗ (not advertised) | ●● hostel module | ✗ (not in advertised tiers) | ✗ | ●● hostel | ●● |
| Alumni | ✗ | ✗ | ✗ | ✗ | ●● AI alumni | ●●● (Blackbaud) |
| Wellbeing/counselling | ○ merit/demerit log | ✗ | ✗ | ✗ | ● health module | ●● (Seesaw/Toddle) |
| AI features | ✗ publicly (2020 promise only) | ✗ | ✗ | ✗ | ●●● AI-branded suite | ●●●● (Khanmigo/MagicSchool) |
| Marketplace/plugins | ✗ | ✗ | ✗ | ✗ | ✗ | ●● (LTI ecosystem) |
| Public API | ✗ (not found) | ✗ (not found) | ✗ (not found) | ✗ | ○ (Tally, WhatsApp) | ●●● (Fedena playground, PowerSchool) |
| Offline behavior | ✗ not advertised | ✗ not advertised | ✗ not advertised | ✗ | ✗ | ●● (Classroom offline cache) |
| i18n / Nepali UI | ✗ English site only | ●●● Nepali-first marketing + bilingual | ✗ English | ●●● Nepali | ✗ (Hindi/EN) | ●●● |
| BS calendar | ✗ not advertised | ✗ not advertised | ✗ not advertised | n/a | ✗ | n/a |
| Payments (eSewa/Khalti/ConnectIPS/Fonepay) | ●● in-app payments (gateways not named) | ●● online payment support | ●●● named all | ●● (course payments) | ●● gateways (IN) | n/a |
| Pricing published | ✗ not pub. | ✗ "free" + paid RFID card (not pub.) | ●●● Rs.0/10/20/40 per student/mo | ●●● Rs.999/30d plans | ✗ not pub. | ● (Fedena $999–1699/yr) |

---

## 3. SECTION B — WHAT WE ARE MISSING (gaps ASchool must close)

Assuming ASchool already has attendance, fees with Khalti/eSewa, exams + marksheets, timetable, LMS, library, GPS transport, HR/payroll, notices, website builder, plugin marketplace, AI workbench + Socratic tutor, IEMIS importer.

1. **IRD-verified billing** — Veda and Paathshala both market IRD-verified CBMS invoicing; private schools in Nepal increasingly expect tax-compliant bill printing. (Veda homepage; Paathshala badge.)
2. **SMS fallback channel** — Smart SMS (SMS merged with push to cut cost) is a Veda flagship; parents without smartphones depend on SMS. No SMS = instant credibility loss outside Kathmandu.
3. **Custom marksheet/report-card print design per school** — Veda's most-loved moat feature (custom result print design, entrance cards, certificates, ID cards). Schools will not switch if they lose their exact card format.
4. **Certificate & ID card generation** (SEE/character/sports certificates, student/parent/teacher IDs, exam entrance cards) — table-stakes documents in Nepal.
5. **Biometric hardware support** — ZKTeco (and RFID readers) integration; Paathshala literally gives the device free and both Veda (staff attendance) and eZone sync devices. Staff biometric attendance is expected by school boards.
6. **RFID/smart-card events** — attendance, canteen, library, access on one card (Paathshala's monetization core). At minimum accept card taps via hardware even if we don't sell cards.
7. **Feature-barring on unpaid fees** — a small but decisive administrative feature Veda advertises (block results/entry until dues cleared).
8. **Discounts & scholarships engine in fees** (sibling discounts, scholarships, waiver workflows).
9. **Voucher-grade accounting** — Nepali-format vouchers (purchase/sales/receipt/payment/journal/contra) + budget-based accounting; Veda Finance and eZone Enterprise cover this.
10. **Canteen (wallet/top-up + POS)** and **hostel** modules — both advertised by Paathshala; boarding schools need them.
11. **Reception/visitor log, parent-visit records, birthday automation** — cheap-to-build "care" features Veda uses to charm principals.
12. **Continuous Assessment System (CAS) / SPA analytics** — Nepal's grading reform demands continuous assessment workflows (CAS), not just term exams.
13. **Excel-import everywhere** — result entry via Excel, bulk student import, bulk fee import: data entry reality in Nepali schools.
14. **White-label per-school apps** — Veda ships a re-skinned app per school; schools "own" their app. ASchool's single multi-tenant app needs an app-icon/branding story for schools (at minimum white-label web + PWA, ideally branded builds).
15. **Zoom (or Jitsi) online-class integration** — still marketed as core by Veda; post-COVID hybrid expectation.
16. **SMS notification logs + usage audit logs** — administrators must see who did what (usage log, notification logs — Veda features page).
17. **Nepali-language UI + BS calendar** — no major competitor advertises either; we can own it, but its absence vs. Paathshala's Nepali-first brand would hurt.
18. **Trust/compliance badges** — ISO 27001 (Paathshala), IRD, UGC: get equivalents or partner attestations before enterprise sales.
19. **Fonepay/ConnectIPS bank rails** — eZone advertises direct bank integration; Khalti/eSewa alone is incomplete for fee desks that want bank reconciliation.
20. **GPS parent-alert polish** — bus-arriving push, route planning, driver app; Paathshala gives GPS free, so transport must be excellent and cheap to run, and ideally free-tiered.
21. **Admissions CRM** (inquiry → entrance exam → offer → enrollment) — in eZone Enterprise and Entab; missing from our list.
22. **Play/App Store presence & ratings** — Paathshala's 4.4★ vs Veda's 3.9/2.9 shows apps are the public face of quality; we need review velocity and update cadence.

## 4. SECTION C — HOW WE WIN (20 ranked differentiators)

1. **AI teaching layer that actually ships** — Socratic tutor + AI workbench (lesson plans, worksheet generation, AI grading with teacher approval) while every Nepali competitor's AI is vaporware and even Vidyalaya's "AI" is marketing labels. Effort: M (we already have the workbench).
2. **AI Nepali/English medium: tutor that speaks Nepali** — Khanmigo-style pedagogy localized to Nepal's curriculum (SEE/CDC textbooks). Effort: M.
3. **Offline-first Flutter apps** — attendance/results/notice caching with queue sync; nobody in Nepal advertises offline; rural schools lose connectivity daily. Effort: M.
4. **Nepali UI + Bikram Sambat calendar everywhere** — app, web, marksheets in BS dates and Nepali labels; no competitor advertises either. Effort: S for calendar conversion, M for full i18n.
5. **IEMIS export as one-click government file** — everyone else markets vague "EMIS compliance"; we generate the actual federal/local IEMIS upload format. Effort: M (importer exists; invert it).
6. **Transparent public pricing** — the only published Nepali pricing is eZone's Rs.10–40/student/month; Veda/Paathshala hide it. Publish Rs.15/25/35 tiers and convert price-anxious committee decisions. Effort: S.
7. **White-label school app builds** — match Veda's per-school app pride (own icon, school name in store). Effort: L (build pipeline) but high win-rate in premier schools.
8. **Parent-first app UX that earns 4.6★+** — Seesaw/ClassDojo-grade onboarding, single timeline, zero-training design; exploit Veda's 2.9★ iOS rating and support-hour gap. Effort: M.
9. **Smart SMS 2.0** — push-with-SMS-fallback plus SMS cost analytics dashboard; directly attack Veda's SMS-cost saving claim with receipts. Effort: S.
10. **Open API + plugin marketplace** — Fedena has an API playground; nobody in Nepal does. Local developers (report-card formats, hardware vendors) build on us. Effort: M (partly exists).
11. **Zero-cost migration kit per competitor** — one-click import from Veda/Paathshala/eZone exports (students, results, ledgers, documents) so switching is a 1-day event, not a 10-day Veda-style setup. Effort: M.
12. **Fonepay/ConnectIPS + bank reconciliation** — auto-match bank statements to invoices; eZone markets the integration, nobody markets reconciliation. Effort: M.
13. **Free tier that beats eZone's Rs.0** — lifetime free for <100 students (single admin + attendance + notices) to blanket the long tail Paathshala/Veda ignore. Effort: S.
14. **ZKTeco biometric box** — plug-and-play device sync (our plugin marketplace makes this a plugin, not a core module). Effort: M.
15. **AI marksheet-to-parent-voice digest** — weekly voice note (Nepali) summarizing a child's progress for low-literacy parents; no competitor has anything like it. Effort: S-M.
16. **CAS/continuous-assessment workflows with SEE report formats** — automate Nepal's actual grading reform instead of generic gradebooks. Effort: M.
17. **Teacher daily report + AI lesson-plan generator in Nepali** — replace Veda's manual daily report with AI-assisted entries. Effort: S.
18. **Attendance hardware-free option** — QR/BLE/face-assisted student attendance without hardware spend, undercutting Paathshala's hardware logistics. Effort: M.
19. **Alumni + wellbeing modules** (counselling log, merit/demerit with positivity analytics) — whitespace in Nepal; international standard (Blackbaud/Seesaw). Effort: M.
20. **Dealership/partner program clone** — Veda runs a dealer program for reach; our marketplace revenue share can recruit IT shops as resellers with better margins. Effort: M.

## 5. SECTION D — PRICING STRATEGY (NPR)

Anchor points (the only published numbers):
- eZone: Rs.0 / **Rs.10** / **Rs.20** / **Rs.40 per student/month** (Lite/Standard/Enterprise; site advertises 50% off 3 years — https://eschool.ezone.com.np/pricing).
- Veda/Paathshala: not published; Veda is sales-led (per-student SaaS is the market pattern), Paathshala is free + paid RFID card.
- Fedena: $999–1,699/yr (≈ Rs.135k–220k/yr) — irrelevant for small schools, relevant for colleges.
- Mero School (consumer): Rs.999/30 days.

Recommended structure:
1. **Free Forever** — ≤100 students, 1 admin + 2 staff logins, attendance, notices, website-lite, IEMIS export, ASchool branding. Goal: own the long tail and create grassroots referrals (parents become the salesforce).
2. **Standard — Rs. 18/student/month** (billed annually; ~Rs. 200/student/yr; e.g. Rs. 60,000/yr for a 300-student school). Includes everything Veda sells as core except accounting: fees w/ Khalti+eSewa+Fonepay, exams/marksheets, LMS, GPS, library, HR, SMS (metered), Nepali UI, BS calendar, IEMIS one-click. Undercuts eZone Standard (Rs.20) while being materially richer, and lands far below typical Veda quotes (unpublished but sales-led; expect effective Rs. 30–60+/student equivalent — do not quote this, verify in sales calls).
3. **Premium — Rs. 35/student/month**: adds accounting/vouchers, biometric sync, canteen/hostel, admissions CRM, white-label app (annual), AI workbench unlimited, API + marketplace revenue-share waiver.
4. **AI add-on — Rs. 49/student/term** (or Rs. 150/student/yr) for the Socratic tutor + unlimited teacher AI workbench. Price it as a separate line so committees can buy "teaching quality" independent of the ERP.
5. **One-time onboarding: Rs. 0 standard / Rs. 25,000–75,000 white-label app** (branded store build). Migration from a named competitor: free (C11) — we pay the switching cost.
6. **SMS pass-through at cost + 10%** with an in-app meter — removes the padding schools suspect in Veda's bundled SMS.
7. Hardware strategy: don't give devices away like Paathshala; instead certify/absorb integration (bring-your-own ZKTeco/RFID) and let card vendors plug in via marketplace.

## 6. SECTION E — MIGRATION / SWITCHING PLAN

Build one **universal importer framework** (CSV/XLSX/JSON → canonical model) plus per-source adapters, run in the admin dashboard, with validation preview and dry-run:

1. **From Veda**: the target list. Veda advertises excel upload for results and data download/printing (features page), so request client data dumps during sales (schools own their data). Adapters: students+guardians (XLSX), staff, fee ledgers (day-book/due reports), results (excel entry format, incl. CAS), documents, past-data archive. Priority: high — this is where the 1,300 schools are.
2. **From Paathshala EMIS**: EMIS-format student & marks datasets (their marketing centers on EMIS reporting, so schools have these files); ZKTeco device re-registration; map RFID card IDs to our card plugin. Priority: high — their free model means schools can churn cheaply, but their card lock-in must be neutralized.
3. **From eZone e-School**: module-shaped exports (SIS, gradebook, fees); map eSewa/Khalti payment history. Priority: medium (their price-led base converts on our free tier).
4. **From Fedena/other legacy (mySQL-style) dumps**: direct DB import adapter — Fedena's schema is public via its community; useful for colleges. Priority: medium.
5. **Generic**: Nepali IEMIS XML/CSV as universal fallback — every school already exports IEMIS, guaranteeing baseline migration for anyone.
6. **Tooling musts**: duplicate detection (by DOB+name+guardian phone), BS↔AD date normalization, Nepali-locale name field mapping, old-marksheet PDF archive attach, bulk parent SMS announcing the new app, and a parallel-run mode (old system read-only view for one term). Target: same-day cutover for ≤500-student schools (beat Veda's "10 days to go live" promise).

## 7. Source index (primary)
- Veda: https://veda-app.com/ · /features · /clients · /about · /dealership · /register · /faq (plans page 404)
- Paathshala: https://paathshala.com.np/ (content extracted from site JS bundle; /sitemap.xml)
- eZone: https://eschool.ezone.com.np/ · /pricing · https://erp.ezone.com.np/
- Mero School/Kullabs: https://mero.school/ (kullabs.com redirects there)
- MiDas: https://midaseclass.com/
- Edusanjal: https://edusanjal.com/
- eSchool Nepal: https://eschoolnepal.com.np/
- Vidyalaya: https://www.vidyalayaschoolsoftware.com/
- Fedena: https://fedena.com/pricing-and-plans
- Entab: https://www.entab.in/
- Teachmint NP: https://www.teachmint.com/en-np
- Play Store: com.ingrails.veda_combine · com.ingrils.organisatiom.activity.teacherapp · com.ingrails.veda_students_app · com.pathshala.emis · (search listings for white-label apps)
- iTunes Search API (country=np): Veda Students App id1183813244 · Veda Guru id1141836401 · Paathshala MIS id6738320045 · Mero School id1581089279 · eSchool App by eZone id6746927557
