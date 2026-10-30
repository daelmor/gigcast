import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

let instance: Db | undefined;

/** Lazily create the postgres.js client so importing this module never needs a database. */
export function getDb(): Db {
	if (instance) return instance;
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('Missing environment variables: DATABASE_URL');
	instance = drizzle(postgres(url), { schema });
	return instance;
}
