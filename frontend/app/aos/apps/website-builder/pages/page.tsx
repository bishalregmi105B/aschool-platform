"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { revalidateSchoolSite } from "@/lib/revalidate";
import { schoolSiteUrl } from "@/lib/site-domain";

interface WebPage {
  id: string;
  title: string;
  slug: string;
  is_published: boolean;
  sort_order: number;
  updated_at: string | null;
}

/** Prebuilt theme pages rendered by the public site (app/school/[slug]/*).
 *  They live in the theme, not in the website_pages table, so the backend
 *  only returns them once they've been materialized as editable rows. */
const PREBUILT_PAGES: { slug: string; title: string; description: string; icon: string; path: string }[] = [
  { slug: "home", title: "Home", description: "Landing page — hero, stats, programs, notices, gallery, CTA", icon: "🏠", path: "" },
  { slug: "about", title: "About Us", description: "School information, mission and vision", icon: "📖", path: "/about" },
  { slug: "academics", title: "Academic Programs", description: "Programs and classes offered", icon: "🎓", path: "/academics" },
  { slug: "teachers", title: "Our Teachers", description: "Teacher and staff directory", icon: "👩‍🏫", path: "/teachers" },
  { slug: "gallery", title: "Photo Gallery", description: "School photo gallery", icon: "📸", path: "/gallery" },
  { slug: "admission", title: "Admission", description: "Admission process and inquiry form", icon: "📝", path: "/admission" },
  { slug: "notices", title: "Notices", description: "Notices and announcements board", icon: "📢", path: "/notices" },
  { slug: "events", title: "Events", description: "School events calendar", icon: "📅", path: "/events" },
  { slug: "facilities", title: "Facilities", description: "Labs, library, transport and more", icon: "🏫", path: "/facilities" },
  { slug: "results", title: "Results", description: "Student result checker", icon: "🧮", path: "/results" },
  { slug: "news", title: "News", description: "News and articles", icon: "📰", path: "/news" },
  { slug: "alumni", title: "Alumni", description: "Alumni network and stories", icon: "🎓", path: "/alumni" },
  { slug: "contact", title: "Contact", description: "Contact details and message form", icon: "📞", path: "/contact" },
];

