require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'HR_Management_System',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

async function dropNotificationsTable() {
    const client = await pool.connect();
    
    try {
        console.log('🗑️  Starting to drop notifications table...');
        
        await client.query('BEGIN');
        
        // Drop indexes first
        console.log('Dropping indexes...');
        await client.query('DROP INDEX IF EXISTS idx_notifications_user_id');
        await client.query('DROP INDEX IF EXISTS idx_notifications_employee_id');
        await client.query('DROP INDEX IF EXISTS idx_notifications_candidate_id');
        await client.query('DROP INDEX IF EXISTS idx_notifications_request_id');
        await client.query('DROP INDEX IF EXISTS idx_notifications_is_read');
        await client.query('DROP INDEX IF EXISTS idx_notifications_created_at');
        
        console.log('Dropping notifications table...');
        await client.query('DROP TABLE IF EXISTS notifications CASCADE');
        
        await client.query('COMMIT');
        console.log('✅ Successfully dropped notifications table and all related objects!');
        
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('❌ Error dropping notifications table:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the script
dropNotificationsTable()
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });

