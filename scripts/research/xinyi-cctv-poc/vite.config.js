import { defineConfig } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root, envDir: false, publicDir: false,
  server: { host: '127.0.0.1', port: 3747, strictPort: true },
  build: {
    outDir: 'dist', emptyOutDir: true,
    rollupOptions: { input: { replay: resolve(root, 'index.html'), validation: resolve(root, 'validation.html'), annotate: resolve(root, 'annotate.html') } },
  },
  plugins: [{ name: 'local-observation-replay', async closeBundle() {
    await mkdir(resolve(root, 'dist/data'), { recursive: true });
    await cp(resolve(root, 'data'), resolve(root, 'dist/data'), { recursive: true });
  } }],
});
