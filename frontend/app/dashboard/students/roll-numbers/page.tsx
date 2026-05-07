"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/spinner";
import { ListOrdered, Save } from "lucide-react";

export default function RollNumbersPage() {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/academics/classes");
      return res.data.data;
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ListOrdered className="h-6 w-6" /> Assign Roll Numbers
        </h1>
        <p className="text-muted-foreground">Assign or auto-generate roll numbers for students</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Select Class & Section</CardTitle></CardHeader>
        <CardContent className="flex gap-4">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>
              {(classes || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Section" /></SelectTrigger>
            <SelectContent>
              {selectedClass && (classes || []).find((c: any) => c.id === selectedClass)?.sections?.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline">Auto-Assign (Alphabetical)</Button>
        </CardContent>
      </Card>

      {selectedSection && (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Roll No.</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Admission No.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Select a class and section to view students
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-end">
              <Button><Save className="h-4 w-4 mr-2" /> Save Roll Numbers</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
