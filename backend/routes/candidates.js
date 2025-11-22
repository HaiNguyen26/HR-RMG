const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

// Vietnamese fonts configuration - PDFKit uses font file paths directly
const fontsPath = path.join(__dirname, '../fonts');
const notoSansRegular = path.join(fontsPath, 'NotoSans-Regular.ttf');
const notoSansBold = path.join(fontsPath, 'NotoSans-Bold.ttf');

// Get Vietnamese fonts - return file path if exists, otherwise use default font name
const getVietnameseFonts = () => {
    let fonts = {
        regular: 'Times-Roman',
        bold: 'Times-Bold'
    };

    if (fs.existsSync(notoSansRegular)) {
        fonts.regular = notoSansRegular;
        console.log('✓ Using NotoSans-Regular for Vietnamese text');
    } else {
        console.warn('✗ NotoSans-Regular font file not found, using Times-Roman');
    }

    if (fs.existsSync(notoSansBold)) {
        fonts.bold = notoSansBold;
        console.log('✓ Using NotoSans-Bold for Vietnamese text');
    } else {
        console.warn('✗ NotoSans-Bold font file not found, using Times-Bold');
    }

    return fonts;
};

// Initialize fonts once at module load
const vietnameseFonts = getVietnameseFonts();

// Prepare logs directory for PDF generation errors
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
const pdfErrorLogPath = path.join(logsDir, 'pdf-errors.log');
const logPdfError = (message, metadata = {}) => {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            message,
            ...metadata
        };
        fs.appendFileSync(pdfErrorLogPath, JSON.stringify(logEntry) + '\n');
    } catch (err) {
        console.error('Failed to write PDF error log:', err.message);
    }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/candidates');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'cv-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận file PDF, DOC hoặc DOCX'));
        }
    }
});

// Notification system removed

// Ensure candidates table exists
const ensureCandidatesTable = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS candidates (
            id SERIAL PRIMARY KEY,
            ho_ten VARCHAR(255) NOT NULL,
            ngay_sinh DATE,
            vi_tri_ung_tuyen VARCHAR(100),
            phong_ban VARCHAR(50),
            so_dien_thoai VARCHAR(20),
            cccd VARCHAR(20),
            ngay_cap_cccd DATE,
            noi_cap_cccd VARCHAR(255),
            ngay_gui_cv DATE,
            cv_file_path VARCHAR(500),
            cv_file_name VARCHAR(255),
            status VARCHAR(50) DEFAULT 'PENDING_INTERVIEW' CHECK (status IN ('PENDING_INTERVIEW', 'PENDING_MANAGER', 'PASSED', 'FAILED')),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Add new columns if they don't exist (for existing databases)
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='ngay_cap_cccd') THEN
                ALTER TABLE candidates ADD COLUMN ngay_cap_cccd DATE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='noi_cap_cccd') THEN
                ALTER TABLE candidates ADD COLUMN noi_cap_cccd VARCHAR(255);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='dia_chi_tam_tru') THEN
                ALTER TABLE candidates ADD COLUMN dia_chi_tam_tru TEXT;
            END IF;
            -- Add personal information columns
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='gioi_tinh') THEN
                ALTER TABLE candidates ADD COLUMN gioi_tinh VARCHAR(20);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='noi_sinh') THEN
                ALTER TABLE candidates ADD COLUMN noi_sinh VARCHAR(255);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='tinh_trang_hon_nhan') THEN
                ALTER TABLE candidates ADD COLUMN tinh_trang_hon_nhan VARCHAR(50);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='dan_toc') THEN
                ALTER TABLE candidates ADD COLUMN dan_toc VARCHAR(50);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='quoc_tich') THEN
                ALTER TABLE candidates ADD COLUMN quoc_tich VARCHAR(100);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='ton_giao') THEN
                ALTER TABLE candidates ADD COLUMN ton_giao VARCHAR(100);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='so_dien_thoai_khac') THEN
                ALTER TABLE candidates ADD COLUMN so_dien_thoai_khac VARCHAR(20);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='email') THEN
                ALTER TABLE candidates ADD COLUMN email VARCHAR(255);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='nguyen_quan') THEN
                ALTER TABLE candidates ADD COLUMN nguyen_quan VARCHAR(255);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='trinh_do_van_hoa') THEN
                ALTER TABLE candidates ADD COLUMN trinh_do_van_hoa VARCHAR(100);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='trinh_do_chuyen_mon') THEN
                ALTER TABLE candidates ADD COLUMN trinh_do_chuyen_mon VARCHAR(255);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='chuyen_nganh') THEN
                ALTER TABLE candidates ADD COLUMN chuyen_nganh VARCHAR(255);
            END IF;
            -- Add JSONB columns for arrays
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='kinh_nghiem_lam_viec') THEN
                ALTER TABLE candidates ADD COLUMN kinh_nghiem_lam_viec JSONB;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='qua_trinh_dao_tao') THEN
                ALTER TABLE candidates ADD COLUMN qua_trinh_dao_tao JSONB;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='trinh_do_ngoai_ngu') THEN
                ALTER TABLE candidates ADD COLUMN trinh_do_ngoai_ngu JSONB;
            END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
        CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at);
    `;

    try {
        await pool.query(createTableQuery);
        // Update existing table constraint if needed
        await pool.query(`
            DO $$ 
            BEGIN
                -- Drop old constraint if exists
                ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
                -- Add new constraint with PENDING_MANAGER
                ALTER TABLE candidates ADD CONSTRAINT candidates_status_check 
                    CHECK (status IN ('PENDING_INTERVIEW', 'PENDING_MANAGER', 'PASSED', 'FAILED'));
            EXCEPTION
                WHEN OTHERS THEN
                    -- If constraint doesn't exist, ignore
                    NULL;
            END $$;
        `);
    } catch (error) {
        console.error('Error ensuring candidates table:', error);
        throw error;
    }
};

// Ensure interview_requests table exists
const ensureInterviewRequestsTable = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS interview_requests (
            id SERIAL PRIMARY KEY,
            candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
            manager_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            manager_name VARCHAR(255) NOT NULL,
            indirect_manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
            indirect_manager_name VARCHAR(255),
            interview_date DATE,
            interview_time TIME,
            status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PENDING_EVALUATION')),
            notes TEXT,
            created_by INTEGER REFERENCES employees(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_interview_requests_candidate_id ON interview_requests(candidate_id);
        CREATE INDEX IF NOT EXISTS idx_interview_requests_manager_id ON interview_requests(manager_id);
        CREATE INDEX IF NOT EXISTS idx_interview_requests_status ON interview_requests(status);
    `;

    try {
        await pool.query(createTableQuery);

        // Add new columns if they don't exist (for existing databases)
        await pool.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='indirect_manager_id') THEN
                    ALTER TABLE interview_requests ADD COLUMN indirect_manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='indirect_manager_name') THEN
                    ALTER TABLE interview_requests ADD COLUMN indirect_manager_name VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='interview_date') THEN
                    ALTER TABLE interview_requests ADD COLUMN interview_date DATE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='interview_time') THEN
                    ALTER TABLE interview_requests ADD COLUMN interview_time TIME;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='evaluation_criteria_1') THEN
                    ALTER TABLE interview_requests ADD COLUMN evaluation_criteria_1 BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='evaluation_criteria_2') THEN
                    ALTER TABLE interview_requests ADD COLUMN evaluation_criteria_2 BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='evaluation_criteria_3') THEN
                    ALTER TABLE interview_requests ADD COLUMN evaluation_criteria_3 BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='evaluation_criteria_4') THEN
                    ALTER TABLE interview_requests ADD COLUMN evaluation_criteria_4 BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='evaluation_criteria_5') THEN
                    ALTER TABLE interview_requests ADD COLUMN evaluation_criteria_5 BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='evaluation_notes') THEN
                    ALTER TABLE interview_requests ADD COLUMN evaluation_notes TEXT;
                END IF;
                -- Direct manager evaluation status
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='direct_manager_evaluated') THEN
                    ALTER TABLE interview_requests ADD COLUMN direct_manager_evaluated BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='direct_manager_evaluation_data') THEN
                    ALTER TABLE interview_requests ADD COLUMN direct_manager_evaluation_data JSONB;
                END IF;
                -- Indirect manager evaluation status
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='indirect_manager_evaluated') THEN
                    ALTER TABLE interview_requests ADD COLUMN indirect_manager_evaluated BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_requests' AND column_name='indirect_manager_evaluation_data') THEN
                    ALTER TABLE interview_requests ADD COLUMN indirect_manager_evaluation_data JSONB;
                END IF;
            END $$;
        `);

        // Update CHECK constraint to include PENDING_EVALUATION
        await pool.query(`
            DO $$ 
            BEGIN
                -- Drop existing constraint if it exists
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'interview_requests_status_check'
                    AND conrelid = 'interview_requests'::regclass
                ) THEN
                    ALTER TABLE interview_requests DROP CONSTRAINT interview_requests_status_check;
                END IF;
                
                -- Add new constraint with PENDING_EVALUATION
                ALTER TABLE interview_requests 
                ADD CONSTRAINT interview_requests_status_check 
                CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PENDING_EVALUATION'));
            END $$;
        `);
    } catch (error) {
        console.error('Error ensuring interview_requests table:', error);
        throw error;
    }
};

// Seed demo data - DISABLED
const seedDemoCandidates = async () => {
    // Demo data seeding has been disabled
    return;

    /* DISABLED - Demo data no longer seeded automatically
    try {
        // Check if candidates already exist
        const checkResult = await pool.query('SELECT COUNT(*) as count FROM candidates');
        if (parseInt(checkResult.rows[0].count) > 0) {
            return; // Already has data, skip seeding
        }

        const demoCandidates = [
            {
                ho_ten: 'Nguyễn Văn An',
                ngay_sinh: '1995-03-15',
                vi_tri_ung_tuyen: 'Lập trình viên',
                phong_ban: 'IT',
                so_dien_thoai: '0912345678',
                cccd: '001234567890',
                ngay_gui_cv: '2024-01-10',
                status: 'PENDING_INTERVIEW'
            },
            {
                ho_ten: 'Trần Thị Bình',
                ngay_sinh: '1998-07-22',
                vi_tri_ung_tuyen: 'Thiết kế',
                phong_ban: 'IT',
                so_dien_thoai: '0923456789',
                cccd: '001234567891',
                ngay_gui_cv: '2024-01-12',
                status: 'PASSED'
            },
            {
                ho_ten: 'Lê Minh Cường',
                ngay_sinh: '1996-11-05',
                vi_tri_ung_tuyen: 'Marketing',
                phong_ban: 'MARKETING',
                so_dien_thoai: '0934567890',
                cccd: '001234567892',
                ngay_gui_cv: '2024-01-08',
                status: 'FAILED'
            },
            {
                ho_ten: 'Phạm Thị Dung',
                ngay_sinh: '1997-05-18',
                vi_tri_ung_tuyen: 'Lập trình viên',
                phong_ban: 'IT',
                so_dien_thoai: '0945678901',
                cccd: '001234567893',
                ngay_gui_cv: '2024-01-15',
                status: 'PENDING_INTERVIEW'
            },
            {
                ho_ten: 'Hoàng Văn Đức',
                ngay_sinh: '1994-09-25',
                vi_tri_ung_tuyen: 'Quản lý dự án',
                phong_ban: 'IT',
                so_dien_thoai: '0956789012',
                cccd: '001234567894',
                ngay_gui_cv: '2024-01-18',
                status: 'PASSED'
            },
            {
                ho_ten: 'Vũ Thị Hương',
                ngay_sinh: '1999-02-14',
                vi_tri_ung_tuyen: 'Thiết kế',
                phong_ban: 'IT',
                so_dien_thoai: '0967890123',
                cccd: '001234567895',
                ngay_gui_cv: '2024-01-20',
                status: 'PENDING_INTERVIEW'
            },
            {
                ho_ten: 'Đỗ Văn Hùng',
                ngay_sinh: '1993-08-30',
                vi_tri_ung_tuyen: 'Phân tích nghiệp vụ',
                phong_ban: 'IT',
                so_dien_thoai: '0978901234',
                cccd: '001234567896',
                ngay_gui_cv: '2024-01-22',
                status: 'FAILED'
            },
            {
                ho_ten: 'Bùi Thị Lan',
                ngay_sinh: '1996-12-08',
                vi_tri_ung_tuyen: 'Nhân sự',
                phong_ban: 'HR',
                so_dien_thoai: '0989012345',
                cccd: '001234567897',
                ngay_gui_cv: '2024-01-25',
                status: 'PASSED'
            },
            {
                ho_ten: 'Ngô Văn Minh',
                ngay_sinh: '1995-06-20',
                vi_tri_ung_tuyen: 'Kế toán',
                phong_ban: 'ACCOUNTING',
                so_dien_thoai: '0990123456',
                cccd: '001234567898',
                ngay_gui_cv: '2024-01-28',
                status: 'PENDING_INTERVIEW'
            },
            {
                ho_ten: 'Lý Thị Nga',
                ngay_sinh: '1998-04-12',
                vi_tri_ung_tuyen: 'Marketing',
                phong_ban: 'MARKETING',
                so_dien_thoai: '0901234567',
                cccd: '001234567899',
                ngay_gui_cv: '2024-02-01',
                status: 'PASSED'
            },
            {
                ho_ten: 'Trương Văn Phong',
                ngay_sinh: '1994-10-05',
                vi_tri_ung_tuyen: 'Kinh doanh',
                phong_ban: 'SALES',
                so_dien_thoai: '0912345679',
                cccd: '001234567900',
                ngay_gui_cv: '2024-02-05',
                status: 'PENDING_INTERVIEW'
            },
            {
                ho_ten: 'Đinh Thị Quỳnh',
                ngay_sinh: '1997-01-28',
                vi_tri_ung_tuyen: 'Lập trình viên',
                phong_ban: 'IT',
                so_dien_thoai: '0923456780',
                cccd: '001234567901',
                ngay_gui_cv: '2024-02-08',
                status: 'FAILED'
            },
            {
                ho_ten: 'Phan Văn Sơn',
                ngay_sinh: '1996-07-15',
                vi_tri_ung_tuyen: 'Kiểm thử',
                phong_ban: 'IT',
                so_dien_thoai: '0934567891',
                cccd: '001234567902',
                ngay_gui_cv: '2024-02-10',
                status: 'PASSED'
            },
            {
                ho_ten: 'Võ Thị Tuyết',
                ngay_sinh: '1999-03-22',
                vi_tri_ung_tuyen: 'Thiết kế',
                phong_ban: 'IT',
                so_dien_thoai: '0945678902',
                cccd: '001234567903',
                ngay_gui_cv: '2024-02-12',
                status: 'PENDING_INTERVIEW'
            },
            {
                ho_ten: 'Dương Văn Tuấn',
                ngay_sinh: '1995-11-10',
                vi_tri_ung_tuyen: 'Marketing',
                phong_ban: 'MARKETING',
                so_dien_thoai: '0956789013',
                cccd: '001234567904',
                ngay_gui_cv: '2024-02-15',
                status: 'PASSED'
            },
            {
                ho_ten: 'Lưu Thị Uyên',
                ngay_sinh: '1998-08-03',
                vi_tri_ung_tuyen: 'Nhân sự',
                phong_ban: 'HR',
                so_dien_thoai: '0967890124',
                cccd: '001234567905',
                ngay_gui_cv: '2024-02-18',
                status: 'PENDING_INTERVIEW'
            },
            {
                ho_ten: 'Cao Văn Việt',
                ngay_sinh: '1994-12-19',
                vi_tri_ung_tuyen: 'Quản lý dự án',
                phong_ban: 'IT',
                so_dien_thoai: '0978901235',
                cccd: '001234567906',
                ngay_gui_cv: '2024-02-20',
                status: 'FAILED'
            },
            {
                ho_ten: 'Tôn Thị Xuân',
                ngay_sinh: '1997-06-07',
                vi_tri_ung_tuyen: 'Kế toán',
                phong_ban: 'ACCOUNTING',
                so_dien_thoai: '0989012346',
                cccd: '001234567907',
                ngay_gui_cv: '2024-02-22',
                status: 'PASSED'
            },
            {
                ho_ten: 'Hồ Văn Yên',
                ngay_sinh: '1996-02-25',
                vi_tri_ung_tuyen: 'Kinh doanh',
                phong_ban: 'SALES',
                so_dien_thoai: '0990123457',
                cccd: '001234567908',
                ngay_gui_cv: '2024-02-25',
                status: 'PENDING_INTERVIEW'
            },
            {
                ho_ten: 'Mai Thị Zara',
                ngay_sinh: '1999-09-14',
                vi_tri_ung_tuyen: 'Lập trình viên',
                phong_ban: 'IT',
                so_dien_thoai: '0901234568',
                cccd: '001234567909',
                ngay_gui_cv: '2024-02-28',
                status: 'PASSED'
            },
            {
                ho_ten: 'Lâm Văn Anh',
                ngay_sinh: '1995-04-30',
                vi_tri_ung_tuyen: 'Vận hành',
                phong_ban: 'OPERATIONS',
                so_dien_thoai: '0912345680',
                cccd: '001234567910',
                ngay_gui_cv: '2024-03-01',
                status: 'PENDING_INTERVIEW'
            },
            {
                ho_ten: 'Chu Thị Bảo',
                ngay_sinh: '1998-10-17',
                vi_tri_ung_tuyen: 'Thiết kế',
                phong_ban: 'IT',
                so_dien_thoai: '0923456781',
                cccd: '001234567911',
                ngay_gui_cv: '2024-03-05',
                status: 'FAILED'
            },
            {
                ho_ten: 'Tạ Văn Cường',
                ngay_sinh: '1994-05-23',
                vi_tri_ung_tuyen: 'Marketing',
                phong_ban: 'MARKETING',
                so_dien_thoai: '0934567892',
                cccd: '001234567912',
                ngay_gui_cv: '2024-03-08',
                status: 'PASSED'
            }
        ];

        for (const candidate of demoCandidates) {
            await pool.query(
                `INSERT INTO candidates (
                    ho_ten, ngay_sinh, vi_tri_ung_tuyen, phong_ban, 
                    so_dien_thoai, cccd, ngay_gui_cv, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    candidate.ho_ten,
                    candidate.ngay_sinh,
                    candidate.vi_tri_ung_tuyen,
                    candidate.phong_ban,
                    candidate.so_dien_thoai,
                    candidate.cccd,
                    candidate.ngay_gui_cv,
                    candidate.status
                ]
            );
        }

        console.log('Demo candidates seeded successfully');
    } catch (error) {
        console.error('Error seeding demo candidates:', error);
        // Don't throw error, just log it
    }
    */
};

