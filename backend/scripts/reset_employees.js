require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const TABLES_TO_TRUNCATE = [
    'notifications',
    'request_items',
    'requests',
    'equipment_assignments',
    'employees',
];

async function resetEmployees() {
    const client = await pool.connect();
    try {
        console.log('🔄 Clearing employees and related data...');
        await client.query('BEGIN');

        for (const table of TABLES_TO_TRUNCATE) {
            console.log(` - Truncating ${table}...`);
            await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        }

        await client.query('COMMIT');
        console.log('✅ Employees and related data cleared. You can now re-import employees.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Failed to reset employees:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

resetEmployees();

