import { describe, expect, it } from 'vitest';
import { RISK_SCORE_NOTE, riskLevelWord } from './risk-level.ts';

describe('riskLevelWord', () => {
	it('keeps the thresholds and names volume, not danger', () => {
		expect(riskLevelWord(0)).toBe('quiet');
		expect(riskLevelWord(24)).toBe('quiet');
		expect(riskLevelWord(25)).toBe('elevated');
		expect(riskLevelWord(59)).toBe('elevated');
		expect(riskLevelWord(60)).toBe('high news volume');
		expect(riskLevelWord(100)).toBe('high news volume');
		expect(RISK_SCORE_NOTE).toContain('not a safety judgment');
		expect(RISK_SCORE_NOTE).toContain('Dense-media cities read higher by default');
	});
});
