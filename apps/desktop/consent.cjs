const {createHmac, randomBytes} = require('node:crypto');
const {Buffer} = require('node:buffer');
const CONSENT_TTL_MS = 60000;
const b64 = value => Buffer.from(value).toString('base64url');
const SHA = /^[0-9a-f]{64}$/;
const clean = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && ![...v].some(c => c.charCodeAt(0) < 32);
/** One-time consent token. v1.<payload>.<hmac> binds the port (UNO). v2 also binds fileSha (physical flash of a revision artifact). v3 {purpose:'serial'} opens one ESP32 serial session.
 *  Verified (and consumed) by services/api/lab-consent.ts. */
function mintConsent(secret, port, now = Date.now(), fileSha, purpose) {
  const v = purpose === 'serial' ? 'v3' : fileSha ? 'v2' : 'v1';
  const payload = b64(JSON.stringify({port, ...(fileSha ? {fileSha} : {}), ...(v === 'v3' ? {purpose: 'serial'} : {}), exp: now + CONSENT_TTL_MS, nonce: randomBytes(16).toString('hex')}));
  return `${v}.${payload}.${createHmac('sha256', secret).update(`${v}.${payload}`).digest('base64url')}`;
}
/** Native human click. Resolves to a token only after "Allow"; the renderer cannot produce one itself.
 *  opts (optional) {fileSha, node, file}: when fileSha is given it must be valid or no dialog is shown. */
async function askConsent(dialog, parent, secret, port, opts) {
  if (!clean(port, 200)) return null;
  let sha, node = 'UNO', file = '', purpose;
  if (opts !== undefined && opts !== null && opts.purpose === 'serial') {
    if (!clean(opts.node, 80)) return null;
    purpose = 'serial'; node = opts.node;
  } else if (opts !== undefined && opts !== null) {
    if (typeof opts !== 'object' || !SHA.test(opts.fileSha) || !clean(opts.node, 80) || !clean(opts.file, 200)) return null;
    sha = opts.fileSha; node = opts.node; file = opts.file;
  }
  const {response} = await dialog.showMessageBox(parent, {type: 'warning', buttons: ['Allow for 20 min', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true,
    title: 'AIoT Lab', message: `Allow AIoT Lab to upload firmware to ${node} on ${port}?`,
    detail: (sha ? `File: ${file}\nSHA-256: ${sha.slice(0, 12)}\nPort: ${port}\n\n` : '') + 'The lab can flash this board and read its serial output for 20 minutes. Only allow this if you started the upload.'});
  return response === 0 ? mintConsent(secret, port, Date.now(), sha, purpose) : null;
}
module.exports = {CONSENT_TTL_MS, mintConsent, askConsent};
