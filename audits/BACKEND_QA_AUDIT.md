# 🛠️ Backend QA & Logic Validation Audit

**Date:** 2026-08-27  
**Focus:** QA of Python Backend calculations, PDF generations, exception handling, and resolving AI service bugs.

---

## 1. Mathematical Logic Fixes
- **`nepal_grading.py`:** Previously, the GPA calculator took a simple average of subject GPAs. This was mathematically incorrect for subjects with differing credit hours. We have updated `calculate_gpa()` to accept and compute a weighted average using `credit_hours`, aligning perfectly with NEB regulations.
- **`hr_payroll.py`:** Fixed a bug in `download_payslip` where `gross` and `net` salaries defaulted to the `basic_salary` if not explicitly stored in the database, completely ignoring dynamic allowances and deductions. The logic now actively calculates `gross = basic + total_allowances` and `net = gross - total_deductions`.

## 2. API Bug Fixes (Resolved)
- **`risk_detector.py`:** Fixed critical `ImportError`. Changed `AttendanceRecord` to `Attendance` model.
- **`adaptive_learning.py`:** Fixed critical `ImportError`. Changed `ExamResult` to `Marks` model and updated `marks_obtained` column reference to `obtained_marks`.
- **`benchmarking_ai.py`:** Fixed critical `ImportError`. Changed `ExamResult` to `Marks` model.
- **`admission_followup.py`:** Fixed typo in Celery task. Changed `plugin_slug="admissions"` to `plugin_slug="admission"`.

## 3. Pending Critical Implementations
- **Unhandled Exceptions:** Core transactional routes in `fees.py`, `exams.py`, and `hr_payroll.py` lack proper `try...except Exception:` blocks with `db.session.rollback()`. This poses a data corruption risk if a mid-transaction error occurs.
- **Document Generation (PDF):**
  - **`reports.py`:** Needs full `weasyprint` HTML-to-PDF conversion logic to generate actual downloadable PDFs rather than JSON data.
  - **`design_studio.py`:** Needs `reportlab` and `Pillow` integration for generating bulk ID cards and Certificates on the server side instead of relying purely on frontend canvas.

## 4. Next Steps
- Enforce transactional integrity across all mutating endpoints using a universal decorator or middleware.
- Build a dedicated `PdfGenerator` utility class wrapping WeasyPrint to serve all report endpoints.
