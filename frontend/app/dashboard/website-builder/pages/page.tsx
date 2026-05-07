"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface WebPage {
  id: string;
  title: string;
  slug: string;
  is_published: boolean;
  is_default: boolean;
  sort_order: number;
  updated_at: string;
}

export default function WebsitePagesManager() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const { data: pages = [], isLoading } = useQuery<WebPage[]>({
    queryKey: ["website-pages"],
    queryFn: () => api.get("/website-builder/pages").then((r) => r.data.data || []),
  });

  const createMut = useMutation({
    mutationFn: (data: { title: string; slug: string }) =>
      api.post("/website-builder/pages", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-pages"] });
      setShowCreate(false);
      setNewTitle("");
      setNewSlug("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/website-builder/pages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-pages"] }),
  });

  const togglePublishMut = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      api.put(`/website-builder/pages/${id}`, { is_published: published }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-pages"] }),
  });

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
          <h1 className="text-2xl font-bold">📄 Website Pages</h1>
          <p className="text-gray-500 text-sm mt-1">Manage the pages on your school website</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          + Add Page
        </button>
      </div>

      {/* Default pages info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        Default pages (Home, About, Notices, Contact, Admission, Academics, Teachers, Gallery,
        Results) are auto-generated from your school data. You can add custom pages below.
      </div>

      {/* Pages list */}
      <div className="border rounded-lg divide-y">
        {pages.map((page) => (
          <div key={page.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{page.title}</h3>
                {page.is_default && (
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                    Default
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    page.is_published
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {page.is_published ? "Published" : "Draft"}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">/{page.slug}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  togglePublishMut.mutate({
                    id: page.id,
                    published: !page.is_published,
                  })
                }
                className="text-xs px-3 py-1 border rounded hover:bg-gray-50"
              >
                {page.is_published ? "Unpublish" : "Publish"}
              </button>
              <a
                href={`/dashboard/website-builder/editor?page=${page.id}`}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Edit
              </a>
              {!page.is_default && (
                <button
                  onClick={() => {
                    if (confirm(`Delete page "${page.title}"?`)) {
                      deleteMut.mutate(page.id);
                    }
                  }}
                  className="text-xs px-3 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}

        {pages.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            No custom pages yet. Click &quot;Add Page&quot; to create one.
          </div>
        )}
      </div>

      {/* Create Page Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold mb-4">Add New Page</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate({ title: newTitle, slug: newSlug || newTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Page Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                  }}
                  placeholder="e.g. Our Facilities"
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL Slug</label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="our-facilities"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMut.isPending ? "Creating..." : "Create Page"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
