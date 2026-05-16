"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft,
  CheckCircle,
  DollarSign,
  Download,
  FileText,
  Send,
  Wallet,
} from "lucide-react";
import Link from "next/link";

export default function PayrollPage() {
  return (
    <PluginGate slug="hr">
      <PayrollContent />
    </PluginGate>
  );
}

function PayrollContent() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );

  const { data, isLoading } = useQuery<any>({
    queryKey: ["payroll", month],
    queryFn: async () => {
      const r = await api.get("/hr/payroll", { params: { month } });
      return r.data;
    },
  });

  const payroll = data?.data || [];
  const summary = data?.summary || {};

  const generate = useMutation({
    mutationFn: async () =>
      (await api.post("/hr/payroll/generate", { month })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success("Payroll generated!");
    },
    onError: () => toast.error("Failed to generate payroll"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/hr">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Payroll Management</h1>
          <p className="text-muted-foreground">
            Monthly salary processing and payslips
          </p>
        </div>
        <input
          type="month"
          className="border rounded-md px-3 py-2"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Staff</p>
            <p className="text-2xl font-bold">
              {payroll.length || summary.total_staff || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Gross Salary</p>
            <p className="text-2xl font-bold">
              Rs.{" "}
              {(
                summary.gross_total ||
                payroll.reduce(
                  (s: number, p: any) => s + (p.gross_salary || 0),
                  0,
                )
              ).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Deductions</p>
            <p className="text-2xl font-bold text-red-600">
              Rs.{" "}
              {(
                summary.total_deductions ||
                payroll.reduce(
                  (s: number, p: any) => s + (p.deductions || 0),
                  0,
                )
              ).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Net Pay</p>
            <p className="text-2xl font-bold text-green-600">
              Rs.{" "}
              {(
                summary.net_total ||
                payroll.reduce(
                  (s: number, p: any) => s + (p.net_salary || 0),
                  0,
                )
              ).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? (
            <Spinner className="mr-2" />
          ) : (
            <DollarSign className="h-4 w-4 mr-2" />
          )}{" "}
          Generate Payroll
        </Button>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" /> Export
        </Button>
        <Button variant="outline">
          <Send className="h-4 w-4 mr-2" /> Send Payslips
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Basic</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead className="font-bold">Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payroll.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No payroll data. Click Generate Payroll.
                  </TableCell>
                </TableRow>
              ) : (
                payroll.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.staff_name}
                    </TableCell>
                    <TableCell>
                      Rs. {(p.basic_salary || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-green-700">
                      Rs. {(p.allowances || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-red-600">
                      Rs. {(p.deductions || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-bold text-base">
                      Rs. {(p.net_salary || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "paid"
                            ? "default"
                            : p.status === "approved"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {p.status || "draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* Payslip PDF Download */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Download Payslip"
                          onClick={async () => {
                            try {
                              const res = await api.get(
                                `/hr/payroll/${p.id}/payslip`,
                                { responseType: "blob" },
                              );
                              const url = URL.createObjectURL(
                                new Blob([res.data], {
                                  type: "application/pdf",
                                }),
                              );
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `payslip_${p.staff_name}_${month}.pdf`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch {
                              toast.error("Failed to download payslip");
                            }
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {/* Approve */}
                        {p.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Approve"
                            onClick={async () => {
                              try {
                                await api.post(`/hr/payroll/${p.id}/approve`);
                                queryClient.invalidateQueries({
                                  queryKey: ["payroll"],
                                });
                                toast.success("Payroll approved");
                              } catch {
                                toast.error("Failed to approve");
                              }
                            }}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {/* Mark Paid */}
                        {p.status === "approved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Mark as Paid"
                            onClick={async () => {
                              try {
                                await api.post(`/hr/payroll/${p.id}/pay`, {
                                  payment_method: "bank",
                                });
                                queryClient.invalidateQueries({
                                  queryKey: ["payroll"],
                                });
                                toast.success("Marked as paid");
                              } catch {
                                toast.error("Failed to mark as paid");
                              }
                            }}
                          >
                            <Wallet className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
