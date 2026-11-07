import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  publicDir: 'public',
  optimizeDeps: {
    include: ['k3ui', '@material/material-color-utilities'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
});
