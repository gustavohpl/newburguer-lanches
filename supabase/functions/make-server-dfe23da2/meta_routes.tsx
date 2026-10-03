// Anúncios na Meta (Facebook/Instagram) pela API de Marketing — mesmo desenho do Engaja Aí.
// Só o Admin usa; toda campanha nasce PAUSADA e ativar é sempre uma ação explícita.
// Credenciais (token do usuário do sistema, conta, página, Instagram) ficam só no servidor (KV meta_segredos).
import { Hono } from "npm:hono";
import * as kv from "./kv_retry.tsx";
import { configDaUnidade } from "./franquia.tsx";
import { success, error } from "./server_utils.tsx";
import { requireAdmin, requireAdminLeitura, requireMaster } from "./middleware.tsx";

// META_API_URL só existe no ambiente de teste (simulador local da Graph API)
const BASE = Deno.env.get("META_API_URL") || "https://graph.facebook.com/v23.0";
const SEGREDOS = "meta_segredos";

type Segredos = { token?: string; conta?: string; pagina?: string; instagram?: string; atualizadoEm?: string; pixel?: string };
type Cfg = { token: string; conta: string; pagina: string; instagram: string | null; pixel: string | null };
type Params = Record<string, string | number | boolean | object | null | undefined>;
type Metricas = { spend?: string; reach?: string; impressions?: string; clicks?: string; cpc?: string; ctr?: string; actions?: { action_type: string; value: string }[] };

class MetaError extends Error {}

const segredosMeta = async (): Promise<Segredos> => (await kv.get(SEGREDOS) as Segredos) || {};

async function metaConfig(): Promise<Cfg> {
  const s = await segredosMeta();
  const config: any = await kv.get("system_config") || {};
  if (!s.token || !s.conta || !s.pagina) throw new MetaError("Meta não configurada (Master → Integrações → Meta: token, conta de anúncios e página).");
  return { token: s.token, conta: `act_${s.conta.replace(/^act_/, "")}`, pagina: s.pagina, instagram: s.instagram || null, pixel: s.pixel || config.metaPixelId || null };
}

function codificar(p: Params): URLSearchParams {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null) u.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  return u;
}

async function chamar<T>(cfg: Pick<Cfg, "token">, metodo: "GET" | "POST" | "DELETE", caminho: string, params: Params = {}): Promise<T> {
  const corpo = codificar({ ...params, access_token: cfg.token });
  const resp = await fetch(metodo === "GET" ? `${BASE}/${caminho}?${corpo}` : `${BASE}/${caminho}`, {
    method: metodo, ...(metodo === "GET" ? {} : { body: corpo }), signal: AbortSignal.timeout(45_000),
  });
  const dados = await resp.json().catch(() => null);
  if (!resp.ok || dados?.error) {
    const e = dados?.error ?? {};
    // error_user_msg vem em português e explica o que fazer
    throw new MetaError(`Meta: ${e.error_user_msg || e.error_user_title || e.message || `HTTP ${resp.status}`}`);
  }
  return dados as T;
}