// GET /api/candidates - Lấy danh sách ứng viên
// GET /api/candidates/managers - Get list of direct managers
router.get('/managers', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT e.id, e.ho_ten, e.email, e.chuc_danh, e.phong_ban
            FROM employees e
            INNER JOIN employees staff ON LOWER(TRIM(staff.quan_ly_truc_tiep)) = LOWER(TRIM(e.ho_ten))
            WHERE (e.trang_thai = 'ACTIVE' OR e.trang_thai = 'PENDING' OR e.trang_thai IS NULL)
            ORDER BY e.ho_ten
        `;

        const result = await pool.query(query);

        res.json({
            success: true,
            message: 'Danh sách quản lý trực tiếp',
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching managers:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể lấy danh sách quản lý: ' + error.message
        });
    }
});

router.get('/', async (req, res) => {
    try {
        await ensureCandidatesTable();

        // Seed demo data if table is empty
        await seedDemoCandidates();

        const { status, search } = req.query;

        // Ensure interview_requests table exists
        await ensureInterviewRequestsTable();

        let query = `
            SELECT 
                c.id,
                c.ho_ten,
                c.gioi_tinh,
                c.ngay_sinh,
                c.noi_sinh,
                c.tinh_trang_hon_nhan,
                c.dan_toc,
                c.quoc_tich,
                c.ton_giao,
                c.vi_tri_ung_tuyen,
                c.phong_ban,
                c.so_dien_thoai,
                c.so_dien_thoai_khac,
                c.email,
                c.cccd,
                c.ngay_cap_cccd,
                c.noi_cap_cccd,
                c.nguyen_quan,
                c.dia_chi_tam_tru,
                c.trinh_do_van_hoa,
                c.trinh_do_chuyen_mon,
                c.chuyen_nganh,
                c.kinh_nghiem_lam_viec,
                c.qua_trinh_dao_tao,
                c.trinh_do_ngoai_ngu,
                c.ngay_gui_cv,
                c.cv_file_path,
                c.cv_file_name,
                c.status,
                c.notes,
                c.created_at,
                c.updated_at,
                ir.manager_name,
                ir.manager_id
            FROM candidates c
            LEFT JOIN (
                SELECT DISTINCT ON (candidate_id) 
                    candidate_id, 
                    manager_name, 
                    manager_id
                FROM interview_requests
                WHERE status IN ('APPROVED', 'REJECTED')
                ORDER BY candidate_id, updated_at DESC
            ) ir ON c.id = ir.candidate_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            query += ` AND c.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (search && search.trim()) {
            query += ` AND (
                LOWER(c.ho_ten) LIKE $${paramIndex} OR
                c.so_dien_thoai LIKE $${paramIndex} OR
                c.cccd LIKE $${paramIndex} OR
                LOWER(c.vi_tri_ung_tuyen) LIKE $${paramIndex}
            )`;
            params.push(`%${search.toLowerCase()}%`);
            paramIndex++;
        }

        query += ` ORDER BY c.created_at DESC`;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            message: 'Danh sách ứng viên',
            data: result.rows.map(row => ({
                id: row.id,
                hoTen: row.ho_ten,
                ho_ten: row.ho_ten, // Keep snake_case for backward compatibility
                gioiTinh: row.gioi_tinh,
                gioi_tinh: row.gioi_tinh,
                ngaySinh: row.ngay_sinh,
                noiSinh: row.noi_sinh,
                noi_sinh: row.noi_sinh,
                tinhTrangHonNhan: row.tinh_trang_hon_nhan,
                tinh_trang_hon_nhan: row.tinh_trang_hon_nhan,
                danToc: row.dan_toc,
                dan_toc: row.dan_toc,
                quocTich: row.quoc_tich,
                quoc_tich: row.quoc_tich,
                tonGiao: row.ton_giao,
                ton_giao: row.ton_giao,
                viTriUngTuyen: row.vi_tri_ung_tuyen,
                vi_tri_ung_tuyen: row.vi_tri_ung_tuyen,
                phongBan: row.phong_ban,
                phong_ban: row.phong_ban,
                soDienThoai: row.so_dien_thoai,
                so_dien_thoai: row.so_dien_thoai,
                soDienThoaiKhac: row.so_dien_thoai_khac,
                so_dien_thoai_khac: row.so_dien_thoai_khac,
                email: row.email,
                cccd: row.cccd,
                ngayCapCCCD: row.ngay_cap_cccd,
                ngay_cap_cccd: row.ngay_cap_cccd,
                noiCapCCCD: row.noi_cap_cccd,
                noi_cap_cccd: row.noi_cap_cccd,
                nguyenQuan: row.nguyen_quan,
                nguyen_quan: row.nguyen_quan,
                diaChiTamTru: row.dia_chi_tam_tru,
                dia_chi_tam_tru: row.dia_chi_tam_tru,
                trinhDoVanHoa: row.trinh_do_van_hoa,
                trinh_do_van_hoa: row.trinh_do_van_hoa,
                trinhDoChuyenMon: row.trinh_do_chuyen_mon,
                trinh_do_chuyen_mon: row.trinh_do_chuyen_mon,
                chuyenNganh: row.chuyen_nganh,
                chuyen_nganh: row.chuyen_nganh,
                kinhNghiemLamViec: row.kinh_nghiem_lam_viec,
                kinh_nghiem_lam_viec: row.kinh_nghiem_lam_viec,
                quaTrinhDaoTao: row.qua_trinh_dao_tao,
                qua_trinh_dao_tao: row.qua_trinh_dao_tao,
                trinhDoNgoaiNgu: row.trinh_do_ngoai_ngu,
                trinh_do_ngoai_ngu: row.trinh_do_ngoai_ngu,
                ngayGuiCV: row.ngay_gui_cv,
                cvFilePath: row.cv_file_path,
                cvFileName: row.cv_file_name,
                status: row.status,
                notes: row.notes,
                createdAt: row.created_at,
                managerName: row.manager_name,
                manager_name: row.manager_name, // Keep snake_case for backward compatibility
                managerId: row.manager_id
            }))
        });
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách ứng viên: ' + error.message
        });
    }
});

// POST /api/candidates - Tạo ứng viên mới
router.post('/', upload.single('cvFile'), async (req, res) => {
    try {
        await ensureCandidatesTable();

        const {
            hoTen,
            gioiTinh,
            ngaySinh,
            noiSinh,
            tinhTrangHonNhan,
            danToc,
            quocTich,
            tonGiao,
            viTriUngTuyen,
            phongBan,
            soDienThoai,
            soDienThoaiKhac,
            email,
            cccd,
            ngayCapCCCD,
            noiCapCCCD,
            nguyenQuan,
            diaChiTamTru,
            trinhDoVanHoa,
            trinhDoChuyenMon,
            chuyenNganh,
            kinhNghiemLamViec,
            quaTrinhDaoTao,
            trinhDoNgoaiNgu,
            ngayGuiCV
        } = req.body;

        // Validation
        if (!hoTen || !ngaySinh || !viTriUngTuyen || !phongBan || !soDienThoai || !cccd || !ngayCapCCCD || !noiCapCCCD || !ngayGuiCV) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
            });
        }

        const insertQuery = `
            INSERT INTO candidates (
                ho_ten, gioi_tinh, ngay_sinh, noi_sinh, tinh_trang_hon_nhan, dan_toc, quoc_tich, ton_giao,
                vi_tri_ung_tuyen, phong_ban,
                so_dien_thoai, so_dien_thoai_khac, email,
                cccd, ngay_cap_cccd, noi_cap_cccd, nguyen_quan,
                dia_chi_tam_tru,
                trinh_do_van_hoa, trinh_do_chuyen_mon, chuyen_nganh,
                kinh_nghiem_lam_viec, qua_trinh_dao_tao, trinh_do_ngoai_ngu,
                ngay_gui_cv,
                cv_file_path, cv_file_name, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
            RETURNING *
        `;

        const cvFilePath = req.file ? req.file.path : null;
        const cvFileName = req.file ? req.file.originalname : null;

        // Parse JSON arrays if they are strings
        let kinhNghiemData = null;
        if (kinhNghiemLamViec) {
            try {
                kinhNghiemData = typeof kinhNghiemLamViec === 'string' ? JSON.parse(kinhNghiemLamViec) : kinhNghiemLamViec;
            } catch (e) {
                console.error('Error parsing kinhNghiemLamViec:', e);
            }
        }

        let quaTrinhData = null;
        if (quaTrinhDaoTao) {
            try {
                quaTrinhData = typeof quaTrinhDaoTao === 'string' ? JSON.parse(quaTrinhDaoTao) : quaTrinhDaoTao;
            } catch (e) {
                console.error('Error parsing quaTrinhDaoTao:', e);
            }
        }

        let ngoaiNguData = null;
        if (trinhDoNgoaiNgu) {
            try {
                ngoaiNguData = typeof trinhDoNgoaiNgu === 'string' ? JSON.parse(trinhDoNgoaiNgu) : trinhDoNgoaiNgu;
            } catch (e) {
                console.error('Error parsing trinhDoNgoaiNgu:', e);
            }
        }

        const result = await pool.query(insertQuery, [
            hoTen,
            gioiTinh || null,
            ngaySinh,
            noiSinh || null,
            tinhTrangHonNhan || null,
            danToc || null,
            quocTich || null,
            tonGiao || null,
            viTriUngTuyen,
            phongBan,
            soDienThoai,
            soDienThoaiKhac || null,
            email || null,
            cccd,
            ngayCapCCCD,
            noiCapCCCD,
            nguyenQuan || null,
            diaChiTamTru || null,
            trinhDoVanHoa || null,
            trinhDoChuyenMon || null,
            chuyenNganh || null,
            kinhNghiemData ? JSON.stringify(kinhNghiemData) : null,
            quaTrinhData ? JSON.stringify(quaTrinhData) : null,
            ngoaiNguData ? JSON.stringify(ngoaiNguData) : null,
            ngayGuiCV,
            cvFilePath,
            cvFileName,
            'PENDING_INTERVIEW'
        ]);

        res.json({
            success: true,
            message: 'Đã lưu thông tin ứng viên thành công',
            data: {
                id: result.rows[0].id,
                hoTen: result.rows[0].ho_ten,
                gioiTinh: result.rows[0].gioi_tinh,
                ngaySinh: result.rows[0].ngay_sinh,
                noiSinh: result.rows[0].noi_sinh,
                tinhTrangHonNhan: result.rows[0].tinh_trang_hon_nhan,
                danToc: result.rows[0].dan_toc,
                quocTich: result.rows[0].quoc_tich,
                tonGiao: result.rows[0].ton_giao,
                viTriUngTuyen: result.rows[0].vi_tri_ung_tuyen,
                phongBan: result.rows[0].phong_ban,
                soDienThoai: result.rows[0].so_dien_thoai,
                soDienThoaiKhac: result.rows[0].so_dien_thoai_khac,
                email: result.rows[0].email,
                cccd: result.rows[0].cccd,
                ngayCapCCCD: result.rows[0].ngay_cap_cccd,
                noiCapCCCD: result.rows[0].noi_cap_cccd,
                nguyenQuan: result.rows[0].nguyen_quan,
                diaChiTamTru: result.rows[0].dia_chi_tam_tru,
                trinhDoVanHoa: result.rows[0].trinh_do_van_hoa,
                trinhDoChuyenMon: result.rows[0].trinh_do_chuyen_mon,
                chuyenNganh: result.rows[0].chuyen_nganh,
                kinhNghiemLamViec: result.rows[0].kinh_nghiem_lam_viec,
                quaTrinhDaoTao: result.rows[0].qua_trinh_dao_tao,
                trinhDoNgoaiNgu: result.rows[0].trinh_do_ngoai_ngu,
                ngayGuiCV: result.rows[0].ngay_gui_cv,
                cvFilePath: result.rows[0].cv_file_path,
                cvFileName: result.rows[0].cv_file_name,
                status: result.rows[0].status,
                createdAt: result.rows[0].created_at
            }
        });
    } catch (error) {
        console.error('Error creating candidate:', error);
        // Delete uploaded file if exists
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting uploaded file:', unlinkError);
            }
        }
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lưu thông tin ứng viên: ' + error.message
        });
    }
});

// PUT /api/candidates/:id/status - Cập nhật trạng thái ứng viên
router.put('/:id/status', async (req, res) => {
    try {
        await ensureCandidatesTable();

        const { id } = req.params;
        const { status, notes } = req.body;

        if (!status || !['PENDING_INTERVIEW', 'PENDING_MANAGER', 'PASSED', 'FAILED'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái không hợp lệ'
            });
        }

        const updateQuery = `
            UPDATE candidates
            SET status = $1,
                notes = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `;

        const result = await pool.query(updateQuery, [status, notes || null, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ứng viên'
            });
        }

        res.json({
            success: true,
            message: 'Đã cập nhật trạng thái ứng viên',
            data: {
                id: result.rows[0].id,
                status: result.rows[0].status,
                notes: result.rows[0].notes
            }
        });
    } catch (error) {
        console.error('Error updating candidate status:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật trạng thái: ' + error.message
        });
    }
});

// PUT /api/candidates/:id/notes - Cập nhật ghi chú cho ứng viên
router.put('/:id/notes', async (req, res) => {
    try {
        await ensureCandidatesTable();

        const { id } = req.params;
        const { notes } = req.body;

        const updateQuery = `
            UPDATE candidates
            SET notes = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;

        const result = await pool.query(updateQuery, [notes || null, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ứng viên'
            });
        }

        res.json({
            success: true,
            message: 'Đã cập nhật ghi chú',
            data: {
                id: result.rows[0].id,
                notes: result.rows[0].notes
            }
        });
    } catch (error) {
        console.error('Error updating candidate notes:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật ghi chú: ' + error.message
        });
    }
});

