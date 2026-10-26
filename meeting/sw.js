// Service Worker para Notificaciones Push en Segundo Plano (Web Push)
// daniel limon - 15th Birthday Celebration

const CACHE_NAME = 'limon-meeting-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Receptor de Notificaciones Push (incluso con la página cerrada)
self.addEventListener('push', (event) => {
    let data = {
        title: 'Daniel Limón Hernández',
        body: 'Nueva actualización sobre la celebración.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        url: '/meeting/'
    };

    if (event.data) {
        try {
            const parsed = event.data.json();
            data = { ...data, ...parsed };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/favicon.ico',
        badge: data.badge || '/favicon.ico',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/meeting/'
        },
        actions: [
            { action: 'open', title: 'Ver Detalles' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Click en la Notificación
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/meeting/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('/meeting') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
