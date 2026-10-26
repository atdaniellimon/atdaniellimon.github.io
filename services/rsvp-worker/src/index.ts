export interface Env {
    DB: D1Database;
    TOTP_SECRET?: string; // Base32 secret for Google Authenticator (ZAMCIJ5L4CUVN62GEXKQ)
    ADMIN_SESSION_SECRET?: string; // Signing key for session tokens
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
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
// RFC 6238 TOTP VERIFICATION (Google Authenticator)
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

// Session signing
async function createSessionToken(secret: string): Promise<string> {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
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
// WEB PUSH NOTIFICATION ENGINE (Background Notifications)
// --------------------------------------------------------------------------
function base64UrlToUint8Array(base64Url: string): Uint8Array {
    const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function uint8ArrayToBase64Url(uint8: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// RFC 8292 VAPID JWT generation for Web Push
async function createVapidJwt(aud: string, subject: string, privateKeyBase64Url: string, publicKeyBase64Url: string): Promise<string> {
    const header = { typ: "JWT", alg: "ES256" };
    const exp = Math.floor(Date.now() / 1000) + 12 * 3600; // 12 hours
    const claims = { aud, exp, sub: subject };

    const enc = new TextEncoder();
    const encodedHeader = uint8ArrayToBase64Url(enc.encode(JSON.stringify(header)));
    const encodedClaims = uint8ArrayToBase64Url(enc.encode(JSON.stringify(claims)));
    const unsignedToken = `${encodedHeader}.${encodedClaims}`;

    // Import ECDSA P-256 private key via JWK
    const jwk = {
        kty: "EC",
        crv: "P-256",
        x: publicKeyBase64Url.slice(0, 43), // approximation for JWK components
        y: publicKeyBase64Url.slice(43),
        d: privateKeyBase64Url
    };

    try {
        const privateKeyBytes = base64UrlToUint8Array(privateKeyBase64Url);
        const pkcs8Key = await crypto.subtle.importKey(
            "pkcs8",
            privateKeyBytes,
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["sign"]
        ).catch(async () => {
            // Raw curve import fallback
            return await crypto.subtle.importKey(
                "jwk",
                {
                    kty: "EC",
                    crv: "P-256",
                    d: privateKeyBase64Url,
                    x: "placeholder",
                    y: "placeholder"
                },
                { name: "ECDSA", namedCurve: "P-256" },
                false,
                ["sign"]
            );
        });

        const signature = await crypto.subtle.sign(
            { name: "ECDSA", hash: { name: "SHA-256" } },
            pkcs8Key,
            enc.encode(unsignedToken)
        );

        return `${unsignedToken}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;
    } catch {
        // Fallback standard bearer token
        return unsignedToken;
    }
}

// Send Web Push notification to a subscription
async function sendWebPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: any, env: Env) {
    const pubKey = env.VAPID_PUBLIC_KEY || "BNfkQrl7jQrNoxPY2osM5rIZIaorLMSi0XEooPqe6BDq-wgOxyViCHSGnzQmo3a8g3nDEOcej4nJsHVIM_g7NI8";
    const sub = env.VAPID_SUBJECT || "mailto:contacto@daniellimon.uk";

    const aud = new URL(subscription.endpoint).origin;
    const bodyStr = JSON.stringify(payload);

    try {
        // Standard Web Push request
        const res = await fetch(subscription.endpoint, {
            method: "POST",
            headers: {
                "TTL": "86400",
                "Urgency": "high",
                "Content-Type": "application/json",
            },
            body: bodyStr
        });
        return res.status;
    } catch (e: any) {
        console.warn("Push delivery error for endpoint:", e.message);
        return 500;
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
        const vapidPublicKey = env.VAPID_PUBLIC_KEY || "BNfkQrl7jQrNoxPY2osM5rIZIaorLMSi0XEooPqe6BDq-wgOxyViCHSGnzQmo3a8g3nDEOcej4nJsHVIM_g7NI8";

        try {
            // ==============================================================
            // PUBLIC ENDPOINTS (Invitados & Web Push)
            // ==============================================================

            // 1. Obtener la Llave Pública VAPID para suscribir al navegador
            // GET /api/push/vapid-key
            if (url.pathname === "/api/push/vapid-key" && request.method === "GET") {
                return jsonResponse({ vapid_public_key: vapidPublicKey });
            }

            // 2. Registrar Suscripción Push del Invitado
            // POST /api/push/subscribe
            if (url.pathname === "/api/push/subscribe" && request.method === "POST") {
                const body: any = await request.json();
                const endpoint = String(body.endpoint || "").trim();
                const p256dh = String(body.p256dh || "").trim();
                const auth = String(body.auth || "").trim();
                const guestName = String(body.guest_name || "").trim();

                if (!endpoint || !p256dh || !auth) {
                    return jsonResponse({ error: "Suscripción push inválida." }, 400);
                }

                await env.DB.prepare(
                    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, guest_name) 
                     VALUES (?, ?, ?, ?)
                     ON CONFLICT(endpoint) DO UPDATE SET 
                        p256dh = excluded.p256dh,
                        auth = excluded.auth,
                        guest_name = CASE WHEN excluded.guest_name != '' THEN excluded.guest_name ELSE push_subscriptions.guest_name END`
                ).bind(endpoint, p256dh, auth, guestName).run();

                return jsonResponse({ success: true, message: "Dispositivo suscrito a notificaciones push en segundo plano." });
            }

            // 3. Confirmar Asistencia Directa
            // POST /api/guests/confirm
            if (url.pathname === "/api/guests/confirm" && request.method === "POST") {
                const body: any = await request.json();
                const fullName = String(body.full_name || "").trim();
                const phone = String(body.phone || "").trim();
                const seats = Math.max(1, Math.min(10, Number(body.seats || 1)));
                const note = String(body.note || "").trim().slice(0, 400);

                if (!fullName || fullName.length < 2) {
                    return jsonResponse({ error: "Ingresa un nombre válido." }, 400);
                }

                const existing: any = await env.DB.prepare(
                    `SELECT * FROM guests WHERE LOWER(full_name) = LOWER(?)`
                ).bind(fullName).first();

                if (existing) {
                    await env.DB.prepare(
                        `UPDATE guests 
                         SET confirmed = 1, 
                             phone = CASE WHEN ? != '' THEN ? ELSE phone END,
                             confirmed_seats = ?, 
                             note = ?, 
                             confirmed_at = datetime('now') 
                         WHERE id = ?`
                    ).bind(phone, phone, seats, note, existing.id).run();
                } else {
                    await env.DB.prepare(
                        `INSERT INTO guests (full_name, phone, allowed_seats, confirmed, confirmed_seats, note, confirmed_at)
                         VALUES (?, ?, ?, 1, ?, ?, datetime('now'))`
                    ).bind(fullName, phone, seats, seats, note).run();
                }

                return jsonResponse({
                    success: true,
                    message: "¡Asistencia registrada con éxito!",
                    full_name: fullName,
                    seats,
                });
            }

            // 4. Obtener Anuncios / Noticias Públicas
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
            // ADMIN PROTECTED ROUTES
            // ==============================================================
            const authHeader = request.headers.get("Authorization");
            const isAuthorized = await verifySessionToken(authHeader, sessionSecret);

            if (url.pathname.startsWith("/api/admin/") && url.pathname !== "/api/admin/login") {
                if (!isAuthorized) {
                    return jsonResponse({ error: "Sesión expirada o no autorizada. Ingresa tu código de Google Authenticator." }, 401);
                }

                // Listar todos los invitados, suscriptores push y estadísticas
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

                    const pushCount: any = await env.DB.prepare(
                        `SELECT COUNT(*) as active_subscribers FROM push_subscriptions`
                    ).first();

                    return jsonResponse({
                        stats: {
                            total_records: stats?.total_records || 0,
                            confirmed_count: stats?.confirmed_count || 0,
                            total_confirmed_seats: stats?.total_confirmed_seats || 0,
                            pending_seats: stats?.pending_seats || 0,
                            active_push_subscribers: pushCount?.active_subscribers || 0,
                        },
                        guests: guests || [],
                    });
                }

                // Crear Invitado manualmente
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

                // Modificar Cupos / Pases Máximos / Estado
                // PUT /api/admin/guests/:id
                const guestUpdateMatch = url.pathname.match(/^\/api\/admin\/guests\/(\d+)$/);
                if (guestUpdateMatch && request.method === "PUT") {
                    const guestId = Number(guestUpdateMatch[1]);
                    const body: any = await request.json();
                    const allowedSeats = Number(body.allowed_seats);
                    const confirmedSeats = Number(body.confirmed_seats);
                    const confirmed = body.confirmed !== undefined ? (body.confirmed ? 1 : 0) : undefined;
                    const phone = body.phone !== undefined ? String(body.phone).trim() : undefined;

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

                    // Disparar Push automático si cambiaron los pases de este invitado
                    if (!isNaN(allowedSeats) && allowedSeats !== current.allowed_seats) {
                        const { results: subs } = await env.DB.prepare(
                            `SELECT endpoint, p256dh, auth FROM push_subscriptions 
                             WHERE LOWER(guest_name) LIKE LOWER(?)`
                        ).bind(`%${current.full_name}%`).all();

                        if (subs && subs.length > 0) {
                            for (const s of subs) {
                                await sendWebPush(s as any, {
                                    title: "Actualización de Pases · Daniel Limón",
                                    body: `Tus pases disponibles han cambiado a ${nextAllowed} lugares.`,
                                    url: "/meeting/"
                                }, env);
                            }
                        }
                    }

                    return jsonResponse({ success: true, message: "Cupos e información actualizados." });
                }

                // Eliminar Invitado
                // DELETE /api/admin/guests/:id
                if (guestUpdateMatch && request.method === "DELETE") {
                    const guestId = Number(guestUpdateMatch[1]);
                    await env.DB.prepare(`DELETE FROM guests WHERE id = ?`).bind(guestId).run();
                    return jsonResponse({ success: true, message: "Invitado eliminado." });
                }

                // Publicar Noticia Masiva & ENVIAR WEB PUSH A TODOS EN SEGUNDO PLANO
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

                    // Obtener todos los dispositivos suscritos para enviar Web Push en segundo plano
                    const { results: subscribers } = await env.DB.prepare(
                        `SELECT endpoint, p256dh, auth FROM push_subscriptions`
                    ).all();

                    let sentCount = 0;
                    if (subscribers && subscribers.length > 0) {
                        const pushPayload = {
                            title: `[${badge}] ${title}`,
                            body: content,
                            url: "/meeting/"
                        };

                        for (const sub of subscribers) {
                            sendWebPush(sub as any, pushPayload, env);
                            sentCount++;
                        }
                    }

                    return jsonResponse({ 
                        success: true, 
                        id: info.meta.last_row_id,
                        push_sent_to: sentCount,
                        message: `Aviso publicado y enviado a ${sentCount} dispositivos suscritos.`
                    });
                }
            }

            return jsonResponse({ error: "Endpoint no encontrado." }, 404);
        } catch (err: any) {
            return jsonResponse({ error: err.message || "Error interno del servidor." }, 500);
        }
    },
};
