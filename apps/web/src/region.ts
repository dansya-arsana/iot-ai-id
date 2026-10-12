/** Visitor's region choice. The server-side geo redirect on "/" honours this cookie. */
const REGION_COOKIE='iot_region';
/** The Indonesian choice lasts a year; the global choice lasts this browser session, so a visitor in Indonesia lands on /id/ again next time. */
export function rememberRegion(region:'id'|'global'){document.cookie=`${REGION_COOKIE}=${region};${region==='id'?' Max-Age=31536000;':''} Path=/; SameSite=Lax`;}
