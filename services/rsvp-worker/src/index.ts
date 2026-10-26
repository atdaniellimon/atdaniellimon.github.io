export interface Env {
    DB: D1Database;
    TOTP_SECRET?: string; // Base32 secret for Google Authenticator (default fallback: ZAMCIJ5L4CUVN62GEXKQ)
    ADMIN_SESSION_SECRET?: string; // Signing key for session tokens
}

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
        },
    });
}

// --------------------------------------------------------------------------
// RFC 6238 TOTP VERIFICATION (Compatible with Google Authenticator)
// --------------------------------------------------------------------------
function base32Decode(base32: string): Uint8Array {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const char of base32.toUpperCase().replace(/=/g, "")) {
        const val = alphabet.indexOf(char);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, "0");
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return new Uint8Array(bytes);
}

async function verifyTOTP(token: string, secretBase32: string): Promise<boolean> {
    const cleanToken = token.trim();
    if (!/^\d{6}$/.test(cleanToken)) return false;

    const keyBytes = base32Decode(secretBase32);
    const key = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
    );

    const currentTimeStep = Math.floor(Date.now() / 1000 / 30);
    // Tolerate drift: check current, previous and next window (-1, 0, +1)
    for (const drift of [-1, 0, 1]) {
        const timeVal = BigInt(currentTimeStep + drift);
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setBigUint64(0, timeVal, false);

        const signature = await crypto.subtle.sign("HMAC", key, buffer);
        const hash = new Uint8Array(signature);
        const offset = hash[hash.length - 1] & 0x0f;
        const codeNum =
            ((hash[offset] & 0x7f) << 24) |
            ((hash[offset + 1] & 0xff) << 16) |
            ((hash[offset + 2] & 0xff) << 8) |
            (hash[offset + 3] & 0xff);

        const candidateCode = String(codeNum % 1000000).padStart(6, "0");
        if (candidateCode === cleanToken) {
            return true;
        }
    }
    return false;
}

