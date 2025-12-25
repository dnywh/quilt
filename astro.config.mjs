// @ts-check
import { defineConfig, envField } from "astro/config";

// https://astro.build/config
export default defineConfig({
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
