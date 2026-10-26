var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS
    }
  });
}
__name(jsonResponse, "jsonResponse");
function base32Decode(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of base32.toUpperCase().replace(/=/g, "")) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}
__name(base32Decode, "base32Decode");
async function verifyTOTP(token, secretBase32) {
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
  const currentTimeStep = Math.floor(Date.now() / 1e3 / 30);
  for (const drift of [-1, 0, 1]) {
    const timeVal = BigInt(currentTimeStep + drift);
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigUint64(0, timeVal, false);
    const signature = await crypto.subtle.sign("HMAC", key, buffer);
    const hash = new Uint8Array(signature);
    const offset = hash[hash.length - 1] & 15;
    const codeNum = (hash[offset] & 127) << 24 | (hash[offset + 1] & 255) << 16 | (hash[offset + 2] & 255) << 8 | hash[offset + 3] & 255;
    const candidateCode = String(codeNum % 1e6).padStart(6, "0");
    if (candidateCode === cleanToken) {
      return true;
    }
  }
  return false;
}
__name(verifyTOTP, "verifyTOTP");
async function createSessionToken(secret) {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1e3;
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
  const sigHex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return btoa(JSON.stringify({ payload, sig: sigHex }));
}
__name(createSessionToken, "createSessionToken");
async function verifySessionToken(token, secret) {
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
      sig.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    );
    return await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payload));
  } catch {
    return false;
  }
}
__name(verifySessionToken, "verifySessionToken");
var src_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    const totpSecret = env.TOTP_SECRET || "ZAMCIJ5L4CUVN62GEXKQ";
    const sessionSecret = env.ADMIN_SESSION_SECRET || "limon_secret_session_key_2026";
    try {
      if (url.pathname === "/api/guests/confirm" && request.method === "POST") {
        const body = await request.json();
        const fullName = String(body.full_name || "").trim();
        const seats = Math.max(1, Math.min(10, Number(body.seats || 1)));
        const note = String(body.note || "").trim().slice(0, 400);
        if (!fullName || fullName.length < 2) {
          return jsonResponse({ error: "Ingresa un nombre v\xE1lido." }, 400);
        }
        const existing = await env.DB.prepare(
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
          message: "\xA1Asistencia registrada con \xE9xito!",
          full_name: fullName,
          seats
        });
      }
      if (url.pathname === "/api/broadcasts" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          `SELECT id, title, content, badge_label, created_at 
                     FROM broadcasts 
                     ORDER BY created_at DESC 
                     LIMIT 10`
        ).all();
        return jsonResponse({ broadcasts: results || [] });
      }
      if (url.pathname === "/api/admin/login" && request.method === "POST") {
        const body = await request.json();
        const pin = String(body.pin || "").trim();
        const isValid = await verifyTOTP(pin, totpSecret);
        if (!isValid) {
          return jsonResponse({ error: "C\xF3digo de Google Authenticator incorrecto o expirado." }, 401);
        }
        const token = await createSessionToken(sessionSecret);
        return jsonResponse({
          success: true,
          message: "Acceso concedido.",
          token
        });
      }
      const authHeader = request.headers.get("Authorization");
      const isAuthorized = await verifySessionToken(authHeader, sessionSecret);
      if (url.pathname.startsWith("/api/admin/") && url.pathname !== "/api/admin/login") {
        if (!isAuthorized) {
          return jsonResponse({ error: "Sesi\xF3n expirada o no autorizada. Ingresa tu c\xF3digo de Google Authenticator." }, 401);
        }
        if (url.pathname === "/api/admin/guests" && request.method === "GET") {
          const { results: guests } = await env.DB.prepare(
            `SELECT id, full_name, phone, allowed_seats, confirmed, confirmed_seats, note, confirmed_at, created_at 
                         FROM guests 
                         ORDER BY confirmed DESC, full_name ASC`
          ).all();
          const stats = await env.DB.prepare(
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
              pending_seats: stats?.pending_seats || 0
            },
            guests: guests || []
          });
        }
        if (url.pathname === "/api/admin/guests" && request.method === "POST") {
          const body = await request.json();
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
          } catch (e) {
            return jsonResponse({ error: "Ya existe un invitado con ese nombre." }, 400);
          }
        }
        const guestUpdateMatch = url.pathname.match(/^\/api\/admin\/guests\/(\d+)$/);
        if (guestUpdateMatch && request.method === "PUT") {
          const guestId = Number(guestUpdateMatch[1]);
          const body = await request.json();
          const allowedSeats = Number(body.allowed_seats);
          const confirmedSeats = Number(body.confirmed_seats);
          const confirmed = body.confirmed !== void 0 ? body.confirmed ? 1 : 0 : void 0;
          const phone = body.phone !== void 0 ? String(body.phone).trim() : void 0;
          const current = await env.DB.prepare(
            `SELECT * FROM guests WHERE id = ?`
          ).bind(guestId).first();
          if (!current) {
            return jsonResponse({ error: "Invitado no encontrado." }, 404);
          }
          const nextAllowed = isNaN(allowedSeats) || allowedSeats === 0 ? current.allowed_seats || 1 : Math.max(1, allowedSeats);
          const nextConfirmed = confirmed !== void 0 ? confirmed : current.confirmed || 0;
          const nextConfirmedSeats = isNaN(confirmedSeats) ? current.confirmed_seats || 0 : Math.max(0, confirmedSeats);
          const nextPhone = phone !== void 0 ? phone : current.phone || "";
          await env.DB.prepare(
            `UPDATE guests 
                         SET allowed_seats = ?, confirmed = ?, confirmed_seats = ?, phone = ? 
                         WHERE id = ?`
          ).bind(nextAllowed, nextConfirmed, nextConfirmedSeats, nextPhone, guestId).run();
          return jsonResponse({ success: true, message: "Cupos e informaci\xF3n actualizados." });
        }
        if (guestUpdateMatch && request.method === "DELETE") {
          const guestId = Number(guestUpdateMatch[1]);
          await env.DB.prepare(`DELETE FROM guests WHERE id = ?`).bind(guestId).run();
          return jsonResponse({ success: true, message: "Invitado eliminado." });
        }
        if (url.pathname === "/api/admin/broadcasts" && request.method === "POST") {
          const body = await request.json();
          const title = String(body.title || "").trim();
          const content = String(body.content || "").trim();
          const badge = String(body.badge_label || "AVISO").trim();
          const audience = String(body.audience || "all").trim();
          if (!title || !content) {
            return jsonResponse({ error: "T\xEDtulo y contenido requeridos." }, 400);
          }
          const info = await env.DB.prepare(
            `INSERT INTO broadcasts (title, content, badge_label, audience) VALUES (?, ?, ?, ?)`
          ).bind(title, content, badge, audience).run();
          return jsonResponse({ success: true, id: info.meta.last_row_id });
        }
        if (url.pathname === "/api/admin/notify" && request.method === "POST") {
          const body = await request.json();
          const guestId = Number(body.guest_id);
          const message = String(body.message || "").trim();
          const type = String(body.notification_type || "seats_update").trim();
          if (!guestId || !message) {
            return jsonResponse({ error: "Invitado y mensaje requeridos." }, 400);
          }
          const guest = await env.DB.prepare(
            `SELECT * FROM guests WHERE id = ?`
          ).bind(guestId).first();
          if (!guest) {
            return jsonResponse({ error: "Invitado no encontrado." }, 404);
          }
          await env.DB.prepare(
            `INSERT INTO notifications (guest_id, message, notification_type) VALUES (?, ?, ?)`
          ).bind(guestId, message, type).run();
          let waLink = "";
          if (guest.phone) {
            const cleanPhone = guest.phone.replace(/\D/g, "");
            waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
          }
          return jsonResponse({
            success: true,
            message: "Notificaci\xF3n registrada.",
            whatsapp_link: waLink
          });
        }
      }
      return jsonResponse({ error: "Endpoint no encontrado." }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message || "Error interno del servidor." }, 500);
    }
  }
};

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-UAZdlk/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-UAZdlk/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
