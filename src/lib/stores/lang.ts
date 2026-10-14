/**
 * Language store (en/hi) — and the language is the ADDRESS: /hi/… is Hindi, everything else
 * English (src/lib/lang/url.ts).
 *
 * It used to be a preference kept in localStorage, so one address served two languages and a
 * crawler, which has no preference, only ever saw English. Now the root layout calls
 * `lang.follow()` with the language of the current address — on the server before any child
 * renders, and in the browser on every navigation — and every `$lang` / `$tr` in the app follows
 * from that. (Setting a module-level store while the server renders looks like shared state, but a
 * render is synchronous: the layout sets it and the children read it before anything else can run,
 * so one request can never see another's language.)
 *
 * localStorage still has a job, a small one: it remembers the language a visitor CHOSE, so that
 * opening an English address later takes them to the Hindi page (the inline script in app.html).
 * A crawler has no such memory, which is exactly why it sees each language at its own address.
 *
 * Exposes `tr` (`$tr('nav_home')`) and `lp` (`$lp('/loans')` -> '/hi/loans' in Hindi).
 */
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { LANG_KEY, t as translate, type Lang } from '$lib/i18n';
import { localePath } from '$lib/lang/url';

function createLang() {
  const { subscribe, set } = writable<Lang>('en');

  function apply(l: Lang) {
    if (!browser) return;
    try {
      document.documentElement.setAttribute('lang', l);
    } catch {
      /* ignore */
    }
  }

  return {
    subscribe,
    /** Make the store say what the address says. Called by the root layout. */
    follow(l: Lang) {
      set(l);
      apply(l);
    },
    /** Same as `follow`; kept for code and tests that set the language directly. */
    set(l: Lang) {
      set(l);
      apply(l);
    },
    /** The visitor CHOSE this language: remember it for their next visit. */
    remember(l: Lang) {
      if (!browser) return;
      try {
        localStorage.setItem(LANG_KEY, l);
      } catch {
        /* storage disabled — the address still carries the language */
      }
    },
  };
}

export const lang = createLang();

/** Reactive translator: `$tr('key', { vars })`. */
export const tr = derived(lang, ($lang) => (key: string, vars?: Record<string, string | number>) =>
  translate($lang, key, vars)
);

/** A path in the current language: `$lp('/loans')` is '/hi/loans' on a Hindi page. */
export const lp = derived(lang, ($lang) => (path: string) => localePath(path, $lang));
