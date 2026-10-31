// Load Bear service worker: receives Web Push reminders and opens the right screen.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{
 let data={title:'Load Bear',body:'Bear has something that might make life easier.',url:'/bear/home',tag:'bear'};
 try{data={...data,...e.data.json()};}catch{}
 e.waitUntil(self.registration.showNotification(data.title,{body:data.body,tag:data.tag,data:{url:data.url},icon:'/bear/icon-192.png',badge:'/bear/badge.png'}));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'/bear/home';
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus' in c){c.navigate(url);return c.focus();}}return self.clients.openWindow(url);}));
});
