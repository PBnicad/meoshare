import { defineConfig, coverageConfigDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/ui/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/ui/test/',
      ],
    },
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
