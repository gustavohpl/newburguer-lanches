// ==========================================
// ⚙️ ROTAS: Config, Cupons, Store, Payment, Upload, Stock, Settings
// Sub-router Hono extraído do index.tsx monolítico
// ==========================================

import { Hono } from "npm:hono";
import { scopedKv } from "./kv_scoped.tsx";
import * as kvRaw from "./kv_retry.tsx";
import { success, error, getBrasiliaISOString, getBusinessDayStart } from "./server_utils.tsx";
import { requireAdmin, requireMaster, cleanupExpiredSessions, resetCleanupThrottle } from "./middleware.tsx";
import { supabase } from "./supabase_client.tsx";
import type { Coupon, StockIngredient, SystemConfig } from "./types.tsx";

const router = new Hono();

// ==========================================
// 🎫 CUPONS DE DESCONTO
// ==========================================

router.get('/coupons', requireAdmin, async (c) => {
  try {
    const skv = scopedKv(c);
    const coupons = await skv.getByPrefix('coupon:');
    return success(c, { coupons });
  } catch (e) {
    return error(c, `Erro ao buscar cupons: ${e}`);
  }
});

router.post('/coupons', requireAdmin, async (c) => {
  try {
    const skv = scopedKv(c);
    const body = await c.req.json();
    const id = body.id || `coupon_${Date.now()}`;
    const coupon: Coupon = {
      ...body, id,
      currentUses: body.currentUses || 0,
      createdAt: body.createdAt || new Date().toISOString()
    };
    await skv.set(`coupon:${id}`, coupon);
    return success(c, { coupon });
  } catch (e) {
    return error(c, `Erro ao criar cupom: ${e}`);
  }
});

router.put('/coupons/:id', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  const id = c.req.param('id');
  try {
    const body = await c.req.json();
    const existing = await skv.get(`coupon:${id}`);
    if (!existing) return error(c, 'Cupom não encontrado', 404);
    const updated: Coupon = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await skv.set(`coupon:${id}`, updated);
    return success(c, { coupon: updated });
  } catch (e) {
    return error(c, `Erro ao atualizar cupom: ${e}`);
  }
});

router.delete('/coupons/:id', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  const id = c.req.param('id');
  await skv.del(`coupon:${id}`);
  return success(c, { message: 'Cupom deletado' });
});

router.delete('/coupons/all', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  const coupons = await skv.getByPrefix('coupon:');
  for (const coupon of coupons) await skv.del(`coupon:${(coupon as any).id}`);
  return success(c, { message: `${coupons.length} cupons deletados` });
});

router.post('/coupons/validate', async (c) => {
  try {
    const skv = scopedKv(c);
    const { code, orderTotal } = await c.req.json();
    if (!code || !code.trim()) return c.json({ success: false, valid: false, error: 'Código do cupom não fornecido' });
    const allCoupons = await skv.getByPrefix('coupon:');
    const coupon = allCoupons.find((cp: any) => cp.code?.toUpperCase() === code.toUpperCase());
    if (!coupon) return c.json({ success: true, valid: false, error: 'Cupom não encontrado' });
    if (!coupon.isActive) return c.json({ success: true, valid: false, error: 'Cupom inativo' });
    if (coupon.maxUses !== -1 && coupon.currentUses >= coupon.maxUses) return c.json({ success: true, valid: false, error: 'Cupom esgotado' });
    if (coupon.expiresAt) {
      if (new Date() > new Date(coupon.expiresAt)) return c.json({ success: true, valid: false, error: 'Cupom expirado' });
    }
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (orderTotal * coupon.value) / 100;
    } else {
      discount = coupon.value;
    }
    discount = Math.min(discount, orderTotal);
    return c.json({ success: true, valid: true, coupon, discount });
  } catch (e) {
    return c.json({ success: false, valid: false, error: `Erro ao validar cupom: ${e}` });
  }
});

