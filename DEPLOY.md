# 🚀 NewBurguer Lanches — Deploy na Vercel + Supabase

## Arquitetura

| Camada    | Tecnologia                  | Hospedagem        |
|-----------|-----------------------------|-------------------|
| Frontend  | React + Vite + Tailwind v4  | **Vercel**        |
| Backend   | Hono (Deno Edge Functions)  | **Supabase** (já ativo) |
| Banco     | PostgreSQL (KV Store)       | **Supabase** (já ativo) |

> O backend e banco de dados **já estão funcionando** no Supabase (`tptkjcihtqjvonqvmhew.supabase.co`).
> Só precisamos fazer o deploy do **frontend** na Vercel.

---

## Passo a Passo

### 1. Subir o projeto no GitHub

```bash
# Na pasta do projeto (onde está este arquivo)
git init
git add .
git commit -m "migração Figma Make → Vercel"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/newburguer-lanches.git
git push -u origin main
```

### 2. Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New → Project"**
3. Importe o repositório `newburguer-lanches` do GitHub
4. A Vercel vai detectar automaticamente:
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Clique em **"Deploy"**

### 3. Domínio personalizado (opcional)

Na Vercel, vá em **Settings → Domains** e adicione seu domínio.

---

## O que foi configurado (sem alterar código)

| Arquivo             | O que faz                                                |
|---------------------|----------------------------------------------------------|
| `package.json`      | Dependências fixadas com versões corretas para npm       |
| `vite.config.ts`    | Plugin Tailwind v4 + aliases para imports do Figma Make  |
| `tsconfig.json`     | TypeScript config na raiz para build correto             |
| `vercel.json`       | SPA routing (todas as rotas → index.html)                |
| `index.html`        | Entry point do Vite na raiz                              |
| `globals.css`       | Adicionado `@import "tailwindcss"` (diretiva de build)   |
| `.gitignore`        | Ignora node_modules, dist, .env                          |
| `public/vite.svg`   | Favicon na pasta public da raiz                          |

### Aliases do Figma Make (tratados no vite.config.ts)

- `sonner@2.0.3` → `sonner`
- `react-hook-form@7.55.0` → `react-hook-form`
- `figma:asset/...` → `./src/assets/...`
- `@supabase/supabase-js@2` → `@supabase/supabase-js`

---

## Estrutura do Projeto

```
newburguer-lanches/
├── index.html          ← Entry point do Vite
├── package.json        ← Dependências (npm)
├── vite.config.ts      ← Config do Vite + Tailwind v4
├── tsconfig.json       ← TypeScript
├── vercel.json         ← Config da Vercel (SPA routing)
├── public/
│   └── vite.svg
└── src/
    ├── main.tsx        ← Bootstrap do React
    ├── App.tsx         ← Componente principal
    ├── admin.tsx       ← Página admin
    ├── ConfigContext.tsx
    ├── styles/
    │   └── globals.css ← CSS + Tailwind v4 theme
    ├── components/     ← 110 componentes React
    ├── hooks/          ← Custom hooks
    ├── utils/
    │   ├── api.ts      ← Chamadas ao backend Supabase
    │   └── supabase/
    │       ├── client.ts
    │       └── info.tsx ← Project ID + Anon Key
    ├── assets/         ← Imagens do Figma
    └── supabase/       ← Edge Functions (referência, roda no Supabase)
```

---

## Troubleshooting

**Build falha com erro de TypeScript?**
→ O `tsconfig.json` está com `strict: false` para evitar erros de tipo do Figma Make.

**Rotas retornam 404 na Vercel?**
→ O `vercel.json` tem rewrite para SPA. Se não funcionar, adicione um arquivo `public/_redirects` com: `/* /index.html 200`

**Estilos diferentes do Figma Make?**
→ Verifique se o Tailwind v4 está compilando. O `@import "tailwindcss"` no globals.css é essencial.
