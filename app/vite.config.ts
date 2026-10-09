/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // 5180: o A-PORT ocupa a 5173 e os dois podem estar abertos juntos.
  server: { port: 5180, strictPort: true, open: false, fs: { allow: ['.', '..'] } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2022' },
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
});
