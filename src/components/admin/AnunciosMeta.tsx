import React, { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { authFetch, getAllProducts, getCoupons } from '../../utils/api';
import { useConfig } from '../../ConfigContext';

// Anúncios reais na Meta (Facebook/Instagram) — porte da tela do Engaja Aí. Toda campanha nasce pausada.
type Metricas = { gasto: number; alcance: number; impressoes: number; cliques: number; cpc: number | null; ctr: number | null; cliques_link: number; visitas_pagina: number; compras: number };
type Resumo = { conta: { nome: string; moeda: string; status: number; saldo_texto: string | null; minimo_diario: number | null }; instagram_conectado: boolean; pixel: boolean; metricas: Metricas };
type Campanha = {
  id: string; nome: string; status: string; status_efetivo: string; orcamento_diario: number | null; criada_em: string; metricas: Metricas;
  anuncio: { imagem: string | null; previa: string | null; instagram: string | null; gerenciador: string } | null;
};
type Item = { id: string; name: string; tamanho?: number | null };
type Local = { key: string; nome: string; tipo: string };
type PostIg = { id: string; legenda: string; tipo: string; link: string; curtidas: number; comentarios: number; imagem: string | null };
type Linha = { alcance: number; cliques: number; gasto: number };
type Detalhes = { publico: (Linha & { idade: string; genero: string })[]; regioes: (Linha & { regiao: string })[]; dias: (Linha & { dia: string })[]; site: { pedidos: number; faturamento: number; gasto: number; retorno: number | null } };

const brl = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const numero = (v: number | null | undefined, casas = 0) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: casas }));
const dataHora = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

