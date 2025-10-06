import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from 'dotenv';
import ws from 'ws';
import * as schema from './schema';

config();

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
}

// Configure neon for Node.js environment
neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;

// Create connection
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

export type Database = typeof db;

// Database instance getter for Activities
export const getDatabase = () => db;
