"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * Standard AOS Window Loading Spinner
 */
export function AOSModuleLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[350px] w-full p-8 select-none">
      <div className="relative flex items-center justify-center mb-4">
        <Loader2 className="w-9 h-9 animate-spin" style={{ color: "var(--w11-accent)" }} />
        <div className="absolute w-12 h-12 rounded-full border animate-ping" style={{ borderColor: "var(--w11-accent-light)" }} />
      </div>
      <span className="text-sm font-medium" style={{ color: "var(--w11-text-secondary)" }}>
        Loading Application...
      </span>
    </div>
  );
}

/**
 * COMPLETE route table: every /dashboard/* path that owns a real page maps
 * to that exact component (auto-generated from the app router tree; server
 * redirect stubs are excluded). This powers the in-process AOS navigation —
 * windows swap content by route without touching the browser URL.
 *
 * Key format: module + "__" + nested segments (e.g. "fees__collect").
 */
export const AOS_ROUTE_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "academics": dynamic(() => import("@/app/dashboard/academics/page"), { loading: AOSModuleLoading }), // /dashboard/academics
  "academics__class-sections": dynamic(() => import("@/app/dashboard/academics/class-sections/page"), { loading: AOSModuleLoading }), // /dashboard/academics/class-sections
  "academics__class-subjects": dynamic(() => import("@/app/dashboard/academics/class-subjects/page"), { loading: AOSModuleLoading }), // /dashboard/academics/class-subjects
  "academics__class-teachers": dynamic(() => import("@/app/dashboard/academics/class-teachers/page"), { loading: AOSModuleLoading }), // /dashboard/academics/class-teachers
  "academics__subjects": dynamic(() => import("@/app/dashboard/academics/subjects/page"), { loading: AOSModuleLoading }), // /dashboard/academics/subjects
  "admission": dynamic(() => import("@/app/dashboard/admission/page"), { loading: AOSModuleLoading }), // /dashboard/admission
  "admission__registrations": dynamic(() => import("@/app/dashboard/admission/registrations/page"), { loading: AOSModuleLoading }), // /dashboard/admission/registrations
  "admission__seats": dynamic(() => import("@/app/dashboard/admission/seats/page"), { loading: AOSModuleLoading }), // /dashboard/admission/seats
  "ai-teacher": dynamic(() => import("@/app/dashboard/ai-teacher/page"), { loading: AOSModuleLoading }), // /dashboard/ai-teacher
  "ai-tools": dynamic(() => import("@/app/dashboard/ai-tools/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools
  "ai-tools__accommodation-finder": dynamic(() => import("@/app/dashboard/ai-tools/accommodation-finder/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/accommodation-finder
  "ai-tools__annual-scheme": dynamic(() => import("@/app/dashboard/ai-tools/annual-scheme/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/annual-scheme
  "ai-tools__attendance-outreach": dynamic(() => import("@/app/dashboard/ai-tools/attendance-outreach/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/attendance-outreach
  "ai-tools__blueprint-builder": dynamic(() => import("@/app/dashboard/ai-tools/blueprint-builder/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/blueprint-builder
  "ai-tools__choice-board": dynamic(() => import("@/app/dashboard/ai-tools/choice-board/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/choice-board
  "ai-tools__conference-prep": dynamic(() => import("@/app/dashboard/ai-tools/conference-prep/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/conference-prep
  "ai-tools__email-responder": dynamic(() => import("@/app/dashboard/ai-tools/email-responder/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/email-responder
  "ai-tools__enrichment-planner": dynamic(() => import("@/app/dashboard/ai-tools/enrichment-planner/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/enrichment-planner
  "ai-tools__exam-timetable-draft": dynamic(() => import("@/app/dashboard/ai-tools/exam-timetable-draft/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/exam-timetable-draft
  "ai-tools__insights": dynamic(() => import("@/app/dashboard/ai-tools/insights/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/insights
  "ai-tools__learning-paths": dynamic(() => import("@/app/dashboard/ai-tools/learning-paths/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/learning-paths
  "ai-tools__lesson-hook": dynamic(() => import("@/app/dashboard/ai-tools/lesson-hook/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/lesson-hook
  "ai-tools__lesson-plan": dynamic(() => import("@/app/dashboard/ai-tools/lesson-plan/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/lesson-plan
  "ai-tools__letter-writer": dynamic(() => import("@/app/dashboard/ai-tools/letter-writer/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/letter-writer
  "ai-tools__meeting-minutes": dynamic(() => import("@/app/dashboard/ai-tools/meeting-minutes/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/meeting-minutes
  "ai-tools__observation-feedback": dynamic(() => import("@/app/dashboard/ai-tools/observation-feedback/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/observation-feedback
  "ai-tools__practical-exam": dynamic(() => import("@/app/dashboard/ai-tools/practical-exam/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/practical-exam
  "ai-tools__progress": dynamic(() => import("@/app/dashboard/ai-tools/progress/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/progress
  "ai-tools__question-paper": dynamic(() => import("@/app/dashboard/ai-tools/question-paper/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/question-paper
  "ai-tools__report-remarks": dynamic(() => import("@/app/dashboard/ai-tools/report-remarks/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/report-remarks
  "ai-tools__text-leveler": dynamic(() => import("@/app/dashboard/ai-tools/text-leveler/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/text-leveler
  "ai-tools__timetable": dynamic(() => import("@/app/dashboard/ai-tools/timetable/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/timetable
  "ai-tools__transition-guide": dynamic(() => import("@/app/dashboard/ai-tools/transition-guide/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/transition-guide
  "ai-tools__vocab-support": dynamic(() => import("@/app/dashboard/ai-tools/vocab-support/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/vocab-support
  "ai-tools__writing-scaffold": dynamic(() => import("@/app/dashboard/ai-tools/writing-scaffold/page"), { loading: AOSModuleLoading }), // /dashboard/ai-tools/writing-scaffold
  "ai-workbench": dynamic(() => import("@/app/dashboard/ai-workbench/page"), { loading: AOSModuleLoading }), // /dashboard/ai-workbench
  "alumni": dynamic(() => import("@/app/dashboard/alumni/page"), { loading: AOSModuleLoading }), // /dashboard/alumni
  "analytics": dynamic(() => import("@/app/dashboard/analytics/page"), { loading: AOSModuleLoading }), // /dashboard/analytics
  "analytics__academic": dynamic(() => import("@/app/dashboard/analytics/academic/page"), { loading: AOSModuleLoading }), // /dashboard/analytics/academic
  "analytics__ai-usage": dynamic(() => import("@/app/dashboard/analytics/ai-usage/page"), { loading: AOSModuleLoading }), // /dashboard/analytics/ai-usage
  "analytics__financial": dynamic(() => import("@/app/dashboard/analytics/financial/page"), { loading: AOSModuleLoading }), // /dashboard/analytics/financial
  "assignments": dynamic(() => import("@/app/dashboard/assignments/page"), { loading: AOSModuleLoading }), // /dashboard/assignments
  "attendance": dynamic(() => import("@/app/dashboard/attendance/page"), { loading: AOSModuleLoading }), // /dashboard/attendance
  "attendance__holidays": dynamic(() => import("@/app/dashboard/attendance/holidays/page"), { loading: AOSModuleLoading }), // /dashboard/attendance/holidays
  "attendance__import": dynamic(() => import("@/app/dashboard/attendance/import/page"), { loading: AOSModuleLoading }), // /dashboard/attendance/import
  "attendance__leave-requests": dynamic(() => import("@/app/dashboard/attendance/leave-requests/page"), { loading: AOSModuleLoading }), // /dashboard/attendance/leave-requests
  "attendance__mark": dynamic(() => import("@/app/dashboard/attendance/mark/page"), { loading: AOSModuleLoading }), // /dashboard/attendance/mark
  "attendance__reports": dynamic(() => import("@/app/dashboard/attendance/reports/page"), { loading: AOSModuleLoading }), // /dashboard/attendance/reports
  "attendance__subject": dynamic(() => import("@/app/dashboard/attendance/subject/page"), { loading: AOSModuleLoading }), // /dashboard/attendance/subject
  "benchmarking": dynamic(() => import("@/app/dashboard/benchmarking/page"), { loading: AOSModuleLoading }), // /dashboard/benchmarking
  "biometric": dynamic(() => import("@/app/dashboard/biometric/page"), { loading: AOSModuleLoading }), // /dashboard/biometric
  "biometric__devices": dynamic(() => import("@/app/dashboard/biometric/devices/page"), { loading: AOSModuleLoading }), // /dashboard/biometric/devices
  "biometric__logs": dynamic(() => import("@/app/dashboard/biometric/logs/page"), { loading: AOSModuleLoading }), // /dashboard/biometric/logs
  "bulk-uploads": dynamic(() => import("@/app/dashboard/bulk-uploads/page"), { loading: AOSModuleLoading }), // /dashboard/bulk-uploads
  "bulk-uploads__csv": dynamic(() => import("@/app/dashboard/bulk-uploads/csv/page"), { loading: AOSModuleLoading }), // /dashboard/bulk-uploads/csv
  "bulk-uploads__history": dynamic(() => import("@/app/dashboard/bulk-uploads/history/page"), { loading: AOSModuleLoading }), // /dashboard/bulk-uploads/history
  "bulk-uploads__iemis": dynamic(() => import("@/app/dashboard/bulk-uploads/iemis/page"), { loading: AOSModuleLoading }), // /dashboard/bulk-uploads/iemis
  "certificates": dynamic(() => import("@/app/dashboard/certificates/page"), { loading: AOSModuleLoading }), // /dashboard/certificates
  "certificates__character": dynamic(() => import("@/app/dashboard/certificates/character/page"), { loading: AOSModuleLoading }), // /dashboard/certificates/character
  "certificates__staff": dynamic(() => import("@/app/dashboard/certificates/staff/page"), { loading: AOSModuleLoading }), // /dashboard/certificates/staff
  "certificates__students": dynamic(() => import("@/app/dashboard/certificates/students/page"), { loading: AOSModuleLoading }), // /dashboard/certificates/students
  "certificates__transfer": dynamic(() => import("@/app/dashboard/certificates/transfer/page"), { loading: AOSModuleLoading }), // /dashboard/certificates/transfer
  "communications": dynamic(() => import("@/app/dashboard/communications/page"), { loading: AOSModuleLoading }), // /dashboard/communications
  "communications__announcements": dynamic(() => import("@/app/dashboard/communications/announcements/page"), { loading: AOSModuleLoading }), // /dashboard/communications/announcements
  "communications__broadcast": dynamic(() => import("@/app/dashboard/communications/broadcast/page"), { loading: AOSModuleLoading }), // /dashboard/communications/broadcast
  "communications__diary": dynamic(() => import("@/app/dashboard/communications/diary/page"), { loading: AOSModuleLoading }), // /dashboard/communications/diary
  "communications__diary__categories": dynamic(() => import("@/app/dashboard/communications/diary/categories/page"), { loading: AOSModuleLoading }), // /dashboard/communications/diary/categories
  "communications__gallery": dynamic(() => import("@/app/dashboard/communications/gallery/page"), { loading: AOSModuleLoading }), // /dashboard/communications/gallery
  "communications__sliders": dynamic(() => import("@/app/dashboard/communications/sliders/page"), { loading: AOSModuleLoading }), // /dashboard/communications/sliders
  "communications__templates": dynamic(() => import("@/app/dashboard/communications/templates/page"), { loading: AOSModuleLoading }), // /dashboard/communications/templates
  "communications__whatsapp": dynamic(() => import("@/app/dashboard/communications/whatsapp/page"), { loading: AOSModuleLoading }), // /dashboard/communications/whatsapp
  "communications__whatsapp__ai-settings": dynamic(() => import("@/app/dashboard/communications/whatsapp/ai-settings/page"), { loading: AOSModuleLoading }), // /dashboard/communications/whatsapp/ai-settings
  "communications__whatsapp__analytics": dynamic(() => import("@/app/dashboard/communications/whatsapp/analytics/page"), { loading: AOSModuleLoading }), // /dashboard/communications/whatsapp/analytics
  "communications__whatsapp__conversations": dynamic(() => import("@/app/dashboard/communications/whatsapp/conversations/page"), { loading: AOSModuleLoading }), // /dashboard/communications/whatsapp/conversations
  "communications__whatsapp__templates": dynamic(() => import("@/app/dashboard/communications/whatsapp/templates/page"), { loading: AOSModuleLoading }), // /dashboard/communications/whatsapp/templates
  "compliance": dynamic(() => import("@/app/dashboard/compliance/page"), { loading: AOSModuleLoading }), // /dashboard/compliance
  "conferences": dynamic(() => import("@/app/dashboard/conferences/page"), { loading: AOSModuleLoading }), // /dashboard/conferences
  "content-review": dynamic(() => import("@/app/dashboard/content-review/page"), { loading: AOSModuleLoading }), // /dashboard/content-review
  "designer": dynamic(() => import("@/app/dashboard/designer/page"), { loading: AOSModuleLoading }), // /dashboard/designer
  "designer__bulk": dynamic(() => import("@/app/dashboard/designer/bulk/page"), { loading: AOSModuleLoading }), // /dashboard/designer/bulk
  "designer__editor": dynamic(() => import("@/app/dashboard/designer/editor/page"), { loading: AOSModuleLoading }), // /dashboard/designer/editor
  "designer__templates": dynamic(() => import("@/app/dashboard/designer/templates/page"), { loading: AOSModuleLoading }), // /dashboard/designer/templates
  "designer__writer": dynamic(() => import("@/app/dashboard/designer/writer/page"), { loading: AOSModuleLoading }), // /dashboard/designer/writer
  "designer__writer2": dynamic(() => import("@/app/dashboard/designer/writer2/page"), { loading: AOSModuleLoading }), // /dashboard/designer/writer2
  "disaster": dynamic(() => import("@/app/dashboard/disaster/page"), { loading: AOSModuleLoading }), // /dashboard/disaster
  "disaster__alerts": dynamic(() => import("@/app/dashboard/disaster/alerts/page"), { loading: AOSModuleLoading }), // /dashboard/disaster/alerts
  "disaster__drills": dynamic(() => import("@/app/dashboard/disaster/drills/page"), { loading: AOSModuleLoading }), // /dashboard/disaster/drills
  "disaster__plans": dynamic(() => import("@/app/dashboard/disaster/plans/page"), { loading: AOSModuleLoading }), // /dashboard/disaster/plans
  "dismissal": dynamic(() => import("@/app/dashboard/dismissal/page"), { loading: AOSModuleLoading }), // /dashboard/dismissal
  "elibrary": dynamic(() => import("@/app/dashboard/elibrary/page"), { loading: AOSModuleLoading }), // /dashboard/elibrary
  "elibrary__past-papers": dynamic(() => import("@/app/dashboard/elibrary/past-papers/page"), { loading: AOSModuleLoading }), // /dashboard/elibrary/past-papers
  "elibrary__upload": dynamic(() => import("@/app/dashboard/elibrary/upload/page"), { loading: AOSModuleLoading }), // /dashboard/elibrary/upload
  "emergency": dynamic(() => import("@/app/dashboard/emergency/page"), { loading: AOSModuleLoading }), // /dashboard/emergency
  "exams": dynamic(() => import("@/app/dashboard/exams/page"), { loading: AOSModuleLoading }), // /dashboard/exams
  "exams__[id]": dynamic(() => import("@/app/dashboard/exams/[id]/page"), { loading: AOSModuleLoading }), // /dashboard/exams/[id]
  "exams__grade-scales": dynamic(() => import("@/app/dashboard/exams/grade-scales/page"), { loading: AOSModuleLoading }), // /dashboard/exams/grade-scales
  "exams__grades": dynamic(() => import("@/app/dashboard/exams/grades/page"), { loading: AOSModuleLoading }), // /dashboard/exams/grades
  "exams__marks": dynamic(() => import("@/app/dashboard/exams/marks/page"), { loading: AOSModuleLoading }), // /dashboard/exams/marks
  "exams__online": dynamic(() => import("@/app/dashboard/exams/online/page"), { loading: AOSModuleLoading }), // /dashboard/exams/online
  "exams__online__questions": dynamic(() => import("@/app/dashboard/exams/online/questions/page"), { loading: AOSModuleLoading }), // /dashboard/exams/online/questions
  "exams__report-cards": dynamic(() => import("@/app/dashboard/exams/report-cards/page"), { loading: AOSModuleLoading }), // /dashboard/exams/report-cards
  "exams__results": dynamic(() => import("@/app/dashboard/exams/results/page"), { loading: AOSModuleLoading }), // /dashboard/exams/results
  "exams__schedule": dynamic(() => import("@/app/dashboard/exams/schedule/page"), { loading: AOSModuleLoading }), // /dashboard/exams/schedule
  "exams__tabulation": dynamic(() => import("@/app/dashboard/exams/tabulation/page"), { loading: AOSModuleLoading }), // /dashboard/exams/tabulation
  "faqs": dynamic(() => import("@/app/dashboard/faqs/page"), { loading: AOSModuleLoading }), // /dashboard/faqs
  "fees": dynamic(() => import("@/app/dashboard/fees/page"), { loading: AOSModuleLoading }), // /dashboard/fees
  "fees__aging": dynamic(() => import("@/app/dashboard/fees/aging/page"), { loading: AOSModuleLoading }), // /dashboard/fees/aging
  "fees__approvals": dynamic(() => import("@/app/dashboard/fees/approvals/page"), { loading: AOSModuleLoading }), // /dashboard/fees/approvals
  "fees__carry-forward": dynamic(() => import("@/app/dashboard/fees/carry-forward/page"), { loading: AOSModuleLoading }), // /dashboard/fees/carry-forward
  "fees__collect": dynamic(() => import("@/app/dashboard/fees/collect/page"), { loading: AOSModuleLoading }), // /dashboard/fees/collect
  "fees__day-closure": dynamic(() => import("@/app/dashboard/fees/day-closure/page"), { loading: AOSModuleLoading }), // /dashboard/fees/day-closure
  "fees__defaulters": dynamic(() => import("@/app/dashboard/fees/defaulters/page"), { loading: AOSModuleLoading }), // /dashboard/fees/defaulters
  "fees__invoices": dynamic(() => import("@/app/dashboard/fees/invoices/page"), { loading: AOSModuleLoading }), // /dashboard/fees/invoices
  "fees__reports": dynamic(() => import("@/app/dashboard/fees/reports/page"), { loading: AOSModuleLoading }), // /dashboard/fees/reports
  "fees__scholarships": dynamic(() => import("@/app/dashboard/fees/scholarships/page"), { loading: AOSModuleLoading }), // /dashboard/fees/scholarships
  "fees__structure": dynamic(() => import("@/app/dashboard/fees/structure/page"), { loading: AOSModuleLoading }), // /dashboard/fees/structure
  "fees__types": dynamic(() => import("@/app/dashboard/fees/types/page"), { loading: AOSModuleLoading }), // /dashboard/fees/types
  "files": dynamic(() => import("@/app/dashboard/files/page"), { loading: AOSModuleLoading }), // /dashboard/files
  "gamification": dynamic(() => import("@/app/dashboard/gamification/page"), { loading: AOSModuleLoading }), // /dashboard/gamification
  "gamification__badges": dynamic(() => import("@/app/dashboard/gamification/badges/page"), { loading: AOSModuleLoading }), // /dashboard/gamification/badges
  "gamification__houses": dynamic(() => import("@/app/dashboard/gamification/houses/page"), { loading: AOSModuleLoading }), // /dashboard/gamification/houses
  "gamification__leaderboard": dynamic(() => import("@/app/dashboard/gamification/leaderboard/page"), { loading: AOSModuleLoading }), // /dashboard/gamification/leaderboard
  "gamification__rewards": dynamic(() => import("@/app/dashboard/gamification/rewards/page"), { loading: AOSModuleLoading }), // /dashboard/gamification/rewards
  "health-records": dynamic(() => import("@/app/dashboard/health-records/page"), { loading: AOSModuleLoading }), // /dashboard/health-records
  "health-records__allergies": dynamic(() => import("@/app/dashboard/health-records/allergies/page"), { loading: AOSModuleLoading }), // /dashboard/health-records/allergies
  "health-records__records": dynamic(() => import("@/app/dashboard/health-records/records/page"), { loading: AOSModuleLoading }), // /dashboard/health-records/records
  "health-records__vaccinations": dynamic(() => import("@/app/dashboard/health-records/vaccinations/page"), { loading: AOSModuleLoading }), // /dashboard/health-records/vaccinations
  "home": dynamic(() => import("@/app/dashboard/page"), { loading: AOSModuleLoading }), // /dashboard
  "hostel": dynamic(() => import("@/app/dashboard/hostel/page"), { loading: AOSModuleLoading }), // /dashboard/hostel
  "hr": dynamic(() => import("@/app/dashboard/hr/page"), { loading: AOSModuleLoading }), // /dashboard/hr
  "hr__appraisal": dynamic(() => import("@/app/dashboard/hr/appraisal/page"), { loading: AOSModuleLoading }), // /dashboard/hr/appraisal
  "hr__expense-categories": dynamic(() => import("@/app/dashboard/hr/expense-categories/page"), { loading: AOSModuleLoading }), // /dashboard/hr/expense-categories
  "hr__expenses": dynamic(() => import("@/app/dashboard/hr/expenses/page"), { loading: AOSModuleLoading }), // /dashboard/hr/expenses
  "hr__leaves": dynamic(() => import("@/app/dashboard/hr/leaves/page"), { loading: AOSModuleLoading }), // /dashboard/hr/leaves
  "hr__leaves__report": dynamic(() => import("@/app/dashboard/hr/leaves/report/page"), { loading: AOSModuleLoading }), // /dashboard/hr/leaves/report
  "hr__payroll": dynamic(() => import("@/app/dashboard/hr/payroll/page"), { loading: AOSModuleLoading }), // /dashboard/hr/payroll
  "hr__payroll__settings": dynamic(() => import("@/app/dashboard/hr/payroll/settings/page"), { loading: AOSModuleLoading }), // /dashboard/hr/payroll/settings
  "hr__staff-attendance": dynamic(() => import("@/app/dashboard/hr/staff-attendance/page"), { loading: AOSModuleLoading }), // /dashboard/hr/staff-attendance
  "iemis-import": dynamic(() => import("@/app/dashboard/iemis-import/page"), { loading: AOSModuleLoading }), // /dashboard/iemis-import
  "iemis-import__history": dynamic(() => import("@/app/dashboard/iemis-import/history/page"), { loading: AOSModuleLoading }), // /dashboard/iemis-import/history
  "incident-management": dynamic(() => import("@/app/dashboard/incident-management/page"), { loading: AOSModuleLoading }), // /dashboard/incident-management
  "incident-management__active": dynamic(() => import("@/app/dashboard/incident-management/active/page"), { loading: AOSModuleLoading }), // /dashboard/incident-management/active
  "incident-management__escalations": dynamic(() => import("@/app/dashboard/incident-management/escalations/page"), { loading: AOSModuleLoading }), // /dashboard/incident-management/escalations
  "incident-management__reports": dynamic(() => import("@/app/dashboard/incident-management/reports/page"), { loading: AOSModuleLoading }), // /dashboard/incident-management/reports
  "incidents": dynamic(() => import("@/app/dashboard/incidents/page"), { loading: AOSModuleLoading }), // /dashboard/incidents
  "inventory": dynamic(() => import("@/app/dashboard/inventory/page"), { loading: AOSModuleLoading }), // /dashboard/inventory
  "library": dynamic(() => import("@/app/dashboard/library/page"), { loading: AOSModuleLoading }), // /dashboard/library
  "library__books": dynamic(() => import("@/app/dashboard/library/books/page"), { loading: AOSModuleLoading }), // /dashboard/library/books
  "library__catalog": dynamic(() => import("@/app/dashboard/library/catalog/page"), { loading: AOSModuleLoading }), // /dashboard/library/catalog
  "library__checkout": dynamic(() => import("@/app/dashboard/library/checkout/page"), { loading: AOSModuleLoading }), // /dashboard/library/checkout
  "library__fines": dynamic(() => import("@/app/dashboard/library/fines/page"), { loading: AOSModuleLoading }), // /dashboard/library/fines
  "library__overdue": dynamic(() => import("@/app/dashboard/library/overdue/page"), { loading: AOSModuleLoading }), // /dashboard/library/overdue
  "library__reports": dynamic(() => import("@/app/dashboard/library/reports/page"), { loading: AOSModuleLoading }), // /dashboard/library/reports
  "library__reservations": dynamic(() => import("@/app/dashboard/library/reservations/page"), { loading: AOSModuleLoading }), // /dashboard/library/reservations
  "library__stocktake": dynamic(() => import("@/app/dashboard/library/stocktake/page"), { loading: AOSModuleLoading }), // /dashboard/library/stocktake
  "lms": dynamic(() => import("@/app/dashboard/lms/page"), { loading: AOSModuleLoading }), // /dashboard/lms
  "marketplace": dynamic(() => import("@/app/dashboard/marketplace/page"), { loading: AOSModuleLoading }), // /dashboard/marketplace
  "multi-branch": dynamic(() => import("@/app/dashboard/multi-branch/page"), { loading: AOSModuleLoading }), // /dashboard/multi-branch
  "multi-branch__analytics": dynamic(() => import("@/app/dashboard/multi-branch/analytics/page"), { loading: AOSModuleLoading }), // /dashboard/multi-branch/analytics
  "multi-branch__branches": dynamic(() => import("@/app/dashboard/multi-branch/branches/page"), { loading: AOSModuleLoading }), // /dashboard/multi-branch/branches
  "multi-branch__dashboard": dynamic(() => import("@/app/dashboard/multi-branch/dashboard/page"), { loading: AOSModuleLoading }), // /dashboard/multi-branch/dashboard
  "notices": dynamic(() => import("@/app/dashboard/notices/page"), { loading: AOSModuleLoading }), // /dashboard/notices
  "notifications": dynamic(() => import("@/app/dashboard/notifications/page"), { loading: AOSModuleLoading }), // /dashboard/notifications
  "notifications__matrix": dynamic(() => import("@/app/dashboard/notifications/matrix/page"), { loading: AOSModuleLoading }), // /dashboard/notifications/matrix
  "parents": dynamic(() => import("@/app/dashboard/parents/page"), { loading: AOSModuleLoading }), // /dashboard/parents
  "parents__[id]": dynamic(() => import("@/app/dashboard/parents/[id]/page"), { loading: AOSModuleLoading }), // /dashboard/parents/[id]
  "plugins": dynamic(() => import("@/app/dashboard/plugins/page"), { loading: AOSModuleLoading }), // /dashboard/plugins
  "plugins__[slug]__settings": dynamic(() => import("@/app/dashboard/plugins/[slug]/settings/page"), { loading: AOSModuleLoading }), // /dashboard/plugins/[slug]/settings
  "portfolio": dynamic(() => import("@/app/dashboard/portfolio/page"), { loading: AOSModuleLoading }), // /dashboard/portfolio
  "profile": dynamic(() => import("@/app/dashboard/profile/page"), { loading: AOSModuleLoading }), // /dashboard/profile
  "reports": dynamic(() => import("@/app/dashboard/reports/page"), { loading: AOSModuleLoading }), // /dashboard/reports
  "reports__exam": dynamic(() => import("@/app/dashboard/reports/exam/page"), { loading: AOSModuleLoading }), // /dashboard/reports/exam
  "reports__expense": dynamic(() => import("@/app/dashboard/reports/expense/page"), { loading: AOSModuleLoading }), // /dashboard/reports/expense
  "reports__teacher": dynamic(() => import("@/app/dashboard/reports/teacher/page"), { loading: AOSModuleLoading }), // /dashboard/reports/teacher
  "settings": dynamic(() => import("@/app/dashboard/settings/page"), { loading: AOSModuleLoading }), // /dashboard/settings
  "settings__access-logs": dynamic(() => import("@/app/dashboard/settings/access-logs/page"), { loading: AOSModuleLoading }), // /dashboard/settings/access-logs
  "settings__backup": dynamic(() => import("@/app/dashboard/settings/backup/page"), { loading: AOSModuleLoading }), // /dashboard/settings/backup
  "settings__custom-fields": dynamic(() => import("@/app/dashboard/settings/custom-fields/page"), { loading: AOSModuleLoading }), // /dashboard/settings/custom-fields
  "settings__integrations": dynamic(() => import("@/app/dashboard/settings/integrations/page"), { loading: AOSModuleLoading }), // /dashboard/settings/integrations
  "settings__notifications": dynamic(() => import("@/app/dashboard/settings/notifications/page"), { loading: AOSModuleLoading }), // /dashboard/settings/notifications
  "settings__roles": dynamic(() => import("@/app/dashboard/settings/roles/page"), { loading: AOSModuleLoading }), // /dashboard/settings/roles
  "sms": dynamic(() => import("@/app/dashboard/sms/page"), { loading: AOSModuleLoading }), // /dashboard/sms
  "staff": dynamic(() => import("@/app/dashboard/staff/page"), { loading: AOSModuleLoading }), // /dashboard/staff
  "students": dynamic(() => import("@/app/dashboard/students/page"), { loading: AOSModuleLoading }), // /dashboard/students
  "students__[id]": dynamic(() => import("@/app/dashboard/students/[id]/page"), { loading: AOSModuleLoading }), // /dashboard/students/[id]
  "students__bulk-import": dynamic(() => import("@/app/dashboard/students/bulk-import/page"), { loading: AOSModuleLoading }), // /dashboard/students/bulk-import
  "students__new": dynamic(() => import("@/app/dashboard/students/new/page"), { loading: AOSModuleLoading }), // /dashboard/students/new
  "students__profile-images": dynamic(() => import("@/app/dashboard/students/profile-images/page"), { loading: AOSModuleLoading }), // /dashboard/students/profile-images
  "students__promote": dynamic(() => import("@/app/dashboard/students/promote/page"), { loading: AOSModuleLoading }), // /dashboard/students/promote
  "students__reset-password": dynamic(() => import("@/app/dashboard/students/reset-password/page"), { loading: AOSModuleLoading }), // /dashboard/students/reset-password
  "students__roll-numbers": dynamic(() => import("@/app/dashboard/students/roll-numbers/page"), { loading: AOSModuleLoading }), // /dashboard/students/roll-numbers
  "students__transfers": dynamic(() => import("@/app/dashboard/students/transfers/page"), { loading: AOSModuleLoading }), // /dashboard/students/transfers
  "teachers": dynamic(() => import("@/app/dashboard/teachers/page"), { loading: AOSModuleLoading }), // /dashboard/teachers
  "teaching-content": dynamic(() => import("@/app/dashboard/teaching-content/page"), { loading: AOSModuleLoading }), // /dashboard/teaching-content
  "timetable": dynamic(() => import("@/app/dashboard/timetable/page"), { loading: AOSModuleLoading }), // /dashboard/timetable
  "timetable__generate": dynamic(() => import("@/app/dashboard/timetable/generate/page"), { loading: AOSModuleLoading }), // /dashboard/timetable/generate
  "timetable__teacher": dynamic(() => import("@/app/dashboard/timetable/teacher/page"), { loading: AOSModuleLoading }), // /dashboard/timetable/teacher
  "transport": dynamic(() => import("@/app/dashboard/transport/page"), { loading: AOSModuleLoading }), // /dashboard/transport
  "transport__allocation": dynamic(() => import("@/app/dashboard/transport/allocation/page"), { loading: AOSModuleLoading }), // /dashboard/transport/allocation
  "transport__buses": dynamic(() => import("@/app/dashboard/transport/buses/page"), { loading: AOSModuleLoading }), // /dashboard/transport/buses
  "transport__logs": dynamic(() => import("@/app/dashboard/transport/logs/page"), { loading: AOSModuleLoading }), // /dashboard/transport/logs
  "transport__map": dynamic(() => import("@/app/dashboard/transport/map/page"), { loading: AOSModuleLoading }), // /dashboard/transport/map
  "transport__monitor": dynamic(() => import("@/app/dashboard/transport/monitor/page"), { loading: AOSModuleLoading }), // /dashboard/transport/monitor
  "transport__pickup-points": dynamic(() => import("@/app/dashboard/transport/pickup-points/page"), { loading: AOSModuleLoading }), // /dashboard/transport/pickup-points
  "transport__reports": dynamic(() => import("@/app/dashboard/transport/reports/page"), { loading: AOSModuleLoading }), // /dashboard/transport/reports
  "transport__routes": dynamic(() => import("@/app/dashboard/transport/routes/page"), { loading: AOSModuleLoading }), // /dashboard/transport/routes
  "transport__stops": dynamic(() => import("@/app/dashboard/transport/stops/page"), { loading: AOSModuleLoading }), // /dashboard/transport/stops
  "transport__trips": dynamic(() => import("@/app/dashboard/transport/trips/page"), { loading: AOSModuleLoading }), // /dashboard/transport/trips
  "users": dynamic(() => import("@/app/dashboard/users/page"), { loading: AOSModuleLoading }), // /dashboard/users
  "visitors": dynamic(() => import("@/app/dashboard/visitors/page"), { loading: AOSModuleLoading }), // /dashboard/visitors
  "website-builder": dynamic(() => import("@/app/dashboard/website-builder/page"), { loading: AOSModuleLoading }), // /dashboard/website-builder
  "website-builder__ai-builder": dynamic(() => import("@/app/dashboard/website-builder/ai-builder/page"), { loading: AOSModuleLoading }), // /dashboard/website-builder/ai-builder
  "website-builder__domain": dynamic(() => import("@/app/dashboard/website-builder/domain/page"), { loading: AOSModuleLoading }), // /dashboard/website-builder/domain
  "website-builder__editor": dynamic(() => import("@/app/dashboard/website-builder/editor/page"), { loading: AOSModuleLoading }), // /dashboard/website-builder/editor
  "website-builder__pages": dynamic(() => import("@/app/dashboard/website-builder/pages/page"), { loading: AOSModuleLoading }), // /dashboard/website-builder/pages
  "website-builder__seo": dynamic(() => import("@/app/dashboard/website-builder/seo/page"), { loading: AOSModuleLoading }), // /dashboard/website-builder/seo
  "website-builder__themes": dynamic(() => import("@/app/dashboard/website-builder/themes/page"), { loading: AOSModuleLoading }), // /dashboard/website-builder/themes
  "wellbeing": dynamic(() => import("@/app/dashboard/wellbeing/page"), { loading: AOSModuleLoading }), // /dashboard/wellbeing
  "wellbeing__counselor": dynamic(() => import("@/app/dashboard/wellbeing/counselor/page"), { loading: AOSModuleLoading }), // /dashboard/wellbeing/counselor
  "wellbeing__moods": dynamic(() => import("@/app/dashboard/wellbeing/moods/page"), { loading: AOSModuleLoading }), // /dashboard/wellbeing/moods
  "wellbeing__surveys": dynamic(() => import("@/app/dashboard/wellbeing/surveys/page"), { loading: AOSModuleLoading }), // /dashboard/wellbeing/surveys
  "white-label": dynamic(() => import("@/app/dashboard/white-label/page"), { loading: AOSModuleLoading }), // /dashboard/white-label
  "white-label__branding": dynamic(() => import("@/app/dashboard/white-label/branding/page"), { loading: AOSModuleLoading }), // /dashboard/white-label/branding
  "white-label__domain": dynamic(() => import("@/app/dashboard/white-label/domain/page"), { loading: AOSModuleLoading }), // /dashboard/white-label/domain
  "white-label__theme": dynamic(() => import("@/app/dashboard/white-label/theme/page"), { loading: AOSModuleLoading }), // /dashboard/white-label/theme

  // ── Redirect stubs — server pages that redirect; map straight to their
  //    targets so in-process windows land on the right content. ──────────
  "academics__classes": dynamic(() => import("@/app/dashboard/academics/class-sections/page"), { loading: AOSModuleLoading }), // → class-sections
  "academics__year": dynamic(() => import("@/app/dashboard/academics/page"), { loading: AOSModuleLoading }), // → academics
  "academics__years": dynamic(() => import("@/app/dashboard/academics/page"), { loading: AOSModuleLoading }), // → academics
  "certificates__id-settings": dynamic(() => import("@/app/dashboard/designer/page"), { loading: AOSModuleLoading }), // → designer
  "certificates__staff-id": dynamic(() => import("@/app/dashboard/certificates/staff/page"), { loading: AOSModuleLoading }), // → certificates/staff
  "certificates__student-id": dynamic(() => import("@/app/dashboard/certificates/students/page"), { loading: AOSModuleLoading }), // → certificates/students
  "certificates__templates": dynamic(() => import("@/app/dashboard/designer/templates/page"), { loading: AOSModuleLoading }), // → designer/templates
  "library__transactions": dynamic(() => import("@/app/dashboard/library/page"), { loading: AOSModuleLoading }), // → library (issues tab)
  "settings__website-design": dynamic(() => import("@/app/dashboard/website-builder/page"), { loading: AOSModuleLoading }), // → website-builder
  "staff__bulk-upload": dynamic(() => import("@/app/dashboard/bulk-uploads/csv/page"), { loading: AOSModuleLoading }), // → bulk-uploads/csv
  "students__guardians": dynamic(() => import("@/app/dashboard/parents/page"), { loading: AOSModuleLoading }), // → parents
  "teachers__bulk-upload": dynamic(() => import("@/app/dashboard/bulk-uploads/csv/page"), { loading: AOSModuleLoading }), // → bulk-uploads/csv
};

/** Map a /dashboard route path to its route-table key. */
export function routeToKey(route: string): string | null {
  const path = route.split("?")[0].replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean); // ["dashboard", "fees", "collect"]
  if (segments[0] !== "dashboard") return null;
  if (segments.length === 1) return "home";
  return segments.slice(1).join("__");
}

/** Resolve any /dashboard route to its exact page component (null if absent). */
export function resolveRouteComponent(route: string): React.ComponentType<any> | null {
  const key = routeToKey(route);
  if (!key) return null;
  return AOS_ROUTE_COMPONENTS[key] || null;
}
