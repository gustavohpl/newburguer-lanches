// ==========================================
// 🚀 SERVIDOR DELIVERY MULTI-TENANT
// Modularização v5 — Orquestrador puro (~50 linhas)
// 7 sub-routers + 9 módulos extraídos
// Última atualização: 2026-02-10
// ==========================================

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";

// Sub-routers
import authRoutes from "./routes_auth.tsx";
import productRoutes from "./routes_products.tsx";
import orderRoutes from "./routes_orders.tsx";
import deliveryRoutes from "./routes_delivery.tsx";
import configRoutes from "./routes_config.tsx";
import securityRoutes from "./routes_security.tsx";
import testRoutes from "./routes_tests.tsx";
import metaRoutes from "./meta_routes.tsx";
import mercadoPagoRoutes from "./mercadopago.tsx";
import { comEscopo, definirEscopo } from "./kv_retry.tsx";
import { acharCidade, entrarNaUnidade, escopoDoPedido } from "./franquia.tsx";

// ==========================================
// 🔗 API — Monta todos os sub-routers
// ==========================================

const api = new Hono();

// Franquia: unidade (Admin/entregador) ou cidade (cliente) do cabeçalho viram o escopo do banco;
// rotas com sessão trocam pela unidade da sessão e rotas de um pedido usam a unidade dona dele
api.use('*', (c: any, next: any) => comEscopo(null, null, async () => {
  const unidade = c.req.header('X-Unit-Id'), cidade = c.req.header('X-City-Id');
  if (unidade) await entrarNaUnidade(unidade);
  else if (cidade && await acharCidade(cidade)) definirEscopo(null, cidade);
  const doPedido = c.req.path.match(/\/(?:orders|payment\/mp\/status)\/([A-Za-z0-9_-]+)/)?.[1];
  if (doPedido && doPedido !== 'search') await escopoDoPedido(doPedido);
  return next();
}));

// Middleware: injeta header X-New-CSRF-Token quando o middleware de auth requisita rotação
api.use('*', async (c: any, next: any) => {
  await next();
  const newCsrf = c.get('_newCsrf');
  if (newCsrf && c.res) {
    try {
      const hdrs = new Headers(c.res.headers);
      hdrs.set('X-New-CSRF-Token', newCsrf);
      c.res = new Response(c.res.body, { status: c.res.status, statusText: c.res.statusText, headers: hdrs });
    } catch (e) {
      console.warn('⚠️ [CSRF] Falha ao injetar header de rotação:', e);
    }
  }
});

// Montar sub-routers
api.route('/', authRoutes);       // health, login admin/master, audit-logs, blacklist/whitelist, security-alert, server/ip
api.route('/', productRoutes);    // products CRUD, categories, migrate-scale
api.route('/', orderRoutes);      // orders CRUD, reviews, customers
api.route('/', deliveryRoutes);   // delivery login/logout, drivers, sectors, delivery-fee
api.route('/', configRoutes);     // config, coupons, store, payment, upload, stock, settings, estimates
api.route('/', securityRoutes);   // IP reputation, webhooks, analytics
api.route('/', testRoutes);       // 80 unit tests + 3 E2E tests + history
api.route('/', metaRoutes);       // tráfego pago (campanhas) — só Admin
api.route('/', mercadoPagoRoutes); // pagamento automático Mercado Pago (Pix, cartão, webhook)

// ==========================================
// 🚀 APP — CORS, Logger, Mount
// ==========================================

const app = new Hono();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Master-Token', 'X-Admin-Token', 'X-CSRF-Token', 'X-Driver-Token', 'X-Unit-Id', 'X-City-Id'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision', 'X-New-CSRF-Token'],
  maxAge: 600,
}));

app.use('*', logger(console.log));

app.route('/server', api);
app.route('/make-server-dfe23da2', api);
app.route('/', api);

Deno.serve(app.fetch);
