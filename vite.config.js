import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function hashDir(dir) {
  const h = createHash('md5');
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else {
        h.update(p.slice(dir.length));
        h.update(readFileSync(p));
      }
    }
  };
  try { walk(dir); } catch { h.update('no-assets'); }
  return h.digest('hex').slice(0, 8);
}

const ASSET_VERSION = hashDir(join(process.cwd(), 'public/assert'));

export default defineConfig({
  base: './',
  define: {
    __ZD_ASSET_VERSION__: JSON.stringify(ASSET_VERSION),
  },
  plugins: [
    {
      name: 'zd-asset-version-query',
      writeBundle(options) {
        const out = resolve(process.cwd(), options.dir || 'dist');
        const stampCss = (file) => {
          const p = join(out, file);
          let t;
          try { t = readFileSync(p, 'utf8'); } catch { return; }
          const patched = t.replace(
            /url\((['"]?)((?:\.{1,2}\/)?assert\/[^'")]+)\1\)/g,
            (m, q, u) => (u.includes('?') ? m : `url(${q}${u}?v=${ASSET_VERSION}${q})`));
          if (patched !== t) writeFileSync(p, patched);
        };
        const stampHtml = (file) => {
          const p = join(out, file);
          let t;
          try { t = readFileSync(p, 'utf8'); } catch { return; }
          const patched = t.replace(
            /src="((?:\.{1,2}\/)?assert\/[^"?#]+)"/g,
            (m, u) => (u.includes('?') ? m : `src="${u}?v=${ASSET_VERSION}"`));
          if (patched !== t) writeFileSync(p, patched);
        };
        for (const name of readdirSync(join(out, 'assets'))) {
          if (name.endsWith('.css')) stampCss(join('assets', name));
        }
        stampHtml('index.html');
      },
    },
  ],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
