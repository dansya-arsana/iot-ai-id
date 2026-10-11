/** admin.iot.ai.id serves the backoffice at its root; the public site lives on iot.ai.id. Local installs keep /backoffice. */
export const isAdminHost=(hostname=typeof window==='undefined'?'':window.location.hostname)=>/^admin\./.test(hostname);
export const PUBLIC_SITE='https://iot.ai.id/';