router.post('/coupons/increment-usage', async (c) => {
  try {
    const skv = scopedKv(c);
    const { code } = await c.req.json();
    if (!code || !code.trim()) return error(c, 'Código do cupom não fornecido', 400);
    const allCoupons = await skv.getByPrefix('coupon:');
    const coupon = allCoupons.find((cp: any) => cp.code?.toUpperCase() === code.toUpperCase());
    if (!coupon) return error(c, 'Cupom não encontrado', 404);
    const updatedCoupon: Coupon = { ...coupon, currentUses: (coupon.currentUses || 0) + 1, lastUsedAt: new Date().toISOString() };
    await skv.set(`coupon:${coupon.id}`, updatedCoupon);
    return success(c, { message: 'Uso do cupom incrementado', coupon: updatedCoupon });
  } catch (e) {
    return error(c, `Erro ao incrementar uso: ${e}`, 500);
  }
});

// ==========================================
// 🏪 LOJA (STATUS E CONFIGURAÇÕES)
// ==========================================

router.get('/store/status', async (c) => {
  const skv = scopedKv(c);
  const status: any = await skv.get('store_status');
  return success(c, { isOpen: status?.isOpen ?? true });
});

router.post('/store/status', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  const { isOpen } = await c.req.json();
  await skv.set('store_status', { isOpen });
  return success(c, { isOpen });
});

router.get('/config/public', async (c) => {
  const skv = scopedKv(c);
  const config: any = await skv.get('system_config') || {};
  const categories = await skv.get('categories') || [];
  const publicConfig = {
    ...config, categories,
    pagSeguroToken: undefined, pagSeguroEmail: undefined,
    hasPagSeguroToken: !!(config.pagSeguroToken || Deno.env.get('PAGSEGURO_TOKEN')),
    adminUsername: undefined
  };
  return success(c, { config: publicConfig });
});

router.get('/master/config', async (c) => {
  try {
    const skv = scopedKv(c);
    const systemConfig: any = await skv.get('system_config') || {};
    const hasAdminPassword = !!Deno.env.get('ADMIN_PASSWORD');
    const masterConfig = {
      ...systemConfig, hasAdminPassword,
      pagSeguroToken: systemConfig.pagSeguroToken || '',
      pagSeguroEmail: systemConfig.pagSeguroEmail || '',
    };
    return success(c, { config: masterConfig });
  } catch (e) {
    return error(c, `Erro ao buscar configuração master: ${e}`);
  }
});

router.post('/master/config', async (c) => {
  try {
    const skv = scopedKv(c);
    const body = await c.req.json();
    const { config, adminPassword } = body;
    if (!config || typeof config !== 'object') return error(c, 'Configuração inválida.', 400);
    const systemConfigToSave: SystemConfig = {
      ...config,
      pagSeguroToken: config.pagSeguroToken || '',
      pagSeguroEmail: config.pagSeguroEmail || '',
      metaPixelId: config.metaPixelId || '',
      metaAccessToken: config.metaAccessToken || '',
    };
    if (adminPassword) {
      console.log('🔐 [MASTER CONFIG] Atualizando senha do admin via painel');
      await skv.set('admin_password', adminPassword);
    }
    await skv.set('system_config', systemConfigToSave);
    return success(c, { config: systemConfigToSave });
  } catch (e) {
    return error(c, `Erro ao salvar configuração master: ${e}`, 500);
  }
});

router.post('/admin/config', async (c) => {
  try {
    const skv = scopedKv(c);
    const updates = await c.req.json();
    const currentConfig: any = await skv.get('system_config') || {};
    const updatedConfig = { ...currentConfig, ...updates };
    await skv.set('system_config', updatedConfig);
    return success(c, { config: updatedConfig });
  } catch (e) {
    return error(c, `Erro ao atualizar configuração: ${e}`, 500);
  }
});

router.post('/master/cleanup-sessions', async (c) => {
  const skv = scopedKv(c);
  console.log('🧹 [CLEANUP] Limpeza manual de sessões solicitada');
  try {
    resetCleanupThrottle();
    const cleaned = await cleanupExpiredSessions();
    return success(c, { cleaned, message: `${cleaned} entradas expiradas removidas` });
  } catch (e) {
    return error(c, `Erro durante limpeza: ${e}`, 500);
  }
});

// ==========================================
// ⏱️ ESTIMATIVAS DE TEMPO
// ==========================================

