<svelte:head>
	<title>tulaufa</title>
</svelte:head>

<img class="logo" src="/logo.jpg" alt="tulaufa logo" />
<div class="content message_soon">
	coming soon
</div>

<style>
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
		font-family: "Gill Sans", Helvetica, Arial, sans-serif;
		color: white;
		font-size: 2rem;
	}

	@media (max-width: 600px) {
		.logo {
			width: 78vmin;
		}
	}
</style>
