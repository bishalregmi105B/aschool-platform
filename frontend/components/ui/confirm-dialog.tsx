"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";

/**
 * ConfirmDialog + useConfirm + undoableDelete.
 *
 * `window.confirm` is banned here: it is unstyled, unlocalizable, blocks the
 * event loop, and on mobile Safari it can be suppressed entirely — which turns
 * "are you sure you want to delete 240 students?" into a silent yes.
 *
 * Two levels of protection:
 *   * ordinary destructive actions get a dialog with the count and consequence;
 *   * irreversible ones (`requireText`) make the admin type the entity name,
 *     the same guard GitHub uses for repository deletion.
 *
 * For deletes that CAN be reversed, prefer `undoableDelete` — an undo toast is
 * kinder than a confirmation, because it does not interrupt the 99% of cases
 * where the user meant it.
 */

export interface ConfirmOptions {
  title: string;
  /** What will happen, in one sentence. Include counts and money. */
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for deletes and anything that spends money or sends messages. */
  tone?: "danger" | "default";
  /** Require the admin to type this string exactly (irreversible actions). */
  requireText?: string;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve?: (value: boolean) => void;
}

const ConfirmContext = React.createContext<
  ((options: ConfirmOptions) => Promise<boolean>) | null
>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmState>({
    open: false,
    title: "",
  });
  const [typed, setTyped] = React.useState("");

  const confirm = React.useCallback((options: ConfirmOptions) => {
    setTyped("");
    return new Promise<boolean>((resolve) => {
      setState({ ...options, open: true, resolve });
    });
  }, []);

  const settle = (value: boolean) => {
    state.resolve?.(value);
    setState((prev) => ({ ...prev, open: false, resolve: undefined }));
  };

  const textGateSatisfied =
    !state.requireText || typed.trim() === state.requireText.trim();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={state.open} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            {state.body && <DialogDescription>{state.body}</DialogDescription>}
          </DialogHeader>

          {state.requireText && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-text" className="text-[11px]">
                Type <span className="font-semibold">{state.requireText}</span> to
                confirm
              </Label>
              <Input
                id="confirm-text"
                value={typed}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && textGateSatisfied) settle(true);
                }}
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => settle(false)}>
              {state.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              size="sm"
              variant={state.tone === "danger" ? "destructive" : "default"}
              disabled={!textGateSatisfied}
              onClick={() => settle(true)}
            >
              {state.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/**
 * Returns an async `confirm(options)`. Falls back to resolving `true` only when
 * no provider is mounted AND the caller passes no `requireText`, so a missing
 * provider can never silently wave through an irreversible action.
 */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = React.useContext(ConfirmContext);
  return React.useCallback(
    async (options: ConfirmOptions) => {
      if (ctx) return ctx(options);
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "useConfirm called without <ConfirmProvider>. Refusing to confirm."
        );
      }
      return false;
    },
    [ctx]
  );
}

export interface UndoableDeleteOptions {
  /** e.g. `3 notices` — appears in the toast. */
  label: string;
  /** Runs after the grace period if the user does not undo. */
  commit: () => Promise<void> | void;
  /** Optimistically hide the rows; called immediately. */
  optimistic?: () => void;
  /** Restore the rows if the user undoes, or if commit fails. */
  rollback?: () => void;
  /** Grace period in ms. */
  graceMs?: number;
}

/**
 * Optimistic delete with a 5-second undo, instead of a confirm dialog.
 * The commit is deferred, so "undo" costs zero server round-trips.
 */
export function undoableDelete({
  label,
  commit,
  optimistic,
  rollback,
  graceMs = 5000,
}: UndoableDeleteOptions): void {
  let undone = false;
  optimistic?.();

  const timer = setTimeout(async () => {
    if (undone) return;
    try {
      await commit();
    } catch (err) {
      rollback?.();
      toast.error(`Couldn't delete ${label}`, {
        description:
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error || "The change was reverted.",
      });
    }
  }, graceMs);

  toast(`Deleted ${label}`, {
    duration: graceMs,
    action: {
      label: "Undo",
      onClick: () => {
        undone = true;
        clearTimeout(timer);
        rollback?.();
      },
    },
  });
}
