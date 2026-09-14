"use client";

/**
 * EditorErrorBoundary — friendly infobar + reload for canvas/editor init
 * failures (wave-J hard rule 4). The fabric canvas and the TipTap surface
 * can both throw on boot (missing GL context, corrupt template JSON, font
 * load race); a raw React crash inside the AOS window was a dead spinner.
 *
 * Renders a win11-infobar (error) with a plain-language message, a Reload
 * action and an optional "start fresh" (clears the ?doc= param) link.
 * Shared by the Designer canvas page and the Writer page.
 */
import React from "react";
import { AlertTriangle, RotateCcw, FilePlus2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
  editorName?: string;
  /** when set, offers "start a new document" (drops the ?doc/?template query) */
  freshHref?: string;
}
interface State { error: Error | null }

export class EditorErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // keep the console breadcrumb for debugging without crashing the shell
    console.error(`[${this.props.editorName ?? "editor"}] render error`, error, info?.componentStack);
  }

  private reload = () => {
    this.setState({ error: null });
    // hard reload — the editor is a client-only surface; a soft retry of the
    // same crash is likely when the canvas itself failed to init.
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const name = this.props.editorName ?? "The editor";
    return (
      <div className="win11 flex items-center justify-center min-h-[60vh] p-6" style={{ background: "var(--w11-window-bg)" }}>
        <div
          role="alert"
          className="win11-infobar error max-w-lg w-full"
          style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14 }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "var(--w11-danger, #c42b1c)", marginTop: 1 }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: "var(--w11-text-primary)" }}>
              {name} couldn&apos;t start
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--w11-text-secondary)" }}>
              Something went wrong while preparing the editor. Your saved work is safe —
              reload to try again, or start a fresh document.
            </p>
            <p className="text-[10px] mt-1.5 font-mono truncate" style={{ color: "var(--w11-text-tertiary)" }}>
              {String(error?.message || error)}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={this.reload}
                className="win11-btn accent inline-flex items-center gap-1.5 text-xs"
                style={{ padding: "6px 12px" }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reload editor
              </button>
              {this.props.freshHref && (
                <a
                  href={this.props.freshHref}
                  className="win11-btn inline-flex items-center gap-1.5 text-xs"
                  style={{ padding: "6px 12px" }}
                >
                  <FilePlus2 className="h-3.5 w-3.5" /> New blank document
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default EditorErrorBoundary;
