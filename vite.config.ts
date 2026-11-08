import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Dev only: serve /api/* with the same handlers Vercel runs in production. */
function devApi(): Plugin {
  return {
    name: 'flipflap-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/birthdays')) return next();
        try {
          const mod = await server.ssrLoadModule('/api/birthdays.js');
          await mod.default(req, res);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  /* Expose .env secrets to the dev API handler (server side only, never bundled). */
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    base: '/',
    publicDir: 'public',
    plugins: [devApi()],
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
  };
});
