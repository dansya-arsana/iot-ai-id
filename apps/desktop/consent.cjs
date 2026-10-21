const {createHmac, randomBytes} = require('node:crypto');
const {Buffer} = require('node:buffer');
const CONSENT_TTL_MS = 60000;
const b64 = value => Buffer.from(value).toString('base64url');
/** One-time consent token: v1.<payload>.<hmac>. Verified (and consumed) by services/api/lab-consent.ts. */
function mintConsent(secret, port, now = Date.now()) {
  const payload = b64(JSON.stringify({port, exp: now + CONSENT_TTL_MS, nonce: randomBytes(16).toString('hex')}));
  return `v1.${payload}.${createHmac('sha256', secret).update(`v1.${payload}`).digest('base64url')}`;
}
/** Native human click. Resolves to a token only after "Allow"; the renderer cannot produce one itself. */
async function askConsent(dialog, parent, secret, port) {
  if (typeof port !== 'string' || !port || port.length > 200 || [...port].some(c => c.charCodeAt(0) < 32)) return null;
  const {response} = await dialog.showMessageBox(parent, {type: 'warning', buttons: ['Allow for 20 min', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true,
    title: 'AIoT Lab', message: `Allow AIoT Lab to upload firmware to UNO on ${port}?`,
    detail: 'The lab can flash this board and read its serial output for 20 minutes. Only allow this if you started the upload.'});
  return response === 0 ? mintConsent(secret, port) : null;
}
module.exports = {CONSENT_TTL_MS, mintConsent, askConsent};
