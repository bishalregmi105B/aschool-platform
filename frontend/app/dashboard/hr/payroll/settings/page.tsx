"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FormSection,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Settings, Save, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface School {
  id: string;
  name: string;
  settings?: {
    payroll?: {
      basicSalaryPercentage?: number;
      allowances?: Array<{ name: string; percentage: number }>;
      deductions?: Array<{ name: string; percentage: number }>;
      taxRate?: number;
      paymentDay?: number;
    }
  };
}

export default function PayrollSettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [serverJson, setServerJson] = useState<string>("");

  const [formData, setFormData] = useState({
    basicSalaryPercentage: 100,
    taxRate: 0,
    paymentDay: 1,
    allowances: [] as Array<{ name: string; percentage: number }>,
    deductions: [] as Array<{ name: string; percentage: number }>
  });

  const { data: school, isLoading } = useQuery<any>({
    queryKey: ["current-school"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<School>>("/schools/current/settings");
      return res.data.data;
    },
  });

  useEffect(() => {
    if (school?.settings?.payroll) {
      const next = {
        basicSalaryPercentage: school.settings.payroll.basicSalaryPercentage || 100,
        taxRate: school.settings.payroll.taxRate || 0,
        paymentDay: school.settings.payroll.paymentDay || 1,
        allowances: school.settings.payroll.allowances || [],
        deductions: school.settings.payroll.deductions || [],
      };
      setServerJson(JSON.stringify(next));
      setFormData(next);
    }
  }, [school]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.put(`/schools/${school?.id}`, {
      settings: {
        ...(school?.settings || {}),
        payroll: payload
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-school"] });
      toast.success(t("Payroll settings saved", "सेटिङ सुरक्षित भयो"));
    },
    onError: () => toast.error(t("Failed to save settings", "सुरक्षित गर्न सकिएन")),
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const addArrayItem = (type: "allowances" | "deductions") => {
    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], { name: "", percentage: 0 }]
    }));
  };

  const updateArrayItem = (type: "allowances" | "deductions", index: number, field: string, value: any) => {
    const newArray = [...formData[type]];
    newArray[index] = { ...newArray[index], [field]: value };
    setFormData(prev => ({ ...prev, [type]: newArray }));
  };

  const removeArrayItem = (type: "allowances" | "deductions", index: number) => {
    const newArray = [...formData[type]];
    newArray.splice(index, 1);
    setFormData(prev => ({ ...prev, [type]: newArray }));
  };

  if (isLoading) return <AOSModuleLoadingState label="Loading payroll settings…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Settings className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Payroll Settings", "पेरोल सेटिंग")}
        subtitle={t("Configure global salary structures and rules", "ग्लोबल तलब संरचना र नियम")}
        actions={
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || (serverJson !== "" && JSON.stringify(formData) === serverJson)}
          >
            {updateMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {t("Save Settings", "सेटिंग सुरक्ष")}
          </Button>
        }
      />
      <AOSPageBody>
        <div className="max-w-4xl space-y-4">
          <FormSection title={t("General Settings", "साझेत सेटिंग")}>
            <p className="text-xs mb-4" style={{ color: "var(--w11-text-secondary)" }}>
              {t("These values apply when new payroll rows are generated.", "नयाँ पेरोल बनाउँदा यी मूल्य लगन्छ।")}
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{t("Basic Salary Percentage (%)", "आधार तलब \%")}</Label>
                <Input
                  type="number"
                  value={formData.basicSalaryPercentage}
                  onChange={(e) => setFormData(prev => ({ ...prev, basicSalaryPercentage: Number(e.target.value) }))}
                  placeholder="e.g. 100"
                />
                <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{t("Share of gross treated as basic salary.", "कुल तलबमध्ये आधार तलबको हिस्सा।")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("Default Tax Rate (%)", "पूर्वनियुक्त कर \%")}</Label>
                <Input
                  type="number"
                  value={formData.taxRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxRate: Number(e.target.value) }))}
                  placeholder="e.g. 1"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Monthly Payment Day", "मासिक भुक्तान दिन")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.paymentDay}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentDay: Number(e.target.value) }))}
                  placeholder="e.g. 1"
                />
                <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{t("Shown as reminder when closing a month's payroll.", "महिना बन्द गर्दा सम्झनाका लागि।")}</p>
              </div>
            </div>
          </FormSection>

          <div className="grid md:grid-cols-2 gap-4">
            <DataPanel
              title={t("Allowances", "भत्ता")}
              actions={
                <Button variant="outline" size="sm" onClick={() => addArrayItem("allowances")}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              }
            >
              <p className="text-xs mb-4" style={{ color: "var(--w11-text-secondary)" }}>
                {t("Added on top of basic salary for every staff payroll.", "आधार तलबमा सबैका लागि थपिन्छ।")}
              </p>
              <div className="space-y-4">
                {formData.allowances.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder={t("Name (e.g. Transport)", "नाम (जस्तै: यातायात)")}
                      value={item.name}
                      onChange={(e) => updateArrayItem("allowances", index, "name", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="%"
                      value={item.percentage}
                      onChange={(e) => updateArrayItem("allowances", index, "percentage", Number(e.target.value))}
                      className="w-20"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeArrayItem("allowances", index)}>
                      <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
                    </Button>
                  </div>
                ))}
                {formData.allowances.length === 0 && (
                  <p className="text-center text-sm py-4" style={{ color: "var(--w11-text-secondary)" }}>{t("No allowances configured", "भत्ता सेट गरिएको छैन")}</p>
                )}
              </div>
            </DataPanel>

            <DataPanel
              title={t("Deductions", "कट्टा")}
              actions={
                <Button variant="outline" size="sm" onClick={() => addArrayItem("deductions")}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              }
            >
              <p className="text-xs mb-4" style={{ color: "var(--w11-text-secondary)" }}>
                {t("Subtracted from gross for every staff payroll.", "सबैको कुल तलबबाट घटिन्छ।")}
              </p>
              <div className="space-y-4">
                {formData.deductions.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder={t("Name (e.g. PF, SSF)", "नाम (जस्तै: SSF)")}
                      value={item.name}
                      onChange={(e) => updateArrayItem("deductions", index, "name", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="%"
                      value={item.percentage}
                      onChange={(e) => updateArrayItem("deductions", index, "percentage", Number(e.target.value))}
                      className="w-20"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeArrayItem("deductions", index)}>
                      <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
                    </Button>
                  </div>
                ))}
                {formData.deductions.length === 0 && (
                  <p className="text-center text-sm py-4" style={{ color: "var(--w11-text-secondary)" }}>{t("No deductions configured", "कट्टा सेट गरिएको छैन")}</p>
                )}
              </div>
            </DataPanel>
          </div>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
