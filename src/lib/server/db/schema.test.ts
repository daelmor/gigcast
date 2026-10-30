import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from './schema';

describe('schema', () => {
	it('defines every expected table', () => {
		const names = [
			schema.qlooCache,
			schema.markets,
			schema.briefs,
			schema.briefRuns,
			schema.agentEvents,
			schema.newsItems,
			schema.newsClassifications,
			schema.holidaysCache,
			schema.weatherCache
		].map((t) => getTableName(t));

		expect(names).toEqual([
			'qloo_cache',
			'markets',
			'briefs',
			'brief_runs',
			'agent_events',
			'news_items',
			'news_classifications',
			'holidays_cache',
			'weather_cache'
		]);
	});
});
