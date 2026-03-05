const axios = require('axios');
const https = require('https');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const agent = new https.Agent({ rejectUnauthorized: false });

const privateKey = process.env.BACKEND_PRIVATE_KEY
  ? process.env.BACKEND_PRIVATE_KEY.replace(/\\n/g, '\n') // if the key is provided via env var, it may have literal \n sequences that need to be converted back to newlines
  : fs.readFileSync('private.pem', 'utf8'); // if not provided just read from file (for local dev)

const dbAxios = axios.create({
  baseURL: process.env.DB_API_URL,
  httpsAgent: agent,
});

// attaches a signed JWT to every outgoing request
dbAxios.interceptors.request.use((config) => {
  const token = jwt.sign(
    { iss: 'smartlock-backend' }, // claims
    privateKey,
    { algorithm: 'RS256', expiresIn: '30s' } // hash with RS256
  );

  config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

module.exports = { dbAxios };