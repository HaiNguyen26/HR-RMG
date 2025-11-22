const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function deleteAllCandidates() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get all candidates to delete CV files
        const candidatesQuery = await client.query('SELECT cv_file_path FROM candidates');
        
        console.log(`Found ${candidatesQuery.rows.length} candidates to delete`);

        // Delete CV files
        let deletedFiles = 0;
        for (const candidate of candidatesQuery.rows) {
            if (candidate.cv_file_path) {
                try {
                    const filePath = candidate.cv_file_path;
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        deletedFiles++;
                    }
                } catch (unlinkError) {
                    console.error('Error deleting CV file:', unlinkError.message);
                }
            }
        }

        // Delete all candidates
        const deleteQuery = `DELETE FROM candidates RETURNING id`;
        const result = await client.query(deleteQuery);

        await client.query('COMMIT');

        console.log(`\n✅ Successfully deleted ${result.rowCount} candidates`);
        console.log(`✅ Deleted ${deletedFiles} CV files`);
        
        return {
            success: true,
            deletedCount: result.rowCount,
            deletedFiles: deletedFiles
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error deleting candidates:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the script
deleteAllCandidates()
    .then(() => {
        console.log('\n✅ All candidates deleted successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Failed to delete candidates:', error);
        process.exit(1);
    });