// o CDN do Instagram/Facebook bloqueia exibir a imagem em outro site: o Admin recebe a miniatura embutida
async function imagemComoDataUrl(url?: string | null, maxBytes = 700_000): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const tipo = r.headers.get("content-type") ?? "";
    if (!r.ok || !tipo.startsWith("image/")) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > maxBytes) return null;
    let bin = "";
    for (const x of bytes) bin += String.fromCharCode(x);
    return `data:${tipo};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

const CAMPOS_METRICAS = "spend,reach,impressions,clicks,cpc,ctr,actions";
const PERIODOS = new Set(["today", "yesterday", "last_7d", "last_14d", "last_30d", "maximum"]);
const CTAS = new Set(["LEARN_MORE", "SHOP_NOW", "ORDER_NOW", "GET_OFFER"]);
const POSICOES_IG = new Set(["reels", "story", "stream", "explore"]);
const POSICOES_FB: Record<string, string> = { fb_feed: "feed", fb_story: "story", fb_reels: "facebook_reels" };

function resumir(m?: Metricas) {
  const n = (v?: string) => (v == null ? 0 : Number(v));
  const acao = (tipo: string) => n(m?.actions?.find((a) => a.action_type === tipo)?.value);
  return {
    gasto: n(m?.spend), alcance: n(m?.reach), impressoes: n(m?.impressions), cliques: n(m?.clicks),
    cpc: m?.cpc ? n(m.cpc) : null, ctr: m?.ctr ? n(m.ctr) : null,
    cliques_link: acao("link_click"), visitas_pagina: acao("landing_page_view"),
    compras: acao("offsite_conversion.fb_pixel_purchase") || acao("purchase"),
  };
}

const inteiro = (v: unknown, min: number, max: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};

function montarPublico(b: Record<string, unknown>, soInstagram = false) {
  const idadeMin = inteiro(b.idade_min, 18, 65) ?? 18;
  const idadeMax = Math.max(idadeMin, inteiro(b.idade_max, 18, 65) ?? 65);
  const generos = Array.isArray(b.generos) ? (b.generos as unknown[]).map(Number).filter((g) => g === 1 || g === 2) : [];
  const locais = Array.isArray(b.locais) ? (b.locais as { key: string; tipo: string; raio?: number }[]) : [];
  const interesses = Array.isArray(b.interesses) ? (b.interesses as { id: string; name: string }[]) : [];
  const escolhidas = Array.isArray(b.posicoes) ? (b.posicoes as string[]) : [];
  const posIg = escolhidas.filter((p) => POSICOES_IG.has(p));
  const posFb = soInstagram ? [] : escolhidas.filter((p) => p in POSICOES_FB).map((p) => POSICOES_FB[p]);
  const nenhuma = !posIg.length && !posFb.length;
  const geo: Record<string, unknown> = {};
  // cidade com raio (delivery): a Meta aceita 17–80 km em volta da cidade
  const cidades = locais.filter((l) => l.tipo === "city").map((l) => ({ key: String(l.key), ...(l.raio ? { radius: Math.min(80, Math.max(17, Math.round(l.raio))), distance_unit: "kilometer" } : {}) }));
  const regioes = locais.filter((l) => l.tipo === "region").map((l) => ({ key: String(l.key) }));
  if (cidades.length) geo.cities = cidades;
  if (regioes.length) geo.regions = regioes;
  if (!cidades.length && !regioes.length) geo.countries = ["BR"];
  return {
    geo_locations: geo,
    age_min: idadeMin,
    age_max: idadeMax,
    ...(generos.length ? { genders: generos } : {}),
    ...(interesses.length ? { flexible_spec: [{ interests: interesses.map((i) => ({ id: String(i.id), name: String(i.name) })) }] } : {}),
    publisher_platforms: [...(posIg.length || nenhuma ? ["instagram"] : []), ...(posFb.length ? ["facebook"] : [])],
    ...(posIg.length || nenhuma ? { instagram_positions: posIg.length ? posIg : ["reels", "story", "stream"] } : {}),
    ...(posFb.length ? { facebook_positions: posFb } : {}),
    // a Meta exige dizer se o "público Advantage" está ligado; ligado ela ignora o público escolhido
    targeting_automation: { advantage_audience: 0 },
  };
}

const router = new Hono();

// consultas só pedem a sessão; o que altera a conta (criar, ativar, orçamento) passa também pelo CSRF
const LEITURA = new Set(["resumo", "campanhas", "detalhes", "posts_instagram", "buscar_interesses", "buscar_locais", "estimar_publico"]);
router.post("/meta/acao", async (c, next) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>));
  return LEITURA.has(String(b.acao)) ? requireAdminLeitura(c, next) : requireAdmin(c, next);
}, async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const acao = String(b.acao ?? "");
  if ((await configDaUnidade()).features?.paidTraffic === false) return error(c, "Anúncios (Meta Ads) desativados nesta loja.", 403);
  try {
    const cfg = await metaConfig();
    const get = <T,>(caminho: string, p?: Params) => chamar<T>(cfg, "GET", caminho, p);
    const post = <T,>(caminho: string, p?: Params) => chamar<T>(cfg, "POST", caminho, p);
    const periodo = (padrao: string) => (PERIODOS.has(String(b.periodo)) ? String(b.periodo) : padrao);

    if (acao === "resumo") {
      const [conta, ins] = await Promise.all([
        get<Record<string, unknown>>(cfg.conta, { fields: "name,currency,account_status,funding_source_details,min_daily_budget" }),
        get<{ data: Metricas[] }>(`${cfg.conta}/insights`, { fields: CAMPOS_METRICAS, date_preset: periodo("last_30d") }),
      ]);
      const fonte = conta.funding_source_details as { display_string?: string } | undefined;
      return c.json({
        conta: { nome: conta.name, moeda: conta.currency, status: conta.account_status, saldo_texto: fonte?.display_string ?? null,
          minimo_diario: conta.min_daily_budget ? Number(conta.min_daily_budget) / 100 : null },
        instagram_conectado: !!cfg.instagram, pixel: !!cfg.pixel, metricas: resumir(ins.data?.[0]),
      });
    }

    if (acao === "campanhas") {
      const r = await get<{ data: Record<string, unknown>[] }>(`${cfg.conta}/campaigns`, {
        fields: `id,name,status,effective_status,objective,daily_budget,created_time,insights.date_preset(${periodo("last_30d")}){${CAMPOS_METRICAS}},` +
          "ads.limit(1){id,preview_shareable_link,creative.thumbnail_width(360).thumbnail_height(640){thumbnail_url,image_url,instagram_permalink_url}}",
        limit: 50,
      });
      const conta = cfg.conta.replace("act_", "");
      type Ad = { id: string; preview_shareable_link?: string; creative?: { thumbnail_url?: string; image_url?: string; instagram_permalink_url?: string } };
      const campanhas = await Promise.all((r.data ?? []).map(async (x) => {
        const ad = (x.ads as { data?: Ad[] } | undefined)?.data?.[0];
        return {
          id: x.id, nome: x.name, status: x.status, status_efetivo: x.effective_status, objetivo: x.objective,
          orcamento_diario: x.daily_budget ? Number(x.daily_budget) / 100 : null, criada_em: x.created_time,
          metricas: resumir((x.insights as { data?: Metricas[] } | undefined)?.data?.[0]),
          anuncio: ad ? {
            imagem: await imagemComoDataUrl(ad.creative?.thumbnail_url ?? ad.creative?.image_url, 400_000),
            previa: ad.preview_shareable_link ?? null,
            instagram: ad.creative?.instagram_permalink_url ?? null,
            gerenciador: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${conta}&selected_campaign_ids=${x.id}`,
          } : null,
        };
      }));
      return c.json({ campanhas });
    }

    if (acao === "detalhes") {
      const id = String(b.campanha ?? "");
      if (!/^\d+$/.test(id)) return error(c, "campanha inválida", 400);
      type Linha = Metricas & { age?: string; gender?: string; region?: string; date_start?: string };
      const ins = (extra: Record<string, string>) =>
        get<{ data: Linha[] }>(`${id}/insights`, { fields: "spend,reach,impressions,clicks,actions", date_preset: periodo("maximum"), limit: 500, ...extra }).then((r) => r.data ?? []);
      const [idadeGenero, regioes, porDia] = await Promise.all([ins({ breakdowns: "age,gender" }), ins({ breakdowns: "region" }), ins({ time_increment: "1" })]);
      const linha = (x: Linha) => { const m = resumir(x); return { alcance: m.alcance, cliques: m.cliques_link, gasto: m.gasto }; };
      // lado do site: pedidos que vieram por este anúncio (utm_campaign = id da campanha)
      const pedidos = [...await kv.getByPrefix("order:"), ...await kv.getByPrefix("archive:")]
        .filter((o: any) => o?.utm?.utm_campaign === id && o.status !== "cancelled");
      const faturamento = pedidos.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);
      const gasto = porDia.reduce((s, d) => s + Number(d.spend ?? 0), 0);
      return c.json({
        publico: idadeGenero.map((x) => ({ idade: x.age, genero: x.gender, ...linha(x) })),
        regioes: regioes.map((x) => ({ regiao: x.region, ...linha(x) })).sort((a, z) => z.alcance - a.alcance).slice(0, 10),
        dias: porDia.map((x) => ({ dia: x.date_start, ...linha(x) })),
        site: { pedidos: pedidos.length, faturamento, gasto, retorno: gasto > 0 ? faturamento / gasto : null },
      });
    }

    if (acao === "posts_instagram") {
      if (!cfg.instagram) return error(c, "Instagram não conectado (Master → Integrações → Meta).", 409);
      const r = await get<{ data: { id: string; caption?: string; media_type: string; media_product_type?: string; media_url?: string; thumbnail_url?: string; permalink: string; timestamp: string; like_count?: number; comments_count?: number }[] }>(
        `${cfg.instagram}/media`, { fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count", limit: 12 });
      const posts = await Promise.all((r.data ?? []).map(async (m) => ({
        id: m.id, legenda: m.caption ?? "", tipo: m.media_product_type === "REELS" ? "Reels" : m.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : m.media_type === "VIDEO" ? "Vídeo" : "Foto",
        link: m.permalink, data: m.timestamp, curtidas: m.like_count ?? 0, comentarios: m.comments_count ?? 0,
        imagem: await imagemComoDataUrl(m.thumbnail_url ?? m.media_url),
      })));
      return c.json({ posts });
    }

    if (acao === "alterar_status") {
      const status = b.status === "ACTIVE" ? "ACTIVE" : "PAUSED";
      const id = String(b.campanha ?? "");
      if (!/^\d+$/.test(id)) return error(c, "campanha inválida", 400);
      // ativar a campanha ativa também o conjunto e o anúncio criados aqui (nascem pausados)
      if (status === "ACTIVE") {
        const filhos = await get<{ data: { id: string }[] }>(`${id}/adsets`, { fields: "id" });
        const anuncios = await get<{ data: { id: string }[] }>(`${id}/ads`, { fields: "id" });
        for (const x of [...(filhos.data ?? []), ...(anuncios.data ?? [])]) await post(x.id, { status: "ACTIVE" });
      }
      await post(id, { status });
      return c.json({ ok: true, status });
    }

    if (acao === "alterar_orcamento") {
      const id = String(b.campanha ?? "");
      const reais = Number(b.orcamento_diario);
      if (!/^\d+$/.test(id) || !(reais >= 1)) return error(c, "orçamento inválido", 400);
      await post(id, { daily_budget: Math.round(reais * 100) });
      return c.json({ ok: true });
    }

    if (acao === "buscar_interesses" || acao === "buscar_locais") {
      const q = String(b.q ?? "").trim().slice(0, 60);
      if (q.length < 2) return c.json({ itens: [] });
      if (acao === "buscar_interesses") {
        const r = await get<{ data: { id: string; name: string; audience_size_lower_bound?: number; path?: string[] }[] }>("search", { type: "adinterest", q, locale: "pt_BR", limit: 15 });
        return c.json({ itens: (r.data ?? []).map((i) => ({ id: i.id, name: i.name, tamanho: i.audience_size_lower_bound ?? null, caminho: i.path?.join(" › ") ?? null })) });
      }
      const r = await get<{ data: { key: string; name: string; type: string; region?: string }[] }>("search", { type: "adgeolocation", q, country_code: "BR", location_types: ["city", "region"], locale: "pt_BR", limit: 12 });
      return c.json({ itens: (r.data ?? []).map((l) => ({ key: l.key, nome: l.region && l.type === "city" ? `${l.name} (${l.region})` : l.name, tipo: l.type })) });
    }

    if (acao === "estimar_publico") {
      type Est = { estimate_mau_lower_bound?: number; estimate_mau_upper_bound?: number };
      const r = await get<{ data: Est[] | Est }>(`${cfg.conta}/delivery_estimate`, { optimization_goal: "LINK_CLICKS", targeting_spec: montarPublico(b) });
      const d = Array.isArray(r.data) ? r.data[0] : r.data;
      return c.json({ min: d?.estimate_mau_lower_bound ?? null, max: d?.estimate_mau_upper_bound ?? null });
    }

    if (acao === "criar_campanha") {
      const nome = String(b.nome ?? "").trim().slice(0, 100);
      const texto = String(b.texto ?? "").trim().slice(0, 2000);
      const titulo = String(b.titulo ?? "").trim().slice(0, 100);
      const link = String(b.link ?? "").trim();
      const cta = CTAS.has(String(b.cta)) ? String(b.cta) : "ORDER_NOW";
      const reais = Number(b.orcamento_diario);
      const imagem = String(b.imagem_base64 ?? "");
      const postIg = typeof b.post_instagram === "string" && /^\d+$/.test(b.post_instagram) ? b.post_instagram : null;
      if (!nome || (!postIg && (!texto || !imagem))) return error(c, "Preencha nome, texto e imagem (ou escolha um post).", 400);
      if (!/^https:\/\/[^\s]+$/.test(link)) return error(c, "Link do site inválido (precisa começar com https://).", 400);
      if (!(reais >= 1) || reais > 10000) return error(c, "Orçamento diário inválido.", 400);
      if (imagem.length > 12_000_000) return error(c, "Imagem grande demais (máx. ~8 MB).", 400);
      if (!cfg.instagram) return error(c, "Instagram não conectado à conta de anúncios (Master → Integrações → Meta).", 409);

      const criados: string[] = [];
      try {
        let hash: string | undefined;
        if (!postIg) {
          const img = await post<{ images: Record<string, { hash: string }> }>(`${cfg.conta}/adimages`, { bytes: imagem });
          hash = Object.values(img.images ?? {})[0]?.hash;
          if (!hash) throw new MetaError("Meta não devolveu a imagem enviada");
        }
        const camp = await post<{ id: string }>(`${cfg.conta}/campaigns`, {
          name: nome, objective: "OUTCOME_TRAFFIC", status: "PAUSED", special_ad_categories: [],
          daily_budget: Math.round(reais * 100), bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        });
        criados.push(camp.id);
        const conj = await post<{ id: string }>(`${cfg.conta}/adsets`, {
          name: `${nome} · público`, campaign_id: camp.id, status: "PAUSED",
          optimization_goal: "LINK_CLICKS", billing_event: "IMPRESSIONS", destination_type: "WEBSITE",
          targeting: montarPublico(b, !!postIg),
        });
        // link com UTM: o pedido guarda a origem e o painel soma os pedidos de cada campanha
        const linkUtm = `${link}${link.includes("?") ? "&" : "?"}utm_source=meta&utm_medium=anuncio&utm_campaign=${camp.id}`;
        const criativo = await post<{ id: string }>(`${cfg.conta}/adcreatives`, postIg
          ? { name: `${nome} · post do perfil`, object_id: cfg.pagina, instagram_user_id: cfg.instagram,
              source_instagram_media_id: postIg, call_to_action: { type: cta, value: { link: linkUtm } } }
          : { name: `${nome} · criativo`,
              object_story_spec: {
                page_id: cfg.pagina, instagram_user_id: cfg.instagram,
                link_data: { image_hash: hash, link: linkUtm, message: texto, ...(titulo ? { name: titulo } : {}), call_to_action: { type: cta, value: { link: linkUtm } } },
              } });
        const anuncio = await post<{ id: string }>(`${cfg.conta}/ads`, { name: nome, adset_id: conj.id, creative: { creative_id: criativo.id }, status: "PAUSED" });
        return c.json({ ok: true, campanha: camp.id, conjunto: conj.id, anuncio: anuncio.id });
      } catch (e) {
        // não deixa campanha pela metade na conta: apagar a campanha apaga conjunto e anúncio junto
        for (const id of criados) await chamar(cfg, "DELETE", id).catch(() => {});
        throw e;
      }
    }

    return error(c, "ação desconhecida", 400);
  } catch (e) {
    console.error("❌ [META]", acao, (e as Error).message);
    return error(c, (e as Error).message, e instanceof MetaError ? 502 : 500);
  }
});

