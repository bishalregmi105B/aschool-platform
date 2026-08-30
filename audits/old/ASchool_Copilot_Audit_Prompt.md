# 🏫 ASchool – Full Codebase Audit & Verification Prompt
> Paste this into **GitHub Copilot Chat** (`Ctrl+Shift+I`) in VS Code.  
> Use `@workspace` at the start so Copilot indexes the entire repo.

---

## MASTER PROMPT

```
@workspace

You are a senior full-stack engineer conducting a deep, end-to-end audit of the **ASchool** platform — a multi-platform school management system with:
- A **backend API** (REST/HTTP)
- A **Frontend Web App**
- **Multiple Flutter Mobile Apps**
- Background job/process workers

Your job is to read every single file in this codebase and produce a structured report. Do NOT skip any module. Be exhaustive.

---

## PHASE 1 — CODEBASE DISCOVERY

1. List every top-level directory and describe what each one contains.
2. Identify the tech stack: backend language/framework, frontend framework, Flutter version, database(s), background job system, and any third-party services.
3. List every environment variable or config key referenced anywhere in the project.
4. Identify all shared libraries, packages, or monorepo workspaces.

---

## PHASE 2 — FULL API AUDIT (Read Every Single Route)

For EVERY API route/endpoint in the backend, document the following table:

| # | Method | Route Path | Controller / Handler | Auth Required | Request Body / Params | Success Response Format (fields + types) | Error Response Format | Used in Web? | Used in Flutter? | Background Job? |
|---|--------|-----------|----------------------|--------------|----------------------|------------------------------------------|----------------------|--------------|-----------------|-----------------|

Group routes by module:
- 🪪 **ID Card Generator** (designer, writer, template, export)
- 📋 **MarkSheet / Report Card Generation**
- 📝 **Exam Handling** (schedule, questions, results, grading)
- 💰 **Accounts & Finance** (fees, payments, invoices, ledger, transactions)
- 📚 **Library Module** (books, issue, return, fine, catalogue)
- 🎓 **Student Management** (enroll, profile, class assignment)
- 👨‍🏫 **Teacher / Staff Management**
- 📅 **Attendance**
- 🔐 **Authentication & Authorization** (login, roles, tokens, refresh)
- ⚙️ **Settings / Admin**
- 🔔 **Notifications** (push, email, SMS)
- 📁 **File / Document Upload & Storage**
- 🔄 **Background Processes / Queues / Cron Jobs**

---

## PHASE 3 — RESPONSE FORMAT CONSISTENCY CHECK

For each module group above:

1. Are success responses consistently wrapped? (e.g., `{ success: true, data: {}, message: "" }`)
2. Are error responses consistently structured? (e.g., `{ success: false, error: "", code: 400 }`)
3. Are pagination responses consistent across all list endpoints? (e.g., `{ data: [], total, page, limit }`)
4. Flag any endpoint that returns a different structure than the rest — mark these as ⚠️ INCONSISTENT.
5. List any endpoints returning `200 OK` for error conditions.

---

## PHASE 4 — FRONTEND WEB AUDIT

1. List every page/route in the web app.
2. For each page:
   - Which API endpoints does it call?
   - Is the correct HTTP method being used?
   - Is the request payload matching what the API expects?
   - Is the response being parsed using the documented response format?
   - Are loading states, error states, and empty states handled?
3. Check all API service/client files (axios, fetch wrappers, interceptors):
   - Is the base URL correctly configured per environment (dev/staging/prod)?
   - Are auth tokens attached to every protected request?
   - Is token refresh (401 handling) implemented?
4. Flag any hardcoded URLs, secrets, or API keys in frontend code — mark ⛔ SECURITY RISK.
5. Check the **ID Card module in web**:
   - Is the Designer (template builder/editor) correctly posting templates to the API?
   - Is the Writer (data-fill step) pulling student data and merging with templates?
   - Is the export/download (PDF/PNG) correctly calling the generation endpoint?
   - Are background generation jobs being triggered and polled correctly?

---

## PHASE 5 — FLUTTER APP AUDIT (All Apps)

For each Flutter app in the repo:

1. List every screen/route.
2. Check the API service layer (Dio/http client):
   - Is baseUrl correctly environment-aware?
   - Are headers (Authorization, Content-Type) set on all calls?
   - Is error handling (DioException / HttpException) catching all failure codes?
   - Is token refresh implemented in the interceptor?
3. For each screen that calls an API:
   - Does the request payload match the backend spec?
   - Does the response parsing match the actual response format?
   - Are null safety issues handled for optional fields?
4. Check **ID Card module in Flutter**:
   - Can users view/download generated ID cards?
   - Is the generation triggered via API or is there local generation logic? Flag any offline duplication.
5. Check **MarkSheet module in Flutter**:
   - Can students/parents view report cards?
   - Is the PDF generation/download working end-to-end?
6. Check **Exam module in Flutter**:
   - Exam schedule listing — does it call the correct endpoint?
   - Result viewing — is the grading response correctly displayed?
7. Check **Finance module in Flutter**:
   - Fee dashboard — is it calling the correct student finance endpoint?
   - Payment history and invoice download — working?
8. Check **Library module in Flutter**:
   - Book search, issue status, return date, fine amount — all pulling from API correctly?
9. Identify any API calls that exist in Flutter but NOT in the backend — mark 🔴 MISSING BACKEND ROUTE.
10. Identify any backend routes not called from either Flutter or Web — mark 🟡 UNUSED ROUTE.

---

## PHASE 6 — BACKGROUND PROCESSES & JOBS AUDIT

1. List every background job, cron task, or queue worker.
2. For each job:
   - What triggers it? (schedule, event, manual API call)
   - What does it do? (generate PDF, send notification, sync data, etc.)
   - Which database tables/collections does it read/write?
   - Does it report success/failure anywhere? (logs, DB status field, webhook)
3. **ID Card Generator background jobs**:
   - Is the generation queue processing correctly?
   - Is the job status (pending → processing → done/failed) stored and retrievable via API?
   - Is the generated file stored and a download URL returned?
   - Are failed jobs retried? Is there a dead-letter queue?
4. **MarkSheet generation jobs**:
   - Same status tracking check as above.
5. **Notification jobs** (push/email/SMS):
   - Are they failing silently? Check for error handling and logging.
6. Flag any job that has no error handling or no logging — mark ⚠️ SILENT FAILURE RISK.

---

## PHASE 7 — ID CARD MODULE DEEP DIVE

This is a critical module. Audit every component:

### Designer (Template Builder)
- [ ] Can admin create a new ID card template?
- [ ] Are template fields (name, photo, class, roll no, barcode, school logo, QR code) configurable?
- [ ] Is template JSON/config correctly saved to the backend?
- [ ] Is template preview rendering correctly in web?
- [ ] Are multiple templates supported (student, teacher, staff)?

### Writer (Data Merge / Population)
- [ ] Does the writer correctly fetch student/staff data for the selected batch?
- [ ] Is the photo upload and URL correctly bound to the template?
- [ ] Are custom fields handled?
- [ ] Is bulk generation (entire class/school) working via background job?

### Generation & Export
- [ ] Is the final ID card generated as PDF or image (PNG)?
- [ ] Can individual cards be downloaded?
- [ ] Can bulk ZIP download work?
- [ ] Is the generation status polled correctly from both web and Flutter?

---

## PHASE 8 — MODULE CONNECTIVITY MATRIX

Create a table showing connection status:

| Module | Backend Routes ✅/❌ | Web Connected ✅/❌ | Flutter Connected ✅/❌ | Background Job ✅/❌ | Notes |
|--------|--------------------|--------------------|----------------------|---------------------|-------|
| ID Card Generator | | | | | |
| MarkSheet Generation | | | | | |
| Exam Handling | | | | | |
| Accounts & Finance | | | | | |
| Library | | | | | |
| Student Management | | | | | |
| Attendance | | | | | |
| Authentication | | | | | |
| Notifications | | | | | |
| File Storage | | | | | |

---

## PHASE 9 — TESTING & ROUTE VERIFICATION

1. List every test file found (unit, integration, widget, e2e).
2. For each module, what test coverage exists? What's missing?
3. Generate a `curl` command for every critical API route so they can be manually tested:

```bash
# Example format:
curl -X POST https://api.aschool.com/v1/idcard/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "templateId": "...", "studentIds": ["..."] }'
```

4. Identify any routes that have no tests at all — mark 🔴 UNTESTED.

---

## PHASE 10 — CRITICAL ISSUES SUMMARY

At the end, produce three lists:

### 🔴 BLOCKERS (Must fix before production)
- Broken API connections
- Missing auth on protected routes
- Silent failure jobs
- Security risks

### 🟡 WARNINGS (Should fix soon)
- Inconsistent response formats
- Missing error handling in Flutter
- Unused routes
- Missing tests on critical paths

### 🟢 SUGGESTIONS (Nice to have)
- Performance improvements
- Code deduplication
- Better logging
- Response caching opportunities

---

Start with Phase 1 and work through each phase sequentially. Show your findings for each phase before moving to the next. If you cannot find code for a specific module, explicitly state "MODULE NOT FOUND" rather than skipping it.
```

