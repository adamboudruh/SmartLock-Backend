const dbAxios = require('../services/dbApiClient').dbAxios;
const https = require('https');

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

    return secret;
  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data?.statusDetails  // array of strings from DB API
                 || err?.response?.data?.title
                 || err?.message
                 || 'Unknown error';
    
    console.error('[DeviceService] Error:', details);
    return null;
  }
}

async function getDevice(deviceId) {
  try {
    const response = await dbAxios.get(`/devices/${deviceId}`);
    return response.data.data;
  } catch (err) {
    console.log(err);
    const status = err?.response?.status || 500;
    const details = err?.response?.data?.statusDetails  // array of strings from DB API
                 || err?.response?.data?.title
                 || err?.message
                 || 'Unknown error';
    
    console.error('[DeviceService] Error:', details);
    return null;
  }
}

module.exports = { getDeviceSecret, getDevice };