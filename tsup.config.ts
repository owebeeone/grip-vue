import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  // Note: consola is bundled and will need Node.js polyfills in browser environments
  // The consuming application (e.g., Vite) should provide polyfills for 'util' module
});

