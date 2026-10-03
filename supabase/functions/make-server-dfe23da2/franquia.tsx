import * as kv from "./kv_retry.tsx";
import { comEscopo, definirEscopo, unidadeAtual, cidadeAtual } from "./kv_retry.tsx";

const EM_ANDAMENTO = ['pending', 'confirmed', 'preparing', 'ready', 'ready_for_delivery', 'out_for_delivery'];

export async function franquia() {
  const cfg: any = await kv.get('system_config') || {};
  return cfg.franchise?.enabled ? cfg.franchise : null;
}
export async function acharUnidade(id: string | null | undefined) {
  if (!id) return null;
  const f = await franquia();
  for (const cidade of f?.cities || []) {
    const unidade = (cidade.units || []).find((u: any) => u.id === id);
    if (unidade) return { cidade, unidade };
  }
  return null;
}
export async function acharCidade(id: string | null | undefined) {
  if (!id) return null;
  return ((await franquia())?.cities || []).find((c: any) => c.id === id) || null;
}
export const unidadeExiste = async (id: string) => !!(await acharUnidade(id));

// muda o escopo do banco para a unidade (e a cidade dela); false se a unidade não existe
export async function entrarNaUnidade(id: string | null | undefined): Promise<boolean> {
  const achada = await acharUnidade(id);
  if (!achada) return false;
  definirEscopo(achada.unidade.id, achada.cidade.id);
  return true;
}

// setores são da cidade (as unidades entregam nos mesmos); cidade antiga sem setores usa os das unidades
export function setoresDaCidade(cidade: any) {
  if (Array.isArray(cidade?.sectors) && cidade.sectors.length) return cidade.sectors;
  const vistos = new Map<string, any>();
  for (const u of cidade?.units || []) for (const s of u.sectors || []) if (!vistos.has(s.id)) vistos.set(s.id, s);
  return [...vistos.values()];
}

// situação de cada unidade da cidade agora: aberta, o que aceita, tempos, taxa, pedidos em andamento e se tem os itens
export async function situacaoDaCidade(cidade: any, itens: string[] = []) {
  const cfg: any = await kv.get('system_config') || {};
  return Promise.all((cidade.units || []).map((u: any) => comEscopo(u.id, cidade.id, async () => {
    const [status, uc, estimativas, taxa, pedidos] = await Promise.all([
      kv.get('store_status'), kv.get('unit_config'), kv.get('time_estimates'), kv.get('delivery_fee'), kv.getByPrefix('order:'),
    ]);
    const produtos = itens.length ? await kv.mget(itens.map((i) => `product:${i}`)) : [];
    const semEstoque = itens.length ? (await disponibilidade()).unavailableProducts : [];
    const consumoLocal = ((uc as any)?.features?.dineIn ?? cfg.features?.dineIn) !== false;
    return {
      id: u.id, nome: u.name, endereco: u.address || '', telefone: u.phone || '', horario: u.openingHours || '',
      aberta: u.isOpen !== false && ((status as any)?.isOpen ?? true),
      entrega: cfg.features?.deliverySystem !== false, retirada: true, consumoLocal,
      estimativas: estimativas || { delivery: { min: 30, max: 50 }, pickup: { min: 15, max: 25 }, dineIn: { min: 20, max: 30 } }, taxa: (taxa ?? u.deliveryFee ?? 0) as number,
      ativos: (pedidos as any[]).filter((o) => EM_ANDAMENTO.includes(o?.status)).length,
      temItens: produtos.length === itens.length && produtos.every((p: any) => p && p.available !== false && !semEstoque.includes(p.id)),
    };
  })));
}

// delivery: a unidade aberta com menos pedidos em andamento que tenha todos os itens
export async function unidadeParaEntrega(cidade: any, itens: string[] = []) {
  const opcoes = (await situacaoDaCidade(cidade, itens)).filter((o) => o.aberta && o.entrega && o.temItens);
  return opcoes.sort((a, b) => a.ativos - b.ativos)[0] || null;
}

// pedido de uma cidade: o escopo vira a unidade que recebeu o pedido (só dentro da cidade/unidade de quem pede)
export async function escopoDoPedido(orderId: string) {
  if (!(await franquia())) return;
  const achada = await acharUnidade(await kv.get(`order_unit:${orderId}`));
  if (!achada) return;
  const u = unidadeAtual(), c = cidadeAtual();
  if ((u && u !== achada.unidade.id) || (!u && c !== achada.cidade.id)) return;
  definirEscopo(achada.unidade.id, achada.cidade.id);
}

// cliente no site da cidade (sem unidade): roda a consulta em cada unidade da cidade
export const soCidade = () => !unidadeAtual() && !!cidadeAtual();
export async function emCadaUnidade<T>(fn: (unidade: any) => Promise<T>): Promise<T[]> {
  const cidade = await acharCidade(cidadeAtual());
  return Promise.all((cidade?.units || []).map((u: any) => comEscopo(u.id, cidade.id, () => fn(u))));
}
// junta listas das unidades pelo id (a primeira unidade que tem o item manda nos dados)
export function juntarPorId(listas: any[][]): any[] {
  const vistos = new Map<string, any>();
  for (const lista of listas) for (const item of lista || []) if (item?.id && !vistos.has(item.id)) vistos.set(item.id, item);
  return [...vistos.values()];
}

// produtos sem estoque na unidade do escopo (ingrediente da ficha técnica zerado)
export async function disponibilidade() {
  const ingredientes = await kv.getByPrefix('stock_ingredient:');
  const produtos = await kv.getByPrefix('product:');
  const vazios = ingredientes.filter((i: any) => (i.currentStock || 0) <= 0).map((i: any) => i.id);
  const lowStockIngredients = ingredientes
    .filter((i: any) => (i.currentStock || 0) > 0 && (i.currentStock || 0) <= (i.minAlert || 0))
    .map((i: any) => ({ id: i.id, name: i.name, stock: i.currentStock, min: i.minAlert }));
  const unavailableProducts = produtos.filter((p: any) => (p.recipe?.ingredients || []).some((r: any) => vazios.includes(r.ingredientId))).map((p: any) => p.id);
  return { unavailableProducts, emptyIngredients: vazios, lowStockIngredients, totalIngredients: ingredientes.length };
}

// config que vale para a unidade do escopo (a da rede com o que o Admin da unidade mudou por cima)
export async function configDaUnidade() {
  const sistema: any = await kv.get('system_config') || {};
  return unidadeAtual() ? { ...sistema, ...(await kv.get('unit_config') || {}) } : sistema;
}
