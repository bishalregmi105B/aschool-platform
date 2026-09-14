"use client";

/**
 * Docs & Designer — full fabric.js canvas editor.
 *
 * Layout:
 *   Left  : icon rail + sliding panel (templates / shapes / text / …)
 *   Center: fabric.js canvas + pages strip
 *   Right : tabbed panel — Properties | AI Assist
 *
 * Top bar: Back | Doc name | Page size | Undo/Redo | Zoom | Snap/Grid |
 *          Save-state pill | AI | Save | Export
 * Wrapped in an error boundary: a fabric init crash shows a friendly
 * infobar + reload instead of a dead window (wave-J).
 */
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui/spinner";
import { PluginGate } from "@/lib/plugins";
import { EditorErrorBoundary } from "@/components/designer/EditorErrorBoundary";

// Load the heavy canvas component only on the client (fabric is browser-only)
const CanvasEditor = dynamic(() => import("@/components/designer/CanvasEditor"), {
  ssr: false,
  loading: () => <PageLoader />,
});

export default function EditorPage() {
  return (
    <PluginGate slug="design_studio">
      <EditorErrorBoundary editorName="The canvas editor" freshHref="/dashboard/designer/editor">
        <Suspense fallback={<PageLoader />}>
          <CanvasEditor />
        </Suspense>
      </EditorErrorBoundary>
    </PluginGate>
  );
}
