"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type Slider = {
  id: string;
  title: string;
  subtitle?: string | null;
  image_url: string;
  link_url?: string | null;
  sort_order: number;
  is_active: boolean;
};

type SliderForm = {
  id?: string;
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
  sort_order: string;
  is_active: boolean;
};

const emptyForm: SliderForm = {
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "",
  sort_order: "0",
  is_active: true,
};

export default function SlidersPage() {
  return (
    <PluginGate slug="notices">
      <SlidersContent />
    </PluginGate>
  );
}

function SlidersContent() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SliderForm>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ["school-sliders"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Slider[]>>("/sliders?include_inactive=true");
      return response.data.data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        image_url: form.image_url.trim(),
        link_url: form.link_url.trim() || null,
        sort_order: Number(form.sort_order || 0),
        is_active: form.is_active,
      };
      if (form.id) {
        return (await api.put(`/sliders/${form.id}`, payload)).data;
      }
      return (await api.post("/sliders", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-sliders"] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Slider saved");
    },
    onError: () => toast.error("Failed to save slider"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/sliders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-sliders"] });
      toast.success("Slider deleted");
    },
    onError: () => toast.error("Failed to delete slider"),
  });

  const sliders = data || [];

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (slider: Slider) => {
    setForm({
      id: slider.id,
      title: slider.title,
      subtitle: slider.subtitle || "",
      image_url: slider.image_url,
      link_url: slider.link_url || "",
      sort_order: String(slider.sort_order || 0),
      is_active: slider.is_active,
    });
    setDialogOpen(true);
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Image className="h-6 w-6" /> Banners & Sliders
          </h1>
          <p className="text-muted-foreground">Manage dashboard carousel banners</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> New Slider
        </Button>
      </div>

      {sliders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No sliders configured for this school.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sliders.map((slider) => (
            <Card key={slider.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="h-28 w-44 shrink-0 overflow-hidden rounded-md border bg-muted">
                    <img src={slider.image_url} alt={slider.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-semibold truncate">{slider.title}</h2>
                        {slider.subtitle ? (
                          <p className="text-sm text-muted-foreground line-clamp-2">{slider.subtitle}</p>
                        ) : null}
                      </div>
                      <Badge variant={slider.is_active ? "default" : "secondary"}>
                        {slider.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      Order {slider.sort_order || 0}
                      {slider.link_url ? <span className="ml-3 truncate inline-block max-w-[220px] align-bottom">{slider.link_url}</span> : null}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(slider)}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => remove.mutate(slider.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Slider" : "New Slider"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Textarea rows={3} value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Link URL</Label>
              <Input value={form.link_url} onChange={(event) => setForm({ ...form, link_url: event.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
              </div>
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 mt-6">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                />
                <span className="text-sm">Active</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={!form.title.trim() || !form.image_url.trim() || save.isPending}>
              {save.isPending ? <Spinner className="mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
