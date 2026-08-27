import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"

//http://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
 