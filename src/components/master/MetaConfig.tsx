import React, { useEffect, useState } from 'react';
import { CheckCircle, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { masterFetch } from '../../utils/api';

type Estado = { temToken: boolean; conta: string; pagina: string; instagram: string; pixel?: string; resultado?: { nome?: string; moeda?: string; pagina?: string | null } | null; erroConta?: string };

// token do usuário do sistema vai direto para o servidor e nunca volta para a tela; os IDs não são segredo
// com franquia, cada cidade tem a própria Meta (rede social da loja da cidade, a mesma para as unidades dela)
export function MetaConfig({ cidades = [] }: { cidades?: { id: string; rotulo: string }[] }) {
  const [cidade, setCidade] = useState('');
  const [pixel, setPixel] = useState('');
  const doEscopo = cidade ? { headers: { 'X-City-Id': cidade } } : {};
  const [estado, setEstado] = useState<Estado | null>(null);
  const [token, setToken] = useState('');
  const [conta, setConta] = useState('');
  const [pagina, setPagina] = useState('');
  const [instagram, setInstagram] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [aviso, setAviso] = useState('');

  const carregar = async (testar = false) => {
    setOcupado(testar ? 'testar' : 'carregar');
    const r = await masterFetch(`/master/meta${testar ? '?testar=1' : ''}`, doEscopo).then((x) => x.json()).catch(() => null);
    if (r?.success) {
      setEstado(r);
      setConta(r.conta);
      setPagina(r.pagina);
      setInstagram(r.instagram);
      setPixel(r.pixel || '');
    } else setAviso(r?.error || 'Não foi possível ler a configuração da Meta.');
    setOcupado('');
  };
  useEffect(() => { setEstado(null); setAviso(''); if (!cidades.length || cidade) carregar(); }, [cidade]);

  const salvar = async (apagar = false) => {
    if (apagar && !confirm('Desconectar a Meta? Os anúncios continuam na conta, mas o Admin deixa de vê-los.')) return;
    setOcupado('salvar');
    const r = await masterFetch('/master/meta', { ...doEscopo, method: 'POST', body: JSON.stringify(apagar ? { apagar: true } : { token, conta, pagina, instagram, ...(cidade ? { pixel } : {}) }) }).then((x) => x.json()).catch(() => null);
    setOcupado('');
    if (!r?.success) return setAviso(r?.error || 'Não foi possível salvar.');
    setToken('');
    setAviso(apagar ? 'Meta desconectada.' : 'Salvo no servidor.');
    carregar(!apagar);
  };

  const campo = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm';
  const seletor = cidades.length > 0 && (
    <label className="block text-sm font-medium text-gray-700">Cidade
      <select value={cidade} onChange={(e) => setCidade(e.target.value)} className={campo}>
        <option value="">Escolha a cidade</option>
        {cidades.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
      </select>
    </label>
  );
  if (cidades.length && !cidade) return <div className="space-y-4">{seletor}</div>;
  return (
    <div className="space-y-4">
      {seletor}
      <span className={`inline-flex items-center gap-1 text-xs font-bold ${estado?.temToken ? 'text-green-700' : 'text-red-600'}`}>
        {estado?.temToken ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        {estado?.temToken ? 'Token configurado' : 'Token faltando'}
      </span>
      {estado?.resultado && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">
          Conta de anúncios <b>{estado.resultado.nome}</b> ({estado.resultado.moeda}){estado.resultado.pagina && <> · Página <b>{estado.resultado.pagina}</b></>}
        </p>
      )}
      {estado?.erroConta && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{estado.erroConta}</p>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Token do usuário do sistema</label>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" className={campo}
          placeholder={estado?.temToken ? '•••••••• (deixe vazio para manter)' : 'EAA...'} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm font-medium text-gray-700">Conta de anúncios (ID)<input value={conta} onChange={(e) => setConta(e.target.value)} className={campo} placeholder="act_123… ou 123…" /></label>
        <label className="text-sm font-medium text-gray-700">Página do Facebook (ID)<input value={pagina} onChange={(e) => setPagina(e.target.value)} className={campo} placeholder="123…" /></label>
        <label className="text-sm font-medium text-gray-700">Instagram (ID da conta)<input value={instagram} onChange={(e) => setInstagram(e.target.value)} className={campo} placeholder="1784…" /></label>
      </div>
      {cidade && <label className="block text-sm font-medium text-gray-700">Pixel ID desta cidade<input value={pixel} onChange={(e) => setPixel(e.target.value)} className={campo} placeholder="123456789012345" /></label>}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-gray-700 space-y-1">
        <p className="font-semibold text-blue-900">Como conectar (Meta Business Suite → Configurações do negócio):</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Crie (ou use) a <b>conta de anúncios</b> e ligue a <b>Página</b> e o <b>Instagram</b> da loja ao portfólio.</li>
          <li>Em <b>Apps</b>, crie um app do tipo <b>Marketing</b> e <b>publique</b> o app (a Meta só deixa criar anúncio com app publicado).</li>
          <li>Em <b>Usuários do sistema</b>, crie um usuário Admin, dê acesso à conta de anúncios, à Página e ao Instagram e gere o token com <b>ads_management, ads_read, business_management, pages_read_engagement, pages_show_list, instagram_basic</b>.</li>
          <li>Cole o token e os três IDs acima, salve e clique em <b>Testar conexão</b>.</li>
        </ol>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => salvar()} disabled={!!ocupado} className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50">
          {ocupado === 'salvar' ? 'Salvando...' : 'Salvar no servidor'}
        </button>
        <button type="button" onClick={() => carregar(true)} disabled={!!ocupado || !estado?.temToken} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${ocupado === 'testar' ? 'animate-spin' : ''}`} />Testar conexão
        </button>
        {estado?.temToken && (
          <button type="button" onClick={() => salvar(true)} disabled={!!ocupado} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 inline-flex items-center gap-2">
            <Trash2 className="w-4 h-4" />Desconectar
          </button>
        )}
      </div>
      {aviso && <p className="text-sm text-gray-700">{aviso}</p>}
    </div>
  );
}
