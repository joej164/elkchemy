import type { ReactNode } from 'react';
import type { Family } from '../board';
import elkCalfArt from '../assets/board/elk-calf-v1.webp';
import elkYoungArt from '../assets/board/elk-young-v1.webp';

// The board's painted art (artwork/board/README.md): delivery copies of the drafts in artwork/board/drafts/, in
// src/assets/board/, drawn inside the board's own 100 × 100 SVG art, so an item keeps its tier pips and top-tier radiance
// and a character her label. Each picture has wide transparent margins, so it is cropped (a viewBox over its pixels) to
// the part that matters and fitted to the space it has; the crop overflows visibly, so a picture's soft glow is kept.
const URLS = import.meta.glob<string>('../assets/board/*.webp', { eager: true, import: 'default' });

/** The delivery copy's URL. */
export function boardArtUrl(name: string): string {
  const url = URLS[`../assets/board/${name}.webp`];
  if (!url) throw new Error(`Missing board art: ${name}`);
  return url;
}

/** A crop of a picture, in its own pixels: x, y, width, height. */
type Crop = readonly [number, number, number, number];

/**
 * The picture `name` (`size` its pixels), its `crop` fitted inside the box x, y, w, h of a 100 × 100 viewBox (`align`: where
 * in the box, as preserveAspectRatio, e.g. 'xMidYMax' to stand a character on the bottom edge).
 */
export function framed(name: string, size: readonly [number, number], crop: Crop, box: Crop, align = 'xMidYMid'): ReactNode {
  return (
    <svg x={box[0]} y={box[1]} width={box[2]} height={box[3]} viewBox={crop.join(' ')} preserveAspectRatio={`${align} meet`} overflow="visible"
      data-art={name}>
      <image href={boardArtUrl(name)} width={size[0]} height={size[1]} />
    </svg>
  );
}

const ITEM_SIZE = [512, 341] as const;

/**
 * Each family's pictures, tier 0 up; a higher tier uses the last (tiers 3 and 4 share theirs, the top tier set apart by
 * its radiance and fifth pip; the photos' third serves tiers 2 to 4).
 */
export const ITEM_FILES: Readonly<Record<Family, readonly string[]>> = {
  grove: ['grove-sprout-v1', 'grove-tree-v1', 'grove-full-tree-v1', 'grove-flowering-tree-v1'],
  song: [1, 2, 3, 4].map((n) => `song-tier-${n}-v1`),
  crystal: [1, 2, 3, 4].map((n) => `crystal-tier-${n}-v1`),
  elk: ['elk-calf-v1', 'elk-young-v1', 'elk-tier-3-v1', 'elk-tier-4-v1'],
  wood: [1, 2, 3, 4].map((n) => `wood-tier-${n}-v1`),
  tool: [1, 2, 3, 4].map((n) => `tool-tier-${n}-v1`),
  book: [1, 2, 3, 4].map((n) => `book-tier-${n}-v1`),
  photo: [1, 2, 3].map((n) => `photo-tier-${n}-v1`),
  // The palace rescue's chest materials (artwork/board/materials/): one picture each, drawn smaller at lower tiers.
  planks: ['chest-planks-v1'],
  hardware: ['chest-hardware-v1'],
};

/**
 * Each family's crop: the box holding all its pictures' opaque pixels (alpha over 128, measured in Chromium), plus 6 px,
 * so its tiers keep the sizes they were drawn at relative to one another (a crystal grows from a shard to a cluster; the
 * songbird stays the same bird as notes and a crown are added) while the margins all its pictures share are cut away.
 */
const ITEM_CROPS: Readonly<Record<Family, Crop>> = {
  grove: [95, 21, 314, 283],
  song: [125, 40, 291, 234],
  crystal: [112, 23, 285, 303],
  elk: [69, -5, 370, 336],
  wood: [108, -1, 294, 342],
  tool: [84, 19, 338, 307],
  book: [120, 29, 264, 276],
  photo: [75, 27, 346, 279],
  planks: [115, 31, 281, 275],
  hardware: [76, 21, 358, 296],
};

/**
 * Where an item's picture goes in its 100 × 100 tile: as large as the tile allows, a little past its edges into the cell's
 * padding (the art's svg lets it overflow), its foot just reaching the row of tier pips (y 85 to 95), which lies over it.
 * Measured on the board at its smallest (64 CSS px tiles) to keep each picture legible.
 */
const ITEM_BOX: Crop = [-6, -5, 112, 95];

/** A family with one picture (the chest materials) draws its lower tiers smaller, so a merge visibly grows it. */
const ONE_PICTURE_SCALE = [0.7, 0.85, 1, 1, 1];

/** An item's picture at `tier` (0 to 4), for ItemArt. */
export function itemPicture(family: Family, tier: number): ReactNode {
  if (family === 'elk' && tier < 2) {
    const calf = tier === 0;
    const name = calf ? 'elk-calf-v1' : 'elk-young-v1';
    const crop = calf ? [79, 71, 313, 371] : [40, 16, 296, 480];
    const size = calf ? [512, 512] : [383, 512];
    return <svg x="-6" y="-5" width="112" height="95" viewBox={crop.join(' ')} preserveAspectRatio="xMidYMax meet" overflow="visible" data-art={name}>
      <image href={calf ? elkCalfArt : elkYoungArt} width={size[0]} height={size[1]} />
    </svg>;
  }
  const files = ITEM_FILES[family];
  const s = files.length === 1 ? ONE_PICTURE_SCALE[tier] : 1;
  const [x, y, w, h] = ITEM_BOX;
  const box: Crop = [x + (w * (1 - s)) / 2, y + h * (1 - s), w * s, h * s];   // shrunk toward the pips, centred
  return framed(files[Math.min(tier, files.length - 1)], ITEM_SIZE, ITEM_CROPS[family], box);
}

/** The Picture Book's own crop (its pixels only, plus 6 px), for the cover its opening lifts. */
export function pictureBookCover(): ReactNode {
  return framed('book-tier-4-v1', ITEM_SIZE, [120, 29, 264, 265], [0, 0, 100, 100]);
}

/**
 * Alisha and Fiona (leaves on her antlers) as chibi board sprites, standing on the bottom edge of their 100 × 100 box and
 * rising a little above it (their svg lets them overflow), as they are tall and narrow. Crops as the items': opaque pixels
 * plus 6 px.
 */
const CHARACTER_BOX: Crop = [-10, -14, 120, 114];
export function characterPicture(who: 'alisha' | 'fiona'): ReactNode {
  return who === 'alisha'
    ? framed('alisha-chibi-v1', [468, 512], [106, 5, 253, 500], CHARACTER_BOX, 'xMidYMax')
    : framed('fiona-leafy-chibi-v1', [383, 512], [47, 5, 291, 501], CHARACTER_BOX, 'xMidYMax');
}

/** Beyond the gate's dog, a small dog: standing on the bottom edge of its box, kept inside it, shorter than Alisha and Fiona. */
const DOG_BOX: Crop = [2, 16, 96, 84];
export function dogPicture(): ReactNode {
  return framed('dog-chibi-v1', [512, 468], [100, 39, 297, 338], DOG_BOX, 'xMidYMax');
}
