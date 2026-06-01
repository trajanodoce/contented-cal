/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F4F8FB',
          100: '#E0EFF8',
          200: '#B7CEEC',
          300: '#7BC0E8',
          400: '#3B9DD4',
          500: '#0070B5',
          600: '#005D97',
          700: '#003d66',
          800: '#003350',
          900: '#002339',
          950: '#001a2b',
        },
        surface: {
          DEFAULT: '#F7F9FC',
          page: '#F4F8FB',
          card: '#F7F9FC',
          nested: '#F9F7FB',
        },
        accent: {
          pink: '#FBE7F1',
          coral: '#FFC3B8',
          lavender: '#D3CDEC',
          mint: '#92D1B2',
          crimson: '#BA2C2C',
        },
        navy: {
          DEFAULT: '#002339',
          border: '#00233930',
        },
      },
      fontFamily: {
        display: ['Faune-Display_Black', 'Faune', 'serif'],
        heading: ['Faune-Text_Bold', 'Faune', 'serif'],
        body: ['Violet Sans', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        // Navy-tinted shadow scale — see § Shadow Tokens in ContentedCal-Design-System.html
        'xs': '0 1px 2px rgba(0,35,57,.09)',
        'sm': '0 2px 4px rgba(0,35,57,.09), 0 4px 8px rgba(0,35,57,.11)',
        DEFAULT: '0 2px 4px rgba(0,35,57,.09), 0 4px 8px rgba(0,35,57,.11)',
        'md': '0 4px 6px rgba(0,35,57,.11), 0 10px 16px rgba(0,35,57,.16)',
        'lg': '0 20px 40px -8px rgba(0,35,57,.22)',
        'xl': '0 30px 56px -10px rgba(0,35,57,.30)',
        'none': 'none',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};
