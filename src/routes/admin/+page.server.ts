/**
 * /admin: activity and run statistics for the operator. Hidden unless
 * ADMIN_TOKEN is set; opened once with `/admin?token=<ADMIN_TOKEN>`, which
 * sets a cookie for thirty days. Anything else answers 404 so the page does
 * not advertise itself.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { dev } from '$app/environment';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAdminStats } from '$lib/server/activity/stats';
import { getEnv } from '$lib/server/env';

const COOKIE = 'gc_admin';
const digest = (s: string) => createHash('sha256').update(s).digest();
const sameSecret = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export const load: PageServerLoad = async ({ cookies, url, setHeaders }) => {
	const expected = getEnv().ADMIN_TOKEN;
	if (!expected) error(404, 'Not found');
	const presented = url.searchParams.get('token');
	if (presented !== null) {
		if (!sameSecret(presented, expected)) error(404, 'Not found');
		cookies.set(COOKIE, digest(expected).toString('hex'), {
			path: '/admin',
			httpOnly: true,
			secure: !dev,
			sameSite: 'lax',
			maxAge: 30 * 24 * 60 * 60
		});
		redirect(303, '/admin');
	}
	const cookie = cookies.get(COOKIE);
	if (!cookie || !sameSecret(cookie, digest(expected).toString('hex'))) error(404, 'Not found');
	setHeaders({ 'cache-control': 'no-store' });
	return { stats: await getAdminStats() };
};
