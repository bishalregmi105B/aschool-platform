"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Award, CreditCard, FileText,
} from "lucide-react";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
} from "@/components/aos/kit/page-kit";

// Quick links — every certificates subpage (templates, student/staff
// certificates, character & transfer letters, ID settings and card runs).
const QUICK_LINKS: { label: string; desc: string; icon: string; href: string }[] = [
  { label: "Certificate Templates", desc: "Create reusable certificate designs", icon: "FileText", href: "/dashboard/certificates/templates" },
  { label: "Student Certificates", desc: "Generate certificates for students", icon: "Users", href: "/dashboard/certificates/students" },
  { label: "Staff Certificates", desc: "Generate certificates for staff", icon: "Briefcase", href: "/dashboard/certificates/staff" },
  { label: "Character Certificates", desc: "Character certificates for students", icon: "HeartPulse", href: "/dashboard/certificates/character" },
  { label: "Transfer Certificates", desc: "Transfer and leaving certificates", icon: "ArrowRightLeft", href: "/dashboard/certificates/transfer" },
  { label: "ID Card Settings", desc: "Configure ID card layout and fields", icon: "CreditCard", href: "/dashboard/certificates/id-settings" },
  { label: "Student ID Cards", desc: "Generate and print student ID cards", icon: "Users", href: "/dashboard/certificates/student-id" },
  { label: "Staff ID Cards", desc: "Generate and print staff ID cards", icon: "Briefcase", href: "/dashboard/certificates/staff-id" },
];

interface TemplateItem {
  id: string;
  name: string;
  category?: string;
}

export default function CertificatesPage() {
  // KPI source — the same template lists the generator subpages load
  // (/design-studio/templates?category=…), one query per category.
  const { data: certTemplates } = useQuery({
    queryKey: ["certificates-templates", "certificates"],
    queryFn: async () => {
      const res = await api.get<{ data: TemplateItem[] }>("/design-studio/templates?category=certificates");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    retry: 1,
  });

  const { data: idTemplates } = useQuery({
    queryKey: ["certificates-templates", "id_cards"],
    queryFn: async () => {
      const res = await api.get<{ data: TemplateItem[] }>("/design-studio/templates?category=id_cards");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    retry: 1,
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Award className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Certificates & ID Cards"
        subtitle="Manage certificate templates and generate ID cards"
      />
      <AOSPageBody>
        {/* Dashboard — KPI stat grid from the live template lists */}
        <StatGrid>
          <KpiCard
            label="Certificate Templates"
            value={certTemplates?.length ?? "—"}
            icon={<FileText className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="ID Card Templates"
            value={idTemplates?.length ?? "—"}
            color="#d83b01"
            icon={<CreditCard className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
          <KpiCard
            label="Surfaces"
            value={QUICK_LINKS.length}
            color="var(--w11-text-primary)"
            icon={<Award className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
        </StatGrid>

        {/* Quick links — shared launcher grid (same tile recipe as the kit). */}
        <QuickLinks
          section="Design & Web"
          links={QUICK_LINKS.map((l) => ({ label: l.label, href: l.href, icon: l.icon }))}
        />
      </AOSPageBody>
    </AOSPage>
  );
}
