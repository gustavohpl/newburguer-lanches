import type { Product } from './api';

/**
 * Ingrediente da ficha técnica (recipe) do produto.
 */
interface RecipeIngredientData {
  ingredientId: string;
  ingredientName?: string;
  quantityUsed?: number;
  selectedPortionLabel?: string;
  hideFromClient?: boolean;
  hidePortionFromClient?: boolean;
  category?: string;
}

interface RecipeExtraData {
  name?: string;
  hideFromClient?: boolean;
}

interface ProductWithRecipe extends Product {
  recipe?: {
    ingredients?: RecipeIngredientData[];
    extras?: RecipeExtraData[];
  };
  ingredientsText?: string;
}

/**
 * Monta lista de ingredientes visíveis para o cliente, respeitando:
 * - `hideFromClient` em ingredientes e extras
 * - Lógica de `selectedPortionLabel` com `.includes()` bidirecional
 * - Fallback para `ingredientsText` quando stockControl está OFF
 */
export function getVisibleIngredients(product: Product): string[] {
  const visible: string[] = [];
  const p = product as ProductWithRecipe;

  // Ingredientes da ficha técnica (stockControl ON)
  if (p.recipe?.ingredients) {
    for (const ri of p.recipe.ingredients) {
      if (!ri.hideFromClient) {
        const name = ri.ingredientName || ri.ingredientId;
        const qty = ri.quantityUsed || 1;
        let label = '';
        if (qty > 1) label += `${qty}x `;
        label += name;
        // Só mostra porção se NÃO estiver marcado hidePortionFromClient
        if (ri.selectedPortionLabel && !ri.hidePortionFromClient) {
          const nameNorm = name.trim().toLowerCase();
          const portionNorm = ri.selectedPortionLabel.trim().toLowerCase();
          if (!portionNorm.includes(nameNorm) && !nameNorm.includes(portionNorm)) {
            // Nomes totalmente diferentes — mostra label completo
            label += ` (${ri.selectedPortionLabel})`;
          } else {
            // Nomes se sobrepõem — extrai só a gramatura (ex: "180g" de "lombo 180g")
            const gramsMatch = ri.selectedPortionLabel.match(/(\d+)\s*g/i);
            if (gramsMatch) {
              label += ` (${gramsMatch[1]}g)`;
            }
          }
        }
        visible.push(label);
      }
    }
  }

  // Extras da ficha técnica
  if (p.recipe?.extras) {
    for (const ex of p.recipe.extras) {
      if (!ex.hideFromClient && ex.name) {
        visible.push(ex.name);
      }
    }
  }

  // ingredientsText (stockControl OFF) — separar por vírgula
  if (!p.recipe && p.ingredientsText) {
    visible.push(...p.ingredientsText.split(',').map((s: string) => s.trim()).filter(Boolean));
  }

  return visible;
}
