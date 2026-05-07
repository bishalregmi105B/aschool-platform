"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, Trophy, Flame, Calendar, Sparkles, GraduationCap, Library } from "lucide-react";

export default function StudentDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hey, Student! 🎓</h1>
          <p className="text-muted-foreground">Class 10A • Roll No. 15</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-orange-100 text-orange-700 gap-1"><Flame className="h-3 w-3" />12 Day Streak</Badge>
          <Badge className="bg-violet-100 text-violet-700 gap-1"><Trophy className="h-3 w-3" />Level 8</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Classes", value: "6", icon: Calendar, color: "text-blue-600 bg-blue-50" },
          { label: "Pending Homework", value: "3", icon: BookOpen, color: "text-orange-600 bg-orange-50" },
          { label: "XP Points", value: "2,450", icon: Sparkles, color: "text-violet-600 bg-violet-50" },
          { label: "Library Books", value: "2", icon: Library, color: "text-green-600 bg-green-50" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Today&apos;s Timetable</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { time: "8:00", subject: "Mathematics", teacher: "Mr. Sharma", status: "completed" },
                { time: "8:45", subject: "Science", teacher: "Ms. Thapa", status: "completed" },
                { time: "10:00", subject: "English", teacher: "Mr. Rai", status: "ongoing" },
                { time: "11:00", subject: "Nepali", teacher: "Ms. Gurung", status: "upcoming" },
                { time: "12:30", subject: "Social Studies", teacher: "Mr. KC", status: "upcoming" },
                { time: "1:15", subject: "Computer", teacher: "Mr. Poudel", status: "upcoming" },
              ].map((p, i) => (
                <div key={i} className={`flex items-center gap-3 py-2 px-3 rounded-lg ${p.status === "ongoing" ? "bg-violet-50 border border-violet-200" : ""}`}>
                  <span className="text-sm text-muted-foreground w-12">{p.time}</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{p.subject}</span>
                    <span className="text-xs text-muted-foreground ml-2">{p.teacher}</span>
                  </div>
                  <Badge variant={p.status === "completed" ? "success" : p.status === "ongoing" ? "default" : "outline"} className="text-xs">
                    {p.status === "ongoing" ? "Now" : p.status === "completed" ? "✓" : "—"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />Pending Homework</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { subject: "Mathematics", title: "Chapter 5 Exercises", due: "Tomorrow", priority: "high" },
                { subject: "Science", title: "Lab Report — Photosynthesis", due: "In 2 days", priority: "medium" },
                { subject: "English", title: "Essay: My Country", due: "In 3 days", priority: "low" },
              ].map((hw, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-2 ${hw.priority === "high" ? "bg-red-500" : hw.priority === "medium" ? "bg-yellow-500" : "bg-green-500"}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{hw.title}</p>
                    <p className="text-xs text-muted-foreground">{hw.subject} • Due: {hw.due}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Achievement Banner */}
      <Card className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0">
        <CardContent className="py-6 flex items-center gap-4">
          <div className="text-4xl">🏆</div>
          <div>
            <h3 className="font-bold text-lg">New Achievement Unlocked!</h3>
            <p className="text-violet-100">Perfect Attendance — 12 days in a row. Keep it up!</p>
          </div>
          <Badge className="ml-auto bg-white/20 text-white">+50 XP</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
