export function hexToRgba(hex: string, alpha: number): string {
  // Remove o hash se existir
  hex = hex.replace('#', '');

  // Parse dos valores hex
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Retorna a string rgba
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Mapeamento de classes Tailwind para hex
export const TAILWIND_CLASS_TO_HEX: Record<string, string> = {
  'bg-amber-600 hover:bg-amber-700': '#d97706',
  'bg-red-600 hover:bg-red-700': '#dc2626',
  'bg-blue-600 hover:bg-blue-700': '#2563eb',
  'bg-green-600 hover:bg-green-700': '#16a34a',
  'bg-purple-600 hover:bg-purple-700': '#9333ea',
  'bg-pink-600 hover:bg-pink-700': '#db2777',
  'bg-gray-600 hover:bg-gray-700': '#4b5563',
  'bg-black hover:bg-gray-900': '#000000',
  'bg-yellow-600 hover:bg-yellow-700': '#ca8a04',
  'bg-orange-600 hover:bg-orange-700': '#ea580c',
};

/**
 * Resolve uma cor (classe Tailwind ou hex) para hex puro.
 * Retorna null se a cor não puder ser resolvida.
 */
export function resolveColorToHex(color?: string): string | null {
  if (!color) return null;
  if (color.startsWith('#')) return color;
  return TAILWIND_CLASS_TO_HEX[color] || null;
}

/**
 * Escurece uma cor hex em um fator (padrão 15%) para estados hover.
 */
export function darkenHex(hex: string, amount = 0.15): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.max(0, Math.round(r * (1 - amount)));
  const dg = Math.max(0, Math.round(g * (1 - amount)));
  const db = Math.max(0, Math.round(b * (1 - amount)));
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}