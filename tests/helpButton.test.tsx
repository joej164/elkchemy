import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LevelGoal } from '../src/session';
import { HelpButton } from '../src/ui/HelpButton';
import { App } from '../src/ui/App';

const itemGoal: LevelGoal = { kind: 'item', item: { family: 'song', tier: 2 } };
const html = renderToStaticMarkup(<HelpButton goal={itemGoal} />);
const leaveHtml = renderToStaticMarkup(<HelpButton goal={{ kind: 'leaveOne' }} />);
const attr = (tag: string, name: string) => new RegExp(`<${tag}[^>]*?\\s${name}="([^"]*)"`).exec(html)?.[1];

describe('HelpButton', () => {
  it('renders an accessible trigger linked to the dialog', () => {
    const trigger = /<button[^>]*data-action="help"[^>]*>/.exec(html)?.[0] ?? '';
    expect(trigger).toContain('aria-label="How to play"');
    expect(trigger).toContain('aria-haspopup="dialog"');
    const dialogId = attr('dialog', 'id');
    expect(dialogId).toBeTruthy();
    expect(trigger).toContain(`aria-controls="${dialogId}"`);
  });

  it('renders a closed dialog labelled by its heading with a Close button', () => {
    const dialog = /<dialog[^>]*>/.exec(html)?.[0] ?? '';
    expect(dialog).toContain('data-help-dialog');
    expect(dialog).not.toMatch(/\sopen[\s=>]/);
    const titleId = attr('dialog', 'aria-labelledby');
    expect(html).toContain(`<h2 id="${titleId}">How to play</h2>`);
    expect(html).toMatch(/<button[^>]*data-action="help-close"[^>]*>Close<\/button>/);
  });

  it('has concise help content', () => {
    expect(html).toContain('Merge 3 for 1 upgraded item; merge 5 for 2.');
    expect(html).toContain('random empty cell');
    expect(html).toContain('Undo');
    expect(html).toContain('Retry');
    expect((html.match(/<li>/g) ?? []).length).toBeLessThanOrEqual(7);
  });

  it('states the active objective', () => {
    expect(html).toContain('<li>Goal: make Song, tier 3 of 4. Winning unlocks the next level.</li>');
    expect(leaveHtml).toContain('Goal: use all supply and finish with exactly one item on the board.');
    expect(leaveHtml).not.toContain('Song');
    expect(html).toContain('Retry restarts this level.');
    expect((leaveHtml.match(/<li>/g) ?? []).length).toBeLessThanOrEqual(7);
  });

  it('shows the pan advice bullet only for large boards', () => {
    const items: LevelGoal = { kind: 'items', items: [{ family: 'grove', tier: 3 }] };
    const big = renderToStaticMarkup(<HelpButton goal={items} largeBoard />);
    expect(big).toContain('Goal: have all one goal items on the board at once.');
    expect(big).toContain('Drag empty ground to pan.');
    expect(big).toContain('Center board');
    expect((big.match(/<li>/g) ?? []).length).toBeLessThanOrEqual(7);
    expect(html).not.toContain('Center board');
  });

  it('App shows the first level and objective', () => {
    const app = renderToStaticMarkup(<App />);
    expect(app).toContain('Level 1 of 5 · Sprouting Grove');
    expect(app).toContain('Goal: make Grove, tier 3 of 4');
    expect(app).not.toContain('data-action="next-level"');
  });

  it('uses no external assets', () => {
    expect(html).not.toContain('http');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('url(');
  });
});
