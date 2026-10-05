// Avatar: the initials circle must stay visible while the photo is still downloading
// (the "Ashutosh Chandan row shows an empty hole" bug), then the photo fades in on load,
// and on error the photo is dropped and the initials simply stay.
//
// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Avatar from './Avatar.svelte';

let app: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement;

afterEach(() => {
  if (app) { unmount(app); app = null; }
});

function render(props: Record<string, unknown>) {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  app = mount(Avatar, { target: host, props: { name: 'Ashutosh Chandan', seed: 'k1', ...props } });
  flushSync();
}

const initialsEl = () => host.querySelector('span[aria-hidden="true"]');

describe('Avatar', () => {
  it('shows the initials while the photo is still loading (img invisible, not absent)', () => {
    render({ photo: 'https://cdn.example/a.jpg' });
    expect(initialsEl()?.textContent?.trim()).toBe('AC');
    const img = host.querySelector('img')!;
    expect(img).toBeTruthy();
    expect(img.className).toContain('opacity-0');
    expect(img.className).not.toContain('opacity-100');
  });

  it('reveals the photo once it has loaded, initials stay underneath', () => {
    render({ photo: 'https://cdn.example/a.jpg' });
    host.querySelector('img')!.dispatchEvent(new Event('load'));
    flushSync();
    expect(host.querySelector('img')!.className).toContain('opacity-100');
    expect(initialsEl()).toBeTruthy();
  });

  it('drops the photo on error and keeps the initials', () => {
    render({ photo: 'https://cdn.example/broken.jpg' });
    host.querySelector('img')!.dispatchEvent(new Event('error'));
    flushSync();
    expect(host.querySelector('img')).toBeNull();
    expect(initialsEl()?.textContent?.trim()).toBe('AC');
  });

  it('renders only the initials when there is no photo', () => {
    render({ photo: '' });
    expect(host.querySelector('img')).toBeNull();
    expect(initialsEl()?.textContent?.trim()).toBe('AC');
  });

  it('reserves its box (width/height) so rows do not jump when the photo arrives', () => {
    render({ photo: 'https://cdn.example/a.jpg', size: 44 });
    const img = host.querySelector('img')!;
    expect(img.getAttribute('width')).toBe('44');
    expect(img.getAttribute('height')).toBe('44');
  });
});