// Simple signed session token
async function createSessionToken(secret: string): Promise<string> {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const payload = `admin:${expiresAt}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    const sigHex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return btoa(JSON.stringify({ payload, sig: sigHex }));
}

async function verifySessionToken(token: string | null, secret: string): Promise<boolean> {
    if (!token) return false;
    try {
        const parsed = JSON.parse(atob(token.replace("Bearer ", "")));
        const { payload, sig } = parsed;
        const [role, expStr] = payload.split(":");
        if (role !== "admin" || Date.now() > Number(expStr)) return false;

        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
            "raw",
            enc.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"]
        );
        const sigBytes = new Uint8Array(
            sig.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16))
        );
        return await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payload));
    } catch {
        return false;
    }
}

// --------------------------------------------------------------------------
// MAIN ROUTER
// --------------------------------------------------------------------------
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: CORS_HEADERS });
        }

        const url = new URL(request.url);
        const totpSecret = env.TOTP_SECRET || "ZAMCIJ5L4CUVN62GEXKQ";
        const sessionSecret = env.ADMIN_SESSION_SECRET || "limon_secret_session_key_2026";

        try {
            // ==============================================================
            // PUBLIC ENDPOINTS (Invitados)
            // ==============================================================

            // 1. Confirmar Asistencia Directa (Sin contraseñas)
            // POST /api/guests/confirm
            if (url.pathname === "/api/guests/confirm" && request.method === "POST") {
                const body: any = await request.json();
                const fullName = String(body.full_name || "").trim();
                const seats = Math.max(1, Math.min(10, Number(body.seats || 1)));
                const note = String(body.note || "").trim().slice(0, 400);

                if (!fullName || fullName.length < 2) {
                    return jsonResponse({ error: "Ingresa un nombre válido." }, 400);
                }

                // Verificar si ya existe en la base de datos
                const existing: any = await env.DB.prepare(
                    `SELECT * FROM guests WHERE LOWER(full_name) = LOWER(?)`
                ).bind(fullName).first();

                if (existing) {
                    await env.DB.prepare(
                        `UPDATE guests 
                         SET confirmed = 1, 
                             confirmed_seats = ?, 
                             note = ?, 
                             confirmed_at = datetime('now') 
                         WHERE id = ?`
                    ).bind(seats, note, existing.id).run();
                } else {
                    await env.DB.prepare(
                        `INSERT INTO guests (full_name, allowed_seats, confirmed, confirmed_seats, note, confirmed_at)
                         VALUES (?, ?, 1, ?, ?, datetime('now'))`
                    ).bind(fullName, seats, seats, note).run();
                }

                return jsonResponse({
                    success: true,
                    message: "¡Asistencia registrada con éxito!",
                    full_name: fullName,
                    seats,
                });
            }

            // 2. Obtener Anuncios / Noticias Públicas para los Invitados
            // GET /api/broadcasts
            if (url.pathname === "/api/broadcasts" && request.method === "GET") {
                const { results } = await env.DB.prepare(
                    `SELECT id, title, content, badge_label, created_at 
                     FROM broadcasts 
                     ORDER BY created_at DESC 
                     LIMIT 10`
                ).all();

                return jsonResponse({ broadcasts: results || [] });
            }

            // ==============================================================
            // ADMIN AUTH (Google Authenticator TOTP)
            // ==============================================================

            // POST /api/admin/login
            if (url.pathname === "/api/admin/login" && request.method === "POST") {
                const body: any = await request.json();
                const pin = String(body.pin || "").trim();

                const isValid = await verifyTOTP(pin, totpSecret);
                if (!isValid) {
                    return jsonResponse({ error: "Código de Google Authenticator incorrecto o expirado." }, 401);
                }

                const token = await createSessionToken(sessionSecret);
                return jsonResponse({
                    success: true,
                    message: "Acceso concedido.",
                    token,
                });
            }

            // ==============================================================
            // ADMIN PROTECTED ROUTES (Requieren token)
            // ==============================================================
            const authHeader = request.headers.get("Authorization");
            const isAuthorized = await verifySessionToken(authHeader, sessionSecret);

            if (url.pathname.startsWith("/api/admin/") && url.pathname !== "/api/admin/login") {
                if (!isAuthorized) {
                    return jsonResponse({ error: "Sesión expirada o no autorizada. Ingresa tu código de Google Authenticator." }, 401);
                }

                // 3. Listar todos los invitados y estadísticas
                // GET /api/admin/guests
                if (url.pathname === "/api/admin/guests" && request.method === "GET") {
                    const { results: guests } = await env.DB.prepare(
                        `SELECT id, full_name, phone, allowed_seats, confirmed, confirmed_seats, note, confirmed_at 
                         FROM guests 
                         ORDER BY confirmed DESC, full_name ASC`
                    ).all();

                    const stats: any = await env.DB.prepare(
                        `SELECT 
                            COUNT(*) as total_records,
                            SUM(CASE WHEN confirmed = 1 THEN 1 ELSE 0 END) as confirmed_count,
                            SUM(CASE WHEN confirmed = 1 THEN confirmed_seats ELSE 0 END) as total_confirmed_seats,
                            SUM(CASE WHEN confirmed = 0 THEN allowed_seats ELSE 0 END) as pending_seats
                         FROM guests`
                    ).first();

                    return jsonResponse({
                        stats: {
                            total_records: stats?.total_records || 0,
                            confirmed_count: stats?.confirmed_count || 0,
                            total_confirmed_seats: stats?.total_confirmed_seats || 0,
                            pending_seats: stats?.pending_seats || 0,
                        },
                        guests: guests || [],
                    });
                }

                // 4. Crear o Agregar Invitado manualmente
                // POST /api/admin/guests
                if (url.pathname === "/api/admin/guests" && request.method === "POST") {
                    const body: any = await request.json();
                    const fullName = String(body.full_name || "").trim();
                    const phone = String(body.phone || "").trim();
                    const allowedSeats = Math.max(1, Number(body.allowed_seats || 1));

                    if (!fullName) {
                        return jsonResponse({ error: "El nombre es obligatorio." }, 400);
                    }

                    try {
                        const info = await env.DB.prepare(
                            `INSERT INTO guests (full_name, phone, allowed_seats) VALUES (?, ?, ?)`
                        ).bind(fullName, phone, allowedSeats).run();

                        return jsonResponse({ success: true, id: info.meta.last_row_id });
                    } catch (e: any) {
                        return jsonResponse({ error: "Ya existe un invitado con ese nombre." }, 400);
                    }
                }

                // 5. Modificar Cupos / Pases Máximos / Estado
                // PUT /api/admin/guests/:id
                const guestUpdateMatch = url.pathname.match(/^\/api\/admin\/guests\/(\d+)$/);
                if (guestUpdateMatch && request.method === "PUT") {
                    const guestId = Number(guestUpdateMatch[1]);
                    const body: any = await request.json();
                    const allowedSeats = Number(body.allowed_seats);
                    const confirmedSeats = Number(body.confirmed_seats);
                    const confirmed = body.confirmed !== undefined ? (body.confirmed ? 1 : 0) : undefined;
                    const phone = body.phone !== undefined ? String(body.phone).trim() : undefined;

                    // Obtener registro actual
                    const current: any = await env.DB.prepare(
                        `SELECT * FROM guests WHERE id = ?`
                    ).bind(guestId).first();

                    if (!current) {
                        return jsonResponse({ error: "Invitado no encontrado." }, 404);
                    }

                    const nextAllowed = isNaN(allowedSeats) || allowedSeats === 0 ? (current.allowed_seats || 1) : Math.max(1, allowedSeats);
                    const nextConfirmed = confirmed !== undefined ? confirmed : (current.confirmed || 0);
                    const nextConfirmedSeats = isNaN(confirmedSeats) ? (current.confirmed_seats || 0) : Math.max(0, confirmedSeats);
                    const nextPhone = phone !== undefined ? phone : (current.phone || "");

                    await env.DB.prepare(
                        `UPDATE guests 
                         SET allowed_seats = ?, confirmed = ?, confirmed_seats = ?, phone = ? 
                         WHERE id = ?`
                    ).bind(nextAllowed, nextConfirmed, nextConfirmedSeats, nextPhone, guestId).run();

                    return jsonResponse({ success: true, message: "Cupos e información actualizados." });
                }

                // 6. Eliminar Invitado
                // DELETE /api/admin/guests/:id
                if (guestUpdateMatch && request.method === "DELETE") {
                    const guestId = Number(guestUpdateMatch[1]);
                    await env.DB.prepare(`DELETE FROM guests WHERE id = ?`).bind(guestId).run();
                    return jsonResponse({ success: true, message: "Invitado eliminado." });
                }

                // 7. Enviar o Publicar Anuncio / Noticia Masiva
                // POST /api/admin/broadcasts
                if (url.pathname === "/api/admin/broadcasts" && request.method === "POST") {
                    const body: any = await request.json();
                    const title = String(body.title || "").trim();
                    const content = String(body.content || "").trim();
                    const badge = String(body.badge_label || "AVISO").trim();
                    const audience = String(body.audience || "all").trim();

                    if (!title || !content) {
                        return jsonResponse({ error: "Título y contenido requeridos." }, 400);
                    }

                    const info = await env.DB.prepare(
                        `INSERT INTO broadcasts (title, content, badge_label, audience) VALUES (?, ?, ?, ?)`
                    ).bind(title, content, badge, audience).run();

                    return jsonResponse({ success: true, id: info.meta.last_row_id });
                }

                // 8. Notificación Directa a un Invitado (Cambio de pases, recordatorio, etc.)
                // POST /api/admin/notify
                if (url.pathname === "/api/admin/notify" && request.method === "POST") {
                    const body: any = await request.json();
                    const guestId = Number(body.guest_id);
                    const message = String(body.message || "").trim();
                    const type = String(body.notification_type || "seats_update").trim();

                    if (!guestId || !message) {
                        return jsonResponse({ error: "Invitado y mensaje requeridos." }, 400);
                    }

                    const guest: any = await env.DB.prepare(
                        `SELECT * FROM guests WHERE id = ?`
                    ).bind(guestId).first();

                    if (!guest) {
                        return jsonResponse({ error: "Invitado no encontrado." }, 404);
                    }

                    await env.DB.prepare(
                        `INSERT INTO notifications (guest_id, message, notification_type) VALUES (?, ?, ?)`
                    ).bind(guestId, message, type).run();

                    // Generar enlace prehecho de WhatsApp por si se quiere enviar con 1 clic
                    let waLink = "";
                    if (guest.phone) {
                        const cleanPhone = guest.phone.replace(/\D/g, "");
                        waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
                    }

                    return jsonResponse({ 
                        success: true, 
                        message: "Notificación registrada.", 
                        whatsapp_link: waLink 
                    });
                }
            }

            return jsonResponse({ error: "Endpoint no encontrado." }, 404);
        } catch (err: any) {
            return jsonResponse({ error: err.message || "Error interno del servidor." }, 500);
        }
    },
};
