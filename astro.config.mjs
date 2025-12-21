// @ts-check
import { defineConfig, envField } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  env: {
    schema: {
      PUBLIC_MAPTILER_API_KEY: envField.string({
        context: 'client',
        access: 'public',
      }),
    },
  },
});
