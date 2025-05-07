import { defineConfig } from "@solidjs/start/config";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import typedCssModulesPlugin from "vite-plugin-typed-css-modules";

export default defineConfig({
  vite: {
    plugins: [TanStackRouterVite({ target: "solid" }), typedCssModulesPlugin()],
  },
  ssr: false,
});
