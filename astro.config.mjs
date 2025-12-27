// @ts-check
import { defineConfig, envField } from "astro/config";
import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  site: "https://quilt.dannywhite.net",
  integrations: [mdx()],
  env: {
    schema: {
      PUBLIC_MAPTILER_API_KEY: envField.string({
        context: "client",
        access: "public",
      }),
      PUBLIC_CLOUDINARY_CLOUD_NAME: envField.string({
        context: "client",
        access: "public",
      }),
    },
  },
  image: {
    domains: ["res.cloudinary.com"],
  },
});
