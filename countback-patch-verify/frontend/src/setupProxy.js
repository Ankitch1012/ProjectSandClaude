const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const host = process.env.BACKEND_HOST || '127.0.0.1';
  const port = process.env.BACKEND_PORT || '5000';
  app.use('/api', createProxyMiddleware({
    target: `http://${host}:${port}`,
    changeOrigin: true,
  }));
};
