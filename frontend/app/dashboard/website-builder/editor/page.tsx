"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Section {
  id: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
  sort_order: number;
}

interface AvailableSection {
  type: string;
  label: string;
  icon: string;
  description: string;
  default_content: Record<string, unknown>;
}

const AVAILABLE_SECTIONS: AvailableSection[] = [
  {
    type: "hero",
    label: "Hero Banner",
    icon: "🖼️",
    description: "Full-width banner with title and CTA",
    default_content: { heading: "Welcome", subheading: "Your School Name", cta_text: "Learn More", cta_link: "/about" },
  },
  {
    type: "text",
    label: "Text Block",
    icon: "📝",
    description: "Rich text content section",
    default_content: { title: "Section Title", body: "Content goes here..." },
  },
  {
    type: "cards",
    label: "Info Cards",
    icon: "🃏",
    description: "Grid of info cards with icons",
    default_content: { title: "Our Features", items: [{ icon: "⭐", title: "Feature 1", text: "Description" }] },
  },
  {
    type: "stats",
    label: "Statistics",
    icon: "📊",
    description: "Number counters row",
    default_content: { items: [{ value: "500+", label: "Students" }, { value: "50+", label: "Teachers" }] },
  },
  {
    type: "gallery",
    label: "Photo Gallery",
    icon: "📸",
    description: "Image grid or carousel",
    default_content: { title: "Gallery", images: [] },
  },
  {
    type: "testimonial",
    label: "Testimonials",
    icon: "💬",
    description: "Student/parent testimonials",
    default_content: { title: "What People Say", items: [{ name: "Parent Name", quote: "Great school!" }] },
  },
  {
    type: "cta",
    label: "Call to Action",
    icon: "📢",
    description: "CTA banner with button",
    default_content: { heading: "Ready to Join?", text: "Apply now for admission.", button_text: "Apply Now", button_link: "/admission" },
  },
  {
    type: "map",
    label: "Location Map",
    icon: "📍",
    description: "Embedded Google Maps location",
    default_content: { title: "Find Us", embed_url: "" },
  },
  {
    type: "faq",
    label: "FAQ",
    icon: "❓",
    description: "Frequently asked questions accordion",
    default_content: { title: "FAQs", items: [{ q: "Question?", a: "Answer." }] },
  },
  {
    type: "video",
    label: "Video",
    icon: "🎥",
    description: "Embedded YouTube/video section",
    default_content: { title: "Watch", video_url: "" },
  },
];

export default function SectionEditor() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const pageId = searchParams.get("page");
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["website-page-sections", pageId],
    queryFn: () => api.get(`/website-builder/pages/${pageId}`).then((r) => r.data.data),
    enabled: !!pageId,
  });

  const sections: Section[] = pageData?.sections || [];

  const addSectionMut = useMutation({
    mutationFn: (section: { type: string; title: string; content: Record<string, unknown> }) =>
      api.post(`/website-builder/pages/${pageId}/sections`, section),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-page-sections", pageId] });
      setShowAddPanel(false);
    },
  });

  const updateSectionMut = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: Record<string, unknown> }) =>
      api.put(`/website-builder/pages/${pageId}/sections/${sectionId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-page-sections", pageId] });
      setEditingSection(null);
    },
  });

  const deleteSectionMut = useMutation({
    mutationFn: (sectionId: string) =>
      api.delete(`/website-builder/pages/${pageId}/sections/${sectionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-page-sections", pageId] }),
  });

  const moveSectionMut = useMutation({
    mutationFn: ({ sectionId, direction }: { sectionId: string; direction: "up" | "down" }) =>
      api.put(`/website-builder/pages/${pageId}/sections/${sectionId}/reorder`, { direction }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-page-sections", pageId] }),
  });

  if (!pageId) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">No page selected</h2>
        <p className="text-gray-500 mb-4">Go to Pages and click Edit on a page to open the section editor.</p>
        <a href="/dashboard/website-builder/pages" className="text-blue-600 underline">
          ← Go to Pages
        </a>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <a href="/dashboard/website-builder/pages" className="text-sm text-blue-600 hover:underline">
            ← Back to Pages
          </a>
          <h1 className="text-2xl font-bold mt-1">
            ✏️ Edit: {pageData?.title || "Page"}
          </h1>
        </div>
        <button
          onClick={() => setShowAddPanel(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          + Add Section
        </button>
      </div>

      {/* Section List */}
      <div className="space-y-3">
        {sections.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-12 text-center">
            <p className="text-gray-400 text-lg mb-3">No sections yet</p>
            <button
              onClick={() => setShowAddPanel(true)}
              className="text-blue-600 underline text-sm"
            >
              Add your first section
            </button>
          </div>
        ) : (
          sections
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((section, idx) => (
              <div
                key={section.id}
                className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {AVAILABLE_SECTIONS.find((s) => s.type === section.type)?.icon || "📦"}
                    </span>
                    <div>
                      <h3 className="font-medium">{section.title}</h3>
                      <p className="text-xs text-gray-400 capitalize">{section.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveSectionMut.mutate({ sectionId: section.id, direction: "up" })}
                      disabled={idx === 0}
                      className="p-1.5 border rounded hover:bg-gray-50 disabled:opacity-30 text-sm"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveSectionMut.mutate({ sectionId: section.id, direction: "down" })}
                      disabled={idx === sections.length - 1}
                      className="p-1.5 border rounded hover:bg-gray-50 disabled:opacity-30 text-sm"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => setEditingSection(section)}
                      className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this section?")) {
                          deleteSectionMut.mutate(section.id);
                        }
                      }}
                      className="px-3 py-1.5 border border-red-200 text-red-600 rounded text-sm hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>

      {/* Add Section Panel */}
      {showAddPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add Section</h2>
              <button onClick={() => setShowAddPanel(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_SECTIONS.map((s) => (
                <button
                  key={s.type}
                  onClick={() =>
                    addSectionMut.mutate({
                      type: s.type,
                      title: s.label,
                      content: s.default_content,
                    })
                  }
                  className="border rounded-lg p-4 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <span className="text-2xl">{s.icon}</span>
                  <h3 className="font-medium text-sm mt-2">{s.label}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Section Modal */}
      {editingSection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit Section: {editingSection.title}</h2>
              <button onClick={() => setEditingSection(null)} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>
            <SectionContentEditor
              section={editingSection}
              onSave={(data) =>
                updateSectionMut.mutate({
                  sectionId: editingSection.id,
                  data,
                })
              }
              saving={updateSectionMut.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionContentEditor({
  section,
  onSave,
  saving,
}: {
  section: Section;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [json, setJson] = useState(JSON.stringify(section.content, null, 2));
  const [title, setTitle] = useState(section.title);
  const [parseError, setParseError] = useState("");

  function handleSave() {
    try {
      const parsed = JSON.parse(json);
      setParseError("");
      onSave({ title, content: parsed });
    } catch {
      setParseError("Invalid JSON. Please fix before saving.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Section Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Content (JSON)</label>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={12}
          className="w-full border rounded px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {parseError && <p className="text-red-500 text-xs mt-1">{parseError}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
