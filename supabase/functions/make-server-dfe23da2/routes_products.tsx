// ==========================================
// 📦 ROTAS: Produtos + Categorias
// Sub-router Hono extraído do index.tsx monolítico
// ==========================================

import { Hono } from "npm:hono";
import * as kv from "./kv_retry.tsx";
import { soCidade, emCadaUnidade, juntarPorId } from "./franquia.tsx";
import { success, error } from "./server_utils.tsx";
import { requireAdmin } from "./middleware.tsx";
import type { ServerProduct, Category } from "./types.tsx";

const router = new Hono();

// ==========================================
// 📦 PRODUTOS
// ==========================================

router.get('/products', async (c) => {
  try {
    const porUnidade: any[][] = soCidade() ? await emCadaUnidade(() => kv.getByPrefix('product:')) : [];
    // site da cidade: um produto aparece se alguma unidade tem e só fica indisponível se estiver em todas
    const products: ServerProduct[] = soCidade()
      ? (() => { const juntos = juntarPorId(porUnidade); return juntos.map((p: any) => ({ ...p, available: porUnidade.some((l) => l.some((x: any) => x.id === p.id && x.available !== false)) })); })()
      : await kv.getByPrefix('product:');
    
    // Ordenar produtos por createdAt (mais antigos primeiro, novos por último)
    const sorted = products.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateA - dateB;
    });
    
    return success(c, { products: sorted });
  } catch (e) {
    return error(c, `Erro ao listar produtos: ${e}`);
  }
});

router.get('/products/:id', async (c) => {
  const id = c.req.param('id');
  const product = await kv.get(`product:${id}`);
  if (!product) return error(c, 'Produto não encontrado', 404);
  return success(c, { product });
});

router.post('/products', requireAdmin, async (c) => {
  const body: Partial<ServerProduct> = await c.req.json();
  const id = body.id || `product_${Date.now()}`;
  
  const product: ServerProduct = { 
    ...body, 
    id, 
    available: body.available !== undefined ? body.available : true,
    createdAt: new Date().toISOString() 
  };
  
  await kv.set(`product:${id}`, product);
  console.log('✅ [SERVER] Produto criado:', product);
  return success(c, { product });
});

router.put('/products/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  try {
    const body = await c.req.json();
    const existing = await kv.get(`product:${id}`);
    if (!existing) return error(c, 'Produto não encontrado', 404);
    
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await kv.set(`product:${id}`, updated);
    return success(c, { product: updated });
  } catch (e) {
    return error(c, `Erro ao atualizar produto: ${e}`);
  }
});

router.delete('/products/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const product: ServerProduct | null = await kv.get(`product:${id}`) as ServerProduct | null;
  await kv.del(`product:${id}`);
  return success(c, { message: 'Produto deletado' });
});

router.delete('/products/all', requireAdmin, async (c) => {
  const products = await kv.getByPrefix('product:');
  for (const p of products) {
    await kv.del(`product:${(p as any).id}`);
  }
  return success(c, { message: 'Todos os produtos deletados' });
});

// ==========================================
// 🏷️ CATEGORIAS
// ==========================================

router.get('/categories', async (c) => {
  try {
    const categories: Category[] = (soCidade() ? juntarPorId(await emCadaUnidade(async () => await kv.get('categories') || [])) : await kv.get('categories') || []) as Category[];
    return success(c, { categories });
  } catch (e) {
    return error(c, `Erro ao buscar categorias: ${e}`);
  }
});

router.post('/categories', requireAdmin, async (c) => {
  try {
    const { categories } = await c.req.json();
    const sanitizedCategories: Category[] = Array.isArray(categories) ? categories : [];
    await kv.set('categories', sanitizedCategories);
    return success(c, { categories: sanitizedCategories });
  } catch (e) {
    return error(c, `Erro ao salvar categorias: ${e}`);
  }
});

export default router;