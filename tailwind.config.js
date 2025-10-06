/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#5B21B6',
          teal: '#0D9488',
        },
      },
    },
  },
  plugins: [],
};
