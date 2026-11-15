import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/features/auth/auth-context";
import { createQueryClient } from "@/lib/query/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/** Server state, tooltips, toasts, auth. Nothing else global: filters live on the URL. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <AuthProvider>
          {children}
          <Toaster position="bottom-right" visibleToasts={3} duration={4000} />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
