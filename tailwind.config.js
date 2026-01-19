/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'studio-bg': '#1a1a1a',
        'studio-panel': '#252525',
        'studio-accent': '#ef4444',
        'knob-metal': '#404040',
      },
      boxShadow: {
        'knob': '0 4px 6px -1px rgba(0, 0, 0, 0.5), inset 0 2px 4px 0 rgba(255, 255, 255, 0.1)',
        'inset-track': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.6)',
      }
    },
  },
  plugins: [],
}