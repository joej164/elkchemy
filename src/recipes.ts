import type { Item } from './board';

/**
 * Merge to treasure (generated puzzles): a recipe crafts its ingredients into a container, which opens to its
 * contents. Ingredients and contents are ordinary items; the container is not an item and never merges.
 * `contents.count` identical items merge (3 → 1) into the puzzle's final item.
 */
export interface Recipe {
  /** Stable: part of puzzle IDs. Lowercase letters only. */
  readonly id: string;
  readonly name: string;
  readonly ingredients: readonly { readonly item: Item; readonly count: number }[];
  readonly container: 'chest';
  readonly contents: { readonly item: Item; readonly count: 3 };
}

export const RECIPES: readonly Recipe[] = [
  {
    id: 'woodland',
    name: 'Woodland chest',
    ingredients: [{ item: { family: 'grove', tier: 2 }, count: 1 }, { item: { family: 'crystal', tier: 2 }, count: 1 }],
    container: 'chest',
    contents: { item: { family: 'elk', tier: 2 }, count: 3 },
  },
];

export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/** The item the recipe's contents merge into: the puzzle's goal. */
export function finalItem(recipe: Recipe): Item {
  const { family, tier } = recipe.contents.item;
  return { family, tier: (tier + 1) as Item['tier'] };
}
