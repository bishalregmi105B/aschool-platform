"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { revalidateSchoolSite } from "@/lib/revalidate";
import { schoolSiteUrl } from "@/lib/site-domain";
import { FileText, Plus } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

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
      <AOSPage>
        <AOSPageHeader title="📄 Website Pages" subtitle="All pages on your school website — prebuilt theme pages included" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                Failed to load website pages. Please try again.
              </p>
              <button onClick={() => refetch()} className="win11-btn">
                Retry
              </button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  if (isLoading) {
    return <AOSModuleLoadingState label="Loading website pages…" />;
  }

  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const prebuiltSlugSet = new Set(PREBUILT_PAGES.map((p) => p.slug));
  const customPages = pages.filter((p) => !prebuiltSlugSet.has(p.slug));
  const subdomain = siteData?.subdomain;

  const publishBadge = (p: WebPage) => (
    <StatusChip
      status={p.is_published ? "published" : "pending"}
      label={p.is_published ? "Published" : "Draft"}
    />
  );

  const rowActions = (p: WebPage) => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => togglePublishMut.mutate({ id: p.id, published: !p.is_published })}
        className="win11-btn"
        style={{ fontSize: "12px", padding: "4px 12px" }}
      >
        {p.is_published ? "Unpublish" : "Publish"}
      </button>
      <a
        href={`/dashboard/website-builder/editor?page=${p.id}`}
        className="win11-btn accent"
        style={{ fontSize: "12px", padding: "4px 12px" }}
      >
        Edit
      </a>
      <button
        onClick={() => {
          if (confirm(`Delete page "${p.title}"?`)) {
            deleteMut.mutate(p.id);
          }
        }}
        className="win11-btn"
        style={{ fontSize: "12px", padding: "4px 12px" }}
      >
        Delete
      </button>
    </div>
  );

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<FileText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="📄 Website Pages"
        subtitle="All pages on your school website — prebuilt theme pages included"
        actions={
          <button onClick={() => setShowCreate(true)} className="win11-btn accent">
            <Plus className="h-4 w-4 mr-1 inline" /> Add Page
          </button>
        }
      />
      <AOSPageBody>
        <div className="space-y-4">
          <div className="win11-infobar info">
            Prebuilt theme pages (Home, About, Programs, Teachers, Gallery, Admission, Contact and more)
            come with your theme and appear below. Click <strong>Enable editing</strong> to make one
            editable in the section editor, then publish your changes.
          </div>

          {/* ── Prebuilt theme pages ── */}
          <div>
            <h2
              className="text-sm font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--w11-text-secondary)" }}
            >
              Theme Pages ({PREBUILT_PAGES.length})
            </h2>
            <DataPanel bodyClassName="p-0">
              <div className="divide-y divide-[var(--w11-border-subtle)]">
                {PREBUILT_PAGES.map((pre) => {
                  const existing = bySlug.get(pre.slug);
                  return (
                    <div
                      key={pre.slug}
                      className="p-4 flex items-center justify-between hover:bg-[var(--w11-control-hover)]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span>{pre.icon}</span>
                          <h3 className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{pre.title}</h3>
                          <StatusChip
                            status={existing ? "active" : "subtle"}
                            label={existing ? "Editable" : "Prebuilt"}
                          />
                          {existing && publishBadge(existing)}
                        </div>
                        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--w11-text-tertiary)" }}>
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
                                  className="hover:underline"
                                  style={{ color: "var(--w11-accent)" }}
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
                            className="win11-btn accent"
                            style={{ fontSize: "12px", padding: "4px 12px" }}
                          >
                            {enabling === pre.slug ? "Enabling…" : "Enable editing"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </DataPanel>
          </div>

          {/* ── Custom pages ── */}
          <div>
            <h2
              className="text-sm font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--w11-text-secondary)" }}
            >
              Custom Pages ({customPages.length})
            </h2>
            <DataPanel bodyClassName="p-0">
              <div className="divide-y divide-[var(--w11-border-subtle)]">
                {customPages.map((page) => (
                  <div
                    key={page.id}
                    className="p-4 flex items-center justify-between hover:bg-[var(--w11-control-hover)]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{page.title}</h3>
                        {publishBadge(page)}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--w11-text-tertiary)" }}>/{page.slug}</p>
                    </div>
                    {rowActions(page)}
                  </div>
                ))}

                {customPages.length === 0 && (
                  <div className="p-8 text-center text-sm" style={{ color: "var(--w11-text-tertiary)" }}>
                    No custom pages yet. Click &quot;+ Add Page&quot; to create one.
                  </div>
                )}
              </div>
            </DataPanel>
          </div>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="win11-modal-backdrop fixed inset-0 flex items-center justify-center z-50 p-4">
            <div
              className="win11-dialog max-w-md w-full p-6"
              style={{ background: "var(--w11-surface-solid)" }}
            >
              <h2 className="text-lg font-bold mb-4" style={{ color: "var(--w11-text-primary)" }}>
                Create New Page
              </h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: "var(--w11-text-primary)" }}
                  >
                    Page Title
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => {
                      setNewTitle(e.target.value);
                      setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                    }}
                    placeholder="e.g. Principal's Message"
                    required
                    className="w-full text-sm"
                    style={{
                      background: "var(--w11-control-bg)",
                      color: "var(--w11-text-primary)",
                      border: "1px solid var(--w11-control-border)",
                      borderRadius: "var(--w11-radius-md)",
                      padding: "8px 12px",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: "var(--w11-text-primary)" }}
                  >
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="principals-message"
                    className="w-full text-sm"
                    style={{
                      background: "var(--w11-control-bg)",
                      color: "var(--w11-text-primary)",
                      border: "1px solid var(--w11-control-border)",
                      borderRadius: "var(--w11-radius-md)",
                      padding: "8px 12px",
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="win11-btn">
                    Cancel
                  </button>
                  <button type="submit" disabled={createMut.isPending} className="win11-btn accent">
                    {createMut.isPending ? "Creating..." : "Create Page"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