// DELETE /api/candidates/all - Xóa tất cả ứng viên (để xóa dữ liệu demo)
router.delete('/all', async (req, res) => {
    try {
        await ensureCandidatesTable();

        // Get all candidates to delete CV files
        const candidatesQuery = await pool.query('SELECT cv_file_path FROM candidates');

        // Delete CV files
        for (const candidate of candidatesQuery.rows) {
            if (candidate.cv_file_path) {
                try {
                    if (fs.existsSync(candidate.cv_file_path)) {
                        fs.unlinkSync(candidate.cv_file_path);
                    }
                } catch (unlinkError) {
                    console.error('Error deleting CV file:', unlinkError);
                }
            }
        }

        // Delete all candidates
        const deleteQuery = `DELETE FROM candidates RETURNING id`;
        const result = await pool.query(deleteQuery);

        res.json({
            success: true,
            message: `Đã xóa ${result.rowCount} ứng viên`,
            count: result.rowCount
        });
    } catch (error) {
        console.error('Error deleting all candidates:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa ứng viên: ' + error.message
        });
    }
});

// DELETE /api/candidates/:id - Xóa ứng viên
router.delete('/:id', async (req, res) => {
    try {
        await ensureCandidatesTable();

        const { id } = req.params;

        // Get candidate info to delete CV file
        const candidateQuery = await pool.query('SELECT cv_file_path FROM candidates WHERE id = $1', [id]);

        if (candidateQuery.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ứng viên'
            });
        }

        // Delete CV file if exists
        if (candidateQuery.rows[0].cv_file_path) {
            try {
                if (fs.existsSync(candidateQuery.rows[0].cv_file_path)) {
                    fs.unlinkSync(candidateQuery.rows[0].cv_file_path);
                }
            } catch (unlinkError) {
                console.error('Error deleting CV file:', unlinkError);
            }
        }

        // Delete candidate record
        const deleteQuery = `DELETE FROM candidates WHERE id = $1 RETURNING *`;
        const result = await pool.query(deleteQuery, [id]);

        res.json({
            success: true,
            message: 'Đã xóa ứng viên',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting candidate:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa ứng viên: ' + error.message
        });
    }
});

