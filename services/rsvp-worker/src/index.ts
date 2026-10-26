export interface Env {
    DB: D1Database;
    ADMIN_SECRET?: string;
}

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: CORS_HEADERS });
        }

        const url = new URL(request.url);

        try {
            // 1. Endpoint: Buscar nombres en la Selección oficial
            // GET /api/guests/search?q=silva
            if (url.pathname === "/api/guests/search" && request.method === "GET") {
                const query = (url.searchParams.get("q") || "").trim();
                if (!query || query.length < 2) {
                    return jsonResponse({ guests: [] });
                }

                const { results } = await env.DB.prepare(
                    `SELECT id, full_name, allowed_seats, confirmed 
                     FROM guests 
                     WHERE full_name LIKE ? 
                     LIMIT 8`
                ).bind(`%${query}%`).all();

                return jsonResponse({ guests: results || [] });
            }

            // 2. Endpoint: Confirmar asistencia con verificación de los 4 dígitos
            // POST /api/guests/confirm
            if (url.pathname === "/api/guests/confirm" && request.method === "POST") {
                const body: any = await request.json();
                const guestId = Number(body.guest_id);
                const last4 = String(body.phone_last4 || "").trim();
                const attendingSeats = Number(body.attending_seats || 1);
                const note = String(body.note || "").trim().slice(0, 300);

                if (!guestId || last4.length !== 4) {
                    return jsonResponse({ error: "Datos incompletos o formato incorrecto." }, 400);
                }

                // Obtener invitado
                const guest: any = await env.DB.prepare(
                    `SELECT * FROM guests WHERE id = ?`
                ).bind(guestId).first();

                if (!guest) {
                    return jsonResponse({ error: "El invitado no fue encontrado en la Selección oficial." }, 404);
                }

                if (guest.confirmed === 1) {
                    return jsonResponse({ 
                        error: "Esta invitación ya fue confirmada previamente. Gracias por tu respuesta.",
                        already_confirmed: true 
                    }, 409);
                }

                // Verificar identidad con los últimos 4 dígitos
                if (guest.phone_last4 !== last4) {
                    return jsonResponse({ 
                        error: "Los dígitos de verificación no coinciden con el registro autorizado." 
                    }, 403);
                }

                // Validar cupos permitidos
                const finalSeats = Math.min(attendingSeats, guest.allowed_seats || 1);

                // Bloquear y registrar confirmación
                await env.DB.prepare(
                    `UPDATE guests 
                     SET confirmed = 1, 
                         confirmed_seats = ?, 
                         note = ?, 
                         confirmed_at = datetime('now') 
                     WHERE id = ?`
                ).bind(finalSeats, note, guestId).run();

                const passToken = `VIP-LM-${String(guest.id).padStart(3, "0")}-${last4.slice(2)}`;

                return jsonResponse({
                    success: true,
                    message: "Asistencia validada y confirmada con éxito.",
                    guest_name: guest.full_name,
                    seats: finalSeats,
                    pass_token: passToken,
                });
            }

            // 3. Endpoint: Resumen de Asistencias (Admin)
            // GET /api/admin/summary?token=limon_secret_admin_token_2026
            if (url.pathname === "/api/admin/summary" && request.method === "GET") {
                const token = url.searchParams.get("token") || request.headers.get("Authorization");
                if (token !== env.ADMIN_SECRET) {
                    return jsonResponse({ error: "No autorizado." }, 401);
                }

                const { results: confirmed } = await env.DB.prepare(
                    `SELECT id, full_name, confirmed_seats, note, confirmed_at 
                     FROM guests 
                     WHERE confirmed = 1 
                     ORDER BY confirmed_at DESC`
                ).all();

                const { results: pending } = await env.DB.prepare(
                    `SELECT id, full_name, allowed_seats 
                     FROM guests 
                     WHERE confirmed = 0 
                     ORDER BY full_name ASC`
                ).all();

                return jsonResponse({
                    total_confirmed_guests: confirmed?.length || 0,
                    confirmed_list: confirmed || [],
                    pending_list: pending || [],
                });
            }

            return jsonResponse({ error: "Endpoint no encontrado." }, 404);
        } catch (err: any) {
            return jsonResponse({ error: err.message || "Error interno del servidor." }, 500);
        }
    },
};
