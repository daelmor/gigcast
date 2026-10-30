import { getContext, setContext } from 'svelte';
import type { SourceIndex } from './sources';

const KEY = Symbol('brief-source-index');

export function setSourceIndex(index: SourceIndex): void {
	setContext(KEY, index);
}

export function getSourceIndex(): SourceIndex | undefined {
	return getContext<SourceIndex | undefined>(KEY);
}
