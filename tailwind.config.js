/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A3C5E',
          50: '#E8EFF6',
          100: '#C5D6E7',
          200: '#8AADC9',
          300: '#4F84AB',
          400: '#2B5A82',
          500: '#1A3C5E',
          600: '#152F4A',
          700: '#102236',
          800: '#0A1623',
          900: '#050B11',
        },
        accent: {
          DEFAULT: '#00A9CE',
          50: '#E0F7FC',
          100: '#B3ECF7',
          200: '#66D9EF',
          300: '#33CDE7',
          400: '#00BFDF',
          500: '#00A9CE',
          600: '#0087A5',
          700: '#00657C',
          800: '#004453',
          900: '#002229',
        },
        bglight: '#F0F7FA',
      },
      fontFamily: {
        heading: ['Montserrat', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
