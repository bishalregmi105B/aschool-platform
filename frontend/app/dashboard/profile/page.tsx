"use client";

import { Mail, Phone, School, Shield, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Account details and role information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar name={user?.full_name || "User"} src={user?.avatar_url} size="lg" />
            <div>
              <p className="text-lg font-semibold">{user?.full_name || "Unknown User"}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {user?.role || "member"}
                </Badge>
                {user?.is_active === false ? (
                  <Badge variant="destructive">Inactive</Badge>
                ) : (
                  <Badge variant="outline">Active</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Mail} label="Email" value={user?.email || "Not set"} />
            <InfoRow icon={Phone} label="Phone" value={user?.phone || "Not set"} />
            <InfoRow icon={Shield} label="Role" value={user?.role || "Not set"} />
            <InfoRow icon={School} label="School ID" value={user?.school_id || "Not set"} />
          </div>

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            For password, security, and notification preferences, use settings pages based on your role permissions.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-sm font-medium break-all">{value}</p>
    </div>
  );
}
