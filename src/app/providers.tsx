"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createQueryClient } from "@/shared/api/query-client";

/** 요청마다 새 QueryClient를 만들지 않도록 컴포넌트 수명 동안 하나를 유지한다. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
