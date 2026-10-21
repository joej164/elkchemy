import type { Item } from './board';

/**
 * Merge to treasure (generated puzzles): a recipe crafts its two ingredients into a container, which opens to its
 * fixed contents. Ingredients and contents are ordinary items; the container is not an item and never merges. Each
 * board has one recipe: dropping either ingredient onto the other crafts (see craftAt in session.ts).
 * `contents.count` identical items merge (3 → 1) one tier up; higher goals add supporting pieces (generator.ts).
 */
export interface Recipe {
  /** Stable: part of puzzle IDs. Lowercase letters only. */
  readonly id: string;
  readonly name: string;
  readonly ingredients: readonly { readonly item: Item; readonly count: number }[];
  readonly container: 'chest';
  readonly contents: { readonly item: Item; readonly count: 3 };
}

const recipe = (id: string, name: string, a: Item['family'], b: Item['family'], reward: Item['family']): Recipe => ({
  id, name, ingredients: [{ item: { family: a, tier: 2 }, count: 1 }, { item: { family: b, tier: 2 }, count: 1 }],
  container: 'chest', contents: { item: { family: reward, tier: 2 }, count: 3 },
});

/** The owner-chosen catalog: every ingredient and content is tier 3 of 5; the reward family is never an ingredient. */
export const RECIPES: readonly Recipe[] = [
  recipe('woodland', 'Woodland chest', 'grove', 'crystal', 'elk'),
  recipe('songbird', 'Songbird chest', 'grove', 'song', 'crystal'),
  recipe('crystal', 'Crystal chest', 'crystal', 'elk', 'song'),
  recipe('grove', 'Grove chest', 'song', 'elk', 'grove'),
];

export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/** The item the recipe's contents merge into (one tier up): the simplest goal. */
export function finalItem(recipe: Recipe): Item {
  const { family, tier } = recipe.contents.item;
  return { family, tier: (tier + 1) as Item['tier'] };
}

/**
 * Container levels (the attic): crafting that makes an ordinary item. Its two ingredients, one dropped onto the other
 * (either way round), become `result` where the drop lands (see craftAt in session.ts). No container is involved.
 */
export interface ItemRecipe { readonly ingredients: readonly [Item, Item]; readonly result: Item }

/** Whether `a` dropped onto `b` (either way round) is the pair `x`, `y`, exact families and tiers. */
export function isPair([x, y]: readonly [Item, Item], a: Item, b: Item): boolean {
  const is = (c: Item, t: Item) => c.family === t.family && c.tier === t.tier;
  return (is(a, x) && is(b, y)) || (is(a, y) && is(b, x));
}

/** Whether `a` dropped onto `b` (either way round) is the recipe's ingredient pair, exact families and tiers. */
export function isIngredientPair(recipe: Recipe, a: Item, b: Item): boolean {
  const [x, y] = recipe.ingredients.map((i) => i.item);
  return isPair([x, y], a, b);
}
