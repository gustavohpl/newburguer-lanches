import React, { useEffect, useState } from 'react';
import { CheckCircle, Copy, RefreshCw, Trash2, XCircle } from 'lucide-react';
import * as api from '../../utils/api';

type Estado = { temToken: boolean; temSegredo: boolean; webhookUrl: string; conta?: { nome?: string; email?: string } | null; erroConta?: string };

// credenciais vão direto para o servidor e nunca voltam para a tela (só "configurado" / "faltando")
export function MercadoPagoConfig() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [token, setToken] = useState('');
  const [segredo, setSegredo] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [aviso, setAviso] = useState('');

  const carregar = async (testar = false) => {
    setOcupado(testar ? 'testar' : 'carregar');
    const r = await api.masterMercadoPago(testar).catch(() => null);
    if (r?.success) setEstado(r);
    else setAviso(r?.error || 'Não foi possível ler a configuração do Mercado Pago.');
    setOcupado('');
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async (apagar = false) => {
    if (apagar && !confirm('Remover o token e a assinatura do Mercado Pago? O pagamento automático para de funcionar.')) return;
    setOcupado('salvar');
    const r = await api.salvarMercadoPago(apagar ? { apagar: true } : { accessToken: token, webhookSecret: segredo });
    setOcupado('');
    if (!r?.success) return setAviso(r?.error || 'Não foi possível salvar.');
    setToken('');
    setSegredo('');
    setAviso(apagar ? 'Credenciais removidas.' : 'Salvo no servidor.');
    carregar(!apagar);
  };

  const item = (ok: boolean, texto: string) => (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${ok ? 'text-green-700' : 'text-red-600'}`}>
      {ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}{texto}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {item(!!estado?.temToken, estado?.temToken ? 'Access Token configurado' : 'Access Token faltando')}
        {item(!!estado?.temSegredo, estado?.temSegredo ? 'Assinatura do webhook configurada' : 'Assinatura do webhook faltando')}
      </div>
      {estado?.conta && <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">Conectado à conta <b>{estado.conta.nome}</b> {estado.conta.email && `(${estado.conta.email})`}</p>}
      {estado?.erroConta && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{estado.erroConta}</p>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Access Token de produção</label>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off"
          placeholder={estado?.temToken ? '•••••••• (deixe vazio para manter)' : 'APP_USR-...'}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Assinatura secreta do webhook</label>
        <input type="password" value={segredo} onChange={(e) => setSegredo(e.target.value)} autoComplete="off"
          placeholder={estado?.temSegredo ? '•••••••• (deixe vazio para manter)' : 'Copiada do painel do Mercado Pago'}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm" />
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-gray-700 space-y-2">
        <p className="font-semibold text-blue-900">Como ligar (Mercado Pago → Suas integrações → sua aplicação):</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Em <b>Credenciais de produção</b>, copie o <b>Access Token</b> e cole acima.</li>
          <li>Em <b>Webhooks</b> (modo produção), cole a URL abaixo e marque o evento <b>Pagamentos</b>.</li>
          <li>Salve no Mercado Pago, copie a <b>Assinatura secreta</b> e cole acima.</li>
          <li>Clique em <b>Salvar no servidor</b> e depois em <b>Testar conexão</b>.</li>
        </ol>
        {estado?.webhookUrl && (
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-white border border-blue-200 rounded px-2 py-1 break-all">{estado.webhookUrl}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(estado.webhookUrl)} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700" title="Copiar URL">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => salvar()} disabled={!!ocupado || (!token && !segredo)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50">
          {ocupado === 'salvar' ? 'Salvando...' : 'Salvar no servidor'}
        </button>
        <button type="button" onClick={() => carregar(true)} disabled={!!ocupado || !estado?.temToken}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${ocupado === 'testar' ? 'animate-spin' : ''}`} />Testar conexão
        </button>
        {estado?.temToken && (
          <button type="button" onClick={() => salvar(true)} disabled={!!ocupado}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 inline-flex items-center gap-2">
            <Trash2 className="w-4 h-4" />Remover
          </button>
        )}
      </div>
      {aviso && <p className="text-sm text-gray-700">{aviso}</p>}
    </div>
  );
}
