// Pagamento automático pelo Mercado Pago (mesmo desenho do Engaja Aí):
// - o valor sai sempre do pedido salvo no servidor, nunca do navegador;
// - Pix pela API de pagamentos; cartão pelo Checkout Pro (o cartão nunca passa por aqui);
// - confirmação só depois de buscar o pagamento na API do MP (webhook com assinatura ou consulta de status);
// - pago = pedido continua na cozinha com paymentStatus 'paid' (nunca é concluído/arquivado por isso).
import { Hono } from "npm:hono";
import * as kv from "./kv_retry.tsx";
import { success, error } from "./server_utils.tsx";
import { requireMaster } from "./middleware.tsx";

// MP_API_URL só existe no ambiente de teste (simulador local da API)
const API = Deno.env.get("MP_API_URL") || "https://api.mercadopago.com";
const SEGREDOS = "mp_segredos";

type Segredos = { accessToken?: string; webhookSecret?: string; atualizadoEm?: string };
type PagamentoMP = {
  id: number;
  status: string; // pending | approved | authorized | in_process | in_mediation | rejected | cancelled | refunded | charged_back
  transaction_amount: number;
  external_reference: string | null;
  payment_type_id?: string;
  date_of_expiration?: string;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
};
type Registro = {
  gateway: "mercadopago"; tipo: "pix" | "cartao"; valor: number; status: string;
  paymentId?: string; preferenceId?: string; qrCode?: string; copiaECola?: string; expiraEm?: string;
  criadoEm: string; atualizadoEm: string;
};

class MercadoPagoError extends Error {}

export const segredosMP = async (): Promise<Segredos> => (await kv.get(SEGREDOS) as Segredos) || {};

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const { accessToken } = await segredosMP();
  if (!accessToken) throw new MercadoPagoError("Mercado Pago não configurado (Master → Integrações).");
  const resp = await fetch(API + caminho, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(20_000),
  });
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) throw new MercadoPagoError(`Mercado Pago HTTP ${resp.status}: ${dados?.message ?? "sem detalhe"}`);
  return dados as T;
}

// MP quer a data como 2026-09-28T18:00:00.000-03:00
const dataBrasilia = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().replace("Z", "-03:00");

const pedidoSalvo = async (id: string): Promise<any> => (await kv.get(`order:${id}`)) || (await kv.get(`archive:${id}`));

// parte do pedido paga nesta forma (no misto, só a parte dela)
export function valorDaForma(order: any, forma: "pix" | "card"): number {
  const total = Number(order?.total) || 0;
  if (order?.splitPayment) {
    const a1 = Number(order.splitAmount1) || 0;
    const a2 = Number(order.splitAmount2) || Number((total - a1).toFixed(2));
    return order.splitMethod1 === forma ? a1 : order.splitMethod2 === forma ? a2 : 0;
  }
  return order?.paymentMethod === forma ? total : 0;
}

// o Admin vê o selo "aguardando pagamento online" enquanto o cliente paga
async function marcarAguardando(order: any) {
  if (order.paymentStatus === "paid" || !(await kv.get(`order:${order.orderId}`))) return;
  await kv.set(`order:${order.orderId}`, { ...order, paymentStatus: "aguardando", paymentGateway: "mercadopago" });
}

const urlWebhook = () => `${Deno.env.get("SUPABASE_URL")}/functions/v1/make-server-dfe23da2/payment/mp/webhook`;

// https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
async function assinaturaValida(req: Request, dataId: string): Promise<boolean> {
  const { webhookSecret } = await segredosMP();
  const header = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id");
  if (!webhookSecret || !header || !requestId || !dataId) return false;
  const partes = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;
  const tsMs = Number(ts) > 1e12 ? Number(ts) : Number(ts) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60_000) return false; // replay
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`id:${id};request-id:${requestId};ts:${ts};`)));
  const esperado = Array.from(assinatura, (b) => b.toString(16).padStart(2, "0")).join("");
  if (esperado.length !== v1.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ v1.charCodeAt(i);
  return dif === 0;
}

