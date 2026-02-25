# 🤠 Faroeste Lanches - Sistema de Delivery

Sistema completo de delivery com painel administrativo, integração com impressora térmica e pagamento automático via PIX.

## ✨ Características

- 🛒 **Carrinho de Compras** com observações personalizadas
- 📱 **Integração WhatsApp** para envio de pedidos
- 💳 **Pagamento PIX Automático** via PagSeguro
- 🖨️ **Impressão Térmica** automática (Knup KP-IM605)
- 👨‍💼 **Painel Administrativo** completo
- ⏰ **Controle de Horário** (abertura/fechamento)
- 📊 **Dashboard** com estatísticas em tempo real
- 🚚 **3 Modalidades**: Entrega, Retirada, Consumir no Local

## 🚀 Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **Estilização**: Tailwind CSS v4
- **Backend**: Supabase (Edge Functions + Database)
- **Pagamentos**: PagSeguro PIX
- **Impressão**: Web Serial API (Knup KP-IM605)
- **Roteamento**: React Router DOM

## 📋 Pré-requisitos

- Node.js 18+ 
- NPM ou Yarn
- Conta no Supabase (já configurada ✅)

---

## ⚡ INÍCIO RÁPIDO

### **Opção 1: Setup Automático (Recomendado)**

#### **Windows:**
```bash
setup.bat
```

#### **Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

### **Opção 2: Setup Manual**

#### **1. Instale as dependências**

```bash
npm install
```

#### **2. Configure as variáveis de ambiente**

O arquivo `.env` já está criado com as credenciais do Supabase!

Você só precisa adicionar seu token do PagSeguro:

```env
VITE_PAGSEGURO_TOKEN=seu_token_aqui
```

#### **3. Rode o projeto**

```bash
npm run dev
```

O aplicativo abrirá automaticamente em `http://localhost:3000`

## 🏗️ Build para Produção

```bash
npm run build
```

Os arquivos otimizados serão gerados na pasta `dist/`

Para testar o build localmente:

```bash
npm run preview
```

## 📱 Funcionalidades Principais

### Para Clientes:
- ✅ Cardápio completo com categorias
- ✅ Carrinho de compras com observações personalizadas
- ✅ Três modalidades: Entrega, Retirada, Consumir no Local
- ✅ Pagamento via PIX (QR Code automático) ou Cartão
- ✅ Rastreamento de pedidos em tempo real
- ✅ Integração com WhatsApp
- ✅ Status da loja (aberto/fechado)

### Para Administradores:
- 🔐 Acesso via `/admin/faroeste2000`
- 📊 Dashboard com estatísticas
- 📦 Gestão de pedidos em tempo real
- 🍔 Gerenciamento de produtos
- ⏱️ Configuração de tempos de entrega
- 🖨️ Conexão com impressora térmica
- 💰 Histórico de vendas

## 🖨️ Impressora Térmica

### Modelo Suportado
- **Knup KP-IM605** (58mm)

### Como Conectar
1. Acesse o painel admin
2. Vá em "Configurações"
3. Clique em "Conectar Impressora"
4. Selecione a porta USB da impressora
5. Teste a impressão

### Impressão Automática
- ✅ Cupom impresso automaticamente no checkout
- ✅ Pode ser reimpresso pelo admin
- ✅ Inclui todas as observações do cliente

## 💳 Pagamento PIX (PagSeguro)

### Configuração no Supabase

As Edge Functions já estão configuradas. Se precisar reconfigurar:

1. Acesse o painel do Supabase
2. Vá em "Edge Functions"
3. Configure a variável de ambiente:
   ```
   PAGSEGURO_TOKEN=seu-token-aqui
   ```

### Fluxo de Pagamento
1. Cliente escolhe PIX no checkout
2. QR Code gerado automaticamente
3. Cliente paga e envia comprovante
4. Webhook confirma o pagamento
5. Pedido é enviado ao WhatsApp

## 🗄️ Banco de Dados

### Estrutura
O sistema usa uma tabela key-value (`kv_store_cc536b4d`) que armazena:
- Produtos
- Pedidos
- Configurações
- Estimativas de tempo

### Acesso
```typescript
import * as kv from './supabase/functions/server/kv_store'

// Exemplos
await kv.get('products')
await kv.set('key', value)
await kv.getByPrefix('order_')
```

## 🔐 Segurança

- ✅ Service Role Key **NUNCA** é exposta no frontend
- ✅ Edge Functions rodam no servidor Supabase
- ✅ Webhook do PagSeguro valida assinatura
- ✅ Senha de admin configurável

## 📂 Estrutura de Pastas

```
/
├── components/          # Componentes React
│   ├── admin/          # Painel administrativo
│   ├── figma/          # Componentes do Figma
│   └── ui/             # Componentes de UI
├── supabase/
│   └── functions/
│       └── server/     # Edge Functions (backend)
├── utils/              # Utilitários
├── styles/             # Estilos globais
├── App.tsx             # App principal (cliente)
├── admin.tsx           # App admin
└── main.tsx            # Ponto de entrada
```

## 🛠️ Scripts Disponíveis

```bash
npm run dev      # Servidor de desenvolvimento
npm run build    # Build para produção
npm run preview  # Preview do build
npm run lint     # Verificar código
```

## 🌐 Deploy

### Opção 1: Vercel (Recomendado)
1. Conecte seu repositório
2. Configure as variáveis de ambiente
3. Deploy automático!

### Opção 2: Netlify
1. `npm run build`
2. Faça upload da pasta `dist/`
3. Configure redirects para SPA

### Opção 3: Supabase Hosting
```bash
npx supabase deploy
```

## 📞 Suporte

- WhatsApp: (64) 99339-2970
- Endereço: Praça Lucio Prado - Goiatuba/GO

## 📄 Licença

Desenvolvido para Faroeste Lanches © 2025

---

## 🎯 Próximos Passos

Depois de instalar:

1. ✅ Teste o pedido completo (cliente → PIX → impressão → WhatsApp)
2. ✅ Configure os horários de funcionamento no admin
3. ✅ Conecte a impressora térmica
4. ✅ Teste todos os fluxos de pagamento
5. ✅ Configure o PagSeguro seguindo `PAGSEGURO_SETUP.md`

## 🐛 Problemas Comuns

### "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Impressora não conecta
- Verifique se está usando Chrome/Edge
- Confirme que a impressora está ligada
- Teste a porta USB

### PIX não gera QR Code
- Verifique o token do PagSeguro
- Confirme que o webhook está configurado
- Veja logs no Supabase Edge Functions

---

**Desenvolvido com ❤️ para Faroeste Lanches** 🤠🍔