/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 새로운 색상 시스템
        base: {
          DEFAULT: '#FFF7ED', // Soft Cream (70%)
        },
        point: {
          DEFAULT: '#FF8A3D', // Apricot Orange (20%)
          hover: '#E67A35',   // 더 어두운 Apricot Orange (hover용)
        },
        accent: {
          DEFAULT: '#3A2F2A', // Espresso Brown (10%)
        },
        // 기존 primary 유지 (호환성)
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
      },
      fontFamily: {
        // Paperozi 폰트를 기본 폰트로 설정
        sans: ['Paperozi', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
