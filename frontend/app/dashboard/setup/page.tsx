"use client";

/**
 * First-run setup wizard (deep-ux plan 5.2b / Phase 2.4).
 *
 * A guided checklist, not a form chain: every step links to the REAL module
 * screen (so there is no duplicated form logic), and completion is computed
 * live from existing count endpoints — when a school finishes a step the
 * card flips to done without any extra state.
 *
 * Trigger: the desktop shows this app after install; it is also the
 * recommended entry from empty-setup dead-ends ("create a class first →"
 * links point at /dashboard/academics directly, which is where the class
 * form actually lives).
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  GraduationCap,
  Layers,
  Link2,
  ScrollText,
  UserCog,
} from "lucide-react";
import { api } from "@/lib/api";
import { AOSPage, AOSPageHeader, AOSPageBody } from "@/components/aos/kit/page-kit";
import { useAOSRouterNavigate } from "@/lib/aos-window-route";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  titleNepali: string;
  hint: string;
  hintNepali: string;
  route: string;
  done: boolean | null; // null = loading
  countText?: (n: number) => [string, string];
}

export default function SetupWizardPage() {
  const navigate = useAOSRouterNavigate();
  const { t } = useI18n();
  const { user } = useAuth();

  const years = useQuery({
    queryKey: ["academic-years"],
    queryFn: async () => (await api.get("/academics/years"))?.data?.data ?? [],
  });
  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await api.get("/academics/classes"))?.data?.data ?? [],
  });
  const subjects = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await api.get("/academics/subjects"))?.data?.data ?? [],
  });
  const feeTypes = useQuery({
    queryKey: ["fees-types"],
    queryFn: async () => (await api.get("/fees/types"))?.data?.data ?? [],
  });
  const teachers = useQuery({
    queryKey: ["setup-teachers"],
    queryFn: async () => (await api.get("/users?role=teacher"))?.data?.data ?? [],
  });

  const sectionCount = ((classes.data as Array<{ sections?: unknown[] }>) || []).reduce(
    (n, c) => n + (c.sections?.length || 0),
    0
  );

  const steps: Step[] = [
    {
      id: "year",
      icon: <CalendarDays className="h-5 w-5" />,
      title: "Create the academic year",
      titleNepali: "शैक्षिक वर्ष सिर्जना गर्नुहोस्",
      hint: "The year everything hangs off — classes, fees, exams.",
      hintNepali: "कक्षा, शुल्क र परीक्षा सबै यसमा निर्भर छन्।",
      route: "/dashboard/academics?tab=years",
      done: years.data ? (years.data as unknown[]).length > 0 : null,
      countText: (n) => [`${n} year${n === 1 ? "" : "s"}`, `${n} वर्ष`],
    },
    {
      id: "classes",
      icon: <GraduationCap className="h-5 w-5" />,
      title: "Add classes",
      titleNepali: "कक्षा थप्नुहोस्",
      hint: "Grade 1 through 12, or whatever you run.",
      hintNepali: "कक्षा १ देखि १२ सम्म।",
      route: "/dashboard/academics?tab=classes",
      done: classes.data ? (classes.data as unknown[]).length > 0 : null,
      countText: (n) => [`${n} classes`, `${n} कक्षा`],
    },
    {
      id: "sections",
      icon: <Layers className="h-5 w-5" />,
      title: "Divide into sections",
      titleNepali: "खण्ड विभाजन गर्नुहोस्",
      hint: "Sections live inside a class — open Academics ▸ Classes.",
      hintNepali: "खण्ड कक्षा भित्र हुन्छन्।",
      route: "/dashboard/academics?tab=sections",
      done: classes.data ? sectionCount > 0 : null,
      countText: (n) => [`${n} sections`, `${n} खण्ड`],
    },
    {
      id: "subjects",
      icon: <ScrollText className="h-5 w-5" />,
      title: "Define subjects",
      titleNepali: "विषय परिभाषित गर्नुहोस्",
      hint: "Subjects bind to classes to build timetables.",
      hintNepali: "विषय कक्षासँग जोडिन्छ।",
      route: "/dashboard/academics?tab=subjects",
      done: subjects.data ? (subjects.data as unknown[]).length > 0 : null,
      countText: (n) => [`${n} subjects`, `${n} विषय`],
    },
    {
      id: "fees",
      icon: <Link2 className="h-5 w-5" />,
      title: "Set up fee structure",
      titleNepali: "शुल्क संरचना राख्नुहोस्",
      hint: "Fee types first, then assign them per class.",
      hintNepali: "पहिले शुल्क प्रकार, पछि कक्षा अनुसार।",
      route: "/dashboard/fees/types",
      done: feeTypes.data ? (feeTypes.data as unknown[]).length > 0 : null,
      countText: (n) => [`${n} fee types`, `${n} शुल्क प्रकार`],
    },
    {
      id: "teachers",
      icon: <UserCog className="h-5 w-5" />,
      title: "Invite teachers",
      titleNepali: "शिक्षक आमन्त्रित गर्नुहोस्",
      hint: "Staff accounts get the teacher app + class assignments.",
      hintNepali: "शिक्षक एप र कक्षा कार्यको लागि।",
      route: "/dashboard/teachers",
      done: teachers.data ? (teachers.data as unknown[]).length > 0 : null,
      countText: (n) => [`${n} teachers`, `${n} शिक्षक`],
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  if (user?.role !== "school_admin" && user?.role !== "superadmin") {
    return (
      <AOSPage>
        <AOSPageHeader title={t("Setup", "सेटअप")} subtitle={t("Admins manage school setup.", "सेटअप प्रशासकले गर्छन्।")} />
        <AOSPageBody>
          <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
            {t(
              "Your school is already set up — your teacher/student portal has what you need.",
              "तपाईंको विद्यालय सेट भइसकेको छ — शिक्षक/विद्यार्थी पोर्टल हेर्नुहोस्।"
            )}
          </p>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<CircleDashed className="h-5 w-5" />}
        title={t("School setup", "विद्यालय सेटअप")}
        subtitle={`${doneCount}/${steps.length} ${t("done", "सम्पन्न")}`}
        actions={
          pct === 100 ? (
            <span
              className="inline-flex items-center gap-1 text-[12px] font-semibold"
              style={{ color: "var(--w11-success, #107c10)" }}
            >
              <CheckCircle2 className="h-4 w-4" /> {t("Ready to run your school", "विद्यालय सञ्चालन तयार")}
            </span>
          ) : undefined
        }
      />
      <AOSPageBody>
        <div
          className="win11-progress"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            height: 8,
            borderRadius: 999,
            background: "var(--w11-control-hover, rgba(0,0,0,0.06))",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--w11-accent)", transition: "width .3s" }} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {steps.map((step, i) => {
            const cnt =
              step.countText &&
              (() => {
                const raw = {
                  year: (years.data as unknown[] | undefined)?.length,
                  classes: (classes.data as unknown[] | undefined)?.length,
                  sections: sectionCount,
                  subjects: (subjects.data as unknown[] | undefined)?.length,
                  fees: (feeTypes.data as unknown[] | undefined)?.length,
                  teachers: (teachers.data as unknown[] | undefined)?.length,
                }[step.id];
                return raw != null && raw > 0 ? step.countText(raw) : null;
              })();
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => navigate(step.route)}
                className="win11-card text-left flex items-start gap-3 transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ padding: 14, margin: 0 }}
                aria-label={`${t("Open step", "चरण खोल्नुहोस्")}: ${step.title}`}
              >
                <span
                  className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full shrink-0"
                  style={{
                    background:
                      step.done === true
                        ? "var(--w11-success-light, rgba(16,124,16,0.12))"
                        : "var(--w11-control-hover, rgba(0,0,0,0.045))",
                    color:
                      step.done === true
                        ? "var(--w11-success, #107c10)"
                        : "var(--w11-text-secondary)",
                  }}
                >
                  {step.done === true ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold" style={{ color: "var(--w11-text-primary)" }}>
                    {step.title} <span className="text-[11px] font-normal" style={{ color: "var(--w11-text-secondary)" }}>· {step.titleNepali}</span>
                  </span>
                  <span className="block text-[12px] mt-0.5" style={{ color: "var(--w11-text-secondary)" }}>
                    {step.hint} <span className="opacity-70">· {step.hintNepali}</span>
                  </span>
                  {cnt && (
                    <span className="block text-[11px] mt-1" style={{ color: "var(--w11-success, #107c10)" }}>
                      ✓ {cnt[0]} · {cnt[1]}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-[12px] mt-4" style={{ color: "var(--w11-text-tertiary)" }}>
          {t(
            "Each card opens the real screen where that thing is created — nothing here duplicates a form.",
            "प्रत्येक कार्डले वास्तविक स्क्रिन खोल्छ — यहाँ कुनै फर्म दोहोरिएको छैन।"
          )}
        </p>
      </AOSPageBody>
    </AOSPage>
  );
}