router.get('/settings/estimates', async (c) => {
  try {
    const skv = scopedKv(c);
    const estimates = await skv.get('time_estimates') || {
      delivery: { min: 30, max: 50 },
      pickup: { min: 15, max: 25 },
      dineIn: { min: 20, max: 30 }
    };
    return success(c, { estimates });
  } catch (e) {
    return error(c, `Erro ao buscar estimativas: ${e}`);
  }
});

router.post('/settings/estimates', requireAdmin, async (c) => {
  try {
    const skv = scopedKv(c);
    const { estimates } = await c.req.json();
    await skv.set('time_estimates', estimates);
    return success(c, { estimates });
  } catch (e) {
    return error(c, `Erro ao salvar estimativas: ${e}`);
  }
});

// ==========================================
// 💳 PAGAMENTOS (PIX & CARD)
// ==========================================

router.post('/payment/pix', async (c) => {
  try {
    const skv = scopedKv(c);
    const body = await c.req.json();
    const { amount, customerName, customerPhone, customerEmail, items, orderId } = body;
    const config: any = await skv.get('system_config') || {};
    const PAGSEGURO_TOKEN = config.pagSeguroToken || Deno.env.get('PAGSEGURO_TOKEN');
    const PAGSEGURO_ENVIRONMENT = Deno.env.get('PAGSEGURO_ENVIRONMENT') || 'sandbox';
    const automaticPayment = config.automaticPayment !== false;
    const manualPixKey = config.manualPixKey || '';

    if (!automaticPayment || !PAGSEGURO_TOKEN) {
      if (!manualPixKey) return error(c, 'Pagamento PIX não configurado.', 400);
      return success(c, { mode: 'manual', pixKey: manualPixKey, amount, message: 'Use a chave PIX abaixo para fazer o pagamento manualmente' });
    }

    const apiUrl = PAGSEGURO_ENVIRONMENT === 'production'
      ? 'https://api.pagseguro.com/orders'
      : 'https://sandbox.api.pagseguro.com/orders';
    const referenceId = orderId || `PIX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const payload = {
      reference_id: referenceId,
      customer: {
        name: customerName,
        email: customerEmail || `${customerPhone.replace(/\D/g, '')}@temp.com`,
        tax_id: '12345678909',
        phones: [{ country: '55', area: customerPhone.replace(/\D/g, '').substring(0, 2), number: customerPhone.replace(/\D/g, '').substring(2), type: 'MOBILE' }]
      },
      items: items.map((item: any, index: number) => ({
        reference_id: `item_${index}`, name: item.name.substring(0, 64),
        quantity: item.quantity, unit_amount: Math.round(item.price * 100)
      })),
      qr_codes: [{ amount: { value: Math.round(amount * 100), currency: 'BRL' }, expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString() }]
    };
    const pagseguroResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PAGSEGURO_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!pagseguroResponse.ok) {
      const errText = await pagseguroResponse.text();
      if (errText.includes('whitelist') || errText.includes('ACCESS_DENIED')) return error(c, 'Erro de whitelist do PagSeguro.', 403);
      return error(c, `Erro ao gerar PIX: ${errText}`, 400);
    }
    const pagseguroData = await pagseguroResponse.json();
    const qrCodeData = pagseguroData.qr_codes?.[0];
    if (!qrCodeData || !qrCodeData.text) return error(c, 'Erro ao gerar QR Code PIX', 500);
    let qrCodeBase64 = '';
    if (qrCodeData.links && qrCodeData.links.length > 0) {
      const qrCodeUrl = qrCodeData.links.find((link: any) => link.media === 'image/png')?.href;
      if (qrCodeUrl) {
        try {
          const qrImageResponse = await fetch(qrCodeUrl, { headers: { 'Authorization': `Bearer ${PAGSEGURO_TOKEN}` } });
          if (qrImageResponse.ok) {
            const arrayBuffer = await qrImageResponse.arrayBuffer();
            qrCodeBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          }
        } catch (qrErr) { console.warn(qrErr); }
      }
    }
    return success(c, { success: true, qrCode: qrCodeBase64, copyPaste: qrCodeData.text, referenceId: pagseguroData.id || referenceId, expiresAt: qrCodeData.expiration_date });
  } catch (e) {
    return error(c, `Erro ao criar pagamento PIX: ${e}`, 500);
  }
});

router.post('/payment/card', async (c) => {
  try {
    const skv = scopedKv(c);
    const body = await c.req.json();
    const { amount, customerName, customerPhone, customerEmail, items, card } = body;
    if (!card || !card.number || !card.expiry || !card.cvv || !card.name) return error(c, 'Dados do cartão incompletos');
    const config: any = await skv.get('system_config') || {};
    const PAGSEGURO_TOKEN = config.pagSeguroToken || Deno.env.get('PAGSEGURO_TOKEN');
    const PAGSEGURO_ENVIRONMENT = Deno.env.get('PAGSEGURO_ENVIRONMENT') || 'sandbox';
    if (!PAGSEGURO_TOKEN) return error(c, 'Token do PagSeguro não configurado.', 500);
    const apiUrl = PAGSEGURO_ENVIRONMENT === 'production' ? 'https://api.pagseguro.com/orders' : 'https://sandbox.api.pagseguro.com/orders';
    const referenceId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let expMonth, expYear;
    if (card.expiry.includes('/')) {
      const parts = card.expiry.split('/');
      expMonth = parts[0];
      expYear = parts[1];
      if (expYear.length === 2) expYear = '20' + expYear;
    } else {
      return error(c, 'Formato de validade inválido');
    }
    const payload = {
      reference_id: referenceId,
      customer: {
        name: customerName, email: customerEmail || 'cliente@faroeste.com', tax_id: '12345678909',
        phones: [{ country: '55', area: customerPhone.replace(/\D/g, '').substring(0, 2), number: customerPhone.replace(/\D/g, '').substring(2), type: 'MOBILE' }]
      },
      items: items.map((item: any, index: number) => ({
        reference_id: `item_${index}`, name: item.name.substring(0, 64), quantity: item.quantity, unit_amount: Math.round(item.price * 100)
      })),
      charges: [{
        reference_id: referenceId, description: `Pedido Faroeste`,
        amount: { value: Math.round(amount * 100), currency: 'BRL' },
        payment_method: {
          type: 'CREDIT_CARD', installments: 1, capture: true,
          card: { number: card.number.replace(/\D/g, ''), exp_month: expMonth, exp_year: expYear, security_code: card.cvv, holder: { name: card.name } }
        }
      }]
    };
    const pagseguroResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PAGSEGURO_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!pagseguroResponse.ok) {
      const errText = await pagseguroResponse.text();
      return error(c, 'Pagamento recusado: ' + errText, 400);
    }
    const pagseguroData = await pagseguroResponse.json();
    const charge = pagseguroData.charges?.[0];
    const chargeStatus = charge?.status;
    if (chargeStatus === 'PAID') {
      const orderIdNew = `FH-${Date.now().toString().slice(-6)}`;
      const orderData = { orderId: orderIdNew, referenceId, customerName, customerPhone, items, total: amount, status: 'pending', paymentStatus: 'paid', createdAt: new Date().toISOString() };
      await skv.set(`order:${orderIdNew}`, orderData);
      return success(c, { status: 'PAID', orderId: orderIdNew, message: 'Pagamento Aprovado' });
    } else {
      return error(c, `Pagamento não aprovado. Status: ${chargeStatus}`);
    }
  } catch (e) {
    return error(c, `Erro interno: ${e}`, 500);
  }
});

router.get('/payment/status/:referenceId', async (c) => {
  try {
    const skv = scopedKv(c);
    const referenceId = c.req.param('referenceId');
    const config: any = await skv.get('system_config') || {};
    const PAGSEGURO_TOKEN = config.pagSeguroToken || Deno.env.get('PAGSEGURO_TOKEN');
    const PAGSEGURO_ENVIRONMENT = Deno.env.get('PAGSEGURO_ENVIRONMENT') || 'sandbox';
    if (!PAGSEGURO_TOKEN) return error(c, 'Token PagSeguro não configurado', 400);
    const apiUrl = PAGSEGURO_ENVIRONMENT === 'production' ? `https://api.pagseguro.com/orders/${referenceId}` : `https://sandbox.api.pagseguro.com/orders/${referenceId}`;
    const pagseguroResponse = await fetch(apiUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${PAGSEGURO_TOKEN}`, 'Accept': 'application/json' } });
    if (!pagseguroResponse.ok) return success(c, { success: true, status: 'pending' });
    const pagseguroData = await pagseguroResponse.json();
    const qrCode = pagseguroData.qr_codes?.[0];
    const charges = pagseguroData.charges || [];
    const paidCharge = charges.find((ch: any) => ch.status === 'PAID');
    if (paidCharge || qrCode?.status === 'PAID') {
      const existingOrder: any = await skv.get(`order:${referenceId}`);
      if (existingOrder) {
        const updatedOrder = { ...existingOrder, paymentStatus: 'paid', updatedAt: new Date().toISOString() };
        await skv.set(`order:${referenceId}`, updatedOrder);
        return success(c, { success: true, status: 'paid', orderId: referenceId });
      }
      const pixPayment: any = await skv.get(`pix_payment:${referenceId}`);
      if (!pixPayment) {
        const orderIdNew = `FH-${Date.now().toString().slice(-6)}`;
        const orderData = { orderId: orderIdNew, referenceId, paymentStatus: 'paid', createdAt: new Date().toISOString() };
        await skv.set(`pix_payment:${referenceId}`, orderData);
        return success(c, { success: true, status: 'paid', orderId: orderIdNew });
      }
      return success(c, { success: true, status: 'paid', orderId: pixPayment.orderId });
    }
    return success(c, { success: true, status: 'pending' });
  } catch (e) {
    return error(c, `Erro ao verificar status: ${e}`, 500);
  }
});

router.post('/payment/notification', async (c) => {
  const skv = scopedKv(c);
  return success(c, { received: true });
});

// ==========================================
// 📤 UPLOAD DE IMAGENS (Supabase Storage)
// ==========================================

router.post('/upload', requireAdmin, async (c) => {
  try {
    const skv = scopedKv(c);
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    if (!file) return error(c, 'Nenhum arquivo enviado', 400);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) return error(c, 'Tipo de arquivo não permitido', 400);
    if (file.size > 5 * 1024 * 1024) return error(c, 'Arquivo muito grande. Máximo 5MB', 400);
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `product_${timestamp}_${randomStr}.${extension}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const bucketName = 'make-dfe23da2-products';
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    if (!bucketExists) await supabase.storage.createBucket(bucketName, { public: false });
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(fileName, buffer, { contentType: file.type, cacheControl: '3600', upsert: false });
    if (uploadError) return error(c, `Erro ao fazer upload: ${uploadError.message}`, 500);
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from(bucketName).createSignedUrl(fileName, 315360000);
    if (signedUrlError) return error(c, `Erro ao gerar URL: ${signedUrlError.message}`, 500);
    return success(c, { url: signedUrlData.signedUrl, fileName, size: file.size, type: file.type });
  } catch (e) {
    return error(c, `Erro ao fazer upload: ${String(e)}`, 500);
  }
});

router.post('/master/upload', async (c) => {
  try {
    const skv = scopedKv(c);
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    if (!file) return error(c, 'Nenhum arquivo enviado', 400);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) return error(c, 'Tipo de arquivo não permitido', 400);
    if (file.size > 15 * 1024 * 1024) return error(c, 'Arquivo muito grande. Máximo 15MB', 400);
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `master_${timestamp}_${randomStr}.${extension}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const bucketName = 'make-dfe23da2-master';
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    if (!bucketExists) await supabase.storage.createBucket(bucketName, { public: false });
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(fileName, buffer, { contentType: file.type, cacheControl: '31536000', upsert: false });
    if (uploadError) return error(c, `Erro ao fazer upload: ${uploadError.message}`, 500);
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from(bucketName).createSignedUrl(fileName, 315360000);
    if (signedUrlError) return error(c, `Erro ao gerar URL: ${signedUrlError.message}`, 500);
    return success(c, { url: signedUrlData.signedUrl, fileName, size: file.size, type: file.type });
  } catch (e) {
    return error(c, `Erro ao fazer upload: ${String(e)}`, 500);
  }
});

// ==========================================
// 📦 SISTEMA DE ESTOQUE
// ==========================================

router.get('/stock/ingredients', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  console.log('📦 [STOCK] GET /stock/ingredients');
  try {
    const allIngredients = await skv.getByPrefix('stock_ingredient:');
    const ingredients = (allIngredients || []).sort((a: any, b: any) => a.name?.localeCompare(b.name || '') || 0);
    return success(c, { ingredients });
  } catch (e) {
    console.error('❌ [STOCK] Erro ao buscar ingredientes:', e);
    return error(c, `Erro ao buscar ingredientes: ${e}`, 500);
  }
});

router.post('/stock/ingredients', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  console.log('📦 [STOCK] POST /stock/ingredients');
  try {
    const body = await c.req.json();
    const now = getBrasiliaISOString();
    const id = body.id || `ing_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    let existing: any = null;
    if (body.id) existing = await skv.get(`stock_ingredient:${body.id}`);
    const ingredient: StockIngredient = {
      ...(existing || {}), ...body, id,
      purchaseHistory: body.purchaseHistory || existing?.purchaseHistory || [],
      createdAt: existing?.createdAt || now, updatedAt: now,
    };
    await skv.set(`stock_ingredient:${id}`, ingredient);
    console.log('✅ [STOCK] Ingrediente salvo:', id, ingredient.name);
    return success(c, { ingredient });
  } catch (e) {
    console.error('❌ [STOCK] Erro ao salvar ingrediente:', e);
    return error(c, `Erro ao salvar ingrediente: ${e}`, 500);
  }
});

