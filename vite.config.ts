import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      'sonner@2.0.3': 'sonner',
      'react-hook-form@7.55.0': 'react-hook-form',
      'figma:asset/6dbb44028ed8a316eb5f92fc5d24fd96935de5f0.png': path.resolve(__dirname, './src/assets/6dbb44028ed8a316eb5f92fc5d24fd96935de5f0.png'),
      'figma:asset/2217307d23df7779a3757aa35c01d81549336b8b.png': path.resolve(__dirname, './src/assets/2217307d23df7779a3757aa35c01d81549336b8b.png'),
      '@supabase/supabase-js@2': '@supabase/supabase-js',
      '@radix-ui/react-slot@1.1.0': '@radix-ui/react-slot',
      '@radix-ui/react-label@2.1.1': '@radix-ui/react-label',
      '@radix-ui/react-dialog@1.1.2': '@radix-ui/react-dialog',
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  server: {
    port: 3000,
    open: true,
  },
});