// POST /api/candidates/:id/interview-request - Create interview request
router.post('/:id/interview-request', async (req, res) => {
    try {
        await ensureInterviewRequestsTable();
        await ensureCandidatesTable();

        const { id } = req.params;
        const {
            managerId,
            managerName,
            indirectManagerId,
            indirectManagerName,
            interviewDate,
            interviewTime,
            notes
        } = req.body;
        const createdBy = req.user?.id || null;

        if (!managerId || !managerName) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn quản lý trực tiếp'
            });
        }

        if (!interviewDate) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ngày phỏng vấn'
            });
        }

        if (!interviewTime) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn giờ phỏng vấn'
            });
        }

        // Check if candidate exists
        const candidateCheck = await pool.query('SELECT id, ho_ten FROM candidates WHERE id = $1', [id]);
        if (candidateCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ứng viên'
            });
        }

        // Check if manager exists
        const managerCheck = await pool.query('SELECT id, ho_ten FROM employees WHERE id = $1', [managerId]);
        if (managerCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quản lý trực tiếp'
            });
        }

        // Check if there's already a pending request for this candidate
        const existingRequest = await pool.query(
            'SELECT id FROM interview_requests WHERE candidate_id = $1 AND status = $2',
            [id, 'PENDING']
        );

        if (existingRequest.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Đã có yêu cầu phỏng vấn đang chờ xét duyệt cho ứng viên này'
            });
        }

        // Ensure notifications table is ready
        // Notification system removed

        // Create interview request and update candidate status to PENDING_MANAGER
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const insertQuery = `
                INSERT INTO interview_requests (
                    candidate_id, 
                    manager_id, 
                    manager_name, 
                    indirect_manager_id,
                    indirect_manager_name,
                    interview_date,
                    interview_time,
                    notes, 
                    created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const result = await client.query(insertQuery, [
                id,
                managerId,
                managerName,
                indirectManagerId || null,
                indirectManagerName || null,
                interviewDate || null,
                interviewTime || null,
                notes || null,
                createdBy
            ]);

            // Update candidate status to PENDING_MANAGER
            await client.query(
                'UPDATE candidates SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                ['PENDING_MANAGER', id]
            );

            await client.query('COMMIT');

            // Notification system removed

            res.json({
                success: true,
                message: 'Đã gửi yêu cầu phỏng vấn đến quản lý trực tiếp',
                data: result.rows[0]
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating interview request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo yêu cầu phỏng vấn: ' + error.message
        });
    }
});

// GET /api/candidates/interview-requests - Get interview requests (for managers)
router.get('/interview-requests', async (req, res) => {
    try {
        await ensureInterviewRequestsTable();

        const { managerId, status } = req.query;
        const currentUserId = req.user?.id;

        let query = `
            SELECT 
                ir.id,
                ir.candidate_id,
                ir.manager_id,
                ir.manager_name,
                ir.indirect_manager_id,
                ir.indirect_manager_name,
                ir.interview_date,
                ir.interview_time,
                ir.status,
                ir.notes,
                ir.direct_manager_evaluated,
                ir.direct_manager_evaluation_data,
                ir.indirect_manager_evaluated,
                ir.indirect_manager_evaluation_data,
                ir.created_at,
                ir.updated_at,
                c.ho_ten as candidate_name,
                c.vi_tri_ung_tuyen,
                c.phong_ban,
                c.so_dien_thoai,
                c.cv_file_path,
                c.cv_file_name
            FROM interview_requests ir
            INNER JOIN candidates c ON ir.candidate_id = c.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        // If managerId is provided, filter by direct manager
        // Otherwise, show requests for current user (either as direct or indirect manager)
        if (managerId) {
            query += ` AND ir.manager_id = $${paramIndex}`;
            params.push(managerId);
            paramIndex++;
        } else if (currentUserId) {
            // Show requests where user is either direct or indirect manager
            query += ` AND (ir.manager_id = $${paramIndex} OR ir.indirect_manager_id = $${paramIndex})`;
            params.push(currentUserId);
            paramIndex++;
        }

        if (status) {
            query += ` AND ir.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        query += ` ORDER BY ir.created_at DESC`;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            message: 'Danh sách yêu cầu phỏng vấn',
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching interview requests:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách yêu cầu phỏng vấn: ' + error.message
        });
    }
});

// PUT /api/candidates/interview-requests/:id/status - Update interview request status
router.put('/interview-requests/:id/status', async (req, res) => {
    try {
        await ensureInterviewRequestsTable();
        // Notification system removed

        const { id } = req.params;
        const { status, notes } = req.body;

        if (!status || !['APPROVED', 'REJECTED', 'PENDING_EVALUATION'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái không hợp lệ'
            });
        }

        // Get current request
        const currentRequest = await pool.query(
            'SELECT * FROM interview_requests WHERE id = $1',
            [id]
        );

        if (currentRequest.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu phỏng vấn'
            });
        }

        // Allow status change from PENDING to PENDING_EVALUATION, or from PENDING_EVALUATION to APPROVED/REJECTED
        if (status === 'PENDING_EVALUATION' && currentRequest.rows[0].status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể chuyển sang chờ đánh giá từ trạng thái chờ duyệt'
            });
        }

        if (['APPROVED', 'REJECTED'].includes(status) && currentRequest.rows[0].status !== 'PENDING_EVALUATION') {
            return res.status(400).json({
                success: false,
                message: 'Yêu cầu phỏng vấn phải ở trạng thái chờ đánh giá để duyệt/từ chối'
            });
        }

        // Update request status and candidate status
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const updateQuery = `
                UPDATE interview_requests
                SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
            `;

            console.log('Updating interview request:', { id, status, notes });
            const result = await client.query(updateQuery, [status, notes || null, id]);
            console.log('Update result:', result.rows);

            // Get candidate info for notification
            const candidateInfo = await client.query(
                'SELECT ho_ten, vi_tri_ung_tuyen FROM candidates WHERE id = $1',
                [currentRequest.rows[0].candidate_id]
            );

            // Update candidate status based on manager decision
            if (status === 'APPROVED') {
                await client.query(
                    'UPDATE candidates SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    ['PASSED', currentRequest.rows[0].candidate_id]
                );
            } else if (status === 'REJECTED') {
                await client.query(
                    'UPDATE candidates SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    ['FAILED', currentRequest.rows[0].candidate_id]
                );
            }

            await client.query('COMMIT');

            // Notification system removed

            // Always return success response even if notification fails
            let message = 'Đã cập nhật trạng thái';
            if (status === 'APPROVED') {
                message = 'Đã duyệt yêu cầu phỏng vấn';
            } else if (status === 'REJECTED') {
                message = 'Đã từ chối yêu cầu phỏng vấn';
            } else if (status === 'PENDING_EVALUATION') {
                message = 'Đã chuyển sang chờ đánh giá tiêu chí';
            }

            res.json({
                success: true,
                message: message,
                data: result.rows[0]
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating interview request status:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            constraint: error.constraint,
            detail: error.detail
        });
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật trạng thái yêu cầu phỏng vấn: ' + error.message,
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                code: error.code,
                constraint: error.constraint,
                detail: error.detail
            } : undefined
        });
    }
});

// PUT /api/candidates/interview-requests/:id/evaluation - Submit interview evaluation
router.put('/interview-requests/:id/evaluation', async (req, res) => {
    try {
        await ensureInterviewRequestsTable();

        const { id } = req.params;
        const {
            criteria1,
            criteria2,
            criteria3,
            criteria4,
            criteria5,
            strengths,
            improvements,
            generalComments,
            finalConclusion
        } = req.body;

        // Get evaluator ID from request body, headers, or req.user
        const evaluatorId = req.body.userId || req.headers['user-id'] || req.user?.id;
        if (!evaluatorId) {
            return res.status(401).json({
                success: false,
                message: 'Không xác định được người đánh giá. Vui lòng đăng nhập lại.'
            });
        }

        // Get current request
        const currentRequest = await pool.query(
            'SELECT * FROM interview_requests WHERE id = $1',
            [id]
        );

        if (currentRequest.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu phỏng vấn'
            });
        }

        const request = currentRequest.rows[0];

        // Check if request is in evaluation state
        if (request.status !== 'PENDING_EVALUATION') {
            return res.status(400).json({
                success: false,
                message: 'Yêu cầu phỏng vấn phải ở trạng thái chờ đánh giá tiêu chí'
            });
        }

        // Determine if evaluator is direct or indirect manager
        const isDirectManager = request.manager_id === evaluatorId;
        const isIndirectManager = request.indirect_manager_id === evaluatorId;

        if (!isDirectManager && !isIndirectManager) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền đánh giá yêu cầu phỏng vấn này'
            });
        }

        // Prepare evaluation data
        const evaluationData = {
            criteria: [
                { score: criteria1?.score || null, comment: criteria1?.comment || '' },
                { score: criteria2?.score || null, comment: criteria2?.comment || '' },
                { score: criteria3?.score || null, comment: criteria3?.comment || '' },
                { score: criteria4?.score || null, comment: criteria4?.comment || '' },
                { score: criteria5?.score || null, comment: criteria5?.comment || '' }
            ],
            strengths: strengths || '',
            improvements: improvements || '',
            generalComments: generalComments || '',
            finalConclusion: finalConclusion || null,
            evaluatedAt: new Date().toISOString()
        };

        // Update evaluation based on manager type
        let updateQuery;
        let updateParams;

        if (isDirectManager) {
            updateQuery = `
                UPDATE interview_requests
                SET 
                    direct_manager_evaluated = TRUE,
                    direct_manager_evaluation_data = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;
            updateParams = [JSON.stringify(evaluationData), id];
        } else {
            updateQuery = `
                UPDATE interview_requests
                SET 
                    indirect_manager_evaluated = TRUE,
                    indirect_manager_evaluation_data = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;
            updateParams = [JSON.stringify(evaluationData), id];
        }

        const result = await pool.query(updateQuery, updateParams);
        const updatedRequest = result.rows[0];

        // Check if both managers have evaluated
        const bothEvaluated = updatedRequest.direct_manager_evaluated &&
            (updatedRequest.indirect_manager_id ? updatedRequest.indirect_manager_evaluated : true);

        // If both evaluated, change status to APPROVED
        if (bothEvaluated) {
            await pool.query(
                `UPDATE interview_requests 
                 SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $1`,
                [id]
            );

            // Update candidate status based on final conclusions
            // For now, we'll set it to PASSED if at least one manager passed
            // This logic can be refined later
            await pool.query(
                'UPDATE candidates SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                ['PASSED', request.candidate_id]
            );
        }

        // Get updated request
        const finalRequest = await pool.query(
            'SELECT * FROM interview_requests WHERE id = $1',
            [id]
        );

        res.json({
            success: true,
            message: bothEvaluated
                ? 'Cả hai quản lý đã đánh giá. Đánh giá đã được gửi về HR.'
                : 'Đã gửi đánh giá. Đang chờ quản lý còn lại đánh giá.',
            data: finalRequest.rows[0]
        });
    } catch (error) {
        console.error('Error submitting interview evaluation:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi gửi đánh giá phỏng vấn: ' + error.message
        });
    }
});

// Helper function to format date to DD/MM/YYYY
const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// Helper function to calculate probation end date
const calculateProbationEndDate = (startDateString, probationDays = 60) => {
    if (!startDateString) return '';
    const startDate = new Date(startDateString);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + parseInt(probationDays));
    return formatDate(endDate.toISOString().split('T')[0]);
};

// Helper function to format currency
const formatCurrency = (amount) => {
    if (!amount) return '';
    const num = amount.toString().replace(/\D/g, '');
    if (!num) return '';
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Helper function to convert position code to Vietnamese label
const getViTriLabel = (value) => {
    if (!value) return '';
    const positionMap = {
        'MUAHANG': 'Mua hàng',
        'TAPVU_NAUAN': 'Tạp vụ & nấu ăn',
        'HAN_BOMACH': 'Hàn bo mạch',
        'CHATLUONG': 'Chất lượng',
        'KHAOSAT_THIETKE': 'Khảo sát thiết kế',
        'ADMIN_DUAN': 'Admin dự án',
        'LAPRAP': 'Lắp ráp',
        'LAPRAP_JIG_PALLET': 'Lắp ráp JIG, Pallet',
        'DIEN_LAPTRINH_PLC': 'Điện lập trình PLC',
        'THIETKE_MAY_TUDONG': 'Thiết kế máy tự động',
        'VANHANH_MAY_CNC': 'Vận hành máy CNC',
        'DICHVU_KYTHUAT': 'Dịch vụ Kỹ thuật',
        'KETOAN_NOIBO': 'Kế toán nội bộ',
        'KETOAN_BANHANG': 'Kế toán bán hàng'
    };
    return positionMap[value] || value;
};

// Helper function to convert department code to Vietnamese label
const getPhongBanLabel = (value) => {
    if (!value) return '';
    const departmentMap = {
        'MUAHANG': 'Mua hàng',
        'HANHCHINH': 'Hành chính',
        'HAN_BOMACH': 'Hàn bo mạch',
        'CHATLUONG': 'Chất lượng',
        'KHAOSAT_THIETKE': 'Khảo sát thiết kế',
        'ADMIN_DUAN': 'Admin dự án',
        'LAPRAP': 'Lắp ráp',
        'LAPRAP_JIG_PALLET': 'Lắp ráp JIG, Pallet',
        'DIEN_LAPTRINH_PLC': 'Điện lập trình PLC',
        'THIETKE_MAY_TUDONG': 'Thiết kế máy tự động',
        'VANHANH_MAY_CNC': 'Vận hành máy CNC',
        'DICHVU_KYTHUAT': 'Dịch vụ Kỹ thuật',
        'KETOAN_NOIBO': 'Kế toán nội bộ',
        'KETOAN_BANHANG': 'Kế toán bán hàng'
    };
    return departmentMap[value] || value;
};

// POST /api/candidates/generate-job-offer-pdf - Generate job offer letter PDF from form data
router.post('/generate-job-offer-pdf', async (req, res) => {
    try {
        const {
            applicantName,
            dateOfBirth,
            cccd,
            placeOfIssue,
            ngayCapCCCD,
            noiCapCCCD,
            gender,
            position,
            department,
            directReportTo,
            indirectReportTo,
            workLocation,
            diaChiTamTru,
            startDate,
            probationDays,
            workingHours,
            probationGrossSalary,
            officialGrossSalary,
            lunchSupport,
            travelAllowance,
            phoneAllowance,
            annualLeaveDays,
            jobDuties
        } = req.body;

        if (!applicantName || !position || !workLocation || !startDate || !probationDays || !probationGrossSalary || !officialGrossSalary) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ các trường bắt buộc'
            });
        }

        // Debug: Log received data for CCCD fields
        console.log('CCCD Fields received:', {
            ngayCapCCCD: ngayCapCCCD,
            noiCapCCCD: noiCapCCCD,
            placeOfIssue: placeOfIssue,
            cccd: cccd
        });

        // Get Vietnamese fonts first to check if they exist
        const vietnameseFonts = getVietnameseFonts();

        // Validate font files exist if using file paths
        if (fs.existsSync(notoSansRegular) && typeof vietnameseFonts.regular === 'string' && !vietnameseFonts.regular.match(/^Times-/)) {
            if (!fs.existsSync(vietnameseFonts.regular)) {
                console.warn('Font file not found, falling back to Times-Roman');
                vietnameseFonts.regular = 'Times-Roman';
            }
        }
        if (fs.existsSync(notoSansBold) && typeof vietnameseFonts.bold === 'string' && !vietnameseFonts.bold.match(/^Times-/)) {
            if (!fs.existsSync(vietnameseFonts.bold)) {
                console.warn('Font file not found, falling back to Times-Bold');
                vietnameseFonts.bold = 'Times-Bold';
            }
        }

        // Create PDF document
        let doc;
        try {
            doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            // Set filename and headers BEFORE piping
            const filename = `Thu-Tuyen-Dung-${applicantName.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.setHeader('Content-Type', 'application/pdf');

            // Pipe document to response
            doc.pipe(res);

            // Handle stream errors
            doc.on('error', (err) => {
                console.error('PDF Document stream error:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: 'Lỗi khi tạo PDF: ' + err.message
                    });
                }
            });

            res.on('error', (err) => {
                console.error('Response stream error:', err);
                doc.destroy();
            });

            res.on('close', () => {
                if (doc && !doc.destroyed) {
                    doc.destroy();
                }
            });
        } catch (error) {
            console.error('Error creating PDF document:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi khi khởi tạo PDF: ' + error.message
            });
        }

        // Helper function to ensure Vietnamese font is used - MUST be defined before use
        const setVietnameseFont = (isBold = false) => {
            try {
                const fontPath = isBold ? vietnameseFonts.bold : vietnameseFonts.regular;
                // Check if font path is a file path or font name
                if (typeof fontPath === 'string') {
                    // If it's a file path (contains path separators), check if file exists
                    if (fontPath.includes('/') || fontPath.includes('\\')) {
                        if (fs.existsSync(fontPath)) {
                            doc.font(fontPath);
                        } else {
                            console.warn(`Font file not found: ${fontPath}, using default`);
                            doc.font(isBold ? 'Times-Bold' : 'Times-Roman');
                        }
                    } else {
                        // It's a font name, use directly
                        doc.font(fontPath);
                    }
                } else {
                    // Fallback to default
                    doc.font(isBold ? 'Times-Bold' : 'Times-Roman');
                }
            } catch (error) {
                console.warn('Error setting font, using default:', error.message);
                // Fallback to default fonts
                doc.font(isBold ? 'Times-Bold' : 'Times-Roman');
            }
        };

        // Helper function to safely set font when using .font() directly
        const safeFont = (fontPath) => {
            try {
                if (typeof fontPath === 'string') {
                    if (fontPath.includes('/') || fontPath.includes('\\')) {
                        if (fs.existsSync(fontPath)) {
                            return fontPath;
                        } else {
                            console.warn(`Font file not found: ${fontPath}, using default`);
                            return fontPath.includes('bold') || fontPath.includes('Bold') ? 'Times-Bold' : 'Times-Roman';
                        }
                    }
                    return fontPath;
                }
                return 'Times-Roman';
            } catch (error) {
                console.warn('Error checking font, using default:', error.message);
                return 'Times-Roman';
            }
        };

        // Wrap all PDF generation in try-catch to handle errors properly
        try {
            console.log('Starting PDF generation for:', applicantName);
            console.log('Using fonts:', {
                regular: vietnameseFonts.regular,
                bold: vietnameseFonts.bold
            });

            // Header without border, logo on left, text on right (black text on white background)
            const tableLeft = 50;
            const headerX = tableLeft;
            const headerY = 50;
            const headerPadding = 15;

            // Add logo if available (on white background, on the left)
            const logoPath = path.join(__dirname, '../../LogoRMG.png');
            const logoSize = 70;
            const logoX = headerX;
            const logoY = headerY;

            if (fs.existsSync(logoPath)) {
                try {
                    doc.image(logoPath, logoX, logoY, { width: logoSize, height: logoSize });
                } catch (error) {
                    console.warn('Could not add logo:', error.message);
                }
            }

            // Company name and title on the right side (black text on white background)
            const textX = logoX + logoSize + headerPadding;
            const textY = headerY;
            const textWidth = 450;

            doc.fillColor('black'); // Black text on white background
            doc.fontSize(12);
            setVietnameseFont(true);
            doc.text('CÔNG TY TNHH RMG VIỆT NAM', textX, textY, { width: textWidth, align: 'left' });

            // Title "THƯ TUYỂN DỤNG" below company name, larger and bold
            const titleY = textY + 20;
            doc.fontSize(16);
            setVietnameseFont(true);
            doc.text('THƯ TUYỂN DỤNG', textX, titleY, { width: textWidth, align: 'left' });

            // Set starting position for greeting and content sections
            let currentY = headerY + logoSize + 25; // Start after header with spacing

            // Greeting - aligned with section labels, with red name and additional info
            doc.fontSize(11);
            setVietnameseFont(false);
            doc.fillColor('black');
            doc.text('Kính gửi anh ', tableLeft, currentY, { continued: true });
            setVietnameseFont(false);
            doc.fillColor('red');
            doc.text(applicantName, { continued: true });
            doc.fillColor('black');
            setVietnameseFont(false);

            // Add additional info after name
            let additionalInfo = [];
            if (dateOfBirth) {
                additionalInfo.push(`Ngày sinh: ${formatDate(dateOfBirth)}`);
            }
            if (cccd) {
                additionalInfo.push(`Số CCCD: ${cccd}`);
            }
            // Use ngayCapCCCD and noiCapCCCD from form
            // Check and add Ngày cấp CCCD - format as date (dd/mm/yyyy)
            if (ngayCapCCCD) {
                try {
                    // Try to format as date if it's a valid date string
                    const dateStr = typeof ngayCapCCCD === 'string' ? ngayCapCCCD.trim() : String(ngayCapCCCD).trim();
                    if (dateStr) {
                        // Try parsing as date and format it
                        const date = new Date(dateStr);
                        if (!isNaN(date.getTime())) {
                            // Valid date, format it
                            const formattedDate = formatDate(dateStr);
                            additionalInfo.push(`Ngày cấp CCCD: ${formattedDate}`);
                        } else {
                            // Not a valid date string, use as is
                            additionalInfo.push(`Ngày cấp CCCD: ${dateStr}`);
                        }
                    }
                } catch (error) {
                    // If parsing fails, use original value
                    const dateStr = typeof ngayCapCCCD === 'string' ? ngayCapCCCD.trim() : String(ngayCapCCCD).trim();
                    if (dateStr) {
                        additionalInfo.push(`Ngày cấp CCCD: ${dateStr}`);
                    }
                }
            }

            // Check and add Nơi cấp CCCD
            if (noiCapCCCD) {
                const noiCap = typeof noiCapCCCD === 'string' ? noiCapCCCD.trim() : String(noiCapCCCD).trim();
                if (noiCap) {
                    additionalInfo.push(`Nơi cấp CCCD: ${noiCap}`);
                }
            } else if (placeOfIssue) {
                // Fallback to placeOfIssue if noiCapCCCD is not available
                const noiCap = typeof placeOfIssue === 'string' ? placeOfIssue.trim() : String(placeOfIssue).trim();
                if (noiCap) {
                    additionalInfo.push(`Nơi cấp CCCD: ${noiCap}`);
                }
            }

            // Debug: Log additional info
            console.log('Additional info to display:', additionalInfo);
            if (gender) {
                const genderText = gender === 'male' || gender === 'Nam' ? 'Nam' : (gender === 'female' || gender === 'Nữ' ? 'Nữ' : gender);
                additionalInfo.push(`Phái: ${genderText}`);
            }

            if (additionalInfo.length > 0) {
                doc.text(',', { continued: false });
                currentY += 15;
                // Display additional info in red, aligned
                doc.fillColor('red');
                doc.fontSize(10);
                additionalInfo.forEach((info, index) => {
                    doc.text(info, tableLeft, currentY);
                    currentY += 12;
                });
                doc.fillColor('black');
                doc.fontSize(11);
            } else {
                doc.text(',');
            }
            currentY += 12;

            // Introduction line - also aligned
            doc.fontSize(11);
            setVietnameseFont(false);
            doc.text('Công ty TNHH RMG Việt Nam trân trọng gửi đến Anh/ Chị thư mời làm việc cho vị trí công việc như sau:', tableLeft, currentY, { width: 500, align: 'justify' });
            // Update currentY from actual text height and add more spacing
            currentY = doc.y + 15; // More spacing before section 1

            // Helper function to add text with red color for monetary values
            const addTextWithRed = (text, x, y, options = {}) => {
                const fontSize = options.fontSize || 10;
                doc.fontSize(fontSize);
                const regex = /(\d[\d,.\s]*\s*VNĐ)/g;
                let lastIndex = 0;
                let match;
                let currentX = x;

                while ((match = regex.exec(text)) !== null) {
                    // Add text before monetary value
                    if (match.index > lastIndex) {
                        const beforeText = text.substring(lastIndex, match.index);
                        doc.fillColor('black');
                        setVietnameseFont(false);
                        doc.text(beforeText, currentX, y, { width: options.width || 460, continued: true });
                        currentX += doc.widthOfString(beforeText, { fontSize });
                    }

                    // Add monetary value in red
                    doc.fillColor('red');
                    setVietnameseFont(false);
                    doc.text(match[0], currentX, y, { width: options.width || 460, continued: true });
                    currentX += doc.widthOfString(match[0], { fontSize });
                    lastIndex = regex.lastIndex;
                }

                // Add remaining text
                if (lastIndex < text.length) {
                    const afterText = text.substring(lastIndex);
                    doc.fillColor('black');
                    setVietnameseFont(false);
                    doc.text(afterText, currentX, y, { width: options.width || 460 });
                }
                doc.fillColor('black'); // Reset to black
            };

            // tableLeft and currentY are already set from header section above

            const writeLine = ({
                text,
                indent = 0,
                align = 'left',
                isBold = false,
                spacing = 6,
                fontSize = 10,
                width,
            }) => {
                doc.fontSize(fontSize);
                setVietnameseFont(isBold);
                doc.text(text, tableLeft + indent, currentY, {
                    width: width !== undefined ? width : 460 - indent,
                    align,
                });
                currentY = doc.y + spacing;
            };

            // Helper to add system value with red color and alignment
            const addSystemValue = (value, x, y) => {
                const displayValue = value || 'Hệ thống';
                doc.fillColor('red');
                doc.text(displayValue, x, y);
                doc.fillColor('black'); // Reset to black
            };

            // Fixed X position for all system values (right-aligned after labels)
            const systemValueX = tableLeft + 180;

            // Section 1: Chức danh
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('1. Chức danh :', tableLeft, currentY);
            addSystemValue(getViTriLabel(position), systemValueX, currentY);
            currentY += 15;
            doc.moveDown(0.5);

            // Section 2: Báo cáo trực tiếp
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('2. Báo cáo trực tiếp cho :', tableLeft, currentY);
            addSystemValue(directReportTo, systemValueX, currentY);
            currentY += 15;
            doc.moveDown(0.5);

            // Section 3: Báo cáo gián tiếp
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('3. Báo cáo gián tiếp cho :', tableLeft, currentY);
            addSystemValue(indirectReportTo, systemValueX, currentY);
            currentY += 15;
            doc.moveDown(0.5);

            // Section 4: Địa điểm làm việc
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('4. Địa điểm làm việc :', tableLeft, currentY);
            addSystemValue(workLocation, systemValueX, currentY);
            currentY += 15;
            doc.y = currentY; // Sync doc.y with currentY

            // Section 4.1: Địa chỉ tạm trú (if provided)
            if (diaChiTamTru && diaChiTamTru.trim()) {
                doc.fontSize(10);
                setVietnameseFont(true);
                doc.text('4.1. Địa chỉ tạm trú :', tableLeft, currentY);
                addSystemValue(diaChiTamTru.trim(), systemValueX, currentY);
                currentY += 15;
                doc.y = currentY; // Sync doc.y with currentY
            }
            doc.moveDown(0.5);

            // Section 5: Ngày bắt đầu làm việc
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('5. Ngày bắt đầu làm việc :', tableLeft, currentY);
            addSystemValue(startDate ? formatDate(startDate) : null, systemValueX, currentY);
            currentY += 15;
            doc.moveDown(0.5);

            // Section 6: Thời gian thử việc
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('6. Thời gian thử việc :', tableLeft, currentY);
            setVietnameseFont(false);
            doc.text(`${probationDays || 60} ngày (kể từ ngày bắt đầu làm việc)`, tableLeft + 180, currentY);
            currentY += 15;
            doc.moveDown(0.5);

            // Section 7: Thời gian làm việc
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('7. Thời gian làm việc :', tableLeft, currentY);
            const workingHoursStr = workingHours || '08:30 - 17:30';
            // Parse working hours to get the time range
            let workingTimeLine = '08:30 – 17:30';
            if (workingHoursStr.match(/\d{2}:\d{2}/)) {
                const matches = workingHoursStr.match(/(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
                if (matches) {
                    workingTimeLine = `${matches[1]} – ${matches[2]}`;
                }
            }
            currentY += 15;
            doc.fontSize(10);
            setVietnameseFont(false);
            doc.text(`${workingTimeLine} (Từ Thứ Hai đến Thứ Sáu)`, tableLeft, currentY);
            currentY += 15;
            doc.text('08:00 – 12:00 (Thứ Bảy- Nếu cần)', tableLeft, currentY);
            currentY += 15;
            doc.moveDown(0.5);

            // Section 8: Công việc chính
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('8. Công việc chính:', tableLeft, currentY);
            currentY += 15;
            doc.fontSize(10);
            setVietnameseFont(false);
            let dutyCount = 0;
            if (jobDuties && Array.isArray(jobDuties) && jobDuties.length > 0) {
                jobDuties.forEach((duty, index) => {
                    if (duty && duty.trim()) {
                        const labelLetter = String.fromCharCode(97 + dutyCount); // a, b, c, ...
                        doc.text(`${labelLetter}. ${duty.trim()}`, tableLeft + 20, currentY, { width: 460, align: 'left' });
                        currentY += 15;
                        dutyCount++;
                    }
                });
            }
            // Add last item
            const lastLabelLetter = String.fromCharCode(97 + dutyCount);
            doc.text(`${lastLabelLetter}. Những công việc khác theo sự phân công của cấp quản lý trực tiếp.`, tableLeft + 20, currentY, { width: 460, align: 'left' });
            currentY += 15;
            doc.moveDown(0.5);

            // Section 9: Mức lương gộp hàng tháng (gross)
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('9. Mức lương gộp hàng tháng (gross)', tableLeft, currentY);
            currentY += 15;
            doc.fontSize(10);
            setVietnameseFont(false);
            const probationSalaryText = `a. Trong thời gian thử việc : ${formatCurrency(probationGrossSalary)} VNĐ/tháng.`;
            addTextWithRed(probationSalaryText, tableLeft + 20, currentY, { width: 460 });
            currentY += 15;
            const officialSalaryText = `b. Sau thời gian thử việc : ${formatCurrency(officialGrossSalary)} VNĐ/tháng.`;
            addTextWithRed(officialSalaryText, tableLeft + 20, currentY, { width: 460 });
            currentY += 15;
            setVietnameseFont(false);
            doc.text('Trong đó 80% là mức lương cơ bản và 20% là phụ cấp lương.', tableLeft + 20, currentY, { width: 460, align: 'justify' });
            currentY += 20;
            doc.moveDown(0.5);

            // Section 10: Thuế thu nhập cá nhân và bảo hiểm bắt buộc
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('10. Thuế thu nhập cá nhân và bảo hiểm bắt buộc:', tableLeft, currentY);
            currentY += 15;
            doc.y = currentY; // Sync doc.y with currentY
            doc.fontSize(10);
            setVietnameseFont(false);
            doc.text('Hàng tháng nhân viên có nghĩa vụ nộp thuế thu nhập cá nhân theo Luật định. Nếu đạt yêu cầu qua thử việc và được ký Hợp đồng lao động, Anh/Chị có nghĩa vụ tham gia BHXH, BHYT, BH thất nghiệp được trích từ tiền lương theo Luật định.', tableLeft + 20, currentY, { width: 460, align: 'justify' });
            // Update currentY from doc.y (actual text height) + spacing
            currentY = doc.y + 10;
            doc.y = currentY;

            // Section 11: Chính sách phụ cấp
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('11. Chính sách phụ cấp', tableLeft, currentY);
            currentY += 15;
            doc.fontSize(10);
            setVietnameseFont(false);
            // a. Hỗ trợ cơm trưa - always "Theo chính sách công ty" in red
            doc.text('a. Hỗ trợ cơm trưa : ', tableLeft + 20, currentY, { width: 460 });
            doc.fillColor('red');
            doc.text('Theo chính sách công ty', tableLeft + 165, currentY, { width: 295 });
            doc.fillColor('black');
            currentY += 15;
            // b. Phụ cấp điện thoại
            if (phoneAllowance) {
                const phoneText = `b. Phụ cấp điện thoại : ${formatCurrency(phoneAllowance)} VNĐ/tháng`;
                addTextWithRed(phoneText, tableLeft + 20, currentY, { width: 460 });
            } else {
                doc.text('b. Phụ cấp điện thoại : ', tableLeft + 20, currentY, { width: 460 });
                doc.fillColor('red');
                doc.text('200.000 VNĐ/tháng', tableLeft + 170, currentY, { width: 290 });
                doc.fillColor('black');
            }
            currentY += 15;
            doc.moveDown(0.5);

            // Section 12: Bảo hiểm Tai nạn
            doc.fontSize(10).font(vietnameseFonts.bold).text('12. Bảo hiểm Tai nạn :', tableLeft, currentY);
            doc.fontSize(10).font(vietnameseFonts.regular).text('theo chính sách công ty', tableLeft + 180, currentY);
            currentY += 15;
            doc.moveDown(0.5);

            // Section 13: Chính sách tiền thưởng
            doc.fontSize(10).font(vietnameseFonts.bold).text('13. Chính sách tiền thưởng', tableLeft, currentY);
            currentY += 15;
            doc.y = currentY; // Sync doc.y with currentY
            doc.fontSize(10).font(vietnameseFonts.regular).text('a. Thưởng tháng lương thứ 13: theo chính sách công ty hiện hành.', tableLeft + 20, currentY, { width: 460 });
            currentY = doc.y + 10; // Update from actual text position
            doc.y = currentY;
            doc.text('b. Thưởng theo đánh giá hoàn thành mục tiêu cuối năm và các khoản thưởng khác: theo chính sách công ty hiện hành.', tableLeft + 20, currentY, { width: 460, align: 'justify' });
            // Update currentY from doc.y (actual text height) + spacing
            currentY = doc.y + 10;
            doc.y = currentY;

            // Section 14: Phương tiện
            doc.fontSize(10).font(vietnameseFonts.bold).text('14. Phương tiện', tableLeft, currentY);
            currentY += 15;
            doc.fontSize(10).font(vietnameseFonts.regular).text('a. Phương tiện đi làm: tự túc', tableLeft + 20, currentY, { width: 460 });
            currentY += 15;
            doc.text('b. Phương tiện đi công tác trong thời gian làm việc: theo chính sách công ty.', tableLeft + 20, currentY, { width: 460, align: 'justify' });
            currentY += 20;
            doc.moveDown(0.5);

            // Section 15: Số ngày nghỉ trong năm
            doc.fontSize(10).font(vietnameseFonts.bold).text('15. Số ngày nghỉ trong năm:', tableLeft, currentY);
            currentY += 15;
            doc.y = currentY; // Sync doc.y with currentY
            doc.fontSize(10).font(vietnameseFonts.regular).text(`a. Nghỉ phép năm: ${annualLeaveDays || 12} ngày trong một năm.`, tableLeft + 20, currentY, { width: 460 });
            currentY = doc.y + 10; // Update from actual text position
            doc.y = currentY;
            doc.text('Phép năm được tính từ ngày Anh/Chị bắt đầu làm việc tại công ty và chỉ được sử dụng sau thời hạn thử việc.', tableLeft + 20, currentY, { width: 460, align: 'justify' });
            currentY = doc.y + 10; // Update from actual text position
            doc.y = currentY;
            doc.text('b. Nghỉ lễ, nghỉ chế độ: áp dụng theo Luật lao động Việt Nam và Chính sách công ty.', tableLeft + 20, currentY, { width: 460, align: 'justify' });
            currentY = doc.y + 10; // Update from actual text position + spacing
            doc.y = currentY;

            // Section 16: Hình thức trả lương
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('16. Hình thức trả lương:', tableLeft, currentY);
            currentY += 15;
            doc.y = currentY; // Sync doc.y with currentY
            doc.fontSize(10);
            setVietnameseFont(false);
            doc.text('Lương và phụ cấp được trả bằng tiền đồng và được chuyển khoản vào tài khoản ngân hàng của Anh/Chị vào ngày 5 hàng tháng.', tableLeft, currentY, { width: 500, align: 'justify' });
            // Update currentY from doc.y (actual text height) + small spacing
            currentY = doc.y + 8;
            doc.y = currentY;

            // Section 17: Phúc lợi
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('17. Phúc lợi:', tableLeft, currentY);
            currentY += 15;
            doc.y = currentY; // Sync doc.y with currentY
            doc.fontSize(10);
            setVietnameseFont(false);
            doc.text('Trong thời gian thử việc, Anh/Chị được hưởng các phúc lợi của công ty bao gồm trợ cấp ngày lễ (nếu có), sinh nhật, cưới hỏi, ốm đau, chia buồn; và các khoản phúc lợi khác áp dụng chung cho toàn thể nhân viên công ty tại thời điểm Anh/Chị đang làm việc (nếu có).', tableLeft, currentY, { width: 500, align: 'justify' });
            // Update currentY from doc.y (actual text height) + small spacing
            currentY = doc.y + 8;
            doc.y = currentY;

            // QUI ĐỊNH section
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('* QUI ĐỊNH:', tableLeft, currentY);
            currentY += 15;
            doc.y = currentY; // Sync doc.y with currentY
            doc.fontSize(10);
            setVietnameseFont(false);
            doc.text('→ Cam kết tuân thủ Nội Quy làm việc của Công ty làm kim chỉ nam cho mọi hành động.', tableLeft, currentY, { width: 500, align: 'justify' });
            currentY = doc.y + 5;
            doc.y = currentY;
            doc.text('→ Không làm bất cứ điều gì gây ảnh hưởng xấu đến vị thế, danh tiếng và hình ảnh của RMG Việt Nam dưới mọi hình thức.', tableLeft, currentY, { width: 500, align: 'justify' });
            currentY = doc.y + 5;
            doc.y = currentY;
            doc.text('→ Không được tiết lộ các thông tin liên quan đến tiền lương và phúc lợi cá nhân cho người khác không có thẩm quyền.', tableLeft, currentY, { width: 500, align: 'justify' });
            currentY = doc.y + 5;
            doc.y = currentY;
            doc.text('→ Đảm bảo giấy phép hành nghề phải được sử dụng phục vụ cho công việc tại công ty RMG Việt Nam', tableLeft, currentY, { width: 500, align: 'justify' });
            currentY = doc.y + 10;
            doc.y = currentY;

            // Closing statements
            doc.fontSize(10);
            setVietnameseFont(false);
            doc.text('Hết thời hạn thử việc, Công ty sẽ tiến hành đánh giá hiệu quả công việc của Anh/Chị và sẽ xem xét ký hợp đồng lao động.', tableLeft, currentY, { width: 500, align: 'justify' });
            currentY = doc.y + 10;
            doc.y = currentY;
            doc.text('Chào mừng Anh/Chị đến với Công ty TNHH RMG Việt Nam, chúc Anh/Chị thành công trong thời gian làm việc với Công ty.', tableLeft, currentY, { width: 500, align: 'justify' });
            currentY = doc.y + 10;
            doc.y = currentY;
            doc.text('Vui lòng ký xác nhận những điều kiện và điều khoản trong Thư Tuyển dụng và gởi lại phòng Hành chính Nhân sự một (01) bản.', tableLeft, currentY, { width: 500, align: 'justify' });
            currentY = doc.y + 12;
            doc.y = currentY;

            // Signature section
            const signatureY = currentY;
            const signatureLeft = tableLeft;
            const signatureRight = signatureLeft + 250;
            doc.fontSize(10);
            setVietnameseFont(true);
            doc.text('NGƯỜI NHẬN VIỆC', signatureLeft, signatureY, { align: 'center', width: 200 });
            doc.text('TỔNG GIÁM ĐỐC', signatureRight, signatureY, { align: 'center', width: 200 });
            currentY += 30;

            doc.fontSize(9);
            setVietnameseFont(false);
            doc.text('(Ký tên và ghi rõ họ tên)', signatureLeft, currentY, { align: 'center', width: 200 });
            doc.text('(Ký tên và đóng dấu)', signatureRight, currentY, { align: 'center', width: 200 });
            currentY += 20;

            doc.fontSize(9);
            setVietnameseFont(true);
            doc.text('LÊ THANH TÙNG', signatureRight, currentY, { align: 'center', width: 200 });
            currentY += 20;

            // Contact information
            doc.fontSize(9);
            setVietnameseFont(false);
            doc.text('Mọi chi tiết hoặc thắc mắc vui lòng liên hệ Ms. Bảo Hà, số điện thoại: 0973662771', tableLeft, currentY, { width: 500, align: 'left' });
            currentY += 15;

            // Document checklist - Page 2
            doc.addPage();
            doc.fontSize(14).font(vietnameseFonts.bold).text('DANH SÁCH HỒ SƠ CẦN NỘP', { align: 'center' });
            doc.moveDown(1);

            const checklistItems = [
                { stt: '1', tenHoSo: 'CCCD', soLuong: '1' },
                { stt: '2', tenHoSo: 'Bằng cấp liên quan khác (nếu có)', soLuong: '1' },
                { stt: '3', tenHoSo: 'Giấy KSK theo Thông tư số 32 (bản gốc)', soLuong: '1' },
                { stt: '4', tenHoSo: 'Ảnh 3x4 mới nhất (Scan/bản cứng)', soLuong: '1' },
                { stt: '5', tenHoSo: 'Thông tin ngân hàng:', soLuong: '' }
            ];

            const checklistTableLeft = 50;
            let checklistY = doc.y + 20;

            doc.fontSize(10).font(vietnameseFonts.bold);
            doc.text('STT', checklistTableLeft, checklistY);
            doc.text('Loại hồ sơ', checklistTableLeft + 40, checklistY);
            doc.text('Số lượng', checklistTableLeft + 350, checklistY);
            checklistY += 20;

            doc.fontSize(10).font(vietnameseFonts.regular);
            checklistItems.forEach(item => {
                doc.text(item.stt, checklistTableLeft, checklistY);
                doc.text(item.tenHoSo, checklistTableLeft + 40, checklistY, { width: 300 });
                doc.text(item.soLuong, checklistTableLeft + 350, checklistY);
                checklistY += 20;
            });

            // Banking information sub-items
            checklistY += 10;
            doc.fontSize(9).font(vietnameseFonts.regular);
            doc.text('• Số TK:', checklistTableLeft + 60, checklistY);
            checklistY += 15;
            doc.text('• Ngân hàng: VIB', checklistTableLeft + 60, checklistY);
            checklistY += 15;
            doc.text('• Chi nhánh:', checklistTableLeft + 60, checklistY);

            // Note
            doc.moveDown(2);
            doc.fontSize(10).font(vietnameseFonts.bold).text('LƯU Ý:', checklistTableLeft);
            doc.moveDown(0.5);
            doc.fontSize(9).font(vietnameseFonts.regular).text(
                '- Hồ sơ nộp đầy đủ vào ngày nhận việc',
                checklistTableLeft + 20, doc.y, { width: 500, align: 'left' }
            );

            // Finalize PDF
            doc.end();

        } catch (pdfError) {
            // Error occurred during PDF generation
            console.error('Error during PDF generation:', pdfError);
            console.error('Error name:', pdfError.name);
            console.error('Error message:', pdfError.message);
            console.error('Error stack:', pdfError.stack);
            if (pdfError.code) {
                console.error('Error code:', pdfError.code);
            }

            logPdfError('Error during PDF generation', {
                applicantName,
                errorName: pdfError.name,
                errorMessage: pdfError.message,
                errorCode: pdfError.code || null
            });

            // Destroy document if it exists
            if (doc && !doc.destroyed) {
                doc.destroy();
            }

            // If headers not sent yet, send error response
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: 'Lỗi khi tạo PDF: ' + (pdfError.message || pdfError.toString())
                });
            } else {
                // Response already started, just end it
                if (!res.finished) {
                    res.end();
                }
            }
        }

    } catch (error) {
        console.error('Error generating job offer PDF:', error);
        console.error('Error stack:', error.stack);

        logPdfError('Error generating job offer PDF (outer catch)', {
            applicantName: req.body?.applicantName,
            errorName: error.name,
            errorMessage: error.message
        });

        // If headers already sent, can't send JSON response
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi tạo thư tuyển dụng: ' + error.message
            });
        } else {
            // Response already started, destroy document and end response
            if (typeof doc !== 'undefined' && doc && !doc.destroyed) {
                doc.destroy();
            }
            if (!res.finished) {
                res.end();
            }
        }
    }
});

