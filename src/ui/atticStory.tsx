import opening1 from '../assets/art/attic-opening-1-v2.webp';
import opening2 from '../assets/art/attic-opening-2-v3.webp';
import opening3 from '../assets/art/attic-opening-3-v2.webp';
import opening4 from '../assets/art/attic-opening-4-v2.webp';
import closing1 from '../assets/art/attic-closing-1-v2.webp';
import closing2 from '../assets/art/attic-closing-2-v2.webp';
import landscapeArt from '../assets/art/woodland-home-landscape-v1.webp';
import type { ComicPanel } from './Comic';

// Owner-approved comic art (sources and provenance: artwork/story/attic/README.md; delivery copies:
// src/assets/art/README.md). Fiona appears only in the photograph and the woodland memory, never in the attic.
// Words live in the HTML captions, never in the art.

const Art = ({ src }: { src: string }) => <img src={src} alt="" />;

/** The photo: a white-bordered print, slightly tilted; the approved elk artwork sits inside the frame. */
function ElkPhoto() {
  return (
    <div className="comic-photo">
      <div className="comic-photo-frame"><img src="/icons/icon-512.png" alt="" /></div>
    </div>
  );
}

/** The approved woodland home painting, softened into a warm memory. */
function WoodlandMemory() {
  return (
    <div className="comic-memory">
      <img src={landscapeArt} alt="" />
    </div>
  );
}

export const OPENING_PANELS: readonly ComicPanel[] = [
  {
    id: 'opening-1',
    description: 'A warm attic with older Alisha, her granddaughter and background helpers tidying.',
    art: <Art src={opening1} />,
    lines: [{ text: 'On a rainy afternoon, Alisha’s granddaughter helps her tidy the attic.' }],
  },
  {
    id: 'opening-2',
    description: 'Alisha holds loose photographs while her granddaughter looks on.',
    art: <Art src={opening2} />,
    lines: [
      { speaker: 'Granddaughter', text: 'Grandma, where did all these photos come from?' },
      { speaker: 'Alisha', text: 'A lifetime of adventures! Let’s sort them as we go.' },
    ],
  },
  {
    id: 'opening-3',
    description: 'Alisha’s granddaughter points toward a box beneath a dust sheet.',
    art: <Art src={opening3} />,
    lines: [
      { speaker: 'Granddaughter', text: 'What’s under that old sheet?' },
      { speaker: 'Alisha', text: 'I’d almost forgotten that box. Let’s clear a little space.' },
    ],
  },
  {
    id: 'opening-4',
    description: 'Alisha and her granddaughter sort loose photographs beside a ribbon-tied bundle.',
    art: <Art src={opening4} />,
    lines: [{ speaker: 'Alisha', text: 'Loose photos first. Three make a tidy bundle.' }],
  },
];

export const CLOSING_PANELS: readonly ComicPanel[] = [
  {
    id: 'closing-1',
    description: 'Alisha and her granddaughter gather beside the Big Memory Book on the old trunk.',
    art: <Art src={closing1} />,
    lines: [
      { text: 'Two more books were tucked inside the old box. Together with the book they’d found, they became the Big Memory Book.' },
      { text: 'Her granddaughter settles beside her.' },
    ],
  },
  {
    id: 'closing-2',
    description: 'An old photograph slips face down from the open Big Memory Book.',
    art: <Art src={closing2} />,
    lines: [{ speaker: 'Granddaughter', text: 'Look—a photo slipped out!' }],
  },
  {
    id: 'closing-3',
    description: 'A white-bordered photograph of the younger golden elk.',
    art: <ElkPhoto />,
    lines: [
      { speaker: 'Granddaughter', text: 'Grandma, is that Aunt Fiona?' },
      { speaker: 'Alisha', text: 'Yes. That photograph was taken a long time ago.' },
    ],
  },
  {
    id: 'closing-4',
    description: 'The sunlit woodland from Alisha’s memories.',
    art: <WoodlandMemory />,
    lines: [
      { speaker: 'Granddaughter', text: 'Will you tell me about it?' },
      { speaker: 'Alisha', text: 'Come sit beside me. I’ll start at the beginning.' },
      { text: 'Alisha’s story begins.' },
    ],
  },
];

/** The closing comic's last picture, the woodland memory. */
export const MEMORY_PANEL = CLOSING_PANELS.length - 1;

/** Whether Woodland Journey plays once closing panel `panel` is shown: from the memory's first reveal to the end. */
export const memoryMusicOn = (on: boolean, panel: number): boolean => on || panel === MEMORY_PANEL;
