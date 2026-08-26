import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./index.css";

// React Query caches/coordinates the Supabase (server-state) calls used by
// CloudSyncWidget. The rest of the app's data (the vistorias themselves)
// lives in IndexedDB via src/lib/storage.js and is treated as local state,
// which is the correct scope — React Query is for server state, not
// everything.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
