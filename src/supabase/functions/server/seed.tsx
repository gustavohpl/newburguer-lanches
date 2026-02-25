// Script para popular o banco com produtos iniciais
// Este arquivo não é executado automaticamente, apenas como referência

import * as kv from "./kv_retry.tsx";

const INITIAL_PRODUCTS = [
  {
    name: 'Estrogonofe de Frango',
    description: 'Estrogonofe de frango cremoso com arroz branco',
    price: 18.00,
    category: 'pratos',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Lasanha à Bolonhesa',
    description: 'Lasanha tradicional com molho bolonhesa e queijo gratinado',
    price: 22.00,
    category: 'pratos',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Arroz com Feijão e Bife',
    description: 'Arroz branco, feijão preto e bife acebolado',
    price: 15.00,
    category: 'pratos',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Frango Grelhado',
    description: 'Peito de frango grelhado com legumes e arroz',
    price: 16.50,
    category: 'pratos',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Macarrão ao Molho Branco',
    description: 'Macarrão com molho branco e frango desfiado',
    price: 17.00,
    category: 'pratos',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Feijoada Completa',
    description: 'Feijoada com arroz, couve, farofa e laranja',
    price: 25.00,
    category: 'pratos',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Brigadeiro',
    description: 'Brigadeiro gourmet de chocolate',
    price: 3.50,
    category: 'doces',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Beijinho',
    description: 'Beijinho de coco cremoso',
    price: 3.50,
    category: 'doces',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Brownie',
    description: 'Brownie de chocolate com nozes',
    price: 8.00,
    category: 'doces',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Torta de Limão',
    description: 'Torta de limão com merengue',
    price: 9.00,
    category: 'doces',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Pudim',
    description: 'Pudim de leite condensado',
    price: 7.50,
    category: 'doces',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Mousse',
    description: 'Mousse de maracujá',
    price: 6.50,
    category: 'doces',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Refrigerante',
    description: 'Refrigerante lata 350ml',
    price: 5.00,
    category: 'bebidas',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Suco Natural',
    description: 'Suco natural de laranja 500ml',
    price: 7.00,
    category: 'bebidas',
    imageUrl: null,
    available: true,
  },
  {
    name: 'Água Mineral',
    description: 'Água mineral 500ml',
    price: 3.00,
    category: 'bebidas',
    imageUrl: null,
    available: true,
  },
];

export async function seedProducts() {
  for (const product of INITIAL_PRODUCTS) {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(`product:${id}`, {
      ...product,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  console.log('✅ Produtos iniciais criados com sucesso!');
}
