/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EDF6F6',
          100: '#D6EBEB',
          200: '#A8D5D6',
          300: '#6FB8BA',
          400: '#0A7275',
          500: '#055D60',
          600: '#044B4D',
          700: '#033B3D',
          800: '#022C2E',
          900: '#011D1E',
          950: '#010F10',
        },
        surface: {
          DEFAULT: '#F3EFEE',
          50: '#FAF8F8',
          100: '#F3EFEE',
          200: '#E8E2E0',
          300: '#D4CBC8',
        },
        mint: {
          DEFAULT: '#EDF6F6',
          50: '#F6FAFA',
          100: '#EDF6F6',
          200: '#D6EBEB',
        },
      },
    },
  },
  plugins: [],
};