// GET /api/candidates/:id/job-offer-pdf - Generate job offer letter PDF (legacy endpoint)
router.get('/:id/job-offer-pdf', async (req, res) => {
    try {
        await ensureCandidatesTable();

        const { id } = req.params;

        // Get candidate information
        const candidateResult = await pool.query(
            'SELECT * FROM candidates WHERE id = $1',
            [id]
        );

        if (candidateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ứng viên'
            });
        }

        const candidate = candidateResult.rows[0];

        // Check if candidate has passed
        if (candidate.status !== 'PASSED') {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể xuất thư mời nhận việc cho ứng viên đã đạt'
            });
        }

        // Get job offer data from request query or use defaults
        const {
            viTriCongViec = candidate.vi_tri_ung_tuyen || 'Chuyên viên',
            diaDiemLamViec = 'Trụ sở Công ty tại 159/59 Trần Văn Đang, P. Nhiêu Lộc, TP. HCM',
            thoiGianLamViec = '8h30 – 17h30, Thứ 2 – Thứ 6',
            ngayBatDau = new Date().toISOString().split('T')[0],
            luongCoBanThiViec = '',
            luongCoBanChinhThuc = '',
            hoTroNhaOThiViec = '',
            hoTroNhaOChinhThuc = '',
            hoTroDiLai = '2,400,000',
            troCapTienCom = '30,000',
            troCapTienGuiXe = 'Theo chính sách công ty'
        } = req.query;

        const formattedStartDate = formatDate(ngayBatDau);
        const probationEndDate = calculateProbationEndDate(ngayBatDau);
        const today = new Date();
        const formattedToday = formatDate(today.toISOString().split('T')[0]);

        // Create PDF document
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        // Set filename
        const filename = `Thu-Moi-Nhan-Viec-${candidate.ho_ten.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(res);

        // Title
        doc.fontSize(16).font(vietnameseFonts.bold).text('THƯ MỜI NHẬN VIỆC', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).font(vietnameseFonts.regular).text('(Thay thế cho Hợp đồng thử việc)', { align: 'center' });
        doc.moveDown(1);

        // Introduction
        doc.fontSize(11).font(vietnameseFonts.regular).text(
            `Chúng tôi hân hạnh mời Anh/Chị ${candidate.ho_ten} vào làm việc tại Công ty với các điều khoản sau đây:`,
            { align: 'justify' }
        );
        doc.moveDown(1);

        // Table structure for job offer details
        const tableTop = doc.y;
        const tableLeft = 50;
        const col1Width = 150;
        const col2Width = 350;
        let currentY = tableTop;

        // Helper function to add table row
        const addTableRow = (label, value, isBold = false) => {
            doc.fontSize(10).font(isBold ? 'Times-Bold' : 'Times-Roman');
            doc.text(label, tableLeft, currentY, { width: col1Width, align: 'left' });
            doc.font(isBold ? 'Times-Bold' : 'Times-Roman');
            doc.text(value || '-', tableLeft + col1Width, currentY, { width: col2Width, align: 'left' });
            currentY += 20;
        };

        // Job offer details
        addTableRow('1. Vị trí công việc:', viTriCongViec);
        addTableRow('2. Địa điểm làm việc:', diaDiemLamViec);
        addTableRow('3. Thời gian làm việc:', thoiGianLamViec);
        addTableRow('4. Ngày bắt đầu làm việc:', formattedStartDate);
        addTableRow('5. Thời gian thử việc:', `Từ ${formattedStartDate} Đến ${probationEndDate}`);
        doc.moveDown(0.5);

        // Total income section
        doc.fontSize(10).font(vietnameseFonts.bold).text('6. Tổng thu nhập:', tableLeft, currentY);
        currentY += 20;
        doc.fontSize(9).font(vietnameseFonts.regular).text(
            'Tổng thu nhập (Gross) đã bao gồm các khoản đóng thuế TNCN, BHXH, BHYT & BHTN theo quy định của Nhà nước.',
            tableLeft, currentY, { width: 500, align: 'justify' }
        );
        currentY += 30;

        // Income table header
        const incomeTableLeft = tableLeft + 20;
        doc.fontSize(9).font(vietnameseFonts.bold);
        doc.text('Khoản mục', incomeTableLeft, currentY);
        doc.text('Thử việc/VNĐ Tháng', incomeTableLeft + 150, currentY);
        doc.text('Chính thức/VNĐ Tháng (Đánh giá theo năng lực)', incomeTableLeft + 280, currentY);
        currentY += 20;

        // Income details
        doc.fontSize(9).font(vietnameseFonts.regular);
        addTableRow('6.1 Lương cơ bản', `${luongCoBanThiViec || '-'} / ${luongCoBanChinhThuc || '-'}`, false);
        currentY -= 20;
        addTableRow('6.2 Hỗ trợ nhà ở', `${hoTroNhaOThiViec || '-'} / ${hoTroNhaOChinhThuc || '-'}`, false);
        currentY -= 20;
        addTableRow('6.3 Hỗ trợ đi lại', `${hoTroDiLai} / ${hoTroDiLai}`, false);
        currentY -= 20;
        addTableRow('6.4 Trợ cấp tiền cơm', `${troCapTienCom} / ${troCapTienCom}`, false);
        currentY -= 20;
        addTableRow('6.5 Trợ cấp tiền gửi xe', `${troCapTienGuiXe} / ${troCapTienGuiXe}`, false);
        currentY -= 20;
        addTableRow('6.6 Tổng Lương + Phụ cấp', '- / -', false);
        currentY -= 20;
        addTableRow('6.7 Mức đóng BHXH', '- / -', false);
        currentY += 20;

        doc.moveDown(1);

        // Other policies
        addTableRow('7. Các chính sách, phúc lợi khác', '- Theo chính sách công ty');

        // Additional sections
        doc.moveDown(1);
        doc.fontSize(10).font(vietnameseFonts.bold).text('8. Hợp đồng lao động', tableLeft);
        doc.moveDown(0.5);
        doc.fontSize(9).font(vietnameseFonts.regular).text(
            'Khi kết thúc thử việc, nếu đạt yêu cầu tuyển dụng Công ty sẽ ký HĐLĐ thời hạn 01 năm (tái ký theo thỏa thuận) và NLĐ được hưởng mọi quyền lợi theo quy định và chính sách của Công ty RMG Vietnam',
            tableLeft, doc.y, { width: 500, align: 'justify' }
        );

        doc.moveDown(1);
        doc.fontSize(10).font(vietnameseFonts.bold).text('9. Trách nhiệm và nghĩa vụ của NLĐ', tableLeft);
        doc.moveDown(0.5);
        doc.fontSize(9).font(vietnameseFonts.regular).text(
            '• Hoàn thành công việc theo mô tả công việc (Đính kèm)\n' +
            '• Chấp hành pháp luật, nội quy, an toàn lao động, các quy định, quy trình, quy chế khác của Công ty.\n' +
            '• Tuân thủ nguyên tắc và đạo đức nghề nghiệp theo quy định của Công ty RMG Vietnam.\n' +
            '• Không tự tiến hành hoặc hợp tác với các cá nhân, tổ chức khác thực hiện các hoạt động có xung đột về lợi ích với hoạt động của Công ty RMG Vietnam và các Công ty liên kết.\n' +
            '• Không làm việc cho bất kỳ bên thứ ba nào khác có cùng lĩnh vực hoạt động với các hoạt động đang đảm trách.',
            tableLeft, doc.y, { width: 500, align: 'left' }
        );

        doc.moveDown(1);
        doc.fontSize(10).font(vietnameseFonts.bold).text('10. Thời gian đào tạo và thử việc', tableLeft);
        doc.moveDown(0.5);
        doc.fontSize(9).font(vietnameseFonts.regular).text(
            'Thời gian đào tạo, học việc: 60 ngày\n' +
            'Sau thời gian đào tạo, học việc:\n' +
            '• Nếu đạt: Hưởng lương đầy đủ kể từ ngày đầu tiên nhận việc theo mức trên.\n' +
            '• Nếu không đạt: Công ty và Người lao động sẽ thỏa thuận theo Luật lao động.',
            tableLeft, doc.y, { width: 500, align: 'left' }
        );

        // Signature section
        doc.moveDown(2);
        const signatureY = doc.y;
        const signatureLeft = tableLeft;
        const signatureRight = signatureLeft + 250;

        doc.fontSize(10).font(vietnameseFonts.bold).text('NGƯỜI NHẬN VIỆC', signatureLeft, signatureY, { align: 'center' });
        doc.fontSize(10).font(vietnameseFonts.bold).text('TỔNG GIÁM ĐỐC', signatureRight, signatureY, { align: 'center' });

        doc.moveDown(2);
        doc.fontSize(9).font(vietnameseFonts.regular).text('(Ký tên và ghi rõ họ tên)', signatureLeft, doc.y, { align: 'center' });
        doc.fontSize(9).font(vietnameseFonts.regular).text('(Ký tên và đóng dấu)', signatureRight, doc.y, { align: 'center' });

        doc.moveDown(1.5);
        doc.fontSize(9).font(vietnameseFonts.regular).text('', signatureLeft, doc.y, { align: 'center' });
        doc.fontSize(9).font(vietnameseFonts.bold).text('LÊ THANH TÙNG', signatureRight, doc.y, { align: 'center' });

        // Contact information
        doc.moveDown(1);
        doc.fontSize(9).font(vietnameseFonts.regular).text(
            'Mọi chi tiết hoặc thắc mắc vui lòng liên hệ Ms. Bảo Hà, số điện thoại: 0973662771',
            tableLeft, doc.y, { width: 500, align: 'left' }
        );

        // Document checklist
        doc.addPage();
        doc.fontSize(14).font(vietnameseFonts.bold).text('DANH SÁCH HỒ SƠ CẦN NỘP', { align: 'center' });
        doc.moveDown(1);

        const checklistItems = [
            { stt: '1', tenHoSo: 'CCCD', soLuong: '1' },
            { stt: '2', tenHoSo: 'Bằng cấp liên quan khác (nếu có)', soLuong: '1' },
            { stt: '3', tenHoSo: 'Giấy KSK theo Thông tư số 32 (bản gốc)', soLuong: '1' },
            { stt: '4', tenHoSo: 'Ảnh 3x4 mới nhất (Scan/bản cứng)', soLuong: '1' },
            { stt: '5', tenHoSo: 'Thông tin ngân hàng:', soLuong: '' }
        ];

        const checklistTableLeft = 50;
        let checklistY = doc.y + 20;

        doc.fontSize(10).font(vietnameseFonts.bold);
        doc.text('STT', checklistTableLeft, checklistY);
        doc.text('Loại hồ sơ', checklistTableLeft + 40, checklistY);
        doc.text('Số lượng', checklistTableLeft + 350, checklistY);
        checklistY += 20;

        doc.fontSize(10).font(vietnameseFonts.regular);
        checklistItems.forEach(item => {
            doc.text(item.stt, checklistTableLeft, checklistY);
            doc.text(item.tenHoSo, checklistTableLeft + 40, checklistY, { width: 300 });
            doc.text(item.soLuong, checklistTableLeft + 350, checklistY);
            checklistY += 20;
        });

        // Banking information sub-items
        checklistY += 10;
        doc.fontSize(9).font(vietnameseFonts.regular);
        doc.text('• Số TK:', checklistTableLeft + 60, checklistY);
        checklistY += 15;
        doc.text('• Ngân hàng: VIB', checklistTableLeft + 60, checklistY);
        checklistY += 15;
        doc.text('• Chi nhánh:', checklistTableLeft + 60, checklistY);

        // Note
        doc.moveDown(2);
        doc.fontSize(10).font(vietnameseFonts.bold).text('LƯU Ý:', checklistTableLeft);
        doc.moveDown(0.5);
        doc.fontSize(9).font(vietnameseFonts.regular).text(
            '- Hồ sơ nộp đầy đủ vào ngày nhận việc',
            checklistTableLeft + 20, doc.y, { width: 500, align: 'left' }
        );

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Error generating job offer PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo thư mời nhận việc: ' + error.message
        });
    }
});

// ============================================
// RECRUITMENT REQUESTS API
// ============================================

// Ensure recruitment_requests table exists
const ensureRecruitmentRequestsTable = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS recruitment_requests (
            id SERIAL PRIMARY KEY,
            manager_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            manager_type VARCHAR(20) NOT NULL CHECK (manager_type IN ('DIRECT', 'INDIRECT')),
            -- PHẦN I: VỊ TRÍ TUYỂN DỤNG
            chuc_danh_can_tuyen VARCHAR(255) NOT NULL,
            so_luong_yeu_cau INTEGER NOT NULL,
            phong_ban VARCHAR(255) NOT NULL,
            nguoi_quan_ly_truc_tiep VARCHAR(255) NOT NULL,
            mo_ta_cong_viec VARCHAR(20) CHECK (mo_ta_cong_viec IN ('co', 'chua_co')),
            loai_lao_dong VARCHAR(20) CHECK (loai_lao_dong IN ('thoi_vu', 'toan_thoi_gian')),
            ly_do_tuyen JSONB,
            ly_do_khac_ghi_chu TEXT,
            -- PHẦN II: TIÊU CHUẨN TUYỂN CHỌN
            tieu_chuan_tuyen_chon JSONB,
            -- Status
            status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED')),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_recruitment_requests_manager_id ON recruitment_requests(manager_id);
        CREATE INDEX IF NOT EXISTS idx_recruitment_requests_status ON recruitment_requests(status);
        CREATE INDEX IF NOT EXISTS idx_recruitment_requests_created_at ON recruitment_requests(created_at DESC);
    `;

    try {
        await pool.query(createTableQuery);
        console.log('✓ Recruitment requests table ensured');
    } catch (error) {
        console.error('Error ensuring recruitment_requests table:', error);
        throw error;
    }
};

