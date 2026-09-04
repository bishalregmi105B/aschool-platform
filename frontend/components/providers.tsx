"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { PluginProvider } from "@/lib/plugins";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PluginProvider>
          {/* ConfirmProvider hosts the single destructive-action dialog;
              useConfirm() refuses (returns false) when it is absent, so it
              must wrap everything that can delete. */}
          <ConfirmProvider>{children}</ConfirmProvider>
        </PluginProvider>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
