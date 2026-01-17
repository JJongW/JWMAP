/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 새로운 색상 시스템
        base: {
          DEFAULT: '#FAFAF7', // Warm Off-White (70%)
        },
        point: {
          DEFAULT: '#E53935', // Tomato Red (20%)
          hover: '#C62828',   // 더 어두운 토마토 레드 (hover용)
        },
        accent: {
          DEFAULT: '#2B2B2B', // Charcoal (10%)
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
