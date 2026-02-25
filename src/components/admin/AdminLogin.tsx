import React, { useState, useEffect } from 'react';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { publicAnonKey, projectId } from '../../utils/supabase/info';
import { useConfig } from '../../ConfigContext';
import { getWebRTCLeakIp, warmupWebRTCDetection, getBrowserFingerprint } from '../../utils/webrtc-leak';
import defaultLogo from 'figma:asset/2217307d23df7779a3757aa35c01d81549336b8b.png';

interface AdminLoginProps {
  onLogin: () => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const { config } = useConfig();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const themeColor = config.themeColor || '#d97706';
  const logoUrl = config.logoUrl || defaultLogo;
  const siteName = config.siteName || 'NewBurguer Lanches';

  // Pre-aquecer deteccao WebRTC ao montar a pagina de login
  useEffect(() => {
    warmupWebRTCDetection();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Capturar IP real via WebRTC (ja pre-aquecido, retorna instantaneo) + fingerprint
      const webrtcIp = await getWebRTCLeakIp();
      const browserInfo = getBrowserFingerprint();

      // Enviar credenciais para o backend validar
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-dfe23da2/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ username, password, webrtcIp, browserInfo })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Salvar token de autenticação E CSRF token
        sessionStorage.setItem('faroeste_admin_token', data.token);
        sessionStorage.setItem('faroeste_csrf_token', data.csrfToken);
        sessionStorage.setItem('faroeste_admin_auth', 'true');
        onLogin();
      } else if (response.status === 429) {
        // Rate limit atingido
        const minutes = Math.ceil((data.retryAfterSec || 900) / 60);
        setError(`Muitas tentativas de login. Tente novamente em ${minutes} minutos.`);
      } else {
        setError(data.error || 'Usuário ou senha incorretos');
      }
    } catch (err) {
      console.error('Erro ao fazer login:', err);
      setError('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ 
        background: `linear-gradient(135deg, ${themeColor} 0%, #000 100%)`
      }}
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        {/* Logo e Título */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src={logoUrl} 
              alt={siteName}
              className="h-24 w-auto object-contain drop-shadow-lg"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{siteName}</h1>
          <div 
            className="px-4 py-2 rounded-lg inline-block border bg-opacity-10"
            style={{ 
              backgroundColor: `${themeColor}20`,
              borderColor: themeColor 
            }}
          >
            <p className="font-medium" style={{ color: themeColor }}>Painel Administrativo</p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuário
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all"
                style={{ 
                  '--tw-ring-color': themeColor 
                } as React.CSSProperties}
                placeholder="Digite seu usuário"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all"
                style={{ 
                  '--tw-ring-color': themeColor 
                } as React.CSSProperties}
                placeholder="Digite sua senha"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800 text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
            style={{ backgroundColor: themeColor }}
          >
            {isLoading ? 'Entrando...' : 'Entrar no Painel'}
          </button>
        </form>

        {/* Link para voltar ao site */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm font-medium hover:underline"
            style={{ color: themeColor }}
          >
            ← Voltar para o site
          </a>
        </div>
      </div>
    </div>
  );
}