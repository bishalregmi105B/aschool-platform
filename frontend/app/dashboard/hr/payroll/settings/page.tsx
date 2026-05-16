"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageLoader, Spinner } from "@/components/ui/spinner";
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
      const res = await api.get<ApiResponse<School>>("/schools/current");
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

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" /> Payroll Settings
          </h1>
          <p className="text-muted-foreground">Configure global salary structures and rules</p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Basic configurations for payroll generation</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Basic Salary Percentage (%)</Label>
              <Input 
                type="number" 
                value={formData.basicSalaryPercentage}
                onChange={(e) => setFormData(prev => ({ ...prev, basicSalaryPercentage: Number(e.target.value) }))}
                placeholder="e.g. 100" 
              />
              <p className="text-xs text-muted-foreground">What percentage of Gross Salary is considered Basic Salary</p>
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
              <p className="text-xs text-muted-foreground">Day of the month when salaries are typically paid</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Allowances</CardTitle>
                <CardDescription>Global allowances applied to basic salary</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => addArrayItem("allowances")}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
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
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {formData.allowances.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No allowances configured</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Deductions</CardTitle>
                <CardDescription>Global deductions applied to basic salary</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => addArrayItem("deductions")}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
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
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {formData.deductions.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No deductions configured</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
