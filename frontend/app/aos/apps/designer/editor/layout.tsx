/**
 * Editor layout — fixed full-screen overlay so the canvas editor
 * covers the entire viewport (no sidebar, no header) just like Canva.
 *
 * The parent DashboardLayout still renders but is visually hidden
 * beneath this fixed layer.
 */
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-background overflow-hidden"
      style={{ isolation: "isolate" }}
    >
      {children}
    </div>
  );
}