router.delete('/stock/ingredients/:id', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  const id = c.req.param('id');
  console.log('📦 [STOCK] DELETE /stock/ingredients/', id);
  try {
    await skv.del(`stock_ingredient:${id}`);
    return success(c, { message: 'Ingrediente deletado' });
  } catch (e) {
    console.error('❌ [STOCK] Erro ao deletar ingrediente:', e);
    return error(c, `Erro ao deletar ingrediente: ${e}`, 500);
  }
});

router.post('/stock/ingredients/:id/restock', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  const id = c.req.param('id');
  console.log('📦 [STOCK] POST /stock/ingredients/:id/restock', id);
  try {
    const body = await c.req.json();
    const { quantity, price } = body;
    const ingredient: any = await skv.get(`stock_ingredient:${id}`);
    if (!ingredient) return error(c, 'Ingrediente não encontrado', 404);
    const now = getBrasiliaISOString();
    const historyEntry = {
      id: `ph_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      date: now, price, quantity, type: ingredient.type,
    };
    ingredient.currentStock = (ingredient.currentStock || 0) + quantity;
    ingredient.purchaseHistory = [...(ingredient.purchaseHistory || []), historyEntry];
    ingredient.updatedAt = now;
    if (ingredient.type === 'kg') { ingredient.pricePerKg = price / quantity; }
    else { ingredient.pricePerUnit = price / quantity; }
    await skv.set(`stock_ingredient:${id}`, ingredient);
    console.log('✅ [STOCK] Estoque reposto:', id, '+', quantity);
    return success(c, { ingredient });
  } catch (e) {
    console.error('❌ [STOCK] Erro na reposição:', e);
    return error(c, `Erro na reposição: ${e}`, 500);
  }
});

router.get('/stock/report/daily', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  console.log('📊 [STOCK] GET /stock/report/daily');
  try {
    const allIngredients = await skv.getByPrefix('stock_ingredient:');
    const dayStart = getBusinessDayStart();
    const dayStartTime = dayStart.getTime();
    const allDeductions = await skv.getByPrefix('stock_deduction:');
    const todayDeductions = (allDeductions || []).filter((d: any) => new Date(d.date).getTime() >= dayStartTime);
    const report = (allIngredients || []).map((ing: any) => {
      const deductions = todayDeductions.filter((d: any) => d.ingredientId === ing.id);
      const totalConsumed = deductions.reduce((sum: number, d: any) => sum + (d.quantity || 0), 0);
      const unitPrice = ing.type === 'kg' ? (ing.pricePerKg || 0) : (ing.pricePerUnit || 0);
      const totalCost = totalConsumed * unitPrice;
      return { ingredientId: ing.id, ingredientName: ing.name, type: ing.type, consumed: totalConsumed, cost: totalCost, remaining: ing.currentStock || 0, unitPrice };
    });
    const totalDayCost = report.reduce((sum: number, r: any) => sum + r.cost, 0);
    return success(c, { report, totalDayCost, businessDayStart: dayStart.toISOString() });
  } catch (e) {
    console.error('❌ [STOCK] Erro no relatório diário:', e);
    return error(c, `Erro no relatório: ${e}`, 500);
  }
});

router.get('/stock/restock-schedule', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  console.log('📅 [STOCK] GET /stock/restock-schedule');
  try {
    const schedule = await skv.get('stock_restock_schedule') || {};
    return success(c, { schedule });
  } catch (e) {
    console.error('❌ [STOCK] Erro ao buscar agenda de reposição:', e);
    return error(c, `Erro ao buscar agenda: ${e}`, 500);
  }
});

router.post('/stock/restock-schedule', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  console.log('📅 [STOCK] POST /stock/restock-schedule');
  try {
    const body = await c.req.json();
    const { schedule } = body;
    if (!schedule || typeof schedule !== 'object') return error(c, 'Agenda inválida', 400);
    await skv.set('stock_restock_schedule', schedule);
    return success(c, { message: 'Agenda salva com sucesso' });
  } catch (e) {
    console.error('❌ [STOCK] Erro ao salvar agenda de reposição:', e);
    return error(c, `Erro ao salvar agenda: ${e}`, 500);
  }
});

router.post('/stock/deduct', requireAdmin, async (c) => {
  const skv = scopedKv(c);
  console.log('📦 [STOCK] POST /stock/deduct');
  try {
    const body = await c.req.json();
    const { items, deliveryType, selectedAcompanhamentos } = body;
    const now = getBrasiliaISOString();
    const isDineIn = deliveryType === 'dine-in';
    const rawSelAcomp = selectedAcompanhamentos || [];
    const selAcomp: string[] = rawSelAcomp.map((a: any) => typeof a === 'string' ? a : a.id);
    if (!items || !Array.isArray(items)) return error(c, 'Items inválidos', 400);
    const deductions: any[] = [];
    const errors: string[] = [];
    for (const item of items) {
      if (!item.recipe?.ingredients) continue;
      for (const recipeIng of item.recipe.ingredients) {
        const ingredient: any = await skv.get(`stock_ingredient:${recipeIng.ingredientId}`);
        if (!ingredient) { errors.push(`Ingrediente ${recipeIng.ingredientId} não encontrado`); continue; }
        const ingCategory = recipeIng.category || ingredient.category || 'ingredient';
        if (isDineIn && (ingCategory === 'embalagem' || ingCategory === 'acompanhamento')) continue;
        if (ingCategory === 'acompanhamento' && !selAcomp.includes(recipeIng.ingredientId)) continue;
        let totalDeduct: number;
        if (ingCategory === 'acompanhamento') {
          const defaultQty = recipeIng.defaultQuantityPerOrder || ingredient.defaultQuantity || recipeIng.quantityUsed || 1;
          totalDeduct = defaultQty * item.quantity;
        } else {
          totalDeduct = recipeIng.quantityUsed * item.quantity;
          if (recipeIng.selectedPortionG && recipeIng.selectedPortionG > 0) {
            totalDeduct = (recipeIng.selectedPortionG / 1000) * recipeIng.quantityUsed * item.quantity;
          }
        }
        ingredient.currentStock = Math.max(0, (ingredient.currentStock || 0) - totalDeduct);
        ingredient.updatedAt = now;
        await skv.set(`stock_ingredient:${ingredient.id}`, ingredient);
        const deductionId = `deduct_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const deduction = {
          id: deductionId, ingredientId: ingredient.id, ingredientName: ingredient.name, category: ingCategory,
          portionLabel: recipeIng.selectedPortionLabel || null, portionG: recipeIng.selectedPortionG || null,
          productId: item.productId, quantity: totalDeduct, date: now,
        };
        await skv.set(`stock_deduction:${deductionId}`, deduction);
        deductions.push(deduction);
      }
    }
    console.log('✅ [STOCK] Deduções realizadas:', deductions.length);
    return success(c, { deductions, errors: errors.length > 0 ? errors : undefined });
  } catch (e) {
    console.error('❌ [STOCK] Erro ao descontar estoque:', e);
    return error(c, `Erro ao descontar: ${e}`, 500);
  }
});

