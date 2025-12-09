import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections
    allowedHosts: [
      'kelompoknullvoid.xetf.my.id',
      'localhost',
      '.xetf.my.id', // Allow all subdomains
    ],
    proxy: {
      '/api': {
        // In Docker, Vite can use the service name 'flask-backend'
        // For local development, this will be overridden or use localhost
        target: process.env.PROXY_TARGET || 'http://flask-backend:5000',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates if needed
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying:', req.method, req.url, '->', proxyReq.path);
          });
        },
      },
    },
  },
})
