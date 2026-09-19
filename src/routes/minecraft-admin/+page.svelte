<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import BedIcon from '$lib/icons/BedIcon.svelte';
	import EyeIcon from '$lib/icons/EyeIcon.svelte';
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
	let reveal = $state(false);
	let passwordInput: HTMLInputElement | undefined = $state();

	// Svelte forbids a dynamic `type` on an input with two-way binding, and
	// swapping between two inputs would drop focus mid-typing. Setting the
	// property directly keeps one element, so focus and selection survive.
	$effect(() => {
		if (passwordInput) passwordInput.type = reveal ? 'text' : 'password';
	});
	let error = $state('');
	let busy = $state<Action | null>(null);

	let status = $state<Status | null>(null);
	let lines = $state<string[]>([]);
	let showLogs = $state(false);
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
				if (follow && showLogs) queueMicrotask(scrollToEnd);
			},
			() => (streamDown = true)
		);
	}

	function toggleLogs() {
		showLogs = !showLogs;
		// Jump to the newest line on reveal: the pane kept filling while hidden.
		if (showLogs && follow) queueMicrotask(scrollToEnd);
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
			showLogs = false;
		}
	}

	function scrollToEnd() {
		if (logPane) logPane.scrollTop = logPane.scrollHeight;
	}

	// The form never navigates — preventDefault plus fetch — so Chrome's
	// heuristics for "a login just happened" often do not fire and no save
	// prompt appears. The Credential Management API says it outright.
	// Firefox and Safari have no such API and fall back on their heuristics,
	// which is why the hidden username field still matters.
	async function rememberCredentials(secret: string) {
		const ctor = (window as unknown as { PasswordCredential?: new (data: object) => Credential })
			.PasswordCredential;
		if (!ctor || !navigator.credentials?.store) return;
		try {
			await navigator.credentials.store(
				new ctor({ id: 'admin', password: secret, name: 'minecraft · tulaufa' })
			);
		} catch {
			// Offering to save is a convenience; it must never break logging in.
		}
	}

	async function onLogin(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		try {
			await login(password);
			// Ask before clearing the field and unmounting the form, or there is
			// nothing left for the browser to read.
			await rememberCredentials(password);
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

<a class="home" href="/" title="На главную" aria-label="На главную">
	<BedIcon />
</a>

<main>
	{#if booting}
		<div class="panel panel-narrow">
			<p class="muted">Загрузка…</p>
		</div>
	{:else if !authed}
		<form class="panel panel-narrow" onsubmit={onLogin}>
			<h1>minecraft</h1>

			<!-- Password managers want a username beside the password before they
			     offer to save anything. There is only one account, so it is fixed
			     and kept out of the tab order. Deliberately NOT readonly: Chrome's
			     form parser skips readonly fields, which leaves a password-only
			     form and no save prompt. -->
			<input
				class="sr-only"
				type="text"
				name="username"
				value="admin"
				autocomplete="username"
				tabindex="-1"
				aria-hidden="true"
			/>

			<label class="sr-only" for="mc-password">Пароль</label>
			<div class="password-field">
				<input
					id="mc-password"
					name="password"
					type="password"
					bind:this={passwordInput}
					bind:value={password}
					placeholder="пароль"
					autocomplete="current-password"
					autocapitalize="off"
					autocorrect="off"
					spellcheck="false"
					required
				/>
				<button
					type="button"
					class="reveal"
					onclick={() => (reveal = !reveal)}
					aria-pressed={reveal}
					aria-controls="mc-password"
					aria-label={reveal ? 'Скрыть пароль' : 'Показать пароль'}
					title={reveal ? 'Скрыть пароль' : 'Показать пароль'}
				>
					<EyeIcon closed={!reveal} />
				</button>
			</div>

			<button type="submit">Войти</button>
			{#if error}<p class="error">{error}</p>{/if}
		</form>
	{:else}
		<div class="panel">
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
				<button
					onclick={() => act('start')}
					disabled={busy !== null || status?.activeState === 'active'}
				>
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
					<button class="toggle" onclick={toggleLogs} aria-expanded={showLogs} aria-controls="mc-logs">
						{showLogs ? 'Скрыть логи' : 'Показать логи'}
					</button>

					<div class="logs-controls" hidden={!showLogs}>
						<label><input type="checkbox" bind:checked={follow} /> следить</label>
						<button class="link" onclick={() => (lines = [])}>очистить</button>
						{#if streamDown}<span class="error">поток логов оборвался</span>{/if}
					</div>
				</div>

				<div class="pane" id="mc-logs" hidden={!showLogs} bind:this={logPane}>
					{#each lines as line, i (i)}<div class="line">{line}</div>{/each}
					{#if lines.length === 0}<p class="muted">Ждём строк…</p>{/if}
				</div>
			</section>
		</div>
	{/if}
</main>

<style>
	/* Scroll inside <main> rather than on <body>. A :global(body) rule here would
	   be compiled into this route's stylesheet, which SvelteKit keeps loaded after
	   a client-side navigation away — so the landing page would stay top-aligned
	   and its logo would visibly jump on the way back. */
	main {
		align-self: stretch;
		justify-self: center;
		height: 100dvh;
		overflow-y: auto;
		width: min(100%, 60rem);
		margin: 0 auto;
		/* room for the fixed home button above the panel */
		padding: 4.5rem 1rem 3rem;
		color: #e8efe8;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	/* The background photo is busy and light in places, so the UI sits on an
	   opaque surface rather than trying to compete with it. */
	.panel {
		padding: 1.5rem;
		border: 1px solid #38472f;
		border-radius: 0.75rem;
		background: #10160f;
		box-shadow:
			0 1.5rem 3rem rgba(0, 0, 0, 0.55),
			0 0 0 1px rgba(0, 0, 0, 0.4);
	}

	.panel-narrow {
		width: min(100%, 22rem);
		margin: 8vh auto 0;
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
	}

	/* Present for form semantics and password managers, invisible to everyone
	   else. Not `display: none`, which some managers skip over. */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	.password-field {
		position: relative;
		display: grid;
	}

	/* Room for the eye, so a long password never slides underneath it. */
	.password-field input {
		padding-right: 2.6rem;
	}

	.reveal {
		position: absolute;
		top: 50%;
		right: 0.3rem;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 0;
		border-radius: 0.3rem;
		background: none;
		color: #8a9a8a;
	}

	.reveal:hover {
		color: #d6e6d6;
	}

	.reveal:focus-visible {
		outline: 2px solid #8fbf8f;
		outline-offset: 1px;
	}

	.reveal[aria-pressed='true'] {
		color: #8fbf8f;
	}

	.home {
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
	}

	.home:hover,
	.home:focus-visible {
		border-color: #8fbf8f;
	}

	/* Matches on type, and the reveal toggle swaps that type at runtime, so
	   both states are selected explicitly. */
	#mc-password {
		padding: 0.6rem 0.75rem;
		border: 1px solid #4a5a4a;
		border-radius: 0.375rem;
		background: #060906;
		color: inherit;
		font: inherit;
	}

	#mc-password:focus-visible {
		outline: 2px solid #8fbf8f;
		outline-offset: 1px;
	}

	button {
		padding: 0.55rem 0.9rem;
		border: 1px solid #4a5a4a;
		border-radius: 0.375rem;
		background: #1a231a;
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
		background: #0a0f0a;
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
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
		font-size: 0.85rem;
	}

	.toggle {
		padding: 0.45rem 0.8rem;
		font-size: 0.85rem;
	}

	.logs-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	/* .pane sets display, which would otherwise win over [hidden]. */
	[hidden] {
		display: none !important;
	}

	.pane {
		height: 26rem;
		overflow: auto;
		padding: 0.75rem;
		border: 1px solid #3a4a3a;
		border-radius: 0.5rem;
		background: #060906;
		font-size: 0.78rem;
		line-height: 1.45;

		/* Firefox. Keeping the gutter reserved stops the lines reflowing the
		   moment the log grows past one screenful. */
		scrollbar-width: thin;
		scrollbar-color: #526d54 transparent;
		scrollbar-gutter: stable;
	}

	/* WebKit and Blink. Styling these also stops macOS hiding the bar until you
	   scroll, so it stays visible inside the pane rather than overlaying it. */
	.pane::-webkit-scrollbar {
		width: 0.7rem;
	}

	.pane::-webkit-scrollbar-track {
		background: transparent;
	}

	.pane::-webkit-scrollbar-thumb {
		border-radius: 999px;
		background: #526d54;
		/* A transparent border plus padding-box insets the thumb, so it floats
		   inside the pane instead of touching its edge. */
		border: 3px solid transparent;
		background-clip: padding-box;
	}

	.pane::-webkit-scrollbar-thumb:hover {
		background: #5f8060;
		background-clip: padding-box;
	}

	.pane::-webkit-scrollbar-corner {
		background: transparent;
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
