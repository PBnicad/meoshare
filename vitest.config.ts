import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/ui/test/setup.ts',
  },
  resolve: {
    alias: {
      '@': './src',
      '@/ui': './src/ui',
      '@/lib': './src/ui/lib',
      '@/components': './src/ui/components',
    },
  },
});
