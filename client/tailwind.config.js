import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#edf2f8',
        foreground: '#0f172a',
        card: '#ffffff',
        'card-foreground': '#111827',
        border: '#d6e0ed',
        input: '#d6e0ed',
        ring: '#4a78b7',
        primary: {
          DEFAULT: '#295f9f',
          foreground: '#f8fbff'
        },
        secondary: {
          DEFAULT: '#e7eef8',
          foreground: '#25354b'
        },
        muted: {
          DEFAULT: '#edf3fb',
          foreground: '#5f6f84'
        },
        destructive: {
          DEFAULT: '#b34040',
          foreground: '#fff5f5'
        }
      },
      borderRadius: {
        lg: '0.8rem',
        md: '0.6rem',
        sm: '0.45rem'
      }
    }
  },
  plugins: [forms]
};
