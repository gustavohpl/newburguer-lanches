import { useConfig } from './ConfigContext';

// ============================================================
// 🎨 SISTEMA DE DESIGN
// ============================================================
// Cada "design" define um conjunto de tokens visuais.
// A LÓGICA do site é a mesma — só muda a aparência.
//
// Para adicionar um novo design no futuro:
//   1. Adicione o id em SystemConfig.designStyle (ConfigContext)
//   2. Crie um novo objeto de tokens aqui em DESIGNS
//   3. Adicione a miniatura no seletor do Master
// ============================================================

export type DesignId = 'classic' | 'clean' | 'rustic' | 'threed' | 'prime';

export interface DesignTokens {
  id: DesignId;
  name: string;
  description: string;

  // Header
  showHeaderBackground: boolean;   // usa imagem de fundo no header?
  headerTextClass: string;         // cor do texto do header
  headerLayout: 'immersive' | 'minimal';

  // Fundo geral da página
  pageBackgroundClass: string;     // classe do fundo do site

  // Cards de produto
  cardClass: string;               // container do card
  cardTitleClass: string;
  cardPriceClass: string;
  cardRounded: string;             // arredondamento
  cardShadow: string;

  // Botões
  buttonRounded: string;
  buttonStyle: 'solid' | 'soft';   // sólido (cor cheia) ou suave

  // Categorias
  categoryStyle: 'pill' | 'underline';

  // Status aberto/fechado
  statusStyle: 'badge' | 'dot';

  // Se usa a cor do tema como destaque forte ou suave
  accentIntensity: 'strong' | 'subtle';
}

const DESIGNS: Record<DesignId, DesignTokens> = {
  // ========== DESIGN 1: CLÁSSICO (atual) ==========
  classic: {
    id: 'classic',
    name: 'Clássico',
    description: 'Imersivo, com imagem de fundo e cards escuros',
    showHeaderBackground: true,
    headerTextClass: 'text-white',
    headerLayout: 'immersive',
    pageBackgroundClass: '', // usa o fundo atual (imagem/escuro)
    cardClass: 'bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800',
    cardTitleClass: 'text-zinc-900 dark:text-white font-bold',
    cardPriceClass: 'font-bold',
    cardRounded: 'rounded-2xl',
    cardShadow: 'shadow-lg',
    buttonRounded: 'rounded-full',
    buttonStyle: 'solid',
    categoryStyle: 'pill',
    statusStyle: 'badge',
    accentIntensity: 'strong',
  },

  // ========== DESIGN 2: CLEAN (novo, minimalista) ==========
  clean: {
    id: 'clean',
    name: 'Clean',
    description: 'Minimalista, fundo claro, sem imagem, cantos suaves',
    showHeaderBackground: false,
    headerTextClass: 'text-zinc-900',
    headerLayout: 'minimal',
    pageBackgroundClass: 'bg-zinc-50',
    cardClass: 'bg-white border border-zinc-200',
    cardTitleClass: 'text-zinc-800 font-semibold',
    cardPriceClass: 'font-semibold',
    cardRounded: 'rounded-xl',
    cardShadow: 'shadow-sm hover:shadow-md',
    buttonRounded: 'rounded-lg',
    buttonStyle: 'soft',
    categoryStyle: 'underline',
    statusStyle: 'dot',
    accentIntensity: 'subtle',
  },

  // ========== DESIGN 3: RÚSTICO (dark/dourado, layout próprio) ==========
  rustic: {
    id: 'rustic',
    name: 'Rústico',
    description: 'Dark com dourado, textura de madeira, categorias em círculos',
    showHeaderBackground: true,
    headerTextClass: 'text-amber-50',
    headerLayout: 'immersive',
    pageBackgroundClass: '',
    cardClass: 'border',
    cardTitleClass: 'text-amber-50 font-black uppercase',
    cardPriceClass: 'font-black',
    cardRounded: 'rounded-2xl',
    cardShadow: 'shadow-lg',
    buttonRounded: 'rounded-xl',
    buttonStyle: 'solid',
    categoryStyle: 'pill',
    statusStyle: 'badge',
    accentIntensity: 'strong',
  },

  // ========== DESIGN 4: 3D (hero imersivo com modelo GLB) ==========
  threed: {
    id: 'threed',
    name: '3D',
    description: 'Hero imersivo com modelo 3D do hambúrguer girando ao scroll',
    showHeaderBackground: false,
    headerTextClass: 'text-white',
    headerLayout: 'immersive',
    pageBackgroundClass: '',
    cardClass: 'border',
    cardTitleClass: 'text-white font-bold',
    cardPriceClass: 'font-black',
    cardRounded: 'rounded-2xl',
    cardShadow: 'shadow-lg',
    buttonRounded: 'rounded-xl',
    buttonStyle: 'solid',
    categoryStyle: 'pill',
    statusStyle: 'badge',
    accentIntensity: 'strong',
  },

  // ========== DESIGN 5: PRIME (editorial/cinematográfico, layout próprio) ==========
  prime: {
    id: 'prime',
    name: 'Prime',
    description: 'Editorial cinematográfico: fundo quase preto, tipografia gigante, seções numeradas e cor de destaque',
    showHeaderBackground: false,
    headerTextClass: 'text-white',
    headerLayout: 'immersive',
    pageBackgroundClass: '',
    cardClass: 'border',
    cardTitleClass: 'text-white font-black uppercase',
    cardPriceClass: 'font-black',
    cardRounded: 'rounded-2xl',
    cardShadow: 'shadow-2xl',
    buttonRounded: 'rounded-full',
    buttonStyle: 'solid',
    categoryStyle: 'underline',
    statusStyle: 'badge',
    accentIntensity: 'strong',
  },
};

/**
 * Hook que retorna os tokens do design atualmente selecionado.
 * Uso: const design = useDesign();  ->  design.cardRounded, design.showHeaderBackground, etc.
 */
export function useDesign(): DesignTokens {
  const { config } = useConfig();
  // ?design=prime no endereço: ver um design sem mudar o salvo no Master (que vale para produção)
  const forcado = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('design') : null;
  const style = ((forcado && forcado in DESIGNS ? forcado : config.designStyle) as DesignId) || 'classic';
  return DESIGNS[style] || DESIGNS.classic;
}

/** Lista todos os designs disponíveis (para o seletor no Master). */
export function getAllDesigns(): DesignTokens[] {
  return Object.values(DESIGNS);
}
