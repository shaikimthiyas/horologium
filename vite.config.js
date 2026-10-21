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
          '/flight-deck': '/flight-deck/',
          '/map': '/flight-deck/',
          '/src/pages/map.html': '/flight-deck/',
          '/geodesic-registry': '/geodesic-registry/',
          '/directory': '/geodesic-registry/',
          '/country': '/geodesic-registry/',
          '/src/pages/country.html': '/geodesic-registry/',
          '/operator-gateway': '/operator-gateway/',
          '/operator': '/operator-gateway/',
          '/security': '/operator-gateway/',
          '/auth': '/operator-gateway/',
          '/src/pages/auth.html': '/operator-gateway/',
          '/protocol-liaison': '/protocol-liaison/',
          '/liaison': '/protocol-liaison/',
          '/inquiry': '/protocol-liaison/',
          '/contact': '/protocol-liaison/',
          '/src/pages/contact.html': '/protocol-liaison/',
          '/api-explorer': '/api-explorer/',
          '/docs': '/api-explorer/',
          '/src/pages/docs.html': '/api-explorer/'
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
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        flightDeck: resolve(__dirname, 'flight-deck/index.html'),
        geodesicRegistry: resolve(__dirname, 'geodesic-registry/index.html'),
        operatorGateway: resolve(__dirname, 'operator-gateway/index.html'),
        protocolLiaison: resolve(__dirname, 'protocol-liaison/index.html'),
        apiExplorer: resolve(__dirname, 'api-explorer/index.html'),
        legacyMap: resolve(__dirname, 'src/pages/map.html'),
        legacyCountry: resolve(__dirname, 'src/pages/country.html'),
        legacyAuth: resolve(__dirname, 'src/pages/auth.html'),
        legacyContact: resolve(__dirname, 'src/pages/contact.html'),
        legacyDocs: resolve(__dirname, 'src/pages/docs.html')
      }
    }
  }
});
