import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://themasonrymodeler.com',
  output: 'static',
  image: {
    // Use sharp for local image optimization
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
});
