/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Codes couleur pour radioprotection
        status: {
          valid: '#10b981',    // vert
          warning: '#f97316',  // orange
          invalid: '#ef4444',  // rouge
          disabled: '#9ca3af', // gris
        }
      },
      animation: {
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
