import type { Config } from 'tailwindcss';

// v8: one light, minimal design. No dark mode, no skins, no themes.
// `brand` is a calm deep green (brand-600 = #0b6b4f, 6.3:1 on white). `saffron`
// is used only for the small Chhath mark and the "top 5" highlight.
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      screens: { xs: '400px' },
      colors: {
        brand: {
          50: '#effaf5',
          100: '#d6f2e5',
          200: '#aee4cb',
          300: '#7ccdae',
          400: '#44ae8a',
          500: '#1d8d6c',
          600: '#0b6b4f',
          700: '#08563f',
          800: '#074432',
          900: '#05301f'
        },
        saffron: '#e8821e',
        gold: '#d99a1d',
        canvas: '#f6f7f5',
        ink: '#16201b',
        muted: '#5f6b65',
        line: '#e3e7e3',
        success: '#13795b',
        info: '#2557a7',
        danger: '#c0392b',
        warning: '#b7791f'
      },
      fontFamily: {
        sans: ['Manrope Variable', 'Manrope', 'Noto Sans Devanagari Variable', 'Noto Sans Devanagari', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,32,27,.04)'
      },
      keyframes: {
        pulseDot: { '50%': { opacity: '0.35' } }
      },
      animation: {
        pulseDot: 'pulseDot 1.8s ease-in-out infinite'
      }
    }
  },
  plugins: []
} satisfies Config;
