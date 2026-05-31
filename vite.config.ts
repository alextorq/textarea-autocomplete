import { defineConfig } from 'vite'

// base must match the repository name so assets resolve correctly on GitHub Pages
// (served from https://alextorq.github.io/textarea-autocomplete/)
export default defineConfig({
  base: '/textarea-autocomplete/',
})
