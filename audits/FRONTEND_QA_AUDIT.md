# 🖥️ Frontend UX/UI & Integration QA Audit Report

**Date:** 2026-08-27  
**Focus:** QA and Gap Analysis of `frontend/app/` Next.js dashboards, components, and plugin gating.

---

## 1. API Integration Issues (404s & Broken Flows)
- **White-Label Endpoints Missing:** The pages `frontend/app/dashboard/white-label/domain/page.tsx`, `theme/page.tsx`, and `branding/page.tsx` attempt to fetch from `/schools/white-label/domain`, `/schools/white-label/theme`, and `/schools/white-label/branding`. However, these endpoints do not exist in `backend/app/api/v1/schools.py` or the `white_label` plugin, resulting in 404 errors. *(Note: `/website-builder/domain` exists and is used elsewhere, creating confusion).*
- **Missing Error States:** Several pages (like the white-label domain page) check for `isLoading` but lack an `isError` check. When API requests fail (like the 404s mentioned above), the UI either fails silently or crashes.

## 2. Plugin Gating Mismatches
Several `<PluginGate>` slugs in the frontend do not match the backend YAML manifests (`backend/app/plugins/manifests/`), locking users out of these modules:
- **HR Module:** `<PluginGate slug="hr">` is used across HR pages, but the backend manifest is `hr_payroll.yaml`.
- **IEMIS Importer:** `<PluginGate slug="iemis_importer">` is used, but there is no `iemis_importer.yaml` manifest in the backend.
- **File Management:** `<PluginGate slug="file_management">` is used, but there is no `file_management.yaml` manifest.
- **Communications:** `<PluginGate slug="communications">` is used in multiple pages, but there is no `communications.yaml` manifest.

## 3. UI/UX & Contrast
- **Theme Consistency:** The Tailwind config defines Forest Green colors (`ocean`, `mint`, `ink`), but they are underutilized. Some pages hardcode other colors (e.g., `text-purple-600`), leading to inconsistency.
- **Responsive Design Flaws:** Tables in `app/dashboard/sms/page.tsx` and `app/dashboard/exams/results/page.tsx` are wrapped in `<div className="border rounded-xl overflow-hidden">` without `overflow-x-auto`. This causes tables to clip or bleed off mobile screens. Other pages (like `hostel`) correctly use `overflow-x-auto`.

## 4. Feature Completeness (Stubs)
- **Landing Page Stubs:** The footer in `frontend/app/page.tsx` contains dummy links (`href="#"`) for critical pages like Privacy, Terms, and Support, which lead nowhere.

---

## 5. Recommended Action Items
1. Re-map all 404 White-Label fetching routes to target `/website-builder/domain`.
2. Introduce proper `isError` boundary wrappers for `useQuery` hooks.
3. Correct the `<PluginGate>` slugs to precisely match the backend module keys.
4. Inject `overflow-x-auto` to all dashboard tables for mobile responsiveness.
