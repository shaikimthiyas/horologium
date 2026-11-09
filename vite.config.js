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
          '/flight-deck': '/flight-deck/',
          '/map': '/flight-deck/',
          '/map/': '/flight-deck/',
          '/geodesic-registry': '/geodesic-registry/',
          '/directory': '/geodesic-registry/',
          '/directory/': '/geodesic-registry/',
          '/country': '/geodesic-registry/',
          '/operator-gateway': '/operator-gateway/',
          '/operator': '/operator-gateway/',
          '/security': '/operator-gateway/',
          '/auth': '/operator-gateway/',
          '/auth/': '/operator-gateway/',
          '/protocol-liaison': '/protocol-liaison/',
          '/liaison': '/protocol-liaison/',
          '/inquiry': '/protocol-liaison/',
          '/contact': '/protocol-liaison/',
          '/contact/': '/protocol-liaison/',
          '/api-explorer': '/api-explorer/',
          '/docs': '/api-explorer/',
          '/docs/': '/api-explorer/',
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
    cors: true,
    hmr: {
      clientPort: 5173
    },
    proxy: {
      '/api/': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '^/ws/': {
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
        flightDeck: resolve(__dirname, 'flight-deck/index.html'),
        geodesicRegistry: resolve(__dirname, 'geodesic-registry/index.html'),
        operatorGateway: resolve(__dirname, 'operator-gateway/index.html'),
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