export default function WebsitePagesManager() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [enabling, setEnabling] = useState<string | null>(null);

  const { data: siteData } = useQuery<{ subdomain?: string }>({
    queryKey: ["website-status"],
    queryFn: () => api.get("/website-builder/status").then((r) => r.data.data),
    staleTime: 60_000,
  });

  const { data: pages = [], isLoading, isError, refetch } = useQuery<WebPage[]>({
    queryKey: ["website-pages"],
    queryFn: () => api.get("/website-builder/pages").then((r) => r.data.data || []),
    retry: 1,
  });

  const createMut = useMutation({
    mutationFn: (data: { title: string; slug: string }) =>
      api.post("/website-builder/pages", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-pages"] });
      setShowCreate(false);
      setNewTitle("");
      setNewSlug("");
      revalidateSchoolSite();
      toast.success("Page created");
    },
    onError: () => toast.error("Failed to create page"),
  });

  // The create-modal form referenced a nonexistent `handleCreate`, so
  // submitting a new page crashed with a ReferenceError instead of creating it.
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = (newSlug || newTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")).trim();
    if (!newTitle.trim() || !slug) return;
    createMut.mutate({ title: newTitle.trim(), slug });
  };

  /** Materialize a prebuilt theme page as an editable builder page. */
  const handleEnableEditing = (pre: (typeof PREBUILT_PAGES)[number]) => {
    setEnabling(pre.slug);
    api
      .post("/website-builder/pages", { title: pre.title, slug: pre.slug, is_published: true })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["website-pages"] });
        qc.invalidateQueries({ queryKey: ["website-status"] });
        revalidateSchoolSite(siteData?.subdomain);
        toast.success(`"${pre.title}" is now editable — opening the editor`);
      })
      .catch(() => toast.error(`Could not enable editing for "${pre.title}"`))
      .finally(() => setEnabling(null));
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/website-builder/pages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-pages"] });
      revalidateSchoolSite();
      toast.success("Page deleted");
    },
    onError: () => toast.error("Failed to delete page"),
  });

  const togglePublishMut = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      api.put(`/website-builder/pages/${id}`, { is_published: published }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-pages"] });
      revalidateSchoolSite();
    },
    onError: () => toast.error("Failed to update publish status"),
  });

  if (isError) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="border rounded-lg py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load website pages. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
          >
            Retry
          </button>
        </div>
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

  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const prebuiltSlugSet = new Set(PREBUILT_PAGES.map((p) => p.slug));
  const customPages = pages.filter((p) => !prebuiltSlugSet.has(p.slug));
  const subdomain = siteData?.subdomain;

  const publishBadge = (p: WebPage) => (
    <span
      className={`text-xs px-2 py-0.5 rounded ${
        p.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {p.is_published ? "Published" : "Draft"}
    </span>
  );

  const rowActions = (p: WebPage) => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => togglePublishMut.mutate({ id: p.id, published: !p.is_published })}
        className="text-xs px-3 py-1 border rounded hover:bg-gray-50"
      >
        {p.is_published ? "Unpublish" : "Publish"}
      </button>
      <a
        href={`/dashboard/website-builder/editor?page=${p.id}`}
        className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
      >
        Edit
      </a>
      <button
        onClick={() => {
          if (confirm(`Delete page "${p.title}"?`)) {
            deleteMut.mutate(p.id);
          }
        }}
        className="text-xs px-3 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📄 Website Pages</h1>
          <p className="text-gray-500 text-sm mt-1">All pages on your school website — prebuilt theme pages included</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
        >
          + Add Page
        </button>
      </div>

      <div className="bg-mint/20 border border-mint/40 rounded-lg p-4 text-sm text-ocean dark:text-mint">
        Prebuilt theme pages (Home, About, Programs, Teachers, Gallery, Admission, Contact and more)
        come with your theme and appear below. Click <strong>Enable editing</strong> to make one
        editable in the section editor, then publish your changes.
      </div>

      {/* ── Prebuilt theme pages ── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Theme Pages ({PREBUILT_PAGES.length})
        </h2>
        <div className="border rounded-lg divide-y">
          {PREBUILT_PAGES.map((pre) => {
            const existing = bySlug.get(pre.slug);
            return (
              <div key={pre.slug} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{pre.icon}</span>
                    <h3 className="font-medium">{pre.title}</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {existing ? "Editable" : "Prebuilt"}
                    </span>
                    {existing && publishBadge(existing)}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {pre.description}
                    {existing ? (
                      <span> · /{existing.slug}</span>
                    ) : (
                      subdomain && (
                        <>
                          {" · "}
                          <a
                            href={schoolSiteUrl(subdomain, pre.path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            view on live site ↗
                          </a>
                        </>
                      )
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {existing ? (
                    rowActions(existing)
                  ) : (
                    <button
                      onClick={() => handleEnableEditing(pre)}
                      disabled={enabling === pre.slug}
                      className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                    >
                      {enabling === pre.slug ? "Enabling…" : "Enable editing"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Custom pages ── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Custom Pages ({customPages.length})
        </h2>
        <div className="border rounded-lg divide-y">
          {customPages.map((page) => (
            <div key={page.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{page.title}</h3>
                  {publishBadge(page)}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">/{page.slug}</p>
              </div>
              {rowActions(page)}
            </div>
          ))}

          {customPages.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">
              No custom pages yet. Click &quot;+ Add Page&quot; to create one.
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold mb-4">Create New Page</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Page Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                  }}
                  placeholder="e.g. Principal's Message"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL Slug</label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="principals-message"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
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
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
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