---

## HOW TO USE THIS PROMPT

### Step 1 — Open Copilot Chat
Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (Mac) in VS Code.

### Step 2 — Index the workspace
Make sure `@workspace` is at the start of the prompt so Copilot reads all files.

### Step 3 — Run in phases
If Copilot hits its context limit, paste each Phase separately as a follow-up:
> "Now do Phase 3 — Response Format Consistency Check"

### Step 4 — Save the report
Ask Copilot to output the final report as Markdown:
> "Output the full audit report as a single Markdown document I can save."

### Step 5 — Fix by priority
Work through 🔴 Blockers → 🟡 Warnings → 🟢 Suggestions in order.

---

## QUICK SINGLE-MODULE PROMPTS

Use these for fast targeted checks:

```
@workspace Audit ONLY the ID Card Generator module — check the designer API, writer API, 
generation background job, web frontend integration, and Flutter integration. 
Show what's working and what's broken.
```

```
@workspace Check ALL API routes in the MarkSheet module. 
For each route show: the endpoint, request format, response format, 
whether web calls it correctly, and whether Flutter calls it correctly.
```

```
@workspace List every background job/worker in this codebase. 
For each one: what triggers it, what it does, does it have error handling, 
does it update a status in the database, and is there a way to query its status via API?
```

```
@workspace Check every Flutter app's API service layer. 
Are base URLs correct? Are auth tokens attached? Is 401/token refresh handled? 
List any API call that doesn't match the backend route signature.
```

```
@workspace Check the Finance module end-to-end: 
backend routes → web frontend calls → Flutter calls. 
Show the response format for each route and flag any mismatch between 
what the backend returns and what the frontend/Flutter expects.
```

```
@workspace Check the Library module: book catalogue API, issue endpoint, 
return endpoint, fine calculation — are all connected in web and Flutter? 
Show any missing connections.
```

---

*Generated for ASchool Platform — Full Stack Audit*
