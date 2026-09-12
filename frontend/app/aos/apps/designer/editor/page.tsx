"use client";

/**
 * Docs & Designer — full fabric.js canvas editor.
 *
 * Layout:
 *   Left  : ElementToolbar  (add shapes / text / image)
 *   Center: fabric.js canvas
 *   Right : tabbed panel — Properties | AI Assist
 *
 * Top bar: Back | Doc name | Page size | Undo/Redo | Zoom | Save | Export
 */
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui/spinner";
import { PluginGate } from "@/lib/plugins";

// Load the heavy canvas component only on the client (fabric is browser-only)
const CanvasEditor = dynamic(() => import("@/components/designer/CanvasEditor"), {
  ssr: false,
  loading: () => <PageLoader />,
});

export default function EditorPage() {
  return (
    <PluginGate slug="design_studio">
      <Suspense fallback={<PageLoader />}>
        <CanvasEditor />
      </Suspense>
    </PluginGate>
  );
}
