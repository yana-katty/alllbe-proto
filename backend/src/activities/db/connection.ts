import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from 'dotenv';
import ws from 'ws';
import * as schema from './schema';

config();

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
}

let connectionString = process.env.DATABASE_URL;

// Configuring Neon for local development with Neon Proxy
if (process.env.NODE_ENV === 'development') {
    neonConfig.fetchEndpoint = (host) => {
        const [protocol, port] = host === 'db.localtest.me' ? ['http', 4444] : ['https', 443];
        return `${protocol}://${host}:${port}/sql`;
    };

    const connectionStringUrl = new URL(connectionString);
    neonConfig.useSecureWebSocket = connectionStringUrl.hostname !== 'db.localtest.me';
    neonConfig.wsProxy = (host) =>
        (host === 'db.localtest.me' ? `${host}:4444/v2` : `${host}/v2`);
}

// Configure neon for Node.js environment
neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;

// Create connection
const sql = neon(connectionString);
export const db = drizzle(sql, { schema });

export type Database = typeof db;

// Database instance getter for Activities
export const getDatabase = () => db;
