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
  const queryClient = useQueryClient();

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
      setFormData({
        basicSalaryPercentage: school.settings.payroll.basicSalaryPercentage || 100,
        taxRate: school.settings.payroll.taxRate || 0,
        paymentDay: school.settings.payroll.paymentDay || 1,
        allowances: school.settings.payroll.allowances || [],
        deductions: school.settings.payroll.deductions || [],
      });
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
      toast.success("Payroll settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
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
        title="Payroll Settings"
        subtitle="Configure global salary structures and rules"
        actions={
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        }
      />
      <AOSPageBody>
        <div className="max-w-4xl space-y-4">
          <FormSection title="General Settings">
            <p className="text-xs mb-4" style={{ color: "var(--w11-text-secondary)" }}>
              Basic configurations for payroll generation
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Basic Salary Percentage (%)</Label>
                <Input
                  type="number"
                  value={formData.basicSalaryPercentage}
                  onChange={(e) => setFormData(prev => ({ ...prev, basicSalaryPercentage: Number(e.target.value) }))}
                  placeholder="e.g. 100"
                />
                <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>What percentage of Gross Salary is considered Basic Salary</p>
              </div>
              <div className="space-y-2">
                <Label>Default Tax Rate (%)</Label>
                <Input
                  type="number"
                  value={formData.taxRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxRate: Number(e.target.value) }))}
                  placeholder="e.g. 1"
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Payment Day</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.paymentDay}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentDay: Number(e.target.value) }))}
                  placeholder="e.g. 1"
                />
                <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Day of the month when salaries are typically paid</p>
              </div>
            </div>
          </FormSection>

          <div className="grid md:grid-cols-2 gap-4">
            <DataPanel
              title="Allowances"
              actions={
                <Button variant="outline" size="sm" onClick={() => addArrayItem("allowances")}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              }
            >
              <p className="text-xs mb-4" style={{ color: "var(--w11-text-secondary)" }}>
                Global allowances applied to basic salary
              </p>
              <div className="space-y-4">
                {formData.allowances.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Name (e.g. Transport)"
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
                  <p className="text-center text-sm py-4" style={{ color: "var(--w11-text-secondary)" }}>No allowances configured</p>
                )}
              </div>
            </DataPanel>

            <DataPanel
              title="Deductions"
              actions={
                <Button variant="outline" size="sm" onClick={() => addArrayItem("deductions")}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              }
            >
              <p className="text-xs mb-4" style={{ color: "var(--w11-text-secondary)" }}>
                Global deductions applied to basic salary
              </p>
              <div className="space-y-4">
                {formData.deductions.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Name (e.g. PF, SSF)"
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
                  <p className="text-center text-sm py-4" style={{ color: "var(--w11-text-secondary)" }}>No deductions configured</p>
                )}
              </div>
            </DataPanel>
          </div>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
