// Typed wrappers over the control API served by tulaufa-mine-go at /api/mc.
// Everything here runs in the browser only; the page is a static shell.

const BASE = '/api/mc';

export type Status = {
	activeState: string;
	subState: string;
	enabled: boolean;
	sinceUnix: number;
	pid: number;
	memoryBytes: number;
};

export type Action = 'start' | 'stop' | 'restart';

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(BASE + path, { credentials: 'same-origin', ...init });
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new ApiError(
			body?.error ?? `request failed (${res.status})`,
			res.status,
		);
	}
	return body as T;
}

function mutate<T>(path: string, payload?: unknown): Promise<T> {
	return request<T>(path, {
		method: 'POST',
		// The API requires this header to match its allowed origin, which is
		// what closes CSRF alongside the SameSite=Strict cookie.
		headers: { 'Content-Type': 'application/json' },
		body: payload === undefined ? undefined : JSON.stringify(payload),
	});
}

export const isAuthenticated = () =>
	request<{ authenticated: boolean }>('/session').then((r) => r.authenticated);

export const login = (password: string) =>
	mutate<{ authenticated: boolean }>('/login', { password });

export const logout = () => mutate<{ authenticated: boolean }>('/logout');

export const getStatus = () => request<Status>('/status');

export const runAction = (action: Action) =>
	mutate<{ action: string; result: string }>('/action', { action });

/** Opens the log stream. Returns a closer; call it when the view goes away. */
export function streamLogs(
	onLine: (line: string) => void,
	onError: () => void,
): () => void {
	const source = new EventSource(BASE + '/logs/stream', {
		withCredentials: true,
	});
	source.addEventListener('line', (e) =>
		onLine((e as MessageEvent<string>).data),
	);
	source.onerror = () => onError();
	return () => source.close();
}
