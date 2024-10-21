const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

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
    }
}));

// Change the port number here if needed
app.listen(3001, () => {
    console.log('Proxy server is running on port 3001');
});