// Initialize table on module load
ensureRecruitmentRequestsTable();

// POST /api/candidates/recruitment-requests - Create recruitment request
router.post('/recruitment-requests', async (req, res) => {
    try {
        await ensureRecruitmentRequestsTable();

        const {
            managerId,
            managerType, // 'DIRECT' or 'INDIRECT'
            chucDanhCanTuyen,
            soLuongYeuCau,
            phongBan,
            nguoiQuanLyTrucTiep,
            moTaCongViec,
            loaiLaoDong,
            lyDoTuyen,
            lyDoKhacGhiChu,
            tieuChuanTuyenChon
        } = req.body;

        if (!managerId || !managerType || !chucDanhCanTuyen || !soLuongYeuCau || !phongBan || !nguoiQuanLyTrucTiep) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
            });
        }

        const insertQuery = `
            INSERT INTO recruitment_requests (
                manager_id, manager_type,
                chuc_danh_can_tuyen, so_luong_yeu_cau, phong_ban, nguoi_quan_ly_truc_tiep,
                mo_ta_cong_viec, loai_lao_dong,
                ly_do_tuyen, ly_do_khac_ghi_chu,
                tieu_chuan_tuyen_chon,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING')
            RETURNING *
        `;

        const result = await pool.query(insertQuery, [
            managerId,
            managerType,
            chucDanhCanTuyen,
            parseInt(soLuongYeuCau, 10),
            phongBan,
            nguoiQuanLyTrucTiep,
            moTaCongViec || null,
            loaiLaoDong || null,
            lyDoTuyen ? JSON.stringify(lyDoTuyen) : null,
            lyDoKhacGhiChu || null,
            tieuChuanTuyenChon ? JSON.stringify(tieuChuanTuyenChon) : null
        ]);

        res.json({
            success: true,
            message: 'Yêu cầu tuyển dụng đã được gửi thành công!',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating recruitment request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo yêu cầu tuyển dụng: ' + error.message
        });
    }
});

