// Rendered at the top of the Outlook pages (a plain inline script, before the app itself loads), as Microsoft
// asks: Office.js must initialise before the page's own code. It first guards history.pushState/replaceState,
// which Office.js sets to null and Next.js needs: real functions are accepted, null is ignored.
export const OFFICE_JS='https://appsforoffice.microsoft.com/lib/1/hosted/office.js';
export const OFFICE_BOOT=`(function(){try{var h=window.history;['pushState','replaceState'].forEach(function(k){var f=h[k];Object.defineProperty(h,k,{configurable:true,get:function(){return f;},set:function(v){if(typeof v==='function')f=v;}});});}catch(e){}if(!document.getElementById('office-js')){var s=document.createElement('script');s.id='office-js';s.src='${OFFICE_JS}';document.head.appendChild(s);}})();`;