// aplica o status REAL (buscado na API do MP) ao pedido; idempotente
async function aplicarStatus(mp: PagamentoMP): Promise<string> {
  const orderId = String(mp.external_reference || "");
  const reg = await kv.get(`pagamento:${orderId}`) as Registro | null;
  const order = orderId && await pedidoSalvo(orderId);
  if (!reg || !order) return "desconhecido";
  const agora = new Date().toISOString();
  const chaveOrder = (await kv.get(`order:${orderId}`)) ? `order:${orderId}` : `archive:${orderId}`;
  const salvar = async (o: any, r: Registro) => { await kv.set(chaveOrder, { ...o, updatedAt: agora }); await kv.set(`pagamento:${orderId}`, { ...r, atualizadoEm: agora }); };

  if (mp.status === "approved") {
    if (order.paymentStatus === "paid") return "ja_confirmado";
    if (Math.abs(Number(mp.transaction_amount) - Number(reg.valor)) > 0.01) {
      await salvar({ ...order, paymentStatus: "divergente", paymentNote: `Pago R$ ${mp.transaction_amount} no Mercado Pago, esperado R$ ${reg.valor} — conferir` }, { ...reg, status: "divergente", paymentId: String(mp.id) });
      return "divergente";
    }
    await salvar(
      { ...order, paymentStatus: "paid", paymentGateway: "mercadopago", paymentId: String(mp.id), paidAmount: Number(mp.transaction_amount), paidAt: agora, paymentType: reg.tipo },
      { ...reg, status: "approved", paymentId: String(mp.id) },
    );
    return "confirmado";
  }
  if (mp.status === "rejected" || mp.status === "cancelled") {
    if (order.paymentStatus !== "paid") await salvar({ ...order, paymentStatus: "recusado" }, { ...reg, status: mp.status, paymentId: String(mp.id) });
    return "recusado";
  }
  if (mp.status === "refunded" || mp.status === "charged_back") {
    await salvar({ ...order, paymentStatus: "estornado", paymentNote: mp.status === "refunded" ? "Pagamento devolvido no Mercado Pago" : "Pagamento contestado (chargeback)" }, { ...reg, status: mp.status });
    return "estornado";
  }
  return "pendente";
}

const router = new Hono();

router.post("/payment/mp/pix", async (c) => {
  try {
    const { orderId } = await c.req.json();
    const order = await pedidoSalvo(String(orderId || ""));
    if (!order) return error(c, "Pedido não encontrado", 404);
    if (order.paymentStatus === "paid") return success(c, { status: "paid" });
    const valor = Number(valorDaForma(order, "pix").toFixed(2));
    if (!(valor > 0)) return error(c, "Este pedido não tem valor a pagar em Pix", 400);

    const atual = await kv.get(`pagamento:${order.orderId}`) as Registro | null;
    if (atual?.tipo === "pix" && atual.status === "pending" && atual.qrCode && atual.expiraEm && new Date(atual.expiraEm).getTime() > Date.now() + 60_000) {
      return success(c, { qrCode: atual.qrCode, copyPaste: atual.copiaECola, expiresAt: atual.expiraEm, valor });
    }
    const host = (() => { try { return new URL(c.req.header("origin") || "").hostname.replace(/^www\./, ""); } catch { return ""; } })() || "pedidos.app";
    const expiraEm = new Date(Date.now() + 30 * 60_000);
    const mp = await chamar<PagamentoMP>("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": `pix-${order.orderId}-${Date.now()}` },
      body: JSON.stringify({
        transaction_amount: valor,
        description: `Pedido ${order.orderId}`,
        payment_method_id: "pix",
        payer: { email: `pedido-${String(order.orderId).toLowerCase()}@${host}`, first_name: String(order.customerName || "Cliente").slice(0, 60) },
        external_reference: order.orderId,
        date_of_expiration: dataBrasilia(expiraEm),
        notification_url: urlWebhook(),
      }),
    });
    const t = mp.point_of_interaction?.transaction_data;
    if (!t?.qr_code) return error(c, "Mercado Pago não devolveu o QR Code do Pix", 502);
    const agora = new Date().toISOString();
    await kv.set(`pagamento:${order.orderId}`, {
      gateway: "mercadopago", tipo: "pix", valor, status: "pending", paymentId: String(mp.id),
      qrCode: t.qr_code_base64 || "", copiaECola: t.qr_code, expiraEm: mp.date_of_expiration || expiraEm.toISOString(), criadoEm: agora, atualizadoEm: agora,
    } satisfies Registro);
    await marcarAguardando(order);
    return success(c, { qrCode: t.qr_code_base64 || "", copyPaste: t.qr_code, expiresAt: mp.date_of_expiration || expiraEm.toISOString(), valor });
  } catch (e) {
    console.error("❌ [MP] pix:", e);
    return error(c, e instanceof MercadoPagoError ? e.message : "Erro ao gerar o Pix", e instanceof MercadoPagoError ? 502 : 500);
  }
});

