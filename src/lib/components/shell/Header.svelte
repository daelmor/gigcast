<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<header class="border-b border-zinc-200 bg-white/80 backdrop-blur">
	<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
		<a href={resolve('/')} class="text-lg font-semibold tracking-tight text-zinc-900">gigcast</a>
		<nav class="flex items-center gap-1 text-sm" aria-label="Main">
			<a
				href={resolve('/new')}
				class="rounded-lg px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
				>New brief</a
			>
			<a
				href="https://github.com/daelmor/gigcast"
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-lg px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
				>GitHub</a
			>
		</nav>
	</div>
</header>
