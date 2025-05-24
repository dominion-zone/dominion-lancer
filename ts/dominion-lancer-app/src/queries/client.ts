import { QueryClient } from "@tanstack/solid-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true,
      retry: 10,
      experimental_prefetchInRender: true,
    },
  },
});
