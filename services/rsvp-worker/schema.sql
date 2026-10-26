-- Esquema D1 para la Selección de los Limón Hernández
CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL UNIQUE,
    phone_last4 TEXT NOT NULL,
    allowed_seats INTEGER DEFAULT 1,
    confirmed INTEGER DEFAULT 0,
    confirmed_seats INTEGER DEFAULT 0,
    note TEXT,
    confirmed_at DATETIME
);

-- Índices de búsqueda y velocidad
CREATE INDEX IF NOT EXISTS idx_guest_name ON guests (full_name);
CREATE INDEX IF NOT EXISTS idx_guest_confirmed ON guests (confirmed);

-- Semilla de ejemplo (Reemplazar con los invitados reales de la Selección)
INSERT OR IGNORE INTO guests (full_name, phone_last4, allowed_seats) VALUES
('Familia Silva Limón', '1420', 3),
('Santiago Ramírez', '7890', 2),
('Carlos Mendoza', '4498', 1),
('Mariana Valdés', '3312', 2),
('Fernando Limón', '9012', 4);
