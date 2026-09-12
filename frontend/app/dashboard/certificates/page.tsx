"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, CreditCard, FileText, Users, Briefcase, type LucideIcon } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";

export default function CertificatesPage() {
  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Award className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Certificates & ID Cards"
        subtitle="Manage certificate templates and generate ID cards"
      />
      <AOSPageBody>
        <Tabs defaultValue="certificates">
          <TabsList>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="id-cards">ID Cards</TabsTrigger>
          </TabsList>

          <TabsContent value="certificates" className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <CertCard title="Certificate Templates" desc="Create reusable certificate designs" icon={FileText} action="Manage Templates" href="/dashboard/certificates/templates" />
              <CertCard title="Student Certificates" desc="Generate certificates for students" icon={Users} action="Generate" href="/dashboard/certificates/students" />
              <CertCard title="Staff Certificates" desc="Generate certificates for staff" icon={Briefcase} action="Generate" href="/dashboard/certificates/staff" />
            </div>
          </TabsContent>

          <TabsContent value="id-cards" className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <CertCard title="ID Card Settings" desc="Configure ID card layout and fields" icon={CreditCard} action="Configure" href="/dashboard/certificates/id-settings" />
              <CertCard title="Student ID Cards" desc="Generate and print student ID cards" icon={Users} action="Generate" href="/dashboard/certificates/student-id" />
              <CertCard title="Staff ID Cards" desc="Generate and print staff ID cards" icon={Briefcase} action="Generate" href="/dashboard/certificates/staff-id" />
            </div>
          </TabsContent>
        </Tabs>
      </AOSPageBody>
    </AOSPage>
  );
}

function CertCard({ title, desc, icon: Icon, action, href }: { title: string; desc: string; icon: LucideIcon; action: string; href: string }) {
  return (
    <DataPanel title={title}>
      <div>
        <div
          className="h-12 w-12 rounded-lg flex items-center justify-center mb-2"
          style={{
            background: "var(--w11-accent-light)",
            borderRadius: "var(--w11-radius-lg)",
          }}
        >
          <Icon className="h-6 w-6" style={{ color: "var(--w11-accent)" }} />
        </div>
        <p className="text-sm mb-4" style={{ color: "var(--w11-text-secondary)" }}>{desc}</p>
        <Button variant="outline" className="w-full" asChild>
          <a href={href}>{action}</a>
        </Button>
      </div>
    </DataPanel>
  );
}