// GET /api/candidates/recruitment-requests - Get all recruitment requests (for HR)
router.get('/recruitment-requests', async (req, res) => {
    try {
        await ensureRecruitmentRequestsTable();

        const { status } = req.query;

        let query = `
            SELECT 
                rr.*,
                e.ho_ten as manager_name,
                e.email as manager_email,
                e.phong_ban as manager_department
            FROM recruitment_requests rr
            LEFT JOIN employees e ON rr.manager_id = e.id
        `;

        const params = [];
        if (status && status !== 'all') {
            query += ` WHERE rr.status = $1`;
            params.push(status);
        }

        query += ` ORDER BY rr.created_at DESC`;

        const result = await pool.query(query, params);

        // Parse JSONB fields
        const requests = result.rows.map(row => ({
            ...row,
            ly_do_tuyen: row.ly_do_tuyen ? (typeof row.ly_do_tuyen === 'string' ? JSON.parse(row.ly_do_tuyen) : row.ly_do_tuyen) : null,
            tieu_chuan_tuyen_chon: row.tieu_chuan_tuyen_chon ? (typeof row.tieu_chuan_tuyen_chon === 'string' ? JSON.parse(row.tieu_chuan_tuyen_chon) : row.tieu_chuan_tuyen_chon) : null
        }));

        res.json({
            success: true,
            data: requests
        });
    } catch (error) {
        console.error('Error fetching recruitment requests:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách yêu cầu tuyển dụng: ' + error.message
        });
    }
});

