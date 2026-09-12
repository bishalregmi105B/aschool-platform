"use client";

import { Mail, Phone, School, Shield, UserCircle, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/avatar";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<UserCircle className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Profile"
        subtitle="Account details and role information"
      />
      <AOSPageBody>
        <DataPanel title="User Details" className="max-w-3xl">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={user?.full_name || "User"} src={user?.avatar_url} size="lg" />
              <div>
                <p
                  className="text-lg font-semibold"
                  style={{ color: "var(--w11-text-primary)" }}
                >
                  {user?.full_name || "Unknown User"}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <StatusChip
                    status="user"
                    label={(user?.role || "member").replace("_", " ")}
                    className="capitalize"
                  />
                  {user?.is_active === false ? (
                    <StatusChip status="inactive" label="Inactive" />
                  ) : (
                    <StatusChip status="active" label="Active" />
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

            <div
              className="rounded-[var(--w11-radius-md)] border border-[color:var(--w11-border-subtle)] px-3 py-2 text-xs"
              style={{
                color: "var(--w11-text-secondary)",
                background: "var(--w11-accent-light)",
              }}
            >
              For password, security, and notification preferences, use settings pages based on your role permissions.
            </div>
          </div>
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
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
    <div className="rounded-[var(--w11-radius-md)] border border-[color:var(--w11-border-subtle)] p-3">
      <div
        className="mb-1 flex items-center gap-2 text-xs"
        style={{ color: "var(--w11-text-secondary)" }}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p
        className="text-sm font-medium break-all"
        style={{ color: "var(--w11-text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}
