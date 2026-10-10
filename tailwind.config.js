import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/**
 * The identity colour and the neutrals are CSS variables, not hex.
 *
 * The admin chooses the identity (Settings → هوية المنصة), and the
 * server prints the values into <head> — see `app/Support/Theme.php`.
 * Each shade is space-separated RGB so `bg-violet-600/40` still works.
 */
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const fromVar = (name) =>
    Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));

/** The identity colour — terracotta by default (replaced violet), chosen in the admin */
const ACCENT = fromVar('accent');

/** Neutrals — warm paper-and-ink by default, or cool slate */
const INK = fromVar('neutral');

/** Done / correct — a sage green that sits on paper, not a neon */
const DONE = {
    50: '#eef3ec', 100: '#dce7d8', 200: '#bcd1b6', 300: '#94b48c',
    400: '#6c9563', 500: '#4f7a47', 600: '#3e6438', 700: '#33512f',
    800: '#2a4128', 900: '#233623', 950: '#111d11',
};

/** Wrong — crimson, kept clearly apart from the terracotta accent */
const WRONG = {
    50: '#fbf0f0', 100: '#f5dcdc', 200: '#ecb9ba', 300: '#df8f92',
    400: '#cf6469', 500: '#b9434b', 600: '#9f313b', 700: '#842832',
    800: '#6e242d', 900: '#5d222a', 950: '#341014',
};

/** Caution / streak at risk — ochre, the colour of old paper's foxing */
const CAUTION = {
    50: '#faf4e6', 100: '#f3e6c4', 200: '#e8cf8f', 300: '#dbb35c',
    400: '#cf9a3a', 500: '#b9812a', 600: '#9a6622', 700: '#7b4f1f',
    800: '#66411f', 900: '#56371d', 950: '#301c0c',
};

/** @type {import('tailwindcss').Config} */
export default {
    // الوضع الليلي بالصنف لا بإعداد النظام — لأن المستخدم يختاره
    // صريحاً في صفحة التهيئة، وقد يخالف إعداد جهازه.
    darkMode: 'class',
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.tsx',
    ],

    theme: {
        extend: {
            // ── The "page of the book" palette ─────────────────────
            // The login screen set the look: paper, ink, terracotta.
            // Rather than touch ~1,000 class names across the app,
            // the scales themselves are redefined — `bg-violet-600`
            // now *is* the accent, `slate` is warm ink-on-paper, and
            // `white` is the sheet. A new component inherits the look
            // without knowing it exists. Keep in sync with `.folio`
            // variables in app.css.
            colors: {
                white: 'rgb(var(--white) / <alpha-value>)',
                violet: ACCENT,
                indigo: ACCENT,
                slate: INK,
                gray: INK,
                // Five colours, one job each — everything else folds in.
                // Decorative hues (a pink break card, a blue tip box)
                // made pages busy without meaning anything.
                stone: INK,
                zinc: INK,
                sky: INK,
                cyan: INK,
                teal: INK,
                fuchsia: ACCENT,
                orange: ACCENT,
                emerald: DONE,
                green: DONE,
                rose: WRONG,
                red: WRONG,
                amber: CAUTION,
            },
            // Paper has corners: softer than square, far from pills
            // Variables so the classic style (the first look) can restore
            // Tailwind's own rounder corners — see `html[data-style]` in app.css
            borderRadius: {
                lg: 'var(--r-lg, 0.3125rem)',
                xl: 'var(--r-xl, 0.4375rem)',
                '2xl': 'var(--r-2xl, 0.5625rem)',
                '3xl': 'var(--r-3xl, 0.75rem)',
            },
            fontFamily: {
                // الترتيب مقصود: Figtree أولاً للإنجليزية،
                // ثم الخط العربي الذي يستلم كل حرف لا يملكه Figtree
                sans: [
                    'Figtree',
                    'IBM Plex Sans Arabic',
                    ...defaultTheme.fontFamily.sans,
                ],
                // English display words on the auth pages — the
                // dictionary-entry voice of the book
                // Fraunces, not Instrument Serif: in the latter the digit 1 is a
                // bare stroke, and "B1" read as "Bl" on every level label
                entry: ['Fraunces', 'Georgia', 'serif'],
            },
        },
    },

    plugins: [forms],
};
