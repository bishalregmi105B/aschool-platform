"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, MessageCircle, Phone, Mail, Smartphone } from "lucide-react";

const channels = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-green-600" },
  { id: "sms", label: "SMS", icon: Phone, color: "text-blue-600" },
  { id: "push", label: "Push Notification", icon: Smartphone, color: "text-violet-600" },
  { id: "email", label: "Email", icon: Mail, color: "text-orange-600" },
];

const notifications = [
  { event: "Student Absent", description: "Alert parents when student is marked absent", default: ["whatsapp", "push"] },
  { event: "Fee Due Reminder", description: "Remind parents about upcoming fee deadlines", default: ["whatsapp", "sms"] },
  { event: "Exam Results Published", description: "Notify when exam results are available", default: ["whatsapp", "push"] },
  { event: "Notice Published", description: "Notify about new school notices", default: ["push"] },
  { event: "Emergency Alert", description: "Critical emergency broadcasts to all", default: ["whatsapp", "sms", "push"] },
  { event: "Bus Arrival", description: "Notify parents about bus arrival/departure", default: ["push"] },
  { event: "Assignment Due", description: "Remind students about upcoming deadlines", default: ["push"] },
  { event: "Report Card Ready", description: "Notify when report cards are generated", default: ["whatsapp", "push"] },
  { event: "Library Book Overdue", description: "Alert about overdue library books", default: ["push"] },
  { event: "PT Conference", description: "Parent-teacher meeting reminders", default: ["whatsapp", "sms"] },
];

export default function NotificationSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6" />Notification Settings</h1>
        <p className="text-muted-foreground">Configure which channels are used for each notification type</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification Channels per Event</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-medium">Event</th>
                  {channels.map((ch) => (
                    <th key={ch.id} className="text-center py-3 font-medium">
                      <div className="flex flex-col items-center gap-1">
                        <ch.icon className={`h-4 w-4 ${ch.color}`} />
                        <span className="text-xs">{ch.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.event} className="border-b hover:bg-muted/50">
                    <td className="py-3">
                      <p className="font-medium">{n.event}</p>
                      <p className="text-xs text-muted-foreground">{n.description}</p>
                    </td>
                    {channels.map((ch) => (
                      <td key={ch.id} className="text-center py-3">
                        <input type="checkbox" defaultChecked={n.default.includes(ch.id)} className="h-4 w-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end"><Button>Save Preferences</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