router.get('/stock/availability', async (c) => {
  const skv = scopedKv(c);
  console.log('📦 [STOCK] GET /stock/availability');
  try {
    const allIngredients = await skv.getByPrefix('stock_ingredient:');
    const allProducts = await skv.getByPrefix('product:');
    const emptyIngredients = (allIngredients || []).filter((ing: any) => (ing.currentStock || 0) <= 0).map((ing: any) => ing.id);
    const lowStockIngredients = (allIngredients || [])
      .filter((ing: any) => (ing.currentStock || 0) > 0 && (ing.currentStock || 0) <= (ing.minAlert || 0))
      .map((ing: any) => ({ id: ing.id, name: ing.name, stock: ing.currentStock, min: ing.minAlert }));
    const unavailableProducts: string[] = [];
    for (const product of (allProducts || [])) {
      if (product.recipe?.ingredients) {
        for (const recipeIng of product.recipe.ingredients) {
          if (emptyIngredients.includes(recipeIng.ingredientId)) { unavailableProducts.push(product.id); break; }
        }
      }
    }
    return success(c, { unavailableProducts, emptyIngredients, lowStockIngredients, totalIngredients: (allIngredients || []).length });
  } catch (e) {
    console.error('❌ [STOCK] Erro ao verificar disponibilidade:', e);
    return error(c, `Erro: ${e}`, 500);
  }
});

