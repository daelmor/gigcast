import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleBrief } from '../../brief/fixtures/sample-brief.ts';
import type { Brief, BriefInput } from '../../brief/schema.ts';
import { resetEnvCache } from '../env.ts';

vi.mock('./store.ts', () => ({
	appendEvent: vi.fn(async () => 1),
	completeBrief: vi.fn(async () => undefined),
	createBriefRecord: vi.fn(async () => undefined),
	createRun: vi.fn(async () => undefined),
	failRun: vi.fn(async () => undefined),
	finishRun: vi.fn(async () => undefined),
	setBriefStatus: vi.fn(async () => undefined)
}));

const store = await import('./store.ts');
const manager = await import('./manager.ts');

const input: BriefInput = {
	artist: 'Test Artist',
	city: 'Mexico City',
	country: 'MX',
	dateFrom: '2027-03-01',
	dateTo: '2027-03-02'
};

/** A runner whose completion the test controls. */
function controlledRunner() {
	const resolvers = new Map<string, () => void>();
	const runner: import('./manager.ts').BriefRunner = ({ briefId }) =>
		new Promise((resolve) => {
			resolvers.set(briefId, () =>
				resolve({ brief: { ...sampleBrief, id: briefId } as Brief, events: [] })
			);
		});
	return { runner, finish: (id: string) => resolvers.get(id)?.() };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const ENV_KEYS = [
	'QLOO_API_KEY',
	'DATABASE_URL',
	'GOOGLE_CLOUD_PROJECT',
	'MAX_CONCURRENT_RUNS',
	'MAX_QUEUED_RUNS',
	'COUNTERFACTUAL_RUN'
] as const;
const saved: Record<string, string | undefined> = {};

describe('startBriefRun capacity', () => {
	beforeEach(() => {
		for (const k of ENV_KEYS) saved[k] = process.env[k];
		process.env.QLOO_API_KEY = 'test-key';
		process.env.DATABASE_URL = 'postgres://example/db';
		process.env.GOOGLE_CLOUD_PROJECT = 'example';
		process.env.MAX_CONCURRENT_RUNS = '1';
		process.env.MAX_QUEUED_RUNS = '1';
		delete process.env.COUNTERFACTUAL_RUN;
		resetEnvCache();
		vi.clearAllMocks();
	});
	afterEach(async () => {
		// Drain anything a test left behind so the module state is clean for the next one.
		manager.abortAllRuns('test over');
		await flush();
		for (const k of ENV_KEYS) {
			if (saved[k] === undefined) delete process.env[k];
			else process.env[k] = saved[k];
		}
		resetEnvCache();
	});

	it('runs the first brief, queues the second and refuses the third', async () => {
		const { runner, finish } = controlledRunner();
		const cf = vi.fn();
		const first = await manager.startBriefRun(input, { runner, counterfactualRunner: cf, id: 'a' });
		expect(first).toEqual({ id: 'a', status: 'running' });
		expect(store.createBriefRecord).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: 'a', status: 'running' })
		);

		const messages: import('./manager.ts').HubMessage[] = [];
		const second = await manager.startBriefRun(input, {
			runner,
			counterfactualRunner: cf,
			id: 'b'
		});
		manager.subscribe('b', (m) => messages.push(m));
		expect(second).toEqual({ id: 'b', status: 'queued', position: 1 });
		expect(store.createBriefRecord).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: 'b', status: 'queued' })
		);
		expect(manager.queuePosition('b')).toBe(1);
		expect(manager.capacity()).toEqual({ running: 1, queued: 1, limit: 1, queueLimit: 1 });

		await expect(
			manager.startBriefRun(input, { runner, counterfactualRunner: cf, id: 'c' })
		).rejects.toBeInstanceOf(manager.BriefBusyError);
		expect(manager.getActiveRun('c')).toBeUndefined();

		finish('a');
		await flush();
		await flush();
		expect(store.completeBrief).toHaveBeenCalledWith('a', expect.anything(), expect.any(String));
		expect(manager.getActiveRun('a')).toBeUndefined();
		expect(manager.getActiveRun('b')?.state).toBe('running');
		expect(store.setBriefStatus).toHaveBeenCalledWith('b', 'running');
		expect(messages).toContainEqual({ kind: 'status', status: 'running', done: false });
		expect(manager.queuePosition('b')).toBeUndefined();

		finish('b');
		await flush();
		await flush();
		expect(manager.getActiveRun('b')).toBeUndefined();
		expect(messages.at(-1)).toEqual({ kind: 'status', status: 'complete', done: true });
		// The second run never ran the counterfactual: it is off by default.
		expect(cf).not.toHaveBeenCalled();
	});

	it('runs the counterfactual only when COUNTERFACTUAL_RUN=on', async () => {
		process.env.COUNTERFACTUAL_RUN = 'on';
		resetEnvCache();
		const { runner, finish } = controlledRunner();
		const cf = vi.fn(async () => ({
			draft: undefined,
			events: [],
			run: { ...sampleBrief.run, kind: 'counterfactual' as const, status: 'failed' as const }
		}));
		await manager.startBriefRun(input, { runner, counterfactualRunner: cf, id: 'd' });
		finish('d');
		await flush();
		await flush();
		expect(cf).toHaveBeenCalledTimes(1);
		const [, brief] = vi.mocked(store.completeBrief).mock.calls[0]!;
		expect((brief as Brief).counterfactual?.status).toBe('failed');
	});

	it('rolls the reservation back when the row cannot be created', async () => {
		vi.mocked(store.createBriefRecord).mockRejectedValueOnce(new Error('db down'));
		const { runner } = controlledRunner();
		await expect(
			manager.startBriefRun(input, { runner, counterfactualRunner: vi.fn(), id: 'e' })
		).rejects.toThrow('db down');
		expect(manager.getActiveRun('e')).toBeUndefined();
		expect(manager.capacity().running).toBe(0);
	});
});