// Master: credenciais só entram (nunca voltam para a tela)
router.get("/master/meta", requireMaster, async (c) => {
  const s = await segredosMeta();
  let conta: Record<string, unknown> | null = null, erroConta = "";
  if (s.token && s.conta && c.req.query("testar")) {
    try {
      const cfg = { token: s.token };
      const [ct, pg] = await Promise.all([
        chamar<Record<string, unknown>>(cfg, "GET", `act_${s.conta.replace(/^act_/, "")}`, { fields: "name,currency,account_status" }),
        s.pagina ? chamar<{ name?: string }>(cfg, "GET", s.pagina, { fields: "name" }) : Promise.resolve({ name: undefined }),
      ]);
      conta = { nome: ct.name, moeda: ct.currency, status: ct.account_status, pagina: pg.name ?? null };
    } catch (e) { erroConta = (e as Error).message; }
  }
  return success(c, { temToken: !!s.token, conta: s.conta || "", pagina: s.pagina || "", instagram: s.instagram || "", pixel: s.pixel || "", atualizadoEm: s.atualizadoEm || null, resultado: conta, erroConta });
});

router.post("/master/meta", requireMaster, async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const limpo = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const atual = await segredosMeta();
  const so = (v: string) => v.replace(/\D/g, "");
  const novo: Segredos = b.apagar ? {} : {
    token: limpo(b.token) || atual.token,
    conta: so(limpo(b.conta)) || atual.conta,
    pagina: so(limpo(b.pagina)) || atual.pagina,
    instagram: so(limpo(b.instagram)) || atual.instagram,
    pixel: typeof b.pixel === "string" ? so(limpo(b.pixel)) : atual.pixel,
  };
  await kv.set(SEGREDOS, { ...novo, atualizadoEm: new Date().toISOString() });
  return success(c, { temToken: !!novo.token });
});

export default router;
