/**
 * Database client singleton.
 *
 * Opens the local SQLite database via expo-sqlite and wraps it with Drizzle ORM.
 * Enables WAL mode and foreign key enforcement on first connection.
 */
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DATABASE_NAME = 'renderflow.db';

let sqliteDb: SQLiteDatabase | null = null;
let drizzleDb: ExpoSQLiteDatabase<typeof schema> | null = null;

/**
 * Returns the Drizzle ORM database instance. Lazily creates and
 * configures the underlying expo-sqlite connection on first call.
 */
export function getDb(): ExpoSQLiteDatabase<typeof schema> {
    if (drizzleDb) {
        return drizzleDb;
    }

    sqliteDb = openDatabaseSync(DATABASE_NAME);

    // Enable WAL mode for better concurrent read/write performance
    sqliteDb.execSync('PRAGMA journal_mode = WAL;');
    // Enforce foreign key constraints
    sqliteDb.execSync('PRAGMA foreign_keys = ON;');

    drizzleDb = drizzle(sqliteDb, { schema });

    return drizzleDb;
}

/**
 * Returns the raw expo-sqlite database instance.
 * Used by the migration runner which needs direct SQL execution.
 */
export function getRawDb(): SQLiteDatabase {
    if (!sqliteDb) {
        getDb(); // Initializes both sqliteDb and drizzleDb
    }
    return sqliteDb!;
}

/**
 * Closes the database connection. Primarily used for testing cleanup.
 */
export function closeDb(): void {
    if (sqliteDb) {
        sqliteDb.closeSync();
        sqliteDb = null;
        drizzleDb = null;
    }
}
