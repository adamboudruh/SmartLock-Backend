const dbAxios = require('../services/dbApiClient').dbAxios;
const https = require('https');

const DB_API = process.env.DB_API_URL || 'https://localhost:7110';
const agent = new https.Agent({ rejectUnauthorized: false });

async function getDeviceSecret(deviceId) {
  try {
    const url = `/devices/${deviceId}/secret`;
    console.log(`[DeviceService] Fetching secret from: ${url}`);

    const response = await dbAxios.get(url);

    console.log(`[DeviceService] Response status: ${response.status}`);
    console.log(`[DeviceService] Response body:`, response.data);

    const secret = response.data.data;
    if (!secret) {
      console.warn(`[DeviceService] Secret was null/empty for device: ${deviceId}`);
      return null;
    }

    console.log(`[DeviceService] Secret cached for device: ${deviceId}`);
    return secret;
  } catch (err) {
    return null; 
  }
}

async function getDevice(deviceId) {
  try {
    const response = await dbAxios.get(`/devices/${deviceId}`, { httpsAgent: agent });
    return response.data.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

module.exports = { getDeviceSecret, getDevice };