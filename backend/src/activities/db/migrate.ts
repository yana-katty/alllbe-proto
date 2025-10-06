import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from './connection';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
    console.log('Running migrations...');

    try {
        const migrationsFolder = join(__dirname, '../../../drizzle');
        await migrate(db, { migrationsFolder });
        console.log('Migrations completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigrations();
