/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{js,jsx,ts,tsx,html}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Rubik", "ui-sans-serif", "system-ui"],
                body: ["Quicksand", "ui-sans-serif", "system-ui"],
            },
            colors: {
                abyss: "#01162b", // deepest navy (backgrounds)
                current: "#00385a", // primary UI blue
                mist: "#6a90b4", // secondary / accents
                frost: "#94a2bf", // muted text, borders
                snow: "#d2dbeb", // light backgrounds
            },
        },
    },
    plugins: [],
};
