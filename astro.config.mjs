import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: 'https://themasonrymodeler.com',
  output: 'static',
  integrations: [sitemap()],

  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },

  adapter: cloudflare()
});