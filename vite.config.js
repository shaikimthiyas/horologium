import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Enterprise Route Alias & Zero-Breakage Forwarding Middleware
 */
function enterpriseRoutePlugin() {
  return {
    name: 'enterprise-route-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || '/';
        const [path, query] = rawUrl.split('?');
        const qs = query ? `?${query}` : '';

        const aliasMap = {
          '/horo': '/horo/',
          '/horologium': '/horo/',
          '/flight-deck': '/map/',
          '/map': '/map/',
          '/geodesic-registry': '/directory/',
          '/directory': '/directory/',
          '/country': '/directory/',
          '/operator-gateway': '/auth/',
          '/operator': '/auth/',
          '/security': '/auth/',
          '/auth': '/auth/',
          '/protocol-liaison': '/contact/',
          '/liaison': '/contact/',
          '/inquiry': '/contact/',
          '/contact': '/contact/',
          '/api-explorer': '/docs/',
          '/docs': '/docs/',
          '/about': '/about/',
          '/colophon': '/about/',
          '/author': '/about/',
          '/status': '/status/',
          '/telemetry': '/status/',
          '/uptime': '/status/',
          '/privacy': '/privacy/',
          '/legal': '/privacy/',
          '/terms': '/privacy/',
          '/developers': '/developers/',
          '/developer': '/developers/',
          '/portal': '/developers/',
          '/business': '/developers/'
        };

        if (aliasMap[path]) {
          res.writeHead(302, { Location: aliasMap[path] + qs });
          return res.end();
        }
        next();
      });
    }
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [enterpriseRoutePlugin()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        horo: resolve(__dirname, 'horo/index.html'),
        map: resolve(__dirname, 'map/index.html'),
        flightDeck: resolve(__dirname, 'flight-deck/index.html'),
        directory: resolve(__dirname, 'directory/index.html'),
        geodesicRegistry: resolve(__dirname, 'geodesic-registry/index.html'),
        auth: resolve(__dirname, 'auth/index.html'),
        operatorGateway: resolve(__dirname, 'operator-gateway/index.html'),
        contact: resolve(__dirname, 'contact/index.html'),
        protocolLiaison: resolve(__dirname, 'protocol-liaison/index.html'),
        apiExplorer: resolve(__dirname, 'api-explorer/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        status: resolve(__dirname, 'status/index.html'),
        privacy: resolve(__dirname, 'privacy/index.html'),
        developers: resolve(__dirname, 'developers/index.html'),
        notFound: resolve(__dirname, '404.html')
      }
    }
  }
});
