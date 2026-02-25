/**
 * WebRTC IP Leak Detection
 * 
 * Tecnica: Criar RTCPeerConnection com servidores STUN publicos.
 * O ICE candidate gathering revela o IP real do cliente,
 * mesmo que ele esteja atras de uma VPN (se a VPN nao bloquear WebRTC).
 * 
 * VPNs modernas (NordVPN, ExpressVPN) geralmente bloqueiam isso,
 * mas VPNs gratuitas/baratas frequentemente vazam o IP real.
 * 
 * Retorna null se:
 * - WebRTC nao for suportado
 * - A VPN bloquear WebRTC
 * - Timeout de 5s for atingido
 * - Apenas IPs privados forem encontrados
 */

// IPs privados (RFC 1918 + loopback + link-local)
const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.|::1|fc00:|fe80:)/;

// Extrair IP de uma linha SDP candidata
function extractIpFromCandidate(candidateStr: string): string | null {
  // Formato: "candidate:... typ srflx raddr ... rport ..."
  // ou "candidate:... <IP> <port> typ ..."
  const parts = candidateStr.split(' ');
  
  // O IP publico geralmente esta no campo 5 (indice 4) do candidate
  // Formato padrao: foundation component protocol priority ip port typ ...
  if (parts.length >= 5) {
    const ip = parts[4];
    if (ip && isValidIp(ip)) {
      return ip;
    }
  }
  return null;
}

function isValidIp(str: string): boolean {
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(str)) return true;
  // IPv6 (simplificado)
  if (str.includes(':') && /^[0-9a-fA-F:]+$/.test(str)) return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_REGEX.test(ip);
}

export interface WebRTCLeakResult {
  /** IP publico real detectado via WebRTC (null se bloqueado/indisponivel) */
  realIp: string | null;
  /** Todos os IPs encontrados (incluindo privados) para debug */
  allIps: string[];
  /** Se o WebRTC foi bloqueado ou nao suportado */
  blocked: boolean;
  /** Tempo em ms que levou para detectar */
  durationMs: number;
}

/**
 * Detecta o IP real via WebRTC STUN.
 * Roda silenciosamente — nao mostra nada ao usuario.
 * Timeout de 5 segundos.
 */
export function detectWebRTCLeak(timeoutMs = 5000): Promise<WebRTCLeakResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const foundIps = new Set<string>();
    let resolved = false;

    const finish = (blocked = false) => {
      if (resolved) return;
      resolved = true;
      
      const allIps = Array.from(foundIps);
      const publicIps = allIps.filter(ip => !isPrivateIp(ip));
      
      resolve({
        realIp: publicIps.length > 0 ? publicIps[0] : null,
        allIps,
        blocked,
        durationMs: Date.now() - startTime
      });
    };

    // Timeout de seguranca
    const timer = setTimeout(() => {
      finish(foundIps.size === 0);
    }, timeoutMs);

    try {
      // Verificar suporte a WebRTC
      const RTCPeerConnection = (window as any).RTCPeerConnection 
        || (window as any).webkitRTCPeerConnection 
        || (window as any).mozRTCPeerConnection;

      if (!RTCPeerConnection) {
        clearTimeout(timer);
        finish(true);
        return;
      }

      // Multiplos servidores STUN para maximizar chance de sucesso
      const config: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
        ]
      };

      const pc = new RTCPeerConnection(config);
      
      // Criar data channel dummy para trigger ICE
      pc.createDataChannel('webrtc-leak-detect');

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          // ICE gathering completo
          clearTimeout(timer);
          setTimeout(() => {
            try { pc.close(); } catch (_) {}
            finish();
          }, 300); // Pequeno delay para pegar candidatos tardios
          return;
        }

        const candidate = event.candidate.candidate;
        if (!candidate) return;

        const ip = extractIpFromCandidate(candidate);
        if (ip) {
          foundIps.add(ip);

          // Se encontramos um IP publico, podemos resolver mais cedo
          if (!isPrivateIp(ip) && !resolved) {
            clearTimeout(timer);
            // Dar mais 500ms para pegar outros candidatos
            setTimeout(() => {
              try { pc.close(); } catch (_) {}
              finish();
            }, 500);
          }
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          setTimeout(() => {
            try { pc.close(); } catch (_) {}
            finish();
          }, 100);
        }
      };

      // Criar offer para iniciar ICE gathering
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timer);
          try { pc.close(); } catch (_) {}
          finish(true);
        });

    } catch (e) {
      clearTimeout(timer);
      console.warn('[WebRTC Leak] Erro ao inicializar:', e);
      finish(true);
    }
  });
}

