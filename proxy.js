const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Enable CORS for all routes
app.use(cors());

// Define a route for the root URL
app.get('/', (req, res) => {
    res.send('Welcome to the Proxy Server');
});

// Set up the proxy for the /tasmota path
app.use('/tasmota', createProxyMiddleware({
    target: 'http://192.168.67.221',
    changeOrigin: true,
    pathRewrite: {
        '^/tasmota': ''
    },
    logLevel: 'debug',
    onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        res.status(500).send('Proxy Error');
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log('Proxy Request:', req.method, req.path);
        console.log('Request Headers:', req.headers);
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log('Proxy Response:', proxyRes.statusCode);
        console.log('Response Headers:', proxyRes.headers);
    }
}));

// Change the port number here if needed
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Proxy server is running on port ${PORT}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).send('Internal Server Error');
});
