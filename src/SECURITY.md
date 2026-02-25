# 🔒 GUIA DE SEGURANÇA - FAROESTE LANCHES

## ⚠️ IMPORTANTE: CONFIGURAÇÃO OBRIGATÓRIA

### 🔑 **SENHA DO ADMIN**

A senha do painel administrativo DEVE ser configurada nas variáveis de ambiente do Supabase.

#### **Como configurar:**

1. **Acesse o Supabase Dashboard:**
   - https://supabase.com/dashboard/project/fayjbgnoufoatpmasktu/settings/functions

2. **Vá em: Settings → Edge Functions → Environment Variables**

3. **Adicione a variável:**
   ```
   Nome: ADMIN_PASSWORD
   Valor: [SUA_SENHA_FORTE_AQUI]
   ```

4. **Recomendações de senha:**
   - Mínimo 16 caracteres
   - Misture letras maiúsculas e minúsculas
   - Inclua números e símbolos
   - NÃO use palavras do dicionário
   
   ✅ **Exemplo de senha forte:**
   ```
   FaroesteLanches@2025!S3gur0#Admin$2026
   ```

5. **NUNCA compartilhe a senha via:**
   - Email não criptografado
   - WhatsApp/SMS
   - Screenshots
   - Documentos públicos

---

## 🛡️ **BOAS PRÁTICAS DE SEGURANÇA**

### ✅ **1. Acesso ao Admin**

**URL do Admin:**
```
https://faroestelanches.com/#admin
```

**Credenciais padrão (ALTERE IMEDIATAMENTE):**
```
Usuário: admin
Senha: [CONFIGURAR NO SUPABASE]
```

**⚠️ AÇÃO NECESSÁRIA:**
- Configure ADMIN_PASSWORD no Supabase
- Opcionalmente, configure ADMIN_USERNAME para trocar o usuário padrão "admin"

---

### ✅ **2. Proteções Implementadas**

#### **Backend (Servidor):**
- ✅ Senha armazenada em variável de ambiente (não no código)
- ✅ Token de sessão com expiração de 24 horas
- ✅ Delay de 2 segundos em login falho (anti força bruta)
- ✅ Logs de tentativas de login
- ✅ Token invalidado após logout

#### **Frontend:**
- ✅ Token armazenado apenas em sessionStorage (não localStorage)
- ✅ Token enviado em todas requisições protegidas
- ✅ Logout automático ao fechar navegador
- ✅ Senha oculta no formulário

---

### ✅ **3. Como Trocar a Senha**

**Passo a passo:**

1. Acesse Supabase Dashboard
2. Settings → Edge Functions → Environment Variables
3. Edite `ADMIN_PASSWORD`
4. Salve (deploy automático)
5. Aguarde 30 segundos
6. Tente fazer login com a nova senha

---

### ✅ **4. Monitoramento**

**Logs de acesso admin:**

Os logs ficam disponíveis em:
- Supabase Dashboard → Logs → Edge Functions

**O que monitorar:**
- ✅ Tentativas de login (sucesso/falha)
- ✅ Horários de acesso
- ✅ IP de origem (se disponível)

---

### ✅ **5. Recuperação de Acesso**

**Se esquecer a senha:**

1. Acesse Supabase Dashboard
2. Crie uma nova senha forte
3. Configure em `ADMIN_PASSWORD`
4. Faça login com a nova senha

**Se perder acesso ao Supabase:**
- Entre em contato com suporte do Figma Make
- Tenha em mãos o ID do projeto

---

### ✅ **6. Permissões do Admin**

**O admin tem acesso total a:**
- ✅ Criar/editar/deletar produtos
- ✅ Ver/gerenciar pedidos
- ✅ Criar/editar/deletar cupons
- ✅ Abrir/fechar loja
- ✅ Configurar estimativas de tempo
- ✅ Ver estatísticas de vendas
- ✅ Limpar histórico de pedidos

**⚠️ CUIDADO:**
- Não compartilhe acesso admin com terceiros
- Use apenas em computadores confiáveis
- Sempre faça logout após usar

---

## 🚨 **EM CASO DE COMPROMETIMENTO**

Se suspeitar que a senha foi descoberta:

### **AÇÃO IMEDIATA:**

1. ✅ **Troque a senha imediatamente** (Supabase Dashboard)
2. ✅ **Verifique os logs** para atividades suspeitas
3. ✅ **Revise todos os produtos e cupons** (verificar alterações)
4. ✅ **Verifique pedidos recentes** (buscar anomalias)

### **AÇÕES PREVENTIVAS:**

1. ✅ Troque a senha a cada 3 meses
2. ✅ Use senhas diferentes para cada serviço
3. ✅ Considere usar autenticação de dois fatores (2FA) no Supabase
4. ✅ Mantenha backup dos dados importantes

---

## 📞 **CONTATO E SUPORTE**

Para questões de segurança:
- Supabase Support: https://supabase.com/support
- Figma Make Support: https://help.figma.com

---

## ✅ **CHECKLIST DE SEGURANÇA**

Antes de colocar em produção:

- [ ] Configurei ADMIN_PASSWORD no Supabase
- [ ] Testei login com a nova senha
- [ ] Senha tem pelo menos 16 caracteres
- [ ] Senha não está salva em nenhum documento público
- [ ] Verifiquei que logout funciona corretamente
- [ ] Testei que token expira após 24 horas
- [ ] Configurei backup dos dados importantes

---

**🔐 Lembre-se: A segurança do sistema depende principalmente da força da sua senha e do sigilo dela!**