// Cache: detectar uma vez e reutilizar (o IP real nao muda durante a sessao)
let cachedResult: WebRTCLeakResult | null = null;
let detectPromise: Promise<WebRTCLeakResult> | null = null;

/**
 * Versao com cache — detecta na primeira chamada e reutiliza o resultado.
 * Ideal para chamar em todos os logins sem custo repetido.
 */
export async function getWebRTCLeakIp(): Promise<string | null> {
  if (cachedResult) return cachedResult.realIp;
  
  if (!detectPromise) {
    detectPromise = detectWebRTCLeak().then(result => {
      cachedResult = result;
      if (result.realIp) {
        console.log(`[WebRTC Leak] IP real detectado: ${result.realIp} (${result.durationMs}ms)`);
      } else if (result.blocked) {
        console.log(`[WebRTC Leak] WebRTC bloqueado ou indisponivel (${result.durationMs}ms)`);
      } else {
        console.log(`[WebRTC Leak] Apenas IPs privados encontrados: ${result.allIps.join(', ')} (${result.durationMs}ms)`);
      }
      return result;
    });
  }
  
  const result = await detectPromise;
  return result.realIp;
}

/**
 * Pre-aquecer a deteccao — chamar no load da pagina de login.
 * Nao retorna nada, apenas inicia a deteccao em background.
 */
export function warmupWebRTCDetection(): void {
  getWebRTCLeakIp().catch(() => {});
}

// ======================================================
// 🌐 BROWSER FINGERPRINT — Segunda camada de deteccao
// ======================================================

export interface BrowserFingerprint {
  /** Timezone do navegador (ex: "America/Sao_Paulo") */
  timezone: string;
  /** Offset UTC em minutos (ex: -180 para BRT) */
  timezoneOffset: number;
  /** Idioma principal do navegador (ex: "pt-BR") */
  language: string;
  /** Lista completa de idiomas aceitos */
  languages: string[];
  /** Resolucao de tela */
  screen: string;
  /** Plataforma (ex: "Win32", "MacIntel", "Linux x86_64") */
  platform: string;
  /** Hora local formatada (para comparacao com IP timezone) */
  localTime: string;
}

/**
 * Captura informacoes do navegador que revelam a localizacao real do usuario.
 * 
 * Timezone: se o IP diz "Europe/Berlin" mas o navegador diz "America/Sao_Paulo",
 * e um forte indicativo de VPN.
 * 
 * Idioma: se o IP e da Alemanha mas o idioma e "pt-BR", tambem e suspeito.
 * 
 * Essas informacoes nao podem ser facilmente falsificadas por VPNs comuns.
 */
export function getBrowserFingerprint(): BrowserFingerprint {
  let timezone = 'unknown';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch (_) {}

  const timezoneOffset = new Date().getTimezoneOffset();
  const language = navigator.language || 'unknown';
  const languages = Array.from(navigator.languages || [language]);
  
  const screenW = window.screen?.width || 0;
  const screenH = window.screen?.height || 0;
  const screen = `${screenW}x${screenH}`;
  
  const platform = (navigator as any).userAgentData?.platform 
    || navigator.platform 
    || 'unknown';

  const localTime = new Date().toLocaleString('pt-BR', { 
    timeZone: timezone !== 'unknown' ? timezone : undefined 
  });

  return {
    timezone,
    timezoneOffset,
    language,
    languages,
    screen,
    platform,
    localTime,
  };
}