const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5002',
      changeOrigin: true,
      secure: false,
      pathRewrite: {
        '^/api': '/api', // Keep the /api prefix
      },
      logLevel: 'debug', // Enable debug logging
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).json({ message: 'Proxy error', error: err.message });
      },
      onProxyReq: (proxyReq, req, res) => {
        // Log the request
        console.log('Proxying request:', req.method, req.url);
        // Add CORS headers
        proxyReq.setHeader('Access-Control-Allow-Origin', 'http://localhost:8092');
        proxyReq.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        proxyReq.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        proxyReq.setHeader('Access-Control-Allow-Credentials', 'true');
      },
      onProxyRes: (proxyRes, req, res) => {
        // Add CORS headers to the response
        proxyRes.headers['Access-Control-Allow-Origin'] = 'http://localhost:8092';
        proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
        console.log('Received response with status:', proxyRes.statusCode);
      },
    })
  );
};
