/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          purple: '#7c3aed',
          deep: '#3b0764',
          pink: '#ec4899',
          blue: '#2563eb',
          green: '#16a34a',
          amber: '#f59e0b',
          red: '#dc2626',
        },
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        pop: 'pop 0.25s ease-out',
        shake: 'shake 0.3s ease-in-out',
      },
    },
  },
  plugins: [],
}
