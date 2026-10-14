import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';

/**
 * v163: iPhone "Add to Home Screen" reads the app details (name, start page)
 * from the page as the server sends it. The admin panel and the Teacher
 * Dashboard get their own copy of index.html with their own details, served
 * by public/_redirects (/admin/* → /admin.html, /teacher/* → /teacher.html).
 */
function areaPages() {
  const AREAS = {
    admin: { manifest: '/manifest-admin.webmanifest', name: 'QIT Admin', title: 'QIT Admin | Quran International Institute' },
    teacher: { manifest: '/manifest-teacher.webmanifest', name: 'QIT Teacher', title: 'QIT Teacher Dashboard | Quran International Institute' },
  };
  return {
    name: 'qit-area-pages',
    apply: 'build',
    enforce: 'post',
    writeBundle(options) {
      const dir = options.dir || 'dist';
      const html = readFileSync(join(dir, 'index.html'), 'utf8');
      for (const [area, a] of Object.entries(AREAS)) {
        const out = html
          .replace('href="/manifest.webmanifest"', `href="${a.manifest}"`)
          .replace(/<meta name="apple-mobile-web-app-title" content="[^"]*"/, `<meta name="apple-mobile-web-app-title" content="${a.name}"`)
          .replace(/<meta name="application-name" content="[^"]*"/, `<meta name="application-name" content="${a.name}"`)
          .replace(/<title>[^<]*<\/title>/, `<title>${a.title}</title>`);
        if (!out.includes(a.manifest)) throw new Error(`area page ${area}: manifest link not found`);
        writeFileSync(join(dir, `${area}.html`), out);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), areaPages()],
  build: {
    target: 'es2019',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // React and the router change rarely, so they get their own file that
        // browsers keep cached across site updates.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
