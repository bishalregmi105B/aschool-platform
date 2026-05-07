"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Award, Plus, Search, Star, Trophy, Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PortfolioItem {
  id: string;
  student_id: string;
  student_name: string;
  title: string;
  description: string;
  category: string;
  achievement_date: string;
  badge_url?: string;
  verified: boolean;
}

export default function PortfolioPage() {
  return (
    <PluginGate slug="student_portfolio">
      <PortfolioContent />
    </PluginGate>
  );
}

function PortfolioContent() {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "academic",
    student_id: "",
    achievement_date: "",
  });
  const queryClient = useQueryClient();

  const { data: portfolios, isLoading } = useQuery({
    queryKey: ["portfolio", search],
    queryFn: async () => {
      const res = await api.get(`/portfolio?q=${search}&per_page=50`);
      return (res.data?.data || []) as PortfolioItem[];
    },
  });

  const { data: students } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const res = await api.get("/students?per_page=200");
      return res.data?.data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post("/portfolio", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      setShowAdd(false);
      setFormData({
        title: "",
        description: "",
        category: "academic",
        student_id: "",
        achievement_date: "",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/portfolio/${id}/verify`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
  });

  const categories = [
    "academic",
    "sports",
    "arts",
    "science",
    "community",
    "leadership",
    "other",
  ];

  const grouped = (portfolios || []).reduce(
    (acc: Record<string, PortfolioItem[]>, item) => {
      const cat = item.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {},
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Award className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Student Portfolio</h1>
          </div>
          <p className="text-muted-foreground">
            Track achievements, credentials, and project showcases
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Achievement
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search achievements..."
          className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No achievements yet</p>
          <p className="text-sm mt-1">Start by adding student achievements</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Star className="h-3.5 w-3.5" />
                {category}
                <span className="bg-muted px-2 py-0.5 rounded-full text-xs">
                  {items.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                  <Card
                    key={item.id}
                    className={item.verified ? "border-primary/30" : ""}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.student_name}
                          </p>
                        </div>
                        {item.verified ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                            ✓ Verified
                          </span>
                        ) : (
                          <button
                            onClick={() => verifyMutation.mutate(item.id)}
                            className="shrink-0 text-xs text-muted-foreground hover:text-primary border px-2 py-0.5 rounded-full"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      {item.achievement_date && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.achievement_date).toLocaleDateString(
                            "en-NP",
                          )}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Achievement Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Achievement</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Student</label>
                <select
                  value={formData.student_id}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, student_id: e.target.value }))
                  }
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select student</option>
                  {(students || []).map(
                    (s: {
                      id: string;
                      first_name: string;
                      last_name: string;
                    }) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Title</label>
                <input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, title: e.target.value }))
                  }
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Achievement title"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, category: e.target.value }))
                  }
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="capitalize">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Describe the achievement..."
                />
              </div>

              <div>
                <label className="text-sm font-medium">Date</label>
                <input
                  type="date"
                  value={formData.achievement_date}
                  onChange={(e) =>
                    setFormData((d) => ({
                      ...d,
                      achievement_date: e.target.value,
                    }))
                  }
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => addMutation.mutate(formData)}
                disabled={
                  addMutation.isPending ||
                  !formData.title ||
                  !formData.student_id
                }
                className="flex-1 gap-2"
              >
                {addMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Add Achievement
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
