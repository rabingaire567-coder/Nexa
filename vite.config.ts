import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('./src', import.meta.url));

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** GitHub Pages project sites live under /<repo>/; user sites live at the root. */
const base = process.env.BASE_PATH || '/';

/**
 * GitHub Pages has no rewrite rules, so a client-side route like /districts
 * would 404. Copying the built index.html to 404.html makes Pages serve the
 * app shell instead, and React Router then reads the real pathname.
 */
function spaFallback(): Plugin {
  return {
    name: 'nexa-spa-fallback',
    apply: 'build',
    async closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      try {
        await fs.copyFile(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
        // Also drop a 200.html so hosts with error-page overrides behave.
        await fs.copyFile(path.join(outDir, 'index.html'), path.join(outDir, '200.html'));
      } catch {
        /* nothing to copy yet */
      }
    },
  };
}

/**
 * Vite rewrites `href`/`src` attributes for `base`, but never the `content`
 * of a meta tag — so og:image would 404 on a project site. Fix those by hand.
 */
function rewriteMetaAssets(): Plugin {
  return {
    name: 'nexa-meta-assets',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(/(content=")\/(og-image\.png|icon-192\.png|icon-512\.png|favicon\.svg|apple-touch-icon\.png|manifest\.webmanifest)/g, `$1${base}$2`);
      },
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), spaFallback(), rewriteMetaAssets()],
  resolve: {
    alias: { '@': root },
  },
  server: {
    port: 5173,
    // The optional Node backend (Gemini proxy + JSON database).
    // During `npm run dev` Vite forwards /api to it so the AI works in dev too.
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the vendor runtime and the (large) Nepal dataset out of the
        // app chunk so the knowledge base caches independently of code changes.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react';
          }
          if (/[\\/]node_modules[\\/]/.test(id)) return 'vendor';
          if (id.includes(`${'districts'}.json`) || id.includes('cities.json') || id.includes('sectors.json') || id.includes('national.json')) {
            return 'data';
          }
          return undefined;
        },
      },
    },
  },
});
