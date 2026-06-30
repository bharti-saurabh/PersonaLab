/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f7fa', 100: '#eaeef3', 200: '#d3dbe6', 300: '#aebccf',
          400: '#8295b2', 500: '#617498', 600: '#4c5c7e', 700: '#3f4c66',
          800: '#384156', 900: '#1f2533', 950: '#11151d',
        },
        // Capital One navy — primary brand
        brand: {
          50: '#eef4f9', 100: '#d3e3ef', 200: '#a6c6df', 300: '#6f9fc6',
          400: '#3d77a6', 500: '#1a5985', 600: '#004977', 700: '#013a60',
          800: '#062f4c', 900: '#0a283f', 950: '#04192a',
        },
        // Capital One red — accent / logo
        accent: {
          50: '#fef3f1', 100: '#fcdfdb', 200: '#f9c2bb', 300: '#f29388',
          400: '#e85d4e', 500: '#d83b2a', 600: '#d03027', 700: '#a92019',
          800: '#8c1d18', 900: '#751d1a', 950: '#3f0b09',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(6,47,76,0.04), 0 8px 24px rgba(6,47,76,0.06)',
        pop: '0 16px 50px rgba(6,47,76,0.20)',
        glow: '0 0 0 1px rgba(0,73,119,0.08), 0 10px 30px rgba(0,73,119,0.12)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        'bar-grow': { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.16,1,.3,1) both',
        'fade-in': 'fade-in .4s ease both',
        'scale-in': 'scale-in .35s cubic-bezier(.16,1,.3,1) both',
        'slide-in': 'slide-in .35s ease both',
        shimmer: 'shimmer 1.4s linear infinite',
        blink: 'blink 1s step-end infinite',
        'bar-grow': 'bar-grow .7s cubic-bezier(.16,1,.3,1) both',
      },
    },
  },
  plugins: [],
}
