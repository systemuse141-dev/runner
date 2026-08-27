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
        background: {
          DEFAULT: '#07080D',
          secondary: '#0B0D16',
          tertiary: '#101322',
        },
        surface: {
          DEFAULT: '#111424',
          elevated: '#161B30',
          highlight: '#1D2340',
          card: 'rgba(17, 20, 36, 0.85)',
          royal: '#131830',
        },
        gold: {
          50: '#FDFBF4',
          100: '#F9F4DF',
          200: '#F2E5B5',
          300: '#EBD48B',
          400: '#E4C261',
          500: '#D4AF37', // Metallic Champagne Gold
          600: '#B89225',
          700: '#947217',
          800: '#73570F',
          900: '#543E08',
          light: '#F5E7B8',
          metallic: '#C5A059',
          champagne: '#E6CA65',
        },
        royal: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#1E1B4B',
          dark: '#0E1326',
          navy: '#131936',
        },
        ivory: {
          DEFAULT: '#FBFBFA',
          muted: '#E8E8E3',
          dark: '#C8C8C0',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          subtle: 'rgba(255, 255, 255, 0.04)',
          gold: 'rgba(212, 175, 55, 0.25)',
          'gold-subtle': 'rgba(212, 175, 55, 0.12)',
          'gold-bright': 'rgba(212, 175, 55, 0.5)',
        },
        status: {
          emerald: '#10B981',
          ruby: '#E11D48',
          amber: '#F59E0B',
          sapphire: '#3B82F6',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Cinzel', 'Playfair Display', 'Inter', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #F5E7B8 50%, #C5A059 100%)',
        'royal-gradient': 'linear-gradient(135deg, #131936 0%, #0B0D16 100%)',
        'card-radial': 'radial-gradient(circle at top left, rgba(212, 175, 55, 0.06), transparent 70%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'gold-shimmer': 'goldShimmer 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        goldShimmer: {
          '0%, 100%': { opacity: '0.9', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.15)' },
        }
      }
    },
  },
  plugins: [],
}
