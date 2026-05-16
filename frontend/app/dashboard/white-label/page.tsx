"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, Palette, Globe, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function WhiteLabelPage() {
  return <PluginGate slug="white_label"><WhiteLabelContent /></PluginGate>;
}

function WhiteLabelContent() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["white-label-overview"],
    queryFn: async () => { const r = await api.get("/schools/white-label/overview"); return r.data?.data ?? r.data; },
  });

  if (isLoading) return <PageLoader />;

  const checklist = [
    { label: "School Logo Uploaded", done: data?.has_logo ?? false },
    { label: "Custom Domain Active", done: data?.custom_domain_active ?? false },
    { label: "Brand Colors Configured", done: data?.brand_colors_set ?? false },
    { label: "ASchool Branding Hidden", done: data?.branding_hidden ?? false },
    { label: "Custom Email Domain", done: data?.custom_email_domain ?? false },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Tag className="h-8 w-8 text-purple-600" />
        <div><h1 className="text-2xl font-bold">White-Label Branding</h1><p className="text-muted-foreground">Custom branding, own domain, and ASchool branding removal</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "Branding", desc: "Logo, colors, fonts, and school identity", icon: Palette, href: "/dashboard/white-label/branding", color: "border-purple-200" },
          { title: "Custom Domain", desc: "Point your own domain to this platform", icon: Globe, href: "/dashboard/white-label/domain", color: "border-blue-200" },
          { title: "Theme", desc: "App theme, colors, and UI customization", icon: Palette, href: "/dashboard/white-label/theme", color: "border-pink-200" },
        ].map((card) => (
          <Card key={card.title} className={`${card.color} hover:shadow-md transition-shadow`}>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><card.icon className="h-5 w-5" />{card.title}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{card.desc}</p>
              <Button size="sm" variant="outline" asChild className="w-full"><Link href={card.href}>Configure</Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Setup Checklist</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <CheckCircle className={`h-5 w-5 ${item.done ? "text-green-600" : "text-muted-foreground/30"}`} />
                <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                <Badge variant={item.done ? "default" : "secondary"} className="ml-auto">{item.done ? "Done" : "Pending"}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
