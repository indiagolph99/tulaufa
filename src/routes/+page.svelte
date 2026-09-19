<script lang="ts">
	import DiamondIcon from '$lib/icons/DiamondIcon.svelte';
</script>

<svelte:head>
	<title>tulaufa</title>
</svelte:head>

<a class="admin-link" href="/minecraft-admin" aria-label="Управление сервером Minecraft">
	<DiamondIcon />
</a>

<img class="logo" src="/logo.jpg" alt="tulaufa logo" />
<div class="content message_soon">coming soon</div>

<style>
	/* Mirrors the home button on /minecraft-admin: same corner, same size, so the
	   two routes lead to each other from the same spot. Fixed, so it stays out
	   of the centred layout entirely. */
	.admin-link {
		position: fixed;
		top: 1rem;
		left: 1rem;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		border: 1px solid #4a5a4a;
		border-radius: 0.375rem;
		background: #10160f;
		box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.45);
		/* The logo uses screen blending; keep this out of it so the diamond
		   renders in its own colours. */
		isolation: isolate;
		transition: border-color 120ms ease;
	}

	.admin-link:hover,
	.admin-link:focus-visible {
		border-color: #4de0d2;
	}

	.logo {
		width: min(60vmin, 520px);
		height: auto;
		/* logo is a dark sketch on white paper: invert it, then screen-blend so
		   the paper drops out and only the strokes stay, in white */
		filter: invert(1) contrast(1.15);
		mix-blend-mode: screen;
		user-select: none;
		-webkit-user-drag: none;
	}

	.message_soon {
		font-family: 'Gill Sans', Helvetica, Arial, sans-serif;
		color: white;
		font-size: 2rem;
	}

	@media (max-width: 600px) {
		.logo {
			width: 78vmin;
		}
	}
</style>
