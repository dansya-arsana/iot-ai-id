/** Visitor's region choice. The server-side geo redirect on "/" honours this cookie. */
const REGION_COOKIE='iot_region';
export function rememberRegion(region:'id'|'global'){document.cookie=`${REGION_COOKIE}=${region}; Max-Age=31536000; Path=/; SameSite=Lax`;}
