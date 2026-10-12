/** admin.iot.ai.id serves the backoffice at its root; the public site lives on iot.ai.id. Local installs keep /backoffice. */
export const isAdminHost=(hostname=typeof window==='undefined'?'':window.location.hostname)=>/^admin\./.test(hostname);
/** The public production host (iot.ai.id, www) plus `iot.admin.localhost`, the e2e alias. localhost and the desktop app are never "public": /build and /sites really work there. */
export const isPublicHost=(hostname=typeof window==='undefined'?'':window.location.hostname)=>/^(www\.)?iot\.ai\.id$/.test(hostname)||hostname==='iot.admin.localhost';
/** Origin of the matching admin host: admin.iot.ai.id, or admin.localhost with the same port for the e2e alias. */
export const adminOrigin=(loc:Pick<Location,'hostname'|'protocol'|'port'>=window.location)=>loc.hostname==='iot.admin.localhost'?`${loc.protocol}//admin.localhost${loc.port?':'+loc.port:''}`:'https://admin.iot.ai.id';
export const PUBLIC_SITE='https://iot.ai.id/';
