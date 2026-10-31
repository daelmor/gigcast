<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Logo from './Logo.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let scrolled = $state(false);

	const links = [
		{ href: resolve('/new'), label: 'New brief', match: '/new' },
		{ href: resolve('/about'), label: 'About', match: '/about' }
	];
	const current = (match: string) => (page.url.pathname.startsWith(match) ? 'page' : undefined);
	const user = $derived(
		page.data.user as
			{ name: string | null; email: string; picture: string | null } | null | undefined
	);
	const authRequired = $derived(page.data.authMode === 'required');
	const next = $derived(encodeURIComponent(page.url.pathname + page.url.search));
	const control =
		'rounded-md px-2 py-1.5 type-button font-medium whitespace-nowrap text-ink-muted transition-colors duration-[120ms] hover:bg-surface-sunken hover:text-ink sm:px-3';
</script>

<svelte:window onscroll={() => (scrolled = window.scrollY > 4)} />

<header
	class="sticky top-0 z-30 border-b border-line bg-surface-raised transition-shadow duration-[120ms] {scrolled
		? 'shadow-raised'
		: ''}"
>
	<div
		class="mx-auto flex max-w-6xl items-center justify-between gap-space-2 px-4 py-2.5 sm:gap-space-4 sm:px-6"
	>
		<a href={resolve('/')} class="rounded-md" aria-label="gigcast home"><Logo /></a>
		<div class="flex items-center gap-space-2 sm:gap-space-3">
			<nav class="flex items-center gap-space-1" aria-label="Main">
				{#each links as link (link.href)}
					<a
						href={link.href}
						aria-current={current(link.match)}
						class="rounded-md px-2 py-1.5 type-button font-medium whitespace-nowrap text-ink-muted transition-colors duration-[120ms] hover:bg-surface-sunken hover:text-ink aria-[current=page]:bg-signal-soft aria-[current=page]:text-signal sm:px-3"
						>{link.label}</a
					>
				{/each}
				<a
					href="https://github.com/daelmor/gigcast"
					target="_blank"
					rel="noopener noreferrer"
					class="hidden rounded-md px-3 py-1.5 type-button font-medium text-ink-muted transition-colors duration-[120ms] hover:bg-surface-sunken hover:text-ink sm:inline-flex"
					>GitHub</a
				>
			</nav>
			{#if authRequired}
				{#if user}
					<form method="post" action="/auth/signout" class="flex items-center gap-space-2">
						{#if user.picture}
							<img
								src={user.picture}
								alt=""
								class="size-7 rounded-full"
								referrerpolicy="no-referrer"
								width="28"
								height="28"
							/>
						{/if}
						<span class="hidden max-w-40 truncate type-small text-ink-muted md:inline"
							>{user.name ?? user.email}</span
						>
						<button type="submit" class={control}>Sign out</button>
					</form>
				{:else}
					<a href="{resolve('/auth/google')}?next={next}" class={control}>Sign in</a>
				{/if}
			{/if}
			<ThemeToggle />
		</div>
	</div>
</header>
