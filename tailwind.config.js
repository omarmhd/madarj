import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** Terracotta — the accent ink (replaces violet) */
const ACCENT = {
    50: '#fbf3ef', 100: '#f6e2d9', 200: '#edc3b2', 300: '#e19d84',
    400: '#d4775a', 500: '#c65a3b', 600: '#b8432a', 700: '#983524',
    800: '#7c2d22', 900: '#66281f', 950: '#37120d',
};

/** Warm greys — paper at the light end, ink at the dark end */
const INK = {
    50: '#f5f0e6', 100: '#ece5d7', 200: '#ddd4c3', 300: '#c6bca9',
    400: '#9d9587', 500: '#767068', 600: '#5d5953', 700: '#45433f',
    800: '#2e2e2c', 900: '#1d2729', 950: '#121618',
};

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
                white: '#fffcf5',
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
            borderRadius: {
                lg: '0.3125rem',
                xl: '0.4375rem',
                '2xl': '0.5625rem',
                '3xl': '0.75rem',
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
