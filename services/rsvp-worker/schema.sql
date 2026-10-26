-- Esquema D1 para la Selección de los Limón Hernández
CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL UNIQUE,
    phone TEXT DEFAULT '',
    allowed_seats INTEGER DEFAULT 1,
    confirmed INTEGER DEFAULT 0,
    confirmed_seats INTEGER DEFAULT 0,
    note TEXT,
    confirmed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de noticias / anuncios y notificaciones para los invitados
CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    badge_label TEXT DEFAULT 'AVISO',
    audience TEXT DEFAULT 'all', -- 'all', 'confirmed', 'pending'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de notificaciones personalizadas o dirigidas
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id INTEGER,
    message TEXT NOT NULL,
    notification_type TEXT DEFAULT 'info', -- 'seats_update', 'notice', 'reminder'
    sent_via TEXT DEFAULT 'portal', -- 'portal', 'whatsapp', 'sms'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(guest_id) REFERENCES guests(id) ON DELETE CASCADE
);

-- Índices de velocidad
CREATE INDEX IF NOT EXISTS idx_guest_name ON guests (full_name);
CREATE INDEX IF NOT EXISTS idx_guest_confirmed ON guests (confirmed);
CREATE INDEX IF NOT EXISTS idx_broadcast_date ON broadcasts (created_at);
