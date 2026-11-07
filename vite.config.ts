import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  resolve: {
    alias: {
      // Workers do not populate process.env from Worker secrets, so the
      // Cloudflare build reads them off `cloudflare:workers` instead. This
      // config drives only the Workers build; `next build` (Netlify) keeps
      // the Node implementation.
      "@/lib/runtime-env": fileURLToPath(
        new URL("./src/lib/runtime-env.cloudflare.ts", import.meta.url),
      ),
    },
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
