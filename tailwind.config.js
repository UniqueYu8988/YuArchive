/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // 黑白极简色彩系统
        'ink': {
          DEFAULT: '#000000',
          950: '#0a0a0a',
          900: '#111111',
          800: '#1a1a1a',
          700: '#222222',
          600: '#333333',
          500: '#555555',
          400: '#888888',
          300: '#aaaaaa',
          200: '#cccccc',
          100: '#eeeeee',
          50:  '#f8f8f8',
        }
      },
      animation: {
        'scroll-left': 'scrollLeft 40s linear infinite',
        'scroll-right': 'scrollRight 45s linear infinite',
        'fade-up': 'fadeUp 0.6s ease-out forwards',
      },
      keyframes: {
        scrollLeft: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        scrollRight: {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
