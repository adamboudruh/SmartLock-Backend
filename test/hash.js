// sample hash script to generate the same hash as the ESP32 for a given UID
const crypto = require('crypto');

const UID_SALT = 'smartlock-uid-v1';
const uid = process.argv[2];

if (!uid) {
  console.error('Usage: node hashUID.js 04AB0A613E6180');
  console.error('Example: node hashUID.js 04AB0A613E6180');
  process.exit(1);
}

const salted = UID_SALT + uid;
const hash = crypto.createHash('sha256').update(salted).digest('hex');

console.log(`UID:    ${uid}`);
console.log(`Salted: ${salted}`);
console.log(`Hash:   ${hash}`);