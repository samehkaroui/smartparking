import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  server: {
    host: '0.0.0.0', // Accessible from network
    port: 5174,
    allowedHosts: [
      'smartparkingf.onrender.com',
      'localhost',
    ],
  },
  
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  
  define: {
    // Make environment variables available in the browser
    'process.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL),
  },
});
