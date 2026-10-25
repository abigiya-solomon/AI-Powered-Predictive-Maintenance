/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#070C18',
          900: '#0B132B',
          850: '#111C3D',
          800: '#1C2541',
          700: '#27355B',
          600: '#3A4B75',
          500: '#526694',
        },
        steel: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F1F5F9',
        },
        cyanAccent: {
          500: '#00B4D8',
          400: '#48CAE4',
          300: '#90E0EF',
        },
        alert: {
          red: '#EF476F',
          amber: '#FFB703',
          green: '#06D6A0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}
