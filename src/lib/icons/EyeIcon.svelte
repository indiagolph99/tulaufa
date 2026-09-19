<script lang="ts">
	// Stroked rather than pixel-art: this is interface chrome, not a Minecraft
	// item, and it has to stay legible at 18px.
	let { closed = false }: { closed?: boolean } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width="18"
	height="18"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	<path d="M1.8 12S5.9 5.5 12 5.5 22.2 12 22.2 12 18.1 18.5 12 18.5 1.8 12 1.8 12Z" />
	<circle cx="12" cy="12" r="3.1" />
	{#if closed}
		<line x1="3.5" y1="20.5" x2="20.5" y2="3.5" />
	{/if}
</svg>
