"use client";

import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Bell, Plus, Megaphone } from "lucide-react";
import Link from "next/link";

export default function AnnouncementsPage() {
  return (
    <PluginGate slug="notices">
      <AnnouncementsContent />
    </PluginGate>
  );
}

function AnnouncementsContent() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="h-6 w-6" /> Announcements</h1>
          <p className="text-muted-foreground">Broadcast announcements to students, teachers, and parents</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/notices"><Plus className="h-4 w-4 mr-2" /> New Announcement</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No announcements yet. Create one to notify students and staff.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
