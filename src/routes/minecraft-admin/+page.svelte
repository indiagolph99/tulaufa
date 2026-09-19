<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		isAuthenticated,
		login,
		logout,
		getStatus,
		runAction,
		streamLogs,
		ApiError,
		type Action,
		type Status
	} from '$lib/mc/client';

	let authed = $state(false);
	let booting = $state(true);
	let password = $state('');
	let error = $state('');
	let busy = $state<Action | null>(null);

	let status = $state<Status | null>(null);
	let lines = $state<string[]>([]);
	let follow = $state(true);
	let streamDown = $state(false);
	let logPane: HTMLDivElement | undefined = $state();

	let poll: ReturnType<typeof setInterval> | undefined;
	let closeStream: (() => void) | undefined;

	const MAX_LINES = 1000;

	async function refreshStatus() {
		try {
			status = await getStatus();
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) teardown(false);
		}
	}

	function startLive() {
		refreshStatus();
		poll = setInterval(refreshStatus, 5000);
		closeStream = streamLogs(
			(line) => {
				// Trim from the front so a long session cannot grow without bound.
				lines = lines.length >= MAX_LINES ? [...lines.slice(1), line] : [...lines, line];
				if (follow) queueMicrotask(scrollToEnd);
			},
			() => (streamDown = true)
		);
	}

	function teardown(keepAuthed: boolean) {
		if (poll) clearInterval(poll);
		poll = undefined;
		closeStream?.();
		closeStream = undefined;
		authed = keepAuthed;
		if (!keepAuthed) {
			status = null;
			lines = [];
		}
	}

	function scrollToEnd() {
		if (logPane) logPane.scrollTop = logPane.scrollHeight;
	}

	async function onLogin(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		try {
			await login(password);
			password = '';
			authed = true;
			startLive();
		} catch (e) {
			error = e instanceof Error ? e.message : 'login failed';
		}
	}

	async function onLogout() {
		await logout().catch(() => {});
		teardown(false);
	}

	async function act(action: Action) {
		if (action !== 'start' && !confirm(`Точно ${action === 'stop' ? 'остановить' : 'перезапустить'} сервер?`))
			return;
		error = '';
		busy = action;
		try {
			await runAction(action);
			await refreshStatus();
		} catch (e) {
			error = e instanceof Error ? e.message : 'действие не выполнено';
		} finally {
			busy = null;
		}
	}

	function uptime(sinceUnix: number) {
		if (!sinceUnix) return '—';
		const s = Math.max(0, Math.floor(Date.now() / 1000 - sinceUnix));
		const d = Math.floor(s / 86400);
		const h = Math.floor((s % 86400) / 3600);
		const m = Math.floor((s % 3600) / 60);
		return d > 0 ? `${d}д ${h}ч` : h > 0 ? `${h}ч ${m}м` : `${m}м`;
	}

	const gib = (bytes: number) => (bytes < 0 ? '—' : `${(bytes / 1024 ** 3).toFixed(1)} ГБ`);

	onMount(async () => {
		try {
			authed = await isAuthenticated();
			if (authed) startLive();
		} catch {
			// API unreachable; the login form is still the right thing to show.
		} finally {
			booting = false;
		}
	});

	onDestroy(() => teardown(authed));
</script>

