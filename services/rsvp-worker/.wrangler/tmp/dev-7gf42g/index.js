var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
var src_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    try {
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
      if (url.pathname === "/api/guests/confirm" && request.method === "POST") {
        const body = await request.json();
        const guestId = Number(body.guest_id);
        const last4 = String(body.phone_last4 || "").trim();
        const attendingSeats = Number(body.attending_seats || 1);
        const note = String(body.note || "").trim().slice(0, 300);
        if (!guestId || last4.length !== 4) {
          return jsonResponse({ error: "Datos incompletos o formato incorrecto." }, 400);
        }
        const guest = await env.DB.prepare(
          `SELECT * FROM guests WHERE id = ?`
        ).bind(guestId).first();
        if (!guest) {
          return jsonResponse({ error: "El invitado no fue encontrado en la Selecci\xF3n oficial." }, 404);
        }
        if (guest.confirmed === 1) {
          return jsonResponse({
            error: "Esta invitaci\xF3n ya fue confirmada previamente. Gracias por tu respuesta.",
            already_confirmed: true
          }, 409);
        }
        if (guest.phone_last4 !== last4) {
          return jsonResponse({
            error: "Los d\xEDgitos de verificaci\xF3n no coinciden con el registro autorizado."
          }, 403);
        }
        const finalSeats = Math.min(attendingSeats, guest.allowed_seats || 1);
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
          message: "Asistencia validada y confirmada con \xE9xito.",
          guest_name: guest.full_name,
          seats: finalSeats,
          pass_token: passToken
        });
      }
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
          pending_list: pending || []
        });
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

// .wrangler/tmp/bundle-aY6EyX/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-aY6EyX/middleware-loader.entry.ts
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