// ==========================================
// 🏙️ FRANCHISE: Migração de dados para unidade
// Copia dados globais (sem prefixo) para unit:{id}:
// ==========================================
router.post('/franchise/migrate', requireMaster, async (c) => {
  try {
    const body = await c.req.json();
    const { targetUnitId } = body;
    
    if (!targetUnitId || !/^[a-z0-9-]+$/.test(targetUnitId)) {
      return error(c, 'targetUnitId inválido', 400);
    }

    // Prefixos de dados que serão migrados
    const MIGRATE_PREFIXES = [
      'product:',
      'order:',
      'archive:',
      'coupon:',
      'sector:',
      'stock_ingredient:',
      'driver:',
    ];
    
    // Chaves individuais (sem prefixo de busca)
    const MIGRATE_SINGLE_KEYS = [
      'delivery_config',
    ];

    let totalMigrated = 0;
    const details: Record<string, number> = {};

    // Migrar dados por prefixo
    for (const prefix of MIGRATE_PREFIXES) {
      const items = await kvRaw.getByPrefixWithKeys(prefix);
      // Filtrar apenas chaves sem prefixo unit: (dados globais)
      const globalItems = items.filter(item => !item.key.startsWith('unit:'));
      
      if (globalItems.length > 0) {
        const newKeys = globalItems.map(item => `unit:${targetUnitId}:${item.key}`);
        const values = globalItems.map(item => item.value);
        await kvRaw.mset(newKeys, values);
        details[prefix] = globalItems.length;
        totalMigrated += globalItems.length;
        console.log(`🏙️ [MIGRATE] ${prefix} → ${globalItems.length} itens copiados para unit:${targetUnitId}`);
      }
    }

    // Migrar chaves individuais
    for (const key of MIGRATE_SINGLE_KEYS) {
      try {
        const value = await kvRaw.get(key);
        if (value) {
          await kvRaw.set(`unit:${targetUnitId}:${key}`, value);
          details[key] = 1;
          totalMigrated += 1;
          console.log(`🏙️ [MIGRATE] ${key} → copiado para unit:${targetUnitId}`);
        }
      } catch (e) {
        // Chave não existe, ignorar
      }
    }

    console.log(`✅ [MIGRATE] Total: ${totalMigrated} itens migrados para unit:${targetUnitId}`);
    return success(c, { 
      migrated: totalMigrated, 
      targetUnitId,
      details,
      message: `${totalMigrated} itens migrados para a unidade "${targetUnitId}". Os dados originais foram mantidos.`
    });
  } catch (e) {
    console.error('❌ [MIGRATE] Erro na migração:', e);
    return error(c, `Erro na migração: ${e}`, 500);
  }
});

export default router;