<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico?v=2" sizes="any" />
	<link rel="shortcut icon" href="/favicon.ico?v=2" type="image/x-icon" />
</svelte:head>

{@render children()}
