import type { ComicPanel, ComicScene } from './Comic';

// Chapter 1's story scenes, one line at a time as in the Attic, over the draft illustrations the storyboard
// (docs/story/chapter-one-review.html) shows (artwork/story/chapter-one/; delivery copies and provenance:
// src/assets/art/README.md). Each panel's id is its storyboard code; its lines are that figure's dialogue, word for word,
// in order (a line with no speaker is narration). A figure without dialogue shows its own title as the caption (owner
// decision, October 28, 2026), except C1-13, whose title is Alisha's "Cookie?" (docs/story-review.md). The ending (C1-12
// onward) is the storyboard's draft, still awaiting review, with the owner's approved dialogue of November 22, 2026. A
// figure whose picture is still to be made shows a labelled placeholder (none at present). The palace entrance's own
// panels (C1-08 to C1-10) are in StoryArt.tsx.

// Delivery copies, by their source's name without "-draft" (01-forest-throw-draft-v2.png → chapter-one-01-forest-throw-v2
// .webp). A copy not made yet shows a labelled placeholder instead (tests require every one).
const ART = import.meta.glob<string>('../assets/art/chapter-one-*.webp', { eager: true, import: 'default' });

/** The URL of a figure's delivery copy, if it exists. */
export function chapterArt(source: string): string | undefined {
  return ART[`../assets/art/chapter-one-${source}.webp`];
}

function Picture({ source, code }: { source: string; code: string }) {
  const src = chapterArt(source);
  return src ? <img src={src} alt="" /> : <div className="comic-placeholder" data-missing-art={source}><span>{code}</span></div>;
}

function panel(id: string, source: string, description: string, lines: ComicPanel['lines']): ComicPanel {
  return { id, description, art: <Picture source={source} code={id} />, lines };
}
const A = (text: string) => ({ speaker: 'Alisha', text });
const F = (text: string) => ({ speaker: 'Fiona', text });
const title = (text: string) => ({ text });
const narration = (text: string) => ({ text });

/** 1 · Meet Fiona, before play: the throw (C1-01) and the ricochet (C1-02). */
export const MEET_FIONA_OPENING: readonly ComicPanel[] = [
  panel('C1-01', '01-forest-throw-v2', 'Alisha throws a disc from a concrete tee pad down a forest fairway toward a distant basket.',
    [title('The throw')]),
  panel('C1-02', '02-tree-ricochet-v2', 'Alisha’s disc strikes a tree and ricochets away into the woods.', [A('Stupid tree!')]),
];

/** 1 · Meet Fiona, after the puzzle: the disc in Fiona’s antlers (C1-03), introductions (C1-04) and an invitation (C1-05). */
export const MEET_FIONA_CLOSING: readonly ComicPanel[] = [
  panel('C1-03', 'meeting-disc-antlers-v2', 'In a secluded wooded glade, Alisha finds her disc resting in Fiona’s antlers.',
    [A('Oh! I’m so sorry.'), F('Is this yours?')]),
  panel('C1-04', '04-disc-returned-v1', 'Alisha takes back her disc from Fiona as they introduce themselves.', [
    A('Thanks. Usually I aim for the basket.'), F('Should I be flattered?'), A('I’m Alisha.'), F('Fiona.'),
  ]),
  panel('C1-05', '05-walking-together-v1', 'Alisha and Fiona walk on together through the woods.', [
    A('Were you heading somewhere before I interrupted?'), F('The Crystal Palace. I have a message to deliver.'),
    A('I’ve never been there. Would you mind some company?'), F('Not at all.'), A('Let me put this away before I hit anything else.'),
  ]),
];

/** 2 · Woodland cleanup, before play: four pictures, C1-06A, C1-06C, C1-06 and C1-06D. */
export const CLEANUP_OPENING: readonly ComicPanel[] = [
  panel('C1-06A', '06a-trail-entry-v1', 'Alisha and Fiona walk together where the woodland trail forks.', [
    A('Do you live around here?'), F('A little farther north. You?'), A('The village. I come out here to play when I can.'),
    F('Is hitting trees part of the game?'), A('Ideally, I hit the basket and nothing else.'), F('Still, I’m glad you stopped to say hello.'),
    A('Technically, my disc stopped to say hello first.'),
  ]),
  panel('C1-06C', '06c-second-throw-v2', 'Alisha throws beside Fiona; the disc veers toward an old tree.', [
    A('There’s the next basket.'), F('Shall I stand back?'), A('You’re fine beside me.'),
  ]),
  panel('C1-06', '06-tool-shed-collapse-v3', 'The old, weakened tree falls across the clearing and crashes onto a tool shed.', [
    A('Not another tree.'), F('Alisha. Move back.'),
  ]),
  panel('C1-06D', '06d-tree-shattered-v1',
    'The trunk has split into large sections; branches and tools block the path, the fallen tree’s shape still plain.', [
      A('…That wasn’t supposed to happen.'), F('I gathered.'), A('We can’t leave the path like this.'), F('Let’s start with the branches.'),
    ]),
];

/** 2 · Woodland cleanup, during play: the depot revealed under the branches (C1-06B). */
export const CLEANUP_STORY: Readonly<Record<string, ComicScene>> = {
  'C1-06B': {
    label: 'Under the branches',
    panels: [panel('C1-06B', '06b-hidden-depot-v4', 'Under the cleared branches lie the shed’s wreckage and its scattered tools.', [
      A('There’s more underneath.'), F('More tools?'), A('Yes. Some of the shed’s still under these branches.'), F('I’ll clear this side.'),
      A('I’ll sort what we’ve found.'),
    ])],
  },
};