// GET /api/candidates/recruitment-requests/:id - Get recruitment request details
router.get('/recruitment-requests/:id', async (req, res) => {
    try {
        await ensureRecruitmentRequestsTable();

        const { id } = req.params;

        const query = `
            SELECT 
                rr.*,
                e.ho_ten as manager_name,
                e.email as manager_email,
                e.phong_ban as manager_department
            FROM recruitment_requests rr
            LEFT JOIN employees e ON rr.manager_id = e.id
            WHERE rr.id = $1
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu tuyển dụng'
            });
        }

        const request = result.rows[0];
        // Parse JSONB fields
        request.ly_do_tuyen = request.ly_do_tuyen ? (typeof request.ly_do_tuyen === 'string' ? JSON.parse(request.ly_do_tuyen) : request.ly_do_tuyen) : null;
        request.tieu_chuan_tuyen_chon = request.tieu_chuan_tuyen_chon ? (typeof request.tieu_chuan_tuyen_chon === 'string' ? JSON.parse(request.tieu_chuan_tuyen_chon) : request.tieu_chuan_tuyen_chon) : null;

        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Error fetching recruitment request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy chi tiết yêu cầu tuyển dụng: ' + error.message
        });
    }
});

// PUT /api/candidates/recruitment-requests/:id/status - Update recruitment request status
router.put('/recruitment-requests/:id/status', async (req, res) => {
    try {
        await ensureRecruitmentRequestsTable();

        const { id } = req.params;
        const { status, notes } = req.body;

        if (!status || !['PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái không hợp lệ'
            });
        }

        const query = `
            UPDATE recruitment_requests
            SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `;

        const result = await pool.query(query, [status, notes || null, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu tuyển dụng'
            });
        }

        res.json({
            success: true,
            message: 'Cập nhật trạng thái thành công',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating recruitment request status:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật trạng thái: ' + error.message
        });
    }
});

module.exports = router;


