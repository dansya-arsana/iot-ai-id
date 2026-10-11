/** Business contact channels shared by the landing pages, the partner form and the footer. */
export const WA_NUMBER='62812114040';
export const WA_DISPLAY='+62 812-114-040';
export const waLink=(text:string)=>`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
