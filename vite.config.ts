import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	server: {
		proxy: {
			// In production nginx forwards this to the control daemon. Locally the
			// dev server stands in, so /minecraft-admin works with `npm run dev`.
			// changeOrigin stays off on purpose: the daemon checks that Origin
			// matches ALLOWED_ORIGIN, which must be the dev server's own address.
			'/api/mc': { target: 'http://127.0.0.1:8787', changeOrigin: false }
		}
	}
});
