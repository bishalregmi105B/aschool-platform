"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, CreditCard, FileText, Users, Briefcase, type LucideIcon } from "lucide-react";

export default function CertificatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="h-6 w-6" /> Certificates & ID Cards</h1>
        <p className="text-muted-foreground">Manage certificate templates and generate ID cards</p>
      </div>

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
    </div>
  );
}

function CertCard({ title, desc, icon: Icon, action, href }: { title: string; desc: string; icon: LucideIcon; action: string; href: string }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="w-full" asChild>
          <a href={href}>{action}</a>
        </Button>
      </CardContent>
    </Card>
  );
}
