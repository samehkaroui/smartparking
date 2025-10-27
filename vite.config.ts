import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  
  define: {
    // Make environment variables available in the browser
    'process.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL),
  },
});