// cartão: página de pagamento do próprio Mercado Pago (Checkout Pro)
router.post("/payment/mp/cartao", async (c) => {
  try {
    const { orderId } = await c.req.json();
    const order = await pedidoSalvo(String(orderId || ""));
    if (!order) return error(c, "Pedido não encontrado", 404);
    if (order.paymentStatus === "paid") return success(c, { status: "paid" });
    const valor = Number(valorDaForma(order, "card").toFixed(2));
    if (!(valor > 0)) return error(c, "Este pedido não tem valor a pagar no cartão", 400);
    const config: any = await kv.get("system_config") || {};
    const origem = (() => { try { return new URL(c.req.header("origin") || "").origin; } catch { return ""; } })();
    if (!origem) return error(c, "Origem inválida", 400);
    const volta = (r: string) => `${origem}/?pedido=${encodeURIComponent(order.orderId)}&pagamento=${r}`;
    const pref = await chamar<{ id: string; init_point: string }>("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({
        items: [{ id: order.orderId, title: `Pedido ${order.orderId} — ${String(config.siteName || "Delivery").slice(0, 60)}`, quantity: 1, unit_price: valor, currency_id: "BRL" }],
        external_reference: order.orderId,
        back_urls: { success: volta("aprovado"), failure: volta("recusado"), pending: volta("pendente") },
        auto_return: "approved",
        notification_url: urlWebhook(),
        payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }, { id: "atm" }], installments: 1 },
        statement_descriptor: String(config.siteName || "DELIVERY").replace(/[^a-z0-9 ]/gi, "").slice(0, 22),
        expires: true, expiration_date_to: dataBrasilia(new Date(Date.now() + 60 * 60_000)),
      }),
    });
    const agora = new Date().toISOString();
    await kv.set(`pagamento:${order.orderId}`, { gateway: "mercadopago", tipo: "cartao", valor, status: "pending", preferenceId: pref.id, criadoEm: agora, atualizadoEm: agora } satisfies Registro);
    await marcarAguardando(order);
    return success(c, { url: pref.init_point });
  } catch (e) {
    console.error("❌ [MP] cartão:", e);
    return error(c, e instanceof MercadoPagoError ? e.message : "Erro ao abrir o pagamento com cartão", e instanceof MercadoPagoError ? 502 : 500);
  }
});

// consulta (o cliente na tela do Pix ou voltando do Checkout Pro com ?payment_id=)
router.get("/payment/mp/status/:orderId", async (c) => {
  try {
    const orderId = c.req.param("orderId");
    const order = await pedidoSalvo(orderId);
    if (!order) return error(c, "Pedido não encontrado", 404);
    if (order.paymentStatus === "paid") return success(c, { status: "paid" });
    const reg = await kv.get(`pagamento:${orderId}`) as Registro | null;
    const paymentId = (c.req.query("payment_id") || reg?.paymentId || "").replace(/\D/g, "");
    if (!reg || !paymentId) return success(c, { status: "pending" });
    const mp = await chamar<PagamentoMP>(`/v1/payments/${paymentId}`);
    if (String(mp.external_reference) !== orderId) return error(c, "Pagamento não pertence a este pedido", 400);
    const r = await aplicarStatus(mp);
    return success(c, { status: r === "confirmado" || r === "ja_confirmado" ? "paid" : r === "recusado" ? "rejected" : r === "divergente" ? "divergent" : "pending" });
  } catch (e) {
    console.error("❌ [MP] status:", e);
    return success(c, { status: "pending" });
  }
});

router.post("/payment/mp/webhook", async (c) => {
  const url = new URL(c.req.url);
  const corpo = await c.req.json().catch(() => ({} as Record<string, any>));
  const tipo = url.searchParams.get("type") ?? corpo.type ?? url.searchParams.get("topic");
  const dataId = url.searchParams.get("data.id") ?? String(corpo.data?.id ?? "");
  if (!(await assinaturaValida(c.req.raw, dataId))) {
    console.warn("🚫 [MP] webhook com assinatura inválida", { tipo, dataId });
    return c.json({ error: "assinatura inválida" }, 401);
  }
  if (tipo !== "payment") return c.json({ ok: true, ignorado: tipo });
  try {
    const r = await aplicarStatus(await chamar<PagamentoMP>(`/v1/payments/${encodeURIComponent(dataId)}`));
    console.log("💳 [MP] webhook", dataId, r);
    return c.json({ ok: true, resultado: r });
  } catch (e) {
    // 500 faz o MP reenviar depois — seguro, a confirmação é idempotente
    console.error("❌ [MP] webhook:", e);
    return c.json({ error: "falha ao processar" }, 500);
  }
});

// Master: token e segredo só entram (nunca voltam para a tela)
router.get("/master/pagamento/mercadopago", requireMaster, async (c) => {
  const s = await segredosMP();
  let conta: Record<string, unknown> | null = null, erroConta = "";
  if (s.accessToken && c.req.query("testar")) {
    try {
      const u = await chamar<{ id: number; nickname?: string; email?: string; site_id?: string }>("/users/me");
      conta = { id: u.id, nome: u.nickname, email: u.email, pais: u.site_id };
    } catch (e) { erroConta = (e as Error).message; }
  }
  return success(c, { temToken: !!s.accessToken, temSegredo: !!s.webhookSecret, atualizadoEm: s.atualizadoEm || null, webhookUrl: urlWebhook(), conta, erroConta });
});

router.post("/master/pagamento/mercadopago", requireMaster, async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const atual = await segredosMP();
  const limpo = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const novo: Segredos = b.apagar
    ? {}
    : { accessToken: limpo(b.accessToken) || atual.accessToken, webhookSecret: limpo(b.webhookSecret) || atual.webhookSecret };
  if (novo.accessToken && !/^(APP_USR|TEST)-[\w-]{20,}$/.test(novo.accessToken)) return error(c, "Access Token inválido (começa com APP_USR- ou TEST-)", 400);
  await kv.set(SEGREDOS, { ...novo, atualizadoEm: new Date().toISOString() });
  return success(c, { temToken: !!novo.accessToken, temSegredo: !!novo.webhookSecret });
});

export default router;
