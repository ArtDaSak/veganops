import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-tema="noche-purpura"]'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--color-bg) / <alpha-value>)',
        surface: 'hsl(var(--color-surface) / <alpha-value>)',
        text: 'hsl(var(--color-text) / <alpha-value>)',
        primary: 'hsl(var(--color-primary) / <alpha-value>)',
        accent: 'hsl(var(--color-accent) / <alpha-value>)',
        border: 'hsl(var(--color-border) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        heading: ['var(--font-outfit)', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
export default config;