<svelte:head>
	<title>minecraft · tulaufa</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main>
	{#if booting}
		<p class="muted">Загрузка…</p>
	{:else if !authed}
		<form onsubmit={onLogin}>
			<h1>minecraft</h1>
			<input
				type="password"
				bind:value={password}
				placeholder="пароль"
				autocomplete="current-password"
				required
			/>
			<button type="submit">Войти</button>
			{#if error}<p class="error">{error}</p>{/if}
		</form>
	{:else}
		<header>
			<h1>minecraft</h1>
			<button class="link" onclick={onLogout}>выйти</button>
		</header>

		<section class="status">
			{#if status}
				<span class="badge {status.activeState}">{status.activeState}</span>
				<dl>
					<dt>состояние</dt>
					<dd>{status.subState}</dd>
					<dt>аптайм</dt>
					<dd>{uptime(status.sinceUnix)}</dd>
					<dt>память</dt>
					<dd>{gib(status.memoryBytes)}</dd>
					<dt>PID</dt>
					<dd>{status.pid || '—'}</dd>
				</dl>
			{:else}
				<p class="muted">Статус недоступен</p>
			{/if}
		</section>

		<section class="actions">
			<button onclick={() => act('start')} disabled={busy !== null || status?.activeState === 'active'}>
				{busy === 'start' ? '…' : 'Запустить'}
			</button>
			<button onclick={() => act('restart')} disabled={busy !== null}>
				{busy === 'restart' ? '…' : 'Перезапустить'}
			</button>
			<button
				class="danger"
				onclick={() => act('stop')}
				disabled={busy !== null || status?.activeState !== 'active'}
			>
				{busy === 'stop' ? '…' : 'Остановить'}
			</button>
		</section>

		{#if error}<p class="error">{error}</p>{/if}

		<section class="logs">
			<div class="logs-head">
				<label><input type="checkbox" bind:checked={follow} /> следить</label>
				<button class="link" onclick={() => (lines = [])}>очистить</button>
				{#if streamDown}<span class="error">поток логов оборвался</span>{/if}
			</div>
			<div class="pane" bind:this={logPane}>
				{#each lines as line, i (i)}<div class="line">{line}</div>{/each}
				{#if lines.length === 0}<p class="muted">Ждём строк…</p>{/if}
			</div>
		</section>
	{/if}
</main>

<style>
	main {
		width: min(100%, 60rem);
		margin: 0 auto;
		padding: 2rem 1rem 3rem;
		color: #e8efe8;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	form {
		display: grid;
		gap: 0.75rem;
		max-width: 20rem;
		margin: 15vh auto 0;
	}

	input[type='password'] {
		padding: 0.6rem 0.75rem;
		border: 1px solid #4a5a4a;
		border-radius: 0.375rem;
		background: rgba(0, 0, 0, 0.45);
		color: inherit;
		font: inherit;
	}

	button {
		padding: 0.55rem 0.9rem;
		border: 1px solid #4a5a4a;
		border-radius: 0.375rem;
		background: rgba(0, 0, 0, 0.45);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		border-color: #8fbf8f;
	}

	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	button.danger:hover:not(:disabled) {
		border-color: #d98a8a;
		color: #ffd9d9;
	}

	button.link {
		border: 0;
		background: none;
		padding: 0;
		text-decoration: underline;
		opacity: 0.75;
	}

	.status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid #3a4a3a;
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.45);
	}

	.badge {
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		background: #555;
	}

	.badge.active {
		background: #2f6b34;
	}
	.badge.failed {
		background: #7a2f2f;
	}
	.badge.activating,
	.badge.deactivating {
		background: #7a6a2f;
	}

	dl {
		display: grid;
		grid-template-columns: repeat(4, auto);
		gap: 0.15rem 1.25rem;
		margin: 0;
		font-size: 0.85rem;
	}

	dt {
		grid-row: 1;
		opacity: 0.6;
	}
	dd {
		grid-row: 2;
		margin: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1rem 0;
	}

	.logs-head {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
		font-size: 0.85rem;
	}

	.pane {
		height: 26rem;
		overflow: auto;
		padding: 0.75rem;
		border: 1px solid #3a4a3a;
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.6);
		font-size: 0.78rem;
		line-height: 1.45;
	}

	.line {
		white-space: pre-wrap;
		word-break: break-word;
	}

	.muted {
		opacity: 0.55;
	}

	.error {
		color: #ffb4b4;
	}

	@media (max-width: 40rem) {
		dl {
			grid-template-columns: repeat(2, auto);
			gap: 0.15rem 1rem;
		}
		dt {
			grid-row: auto;
		}
		dd {
			grid-row: auto;
		}
	}
</style>
