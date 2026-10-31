/** Account rows for Google sign-in. One row per person, found by Google subject first, then by email. */
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index.ts';
import { users } from '../db/schema.ts';
import type { AuthUser } from './session.ts';

export interface GoogleProfile {
	sub: string;
	email: string;
	name?: string;
	picture?: string;
}

const toAuthUser = (row: typeof users.$inferSelect): AuthUser => ({
	id: row.id,
	email: row.email,
	name: row.name,
	picture: row.picture
});

export async function upsertGoogleUser(profile: GoogleProfile): Promise<AuthUser> {
	const db = getDb();
	const email = profile.email.trim().toLowerCase();
	const bySub = await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1);
	const existing =
		bySub[0] ?? (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
	const now = new Date();
	if (existing) {
		const [row] = await db
			.update(users)
			.set({
				email,
				name: profile.name ?? existing.name,
				picture: profile.picture ?? existing.picture,
				googleSub: profile.sub,
				lastLoginAt: now
			})
			.where(eq(users.id, existing.id))
			.returning();
		return toAuthUser(row);
	}
	const [row] = await db
		.insert(users)
		.values({
			id: `usr_${nanoid(12)}`,
			email,
			name: profile.name ?? null,
			picture: profile.picture ?? null,
			googleSub: profile.sub
		})
		.returning();
	return toAuthUser(row);
}