/** 2 · Woodland cleanup, after the puzzle: the path clear (C1-07). */
export const CLEANUP_CLOSING: readonly ComicPanel[] = [
  panel('C1-07', '07-clearing-tidied-v4', 'The woodland path is clear again, with a few twigs left and the damaged shed beside it.', [
    A('It’s not perfect, but the path’s clear.'), F('People can get through again.'), A('That’s what matters.'), F('Shall we?'), A('Let’s go.'),
  ]),
];

/**
 * 4 · The Crystal Palace, during play: together again (C1-11), once Fiona has asked on the board whether the partition is
 * opening and the board has shown it open, Alisha stepping out. Its opening is C1-10.
 */
export const RESCUE_STORY: Readonly<Record<string, ComicScene>> = {
  'C1-11': {
    label: 'Together again',
    panels: [panel('C1-11', '11-palace-reunion-v1', 'The crystal partition stands open, and Alisha steps through to Fiona.', [
      A('I’m free!'), F('Good. Let’s avoid any more pressure plates.'), A('Agreed. Now, about that message…'),
    ])],
  },
};

/**
 * 5 · Beyond the gate, before play: the delivery (C1-12), Alisha waiting and growing restless (C1-12A, three moments, one
 * per tap), noticing the dog down the hall (C1-13), then following it as Fiona comes out and sees her go (C1-14).
 */
export const BEYOND_OPENING: readonly ComicPanel[] = [
  panel('C1-12', '12-message-door-v1', 'Fiona goes into the message room while Alisha waits outside.', [title('The delivery')]),
  {
    // One picture of three moments, revealed one per tap (owner request), the panels' gutters at 229 and 467 of 720 px.
    ...panel('C1-12A', '12a-growing-restless-v1', 'Alisha waits alone outside the closed message-room door, growing restless.',
      [title('Growing restless')]),
    moments: [
      { end: 229.5 / 720, description: 'She stands waiting, her backpack on.' },
      { end: 467.5 / 720, description: 'She leans against the wall, arms crossed, her backpack set down beside her.' },
      { end: 1, description: 'She sits on the floor by the door, her chin in her hand.' },
    ],
  },
  panel('C1-13', '13-dog-sighting-v2', 'Waiting outside, Alisha sees a familiar-looking dog.', [A('Cookie?')]),
  panel('C1-14', '14-fiona-follows-v2', 'Fiona comes out of the message room and sees Alisha following the dog.', [title('Fiona follows')]),
];

/** 5 · Beyond the gate, after the puzzle: the gate ending, C1-15A to C1-21, and the coda C1-22 (drafts, awaiting review). */
export const BEYOND_CLOSING: readonly ComicPanel[] = [
  panel('C1-15A', '15a-cookie-call-v1', 'Seen from behind, Alisha runs after the dog into a walled palace grove, Fiona beside her; the dog has its back to them.', [
    A('Cookie! There you—'), narration('The dog turns.'),
  ]),
  panel('C1-15', '15-grove-arrival-v1', 'In the walled palace grove, Alisha crouches to greet the dog as Fiona looks on.', [
    A('Oh. You’re not Cookie.'), F('A friend of yours?'), A('Not this one, apparently.'),
  ]),
  panel('C1-16', '16-discs-spill-v2',
    'The dog knocks Alisha off balance and discs scatter from her bag; the orange disc rolls on its edge toward an empty mechanism.', [
      A('Whoa!'), F('Are you all right?'), A('I think so. My discs, though…'), narration('The orange disc rolls toward the mechanism.'),
      A('Oh, come on. Not that way.'),
    ]),
  panel('C1-17', '17-gate-awakens-v4',
    'The orange disc clicks into a rune-key socket, and a small opening grows inside the stone arch onto a hilltop, a lake and a basket.', [
      F('Did your disc just open that?'), A('I definitely didn’t aim for it.'), F('What’s on the other side?'),
    ]),
  panel('C1-18', '18-course-reveal-v3', 'The opening widens onto a hilltop disc golf course.', [
    A('Wait. Is that Ridgeview?'), F('Yes. Have you been?'), A('No! I’ve wanted to play there for years.'),
    F('Your village is a few hours’ walk from there.'), A('Have you got time for a round?'), F('I’ve delivered my message. I’ve got time.'),
  ]),
  panel('C1-19A', '19a-mechanism-trip-v6',
    'Following Fiona through, Alisha trips against the mechanism, and the orange disc rolls toward the gate; Fiona is already beyond.',
    [title('An accidental stumble')]),
  panel('C1-19', '19-crossing-v4',
    'Alisha steps through after Fiona and picks up the orange disc on the grass, the palace grove still visible through the gate.',
    [title('Following the disc')]),
  panel('C1-20', '20-gate-closing-v4',
    'Seen from behind, Alisha and Fiona face the shrinking opening, a small window back into the palace grove; Alisha holds her disc.',
    [A('Well… at least I’ve got my favorite disc.')]),
  panel('C1-21', '21-course-reveal-v3', 'Seen from behind, Alisha and Fiona look out over the disc golf course.', [title('The course ahead')]),
  panel('C1-22', '21-linked-gates-v1', 'Distant rune gates glow across the realm.', [title('Elsewhere throughout the realm…')]),
];
