
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#56C1E0",
          foreground: "#FFFFFF",
          50: '#EDFAFF',
          100: '#D6F3FF',
          200: '#ADE6FF',
          300: '#85DAFF',
          400: '#56C1E0',
          500: '#35ABCF',
          600: '#2389AD',
          700: '#156A89',
          800: '#0B4D67',
          900: '#043546',
        },
        secondary: {
          DEFAULT: "#AF7AE7",
          foreground: "#FFFFFF",
          50: '#F7F0FF',
          100: '#EEE0FF',
          200: '#DCC1FF',
          300: '#CBA3FF',
          400: '#AF7AE7',
          500: '#9B56E0',
          600: '#7F35CF',
          700: '#6523AD',
          800: '#4B1589',
          900: '#320B67',
        },
        destructive: {
          DEFAULT: "#FF6B6B",
          foreground: "#FFFFFF",
          50: '#FFF0F0',
          100: '#FFE0E0',
          200: '#FFC1C1',
          300: '#FFA3A3',
          400: '#FF6B6B',
          500: '#FF3838',
          600: '#FF0505',
          700: '#D20000',
          800: '#A00000',
          900: '#6D0000',
        },
        muted: {
          DEFAULT: "#F3F4F6",
          foreground: "#6B7280",
        },
        accent: {
          DEFAULT: "#EAE0FF",
          foreground: "#1F2937",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "pulse-gentle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        "scale-up": {
          "0%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "fade-up": "fade-up 0.5s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "pulse-gentle": "pulse-gentle 3s infinite ease-in-out",
        "scale-up": "scale-up 0.2s ease-out",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 20px rgba(0, 0, 0, 0.1)',
        glow: '0 0 15px rgba(86, 193, 224, 0.5)',
        'glow-secondary': '0 0 15px rgba(175, 122, 231, 0.5)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'dot-pattern': 'radial-gradient(circle, #56C1E0 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-size': '20px 20px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
