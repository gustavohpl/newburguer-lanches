// Utilitários para manipulação de cores e temas

// Converte Hex para RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Converte RGB para HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Converte HSL para Hex
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Gera a paleta completa baseada em uma cor base
export function generatePalette(baseColorHex: string) {
  const rgb = hexToRgb(baseColorHex);
  if (!rgb) return null;
  
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  
  // Ajustes finos para garantir que a cor base seja próxima do tom 600
  const baseHue = hsl.h;
  const baseSat = Math.max(hsl.s, 20); // Garantir saturação mínima
  
  // Regra monocromática: Mantém Hue, varia Lightness
  const palette = {
    50: hslToHex(baseHue, baseSat, 97),
    100: hslToHex(baseHue, baseSat, 94),
    200: hslToHex(baseHue, baseSat, 86),
    300: hslToHex(baseHue, baseSat, 77),
    400: hslToHex(baseHue, baseSat, 66),
    500: hslToHex(baseHue, baseSat, 55),
    600: baseColorHex, // A cor escolhida é a principal (600)
    700: hslToHex(baseHue, baseSat, 39),
    800: hslToHex(baseHue, baseSat, 32),
    900: hslToHex(baseHue, baseSat, 24),
    950: hslToHex(baseHue, baseSat, 14),
  };

  return palette;
}

// Injeta as variáveis CSS no documento
export function applyTheme(
  baseColorHex: string, 
  modeConfig?: { 
    backgroundColor?: string; 
    cardColor?: string; 
    textColor?: string;
  }
) {
  const palette = generatePalette(baseColorHex);
  if (!palette) return;

  const root = document.documentElement;
  
  // Definir variáveis CSS
  Object.entries(palette).forEach(([shade, hex]) => {
    root.style.setProperty(`--color-primary-${shade}`, hex);
  });
  
  // Variáveis funcionais (atalhos)
  root.style.setProperty('--color-primary-main', palette[600]);
  root.style.setProperty('--color-primary-light', palette[100]);
  root.style.setProperty('--color-primary-dark', palette[800]);

  // Injetar overrides de classes do Tailwind IMEDIATAMENTE para evitar FOUC
  const styleId = 'theme-overrides';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement;
  
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  // Base CSS (Cores do Tema Principal)
  let css = `
    .bg-amber-50 { background-color: ${palette[50]}; }
    .bg-amber-100 { background-color: ${palette[100]}; }
    .bg-amber-200 { background-color: ${palette[200]}; }
    .bg-amber-300 { background-color: ${palette[300]}; }
    .bg-amber-400 { background-color: ${palette[400]}; }
    .bg-amber-500 { background-color: ${palette[500]}; }
    .bg-amber-600 { background-color: ${palette[600]}; }
    .bg-amber-700 { background-color: ${palette[700]}; }
    .bg-amber-800 { background-color: ${palette[800]}; }
    .bg-amber-900 { background-color: ${palette[900]}; }
    .bg-amber-950 { background-color: ${palette[950]}; }
    
    .text-amber-50 { color: ${palette[50]}; }
    .text-amber-100 { color: ${palette[100]}; }
    .text-amber-200 { color: ${palette[200]}; }
    .text-amber-300 { color: ${palette[300]}; }
    .text-amber-400 { color: ${palette[400]}; }
    .text-amber-500 { color: ${palette[500]}; }
    .text-amber-600 { color: ${palette[600]}; }
    .text-amber-700 { color: ${palette[700]}; }
    .text-amber-800 { color: ${palette[800]}; }
    .text-amber-900 { color: ${palette[900]}; }
    .text-amber-950 { color: ${palette[950]}; }
    
    .border-amber-100 { border-color: ${palette[100]}; }
    .border-amber-200 { border-color: ${palette[200]}; }
    .border-amber-300 { border-color: ${palette[300]}; }
    .border-amber-400 { border-color: ${palette[400]}; }
    .border-amber-500 { border-color: ${palette[500]}; }
    .border-amber-600 { border-color: ${palette[600]}; }
    
    .ring-amber-500 { --tw-ring-color: ${palette[500]}; }
    
    .from-amber-500 { --tw-gradient-from: ${palette[500]}; }
    .to-amber-600 { --tw-gradient-to: ${palette[600]}; }
    .from-amber-600 { --tw-gradient-from: ${palette[600]}; }
    .to-amber-700 { --tw-gradient-to: ${palette[700]}; }
    .to-amber-800 { --tw-gradient-to: ${palette[800]}; }

    .hover\\:bg-amber-600:hover { background-color: ${palette[600]}; }
    .hover\\:bg-amber-700:hover { background-color: ${palette[700]}; }
  `;

  // Se houver configuração de Modo Escuro / Cores Customizadas
  if (modeConfig) {
    const scope = '#client-app';
    
    // 1. Fundo da Página (Page Background)
    if (modeConfig.backgroundColor && modeConfig.backgroundColor !== '#f9fafb') {
      css += `
        ${scope} { background-color: ${modeConfig.backgroundColor} !important; }
        /* Apenas sobrescreve se não estiver no modo escuro do tailwind ou se for uma cor específica */
        :not(.dark) ${scope} .bg-gray-50, :not(.dark) ${scope} .bg-gray-100 { background-color: ${modeConfig.backgroundColor} !important; }
      `;
    }

    // 2. Fundo dos Cartões (Card Background)
    if (modeConfig.cardColor && modeConfig.cardColor !== '#ffffff') {
      css += `
        :not(.dark) ${scope} .bg-white { background-color: ${modeConfig.cardColor} !important; }
        .dark ${scope} .bg-card,
        .dark ${scope} [class*="dark:bg-zinc-900"],
        ${scope}.dark .bg-card,
        ${scope}.dark [class*="dark:bg-zinc-900"] { background-color: ${modeConfig.cardColor} !important; }
      `;
    }

    // 3. Cor do Texto (Text Color)
    if (modeConfig.textColor && modeConfig.textColor !== '#111827') {
      css += `
        :not(.dark) ${scope} .text-gray-900, :not(.dark) ${scope} .text-gray-800, :not(.dark) ${scope} .text-gray-700 { color: ${modeConfig.textColor} !important; }
      `;
      
      // Ajuste para textos secundários se estivermos em modo escuro manual (texto claro)
      const rgb = hexToRgb(modeConfig.textColor);
      if (rgb && (rgb.r*0.299 + rgb.g*0.587 + rgb.b*0.114) > 186) {
         // É modo escuro manual (texto claro)
         css += `
           ${scope} .text-gray-600, ${scope} .text-gray-500, ${scope} .text-gray-400 { color: #9AA0A6 !important; }
           ${scope} .border-gray-200, ${scope} .border-gray-300, ${scope} .border-gray-100 { border-color: #3C4043 !important; }
           ${scope} .divide-gray-200 > :not([hidden]) ~ :not([hidden]) { border-color: #3C4043 !important; }
           
           ${scope} input, ${scope} select, ${scope} textarea { 
             background-color: #303134 !important; 
             color: #E8EAED !important;
             border-color: #5F6368 !important;
           }
         `;
      }
    }
  }

  styleEl.textContent = css;
}