async function chamarMeta<T>(acao: string, corpo: Record<string, unknown> = {}): Promise<T> {
  const r = await authFetch('/meta/acao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, ...corpo }) });
  const d = await r.json().catch(() => null);
  if (!r.ok || d?.success === false) throw new Error(d?.error || `Erro ${r.status}`);
  return d as T;
}

const PERIODOS: [string, string][] = [['today', 'Hoje'], ['last_7d', '7 dias'], ['last_30d', '30 dias'], ['maximum', 'Tudo']];
const STATUS: Record<string, [string, string]> = {
  ACTIVE: ['Rodando', 'text-emerald-600'], PAUSED: ['Pausada', 'text-gray-500'], CAMPAIGN_PAUSED: ['Pausada', 'text-gray-500'],
  ADSET_PAUSED: ['Conjunto pausado', 'text-gray-500'], IN_PROCESS: ['Em revisão', 'text-amber-600'], PENDING_REVIEW: ['Em revisão', 'text-amber-600'],
  DISAPPROVED: ['Reprovada', 'text-red-600'], WITH_ISSUES: ['Com problema', 'text-red-600'], PENDING_BILLING_INFO: ['Falta pagamento', 'text-red-600'],
};
const CTAS: [string, string][] = [['ORDER_NOW', 'Pedir agora'], ['SHOP_NOW', 'Comprar agora'], ['LEARN_MORE', 'Saiba mais'], ['GET_OFFER', 'Obter oferta']];
const POSICOES: [string, string][] = [['reels', 'Reels'], ['story', 'Stories'], ['stream', 'Feed'], ['explore', 'Explorar']];
const POSICOES_FB: [string, string][] = [['fb_feed', 'Feed'], ['fb_story', 'Stories'], ['fb_reels', 'Reels']];
const campo = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500';
const cartao = 'rounded-2xl border border-gray-200 bg-white shadow-sm';

function Numero({ rotulo, valor, dica }: { rotulo: string; valor: string; dica?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{rotulo}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-gray-800">{valor}</p>
      {dica && <p className="text-[11px] text-gray-400">{dica}</p>}
    </div>
  );
}

export function AnunciosMeta() {
  const [periodo, setPeriodo] = useState('last_30d');
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [campanhas, setCampanhas] = useState<Campanha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [r, c] = await Promise.all([chamarMeta<Resumo>('resumo', { periodo }), chamarMeta<{ campanhas: Campanha[] }>('campanhas', { periodo })]);
      setResumo(r);
      setCampanhas(c.campanhas);
    } catch (e) {
      setErro((e as Error).message);
      setCampanhas([]);
    }
  }, [periodo]);

  useEffect(() => { carregar(); }, [carregar]);
  // números da Meta não avisam: atualiza a cada minuto com a aba aberta
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && carregar(), 60_000);
    return () => clearInterval(id);
  }, [carregar]);

  async function status(c: Campanha, novo: 'ACTIVE' | 'PAUSED') {
    if (novo === 'ACTIVE' && !confirm(`Ativar "${c.nome}"? Ela começa a gastar até ${brl(c.orcamento_diario ?? 0)} por dia.`)) return;
    setOcupado(c.id);
    try {
      await chamarMeta('alterar_status', { campanha: c.id, status: novo });
      await carregar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function orcamento(c: Campanha) {
    const r = prompt(`Novo orçamento diário para "${c.nome}" (R$):`, String(c.orcamento_diario ?? ''));
    if (r == null) return;
    const v = Number(r.replace(',', '.'));
    if (!(v >= 1)) return alert('Valor inválido.');
    setOcupado(c.id);
    try {
      await chamarMeta('alterar_orcamento', { campanha: c.id, orcamento_diario: v });
      await carregar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const naoConfigurada = !!erro && /não configurada/i.test(erro);
  const m = resumo?.metricas;
  return (
    <div className="space-y-6">
      {naoConfigurada ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-bold">Meta ainda não conectada</p>
          <p className="mt-1">Conecte a conta de anúncios no <b>Master → Integrações & APIs → Meta</b> (token do usuário do sistema, conta de anúncios, Página e Instagram).</p>
        </div>
      ) : erro && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {!naoConfigurada && (
        <section className={`${cartao} p-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h2 className="font-bold text-gray-800">Meta · {resumo?.conta.nome ?? '…'}</h2>
              <p className="text-xs text-gray-500">
                {resumo ? <>{resumo.conta.saldo_texto ?? 'sem forma de pagamento'} · Instagram {resumo.instagram_conectado ? '✓' : '✗'} · Pixel {resumo.pixel ? '✓' : 'não configurado'}</> : 'carregando…'}
              </p>
            </div>
            <div className="flex gap-1 rounded-lg border border-gray-200 p-1 text-sm">
              {PERIODOS.map(([id, r]) => (
                <button key={id} onClick={() => setPeriodo(id)} className={`rounded px-2 py-1 ${periodo === id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-800'}`}>{r}</button>
              ))}
            </div>
            <button onClick={() => setCriando(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">+ Nova campanha</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Numero rotulo="Gasto" valor={m ? brl(m.gasto) : '—'} />
            <Numero rotulo="Alcance" valor={m ? numero(m.alcance) : '—'} dica="pessoas diferentes" />
            <Numero rotulo="Impressões" valor={m ? numero(m.impressoes) : '—'} />
            <Numero rotulo="Cliques no link" valor={m ? numero(m.cliques_link) : '—'} />
            <Numero rotulo="Custo por clique" valor={m?.cpc != null ? brl(m.cpc) : '—'} />
            <Numero rotulo="Compras" valor={resumo?.pixel ? numero(m?.compras ?? 0) : '—'} dica={resumo?.pixel ? undefined : 'precisa do Pixel'} />
          </div>
        </section>
      )}

      {criando && <NovaCampanha minimoDiario={resumo?.conta.minimo_diario ?? null} aoFechar={() => setCriando(false)} aoCriar={() => { setCriando(false); carregar(); }} />}

      {!naoConfigurada && (
        <section className={cartao}>
          <h2 className="border-b border-gray-200 p-4 font-bold text-gray-800">Campanhas</h2>
          {campanhas === null ? <p className="p-6 text-gray-500">Carregando…</p>
            : campanhas.length === 0 ? <p className="p-6 text-center text-gray-500">Nenhuma campanha ainda. Crie a primeira em “+ Nova campanha”.</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Campanha</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Orçamento/dia</th>
                      <th className="px-3 py-2 text-right">Gasto</th><th className="px-3 py-2 text-right">Alcance</th><th className="px-3 py-2 text-right">Cliques</th>
                      <th className="px-3 py-2 text-right">CPC</th><th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {campanhas.map((c) => {
                      const [rot, cor] = STATUS[c.status_efetivo] ?? [c.status_efetivo, 'text-gray-500'];
                      return (
                        <Fragment key={c.id}>
                          <tr className="border-t border-gray-100">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-3">
                                {c.anuncio?.imagem ? <img src={c.anuncio.imagem} alt="" className="h-16 w-12 shrink-0 rounded-md object-cover" /> : <div className="h-16 w-12 shrink-0 rounded-md bg-gray-100" />}
                                <div>
                                  <button onClick={() => setAberta(aberta === c.id ? null : c.id)} className="text-left">
                                    <div className="font-medium text-gray-800 hover:text-blue-600">{c.nome} <span className="text-xs text-gray-400">{aberta === c.id ? '▴' : '▾ detalhes'}</span></div>
                                    <div className="text-xs text-gray-400">criada {dataHora(c.criada_em)}</div>
                                  </button>
                                  {c.anuncio && (
                                    <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                                      {c.anuncio.instagram && <a href={c.anuncio.instagram} target="_blank" rel="noreferrer" className="font-semibold text-pink-600 hover:underline">Ver no Instagram ↗</a>}
                                      {c.anuncio.previa && <a href={c.anuncio.previa} target="_blank" rel="noreferrer" className="text-gray-500 hover:underline">Prévia (Meta) ↗</a>}
                                      <a href={c.anuncio.gerenciador} target="_blank" rel="noreferrer" className="text-gray-500 hover:underline">Gerenciador de Anúncios ↗</a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className={`px-3 py-2 font-medium ${cor}`}>{rot}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <button disabled={!!ocupado} onClick={() => orcamento(c)} className="underline decoration-dotted hover:text-blue-600">{c.orcamento_diario != null ? brl(c.orcamento_diario) : '—'}</button>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{brl(c.metricas.gasto)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{numero(c.metricas.alcance)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{numero(c.metricas.cliques_link)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{c.metricas.cpc != null ? brl(c.metricas.cpc) : '—'}</td>
                            <td className="px-3 py-2 text-right">
                              {c.status === 'ACTIVE'
                                ? <button disabled={!!ocupado} onClick={() => status(c, 'PAUSED')} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40">Pausar</button>
                                : <button disabled={!!ocupado} onClick={() => status(c, 'ACTIVE')} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Ativar</button>}
                            </td>
                          </tr>
                          {aberta === c.id && <tr><td colSpan={8} className="border-t border-gray-100 p-0"><DetalhesCampanha id={c.id} /></td></tr>}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      )}
    </div>
  );
}

function Busca<T>({ acao, placeholder, rotulo, aoEscolher }: { acao: 'buscar_interesses' | 'buscar_locais'; placeholder: string; rotulo: (i: T) => string; aoEscolher: (i: T) => void }) {
  const [q, setQ] = useState('');
  const [itens, setItens] = useState<T[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setItens([]); return; }
    const t = setTimeout(() => { chamarMeta<{ itens: T[] }>(acao, { q }).then((r) => setItens(r.itens)).catch(() => setItens([])); }, 400);
    return () => clearTimeout(t);
  }, [q, acao]);
  return (
    <div className="relative">
      <input className={campo} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      {itens.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white text-sm shadow-xl">
          {itens.map((i, n) => (
            <li key={n}><button type="button" onClick={() => { aoEscolher(i); setQ(''); setItens([]); }} className="w-full px-3 py-2 text-left hover:bg-gray-50">{rotulo(i)}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chips<T>({ itens, rotulo, remover }: { itens: T[]; rotulo: (i: T) => string; remover: (i: T) => void }) {
  if (!itens.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {itens.map((i, n) => (
        <span key={n} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
          {rotulo(i)}<button type="button" onClick={() => remover(i)} className="text-gray-400 hover:text-red-500">✕</button>
        </span>
      ))}
    </div>
  );
}

const paraBase64 = (blob: Blob) => new Promise<string>((ok, falha) => {
  const leitor = new FileReader();
  leitor.onload = () => ok(String(leitor.result));
  leitor.onerror = falha;
  leitor.readAsDataURL(blob);
});

function NovaCampanha({ aoFechar, aoCriar, minimoDiario = null }: { aoFechar: () => void; aoCriar: () => void; minimoDiario?: number | null }) {
  const { config } = useConfig();
  const loja = config.siteName || 'nossa loja';
  const site = `${window.location.origin}/`;
  const [produtos, setProdutos] = useState<{ id: string; name: string; image: string }[]>([]);
  const [cupons, setCupons] = useState<{ code: string }[]>([]);
  const [nome, setNome] = useState(`${loja} · delivery`);
  const [imagem, setImagem] = useState<{ base64: string; previa: string } | null>(null);
  const [arte, setArte] = useState<string | null>(null);
  const [origem, setOrigem] = useState<'nova' | 'post'>('nova');
  const [posts, setPosts] = useState<PostIg[] | null>(null);
  const [erroPosts, setErroPosts] = useState<string | null>(null);
  const [post, setPost] = useState<PostIg | null>(null);
  const [texto, setTexto] = useState(`Bateu a fome? 🍔\n\nLanches feitos na hora, do jeito que você gosta.\n🛵 Entrega rápida\n📲 Peça pelo site em poucos toques`);
  const [titulo, setTitulo] = useState(`Peça no ${loja}`);
  const [cta, setCta] = useState('ORDER_NOW');
  const [cupom, setCupom] = useState('');
  const [orcamento, setOrcamento] = useState('10');
  const [idadeMin, setIdadeMin] = useState('18');
  const [idadeMax, setIdadeMax] = useState('55');
  const [generos, setGeneros] = useState<number[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [raio, setRaio] = useState('20');
  const [interesses, setInteresses] = useState<Item[]>([]);
  const [posicoes, setPosicoes] = useState<string[]>(['reels', 'story', 'stream']);
  const [estimativa, setEstimativa] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    getAllProducts().then((r: any) => setProdutos((r?.products || []).filter((p: any) => p.image || p.imageUrl).map((p: any) => ({ id: p.id, name: p.name, image: p.image || p.imageUrl })).slice(0, 18))).catch(() => {});
    getCoupons().then((r: any) => setCupons((r?.coupons || []).filter((x: any) => x.isActive !== false && x.active !== false))).catch(() => {});
  }, []);

  const link = cupom ? `${site}?cupom=${encodeURIComponent(cupom)}` : site;
  const textoFinal = cupom && !texto.includes(cupom) ? `${texto}\n\n🎟️ Use o cupom ${cupom}` : texto;
  const publico = () => ({
    idade_min: Number(idadeMin), idade_max: Number(idadeMax), generos,
    locais: locais.map((l) => ({ key: l.key, tipo: l.tipo, ...(l.tipo === 'city' ? { raio: Number(raio) || undefined } : {}) })),
    interesses: interesses.map((i) => ({ id: i.id, name: i.name })), posicoes,
  });

  const chavePublico = JSON.stringify(publico());
  useEffect(() => {
    setEstimativa(null);
    const t = setTimeout(() => {
      chamarMeta<{ min: number | null; max: number | null }>('estimar_publico', JSON.parse(chavePublico))
        .then((r) => setEstimativa(r.min != null ? `${numero(r.min)} – ${numero(r.max)} pessoas` : 'sem estimativa'))
        .catch(() => setEstimativa('sem estimativa'));
    }, 700);
    return () => clearTimeout(t);
  }, [chavePublico]);

  async function escolherProduto(p: { id: string; image: string }) {
    setArte(p.id);
    setErro(null);
    try {
      const url = await paraBase64(await (await fetch(p.image)).blob());
      setImagem({ base64: url.split(',')[1], previa: url });
    } catch {
      setErro('Não consegui carregar a foto desse produto. Use uma imagem própria.');
    }
  }

  function lerImagem(arquivo?: File) {
    if (!arquivo) return;
    if (arquivo.size > 8_000_000) return setErro('Imagem grande demais (máx. 8 MB).');
    paraBase64(arquivo).then((url) => { setImagem({ base64: url.split(',')[1], previa: url }); setArte('propria'); });
  }

  function usarPosts() {
    setOrigem('post');
    if (posts) return;
    setErroPosts(null);
    chamarMeta<{ posts: PostIg[] }>('posts_instagram').then((r) => setPosts(r.posts)).catch((e) => setErroPosts((e as Error).message));
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (origem === 'post' && !post) return setErro('Escolha o post do perfil que vai virar anúncio.');
    if (origem === 'nova' && !imagem) return setErro('Escolha a imagem do anúncio (foto de um produto ou imagem própria).');
    if (!link.startsWith('https://')) return setErro('O link do anúncio precisa ser https:// (abra o Admin pelo endereço oficial do site).');
    if (minimoDiario != null && Number(orcamento.replace(',', '.')) < minimoDiario) return setErro(`A Meta exige no mínimo ${brl(minimoDiario)} por dia nesta conta.`);
    setEnviando(true);
    setErro(null);
    try {
      await chamarMeta('criar_campanha', {
        nome, texto: textoFinal, titulo, cta, link, orcamento_diario: Number(orcamento.replace(',', '.')),
        ...(origem === 'post' && post ? { post_instagram: post.id } : { imagem_base64: imagem?.base64 }),
        ...publico(),
      });
      aoCriar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  const rotuloCta = CTAS.find(([v]) => v === cta)?.[1] ?? 'Pedir agora';

  return (
    <form onSubmit={criar} className={`${cartao} space-y-5 p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Nova campanha <span className="text-sm font-normal text-gray-500">· nasce pausada</span></h2>
        <button type="button" onClick={aoFechar} className="text-sm text-gray-500 hover:text-gray-800">Cancelar</button>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 text-sm">
            {([['nova', 'Anúncio novo (foto)'], ['post', 'Turbinar post do Instagram']] as const).map(([id, r]) => (
              <button type="button" key={id} onClick={() => (id === 'post' ? usarPosts() : setOrigem('nova'))}
                className={`flex-1 rounded-lg px-3 py-2 ${origem === id ? 'bg-blue-600 font-semibold text-white' : 'text-gray-600 hover:text-gray-900'}`}>{r}</button>
            ))}
          </div>

          {origem === 'post' ? (
            <div>
              <p className="mb-2 text-sm text-gray-600">Escolha um post do Instagram da loja. Ele continua no perfil, e as curtidas do anúncio somam nele.</p>
              {erroPosts ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Não consegui ler os posts do Instagram: {erroPosts}</p>
                : posts === null ? <p className="text-sm text-gray-500">Carregando posts…</p>
                : posts.length === 0 ? <p className="text-sm text-gray-500">O perfil ainda não tem posts.</p>
                : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {posts.map((p) => (
                      <button type="button" key={p.id} onClick={() => setPost(p)} title={p.legenda}
                        className={`overflow-hidden rounded-xl border-2 text-left ${post?.id === p.id ? 'border-blue-600 ring-2 ring-blue-200' : 'border-transparent opacity-80 hover:opacity-100'}`}>
                        {p.imagem ? <img src={p.imagem} alt="" className="aspect-square w-full object-cover" /> : <div className="grid aspect-square w-full place-items-center bg-gray-100 text-xs text-gray-500">{p.tipo}</div>}
                        <span className="block bg-gray-50 px-2 py-1 text-[11px] text-gray-600">{p.tipo} · ♡ {numero(p.curtidas)}</span>
                      </button>
                    ))}
                  </div>
                )}
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm text-gray-600">Imagem do anúncio: foto de um produto do cardápio ou uma imagem sua</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {produtos.map((p) => (
                  <button type="button" key={p.id} onClick={() => escolherProduto(p)} title={p.name}
                    className={`overflow-hidden rounded-xl border-2 ${arte === p.id ? 'border-blue-600 ring-2 ring-blue-200' : 'border-transparent opacity-80 hover:opacity-100'}`}>
                    <img src={p.image} alt={p.name} className="aspect-square w-full object-cover" />
                    <span className="block truncate bg-gray-50 px-1 py-1 text-[11px] text-gray-600">{p.name}</span>
                  </button>
                ))}
              </div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                <span className={`rounded-lg border px-3 py-1.5 ${arte === 'propria' ? 'border-blue-600 text-blue-700' : 'border-gray-300'}`}>{arte === 'propria' ? '✓ Imagem própria' : '+ Usar minha própria imagem'}</span>
                1080×1080 ou 1080×1920 · PNG ou JPG
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => lerImagem(e.target.files?.[0])} />
              </label>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-600">Nome da campanha<input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={100} /></label>
            <label className="text-sm text-gray-600">Orçamento diário (R$)
              <input className={campo} inputMode="decimal" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} required />
              {minimoDiario != null && <span className={`text-xs ${Number(orcamento.replace(',', '.')) < minimoDiario ? 'text-red-600' : 'text-gray-400'}`}>mínimo da Meta nesta conta: {brl(minimoDiario)} por dia</span>}
            </label>
          </div>
          {origem === 'nova' ? (
            <label className="block text-sm text-gray-600">Texto do anúncio<textarea className={`${campo} h-32`} value={texto} onChange={(e) => setTexto(e.target.value)} required maxLength={1900} /></label>
          ) : <p className="text-xs text-gray-500">O texto do anúncio é a legenda do próprio post.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            {origem === 'nova' && <label className="text-sm text-gray-600">Título<input className={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={100} /></label>}
            <label className="text-sm text-gray-600">Botão
              <select className={campo} value={cta} onChange={(e) => setCta(e.target.value)}>{CTAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
            </label>
            <label className="text-sm text-gray-600">Cupom no link <span className="text-gray-400">(opcional)</span>
              <select className={campo} value={cupom} onChange={(e) => setCupom(e.target.value)}>
                <option value="">Sem cupom</option>
                {cupons.map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}
              </select>
            </label>
          </div>
          <p className="break-all text-xs text-gray-500">Link do anúncio: {link}</p>

          <fieldset className="space-y-4 rounded-xl border border-gray-200 p-4">
            <legend className="px-2 text-sm font-semibold text-gray-700">Público</legend>
            <div className="flex flex-wrap items-end gap-4">
              <label className="text-sm text-gray-600">Idade
                <div className="flex items-center gap-2">
                  <input className={`${campo} w-20`} value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} inputMode="numeric" /><span>a</span>
                  <input className={`${campo} w-20`} value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} inputMode="numeric" />
                </div>
              </label>
              <div className="text-sm text-gray-600">Gênero
                <div className="mt-1 flex gap-2">
                  {([[0, 'Todos'], [1, 'Homens'], [2, 'Mulheres']] as const).map(([g, r]) => (
                    <button type="button" key={g} onClick={() => setGeneros(g === 0 ? [] : [g])}
                      className={`rounded-lg border px-3 py-2 ${(g === 0 ? generos.length === 0 : generos.includes(g)) ? 'border-blue-600 text-blue-700' : 'border-gray-300'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="text-sm text-gray-600">Onde aparece
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-400">Instagram:</span>
                  {POSICOES.map(([p, r]) => <button type="button" key={p} onClick={() => setPosicoes(alternar(posicoes, p))} className={`rounded-lg border px-3 py-2 ${posicoes.includes(p) ? 'border-pink-500 text-pink-700' : 'border-gray-300'}`}>{r}</button>)}
                </div>
                {origem === 'nova' && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400">Facebook:</span>
                    {POSICOES_FB.map(([p, r]) => <button type="button" key={p} onClick={() => setPosicoes(alternar(posicoes, p))} className={`rounded-lg border px-3 py-2 ${posicoes.includes(p) ? 'border-[#1877f2] text-[#1877f2]' : 'border-gray-300'}`}>{r}</button>)}
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="text-sm text-gray-600">Cidade de entrega <span className="text-gray-400">(vazio = Brasil todo)</span>
                <Busca<Local> acao="buscar_locais" placeholder="Ex.: Goiatuba" rotulo={(l) => `${l.nome} · ${l.tipo === 'city' ? 'cidade' : 'estado'}`}
                  aoEscolher={(l) => setLocais((x) => (x.some((y) => y.key === l.key) ? x : [...x, l]))} />
                <Chips itens={locais} rotulo={(l) => l.nome} remover={(l) => setLocais((x) => x.filter((y) => y.key !== l.key))} />
                {locais.some((l) => l.tipo === 'city') && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">Raio em volta da cidade
                    <input className={`${campo} w-20`} value={raio} onChange={(e) => setRaio(e.target.value)} inputMode="numeric" /> km <span className="text-gray-400">(a Meta aceita 17 a 80)</span>
                  </label>
                )}
              </div>
              <div className="text-sm text-gray-600">Interesses <span className="text-gray-400">(vazio = sem filtro)</span>
                <Busca<Item> acao="buscar_interesses" placeholder="Ex.: hambúrguer, fast food" rotulo={(i) => `${i.name}${i.tamanho ? ` · ${numero(i.tamanho)}+` : ''}`}
                  aoEscolher={(i) => setInteresses((x) => (x.some((y) => y.id === i.id) ? x : [...x, i]))} />
                <Chips itens={interesses} rotulo={(i) => i.name} remover={(i) => setInteresses((x) => x.filter((y) => y.id !== i.id))} />
              </div>
            </div>
            <p className="text-sm text-gray-700">Tamanho estimado: <b>{estimativa ?? 'calculando…'}</b> <span className="text-xs text-gray-400">(ativos por mês nos lugares escolhidos)</span></p>
          </fieldset>

          {erro && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <div className="flex items-center gap-3">
            <button disabled={enviando} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{enviando ? 'Criando na Meta…' : 'Criar campanha (pausada)'}</button>
            <span className="text-xs text-gray-500">Nada é gasto até você clicar em “Ativar” na lista.</span>
          </div>
        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <p className="mb-2 text-sm font-semibold text-gray-700">Prévia do anúncio</p>
          <PreviaAnuncio imagem={origem === 'post' ? post?.imagem ?? null : imagem?.previa ?? null} texto={origem === 'post' ? post?.legenda ?? '' : textoFinal}
            titulo={origem === 'post' ? '' : titulo} botao={rotuloCta} usuario={loja} logo={config.logoUrl}
            posicoes={origem === 'post' ? posicoes.filter((p) => !p.startsWith('fb_')) : posicoes} />
        </aside>
      </div>
    </form>
  );
}

const NOMES: Record<string, string> = { reels: 'Reels', story: 'Stories', stream: 'Feed', explore: 'Explorar', fb_feed: 'Facebook · Feed', fb_story: 'Facebook · Stories', fb_reels: 'Facebook · Reels' };
const BASE: Record<string, string> = { fb_feed: 'stream', fb_story: 'story', fb_reels: 'reels' };

// simulação aproximada de como o anúncio aparece (a Meta pode cortar texto e mover o botão)
function PreviaAnuncio({ imagem, texto, titulo, botao, usuario, logo, posicoes }: { imagem: string | null; texto: string; titulo: string; botao: string; usuario: string; logo?: string; posicoes: string[] }) {
  const opcoes = posicoes.length ? posicoes : ['reels'];
  const [escolhida, setEscolhida] = useState(opcoes[0]);
  const atual = opcoes.includes(escolhida) ? escolhida : opcoes[0];
  const pos = BASE[atual] ?? atual;
  const primeiraLinha = texto.split('\n').find((l) => l.trim()) ?? '';
  const Avatar = ({ t }: { t: number }) => (
    <span className="shrink-0 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]" style={{ width: t, height: t }}>
      {logo ? <img src={logo} alt="" className="h-full w-full rounded-full border-2 border-black bg-white object-contain" /> : <span className="block h-full w-full rounded-full border-2 border-black bg-gray-700" />}
    </span>
  );
  const Foto = ({ className }: { className: string }) => (imagem
    ? <img src={imagem} alt="" className={`${className} object-cover`} />
    : <div className={`${className} grid place-items-center bg-gray-800 text-xs text-gray-400`}>sua imagem aqui</div>);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1 text-xs">
        {opcoes.map((p) => (
          <button type="button" key={p} onClick={() => setEscolhida(p)}
            className={`rounded-full px-3 py-1 ${atual === p ? (p.startsWith('fb_') ? 'bg-[#1877f2] text-white' : 'bg-pink-600 text-white') : 'border border-gray-300 text-gray-500'}`}>{NOMES[p] ?? p}</button>
        ))}
      </div>
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[28px] border-4 border-gray-800 bg-black text-white shadow-2xl">
        {(pos === 'reels' || pos === 'story') && (
          <>
            <Foto className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />
            <div className={`absolute left-3 flex items-center gap-2 text-[11px] ${pos === 'story' ? 'top-5' : 'top-3'}`}>
              <Avatar t={26} /><div className="leading-tight"><b>{usuario}</b><div className="text-[10px] opacity-80">Patrocinado</div></div>
            </div>
            <div className="absolute inset-x-3 bottom-3 space-y-2 text-[11px]">
              {pos === 'reels' && <p className="line-clamp-2 pr-8"><b>{usuario}</b> {primeiraLinha}</p>}
              <div className="flex items-center justify-between rounded-lg bg-white/95 px-3 py-2 text-[12px] font-semibold text-black">{botao} <span>›</span></div>
            </div>
          </>
        )}
        {(pos === 'stream' || pos === 'explore') && (
          <div className="flex h-full flex-col overflow-hidden text-[11px]">
            <div className="flex items-center gap-2 px-3 py-2"><Avatar t={24} /><div className="leading-tight"><b>{usuario}</b><div className="text-[10px] text-gray-400">Patrocinado</div></div></div>
            <Foto className="aspect-[4/5] w-full" />
            <div className="flex items-center justify-between bg-gray-900 px-3 py-2 font-semibold"><span className="truncate">{titulo || botao}</span><span className="shrink-0 text-pink-400">{botao} ›</span></div>
            <p className="line-clamp-4 whitespace-pre-line px-3 py-2"><b>{usuario}</b> {texto}</p>
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-gray-400">Prévia aproximada. A Meta pode ajustar cortes e a posição do botão.</p>
    </div>
  );
}

function DetalhesCampanha({ id }: { id: string }) {
  const [d, setD] = useState<Detalhes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { chamarMeta<Detalhes>('detalhes', { campanha: id, periodo: 'maximum' }).then(setD).catch((e) => setErro((e as Error).message)); }, [id]);
  if (erro) return <p className="p-4 text-sm text-red-600">{erro}</p>;
  if (!d) return <p className="p-4 text-sm text-gray-500">Carregando detalhes…</p>;
  const soma = (mapa: Map<string, number>, k: string, v: number) => mapa.set(k, (mapa.get(k) ?? 0) + v);
  const porIdade = new Map<string, number>(), porGenero = new Map<string, number>();
  for (const p of d.publico) { soma(porIdade, p.idade, p.alcance); soma(porGenero, p.genero, p.alcance); }
  const GENERO: Record<string, string> = { male: 'Homens', female: 'Mulheres', unknown: 'Não informado' };
  const Barra = ({ rotulo, valor, max, extra }: { rotulo: string; valor: number; max: number; extra?: string }) => (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-xs">
      <span className="truncate text-gray-500">{rotulo}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${max ? Math.max(2, (valor / max) * 100) : 0}%` }} /></div>
      <span className="tabular-nums text-gray-700">{numero(valor)}{extra && <span className="text-gray-400"> · {extra}</span>}</span>
    </div>
  );
  const maxDe = (xs: number[]) => Math.max(0, ...xs);
  return (
    <div className="space-y-5 bg-gray-50 p-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-gray-700">No site (pedidos que vieram por este anúncio)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero rotulo="Pedidos" valor={numero(d.site.pedidos)} />
          <Numero rotulo="Faturamento" valor={brl(d.site.faturamento)} />
          <Numero rotulo="Gasto no anúncio" valor={brl(d.site.gasto)} />
          <Numero rotulo="Retorno" valor={d.site.retorno != null ? `${numero(d.site.retorno, 2)}×` : '—'} dica="faturamento ÷ gasto" />
        </div>
      </div>
      {d.publico.length === 0 && d.dias.length === 0 ? (
        <p className="text-sm text-gray-500">A Meta ainda não tem dados de público. Eles aparecem depois que o anúncio começar a rodar.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">Idade de quem viu</p>
            {[...porIdade.entries()].sort().map(([k, v]) => <Barra key={k} rotulo={k} valor={v} max={maxDe([...porIdade.values()])} />)}
            <p className="pt-3 text-sm font-semibold text-gray-700">Gênero</p>
            {[...porGenero.entries()].map(([k, v]) => <Barra key={k} rotulo={GENERO[k] ?? k} valor={v} max={maxDe([...porGenero.values()])} />)}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">Regiões (alcance)</p>
            {d.regioes.map((r) => <Barra key={r.regiao} rotulo={r.regiao} valor={r.alcance} max={maxDe(d.regioes.map((x) => x.alcance))} extra={`${numero(r.cliques)} cliques`} />)}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">Cliques no link por dia</p>
            {d.dias.map((x) => <Barra key={x.dia} rotulo={new Date(`${x.dia}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} valor={x.cliques} max={maxDe(d.dias.map((y) => y.cliques))} extra={brl(x.gasto)} />)}
          </div>
        </div>
      )}
    </div>
  );
}
