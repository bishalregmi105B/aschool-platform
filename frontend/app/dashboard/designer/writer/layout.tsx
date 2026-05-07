import type { ReactNode } from "react";

/** Full-screen layout — no sidebar/nav so writer has maximum space */
export default function WriterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {children}
    </div>
  );
}
