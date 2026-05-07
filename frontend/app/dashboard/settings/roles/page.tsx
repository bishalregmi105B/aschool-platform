"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Users } from "lucide-react";

const roles = [
  { name: "Super Admin", users: 1, permissions: "Full access to all modules", color: "bg-red-100 text-red-700" },
  { name: "Admin", users: 3, permissions: "Manage school operations", color: "bg-blue-100 text-blue-700" },
  { name: "Teacher", users: 45, permissions: "Attendance, marks, assignments", color: "bg-green-100 text-green-700" },
  { name: "Accountant", users: 2, permissions: "Fee management, payroll", color: "bg-yellow-100 text-yellow-700" },
  { name: "Librarian", users: 1, permissions: "Library management", color: "bg-purple-100 text-purple-700" },
  { name: "Receptionist", users: 1, permissions: "Admissions, inquiries", color: "bg-pink-100 text-pink-700" },
  { name: "Parent", users: 350, permissions: "View child data, pay fees", color: "bg-cyan-100 text-cyan-700" },
  { name: "Student", users: 420, permissions: "View own data, homework, LMS", color: "bg-indigo-100 text-indigo-700" },
];

const modules = [
  "Dashboard", "Students", "Teachers", "Attendance", "Exams", "Fees",
  "Library", "Transport", "HR & Payroll", "LMS", "Social Hub", "Notices",
  "Reports", "Settings", "Marketplace", "Website Builder", "AI Tools",
];

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" />Roles & Permissions</h1>
          <p className="text-muted-foreground">Manage user roles and access control</p>
        </div>
        <Button>Create Custom Role</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {roles.map((role) => (
          <Card key={role.name} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <Badge className={role.color}>{role.name}</Badge>
                  <p className="text-sm text-muted-foreground mt-2">{role.permissions}</p>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">{role.users}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-4 w-full">Edit Permissions</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
