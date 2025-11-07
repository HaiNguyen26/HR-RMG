const express = require('express');
const router = express.Router();
const pool = require('../config/database');

let ensureLeaveRequestsTablePromise = null;
const ensureLeaveRequestsTable = async () => {
    if (ensureLeaveRequestsTablePromise) {
        return ensureLeaveRequestsTablePromise;
    }

    ensureLeaveRequestsTablePromise = (async () => {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leave_requests (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                manager_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('LEAVE', 'RESIGN')),
                start_date DATE NOT NULL,
                end_date DATE,
                reason TEXT NOT NULL,
                notes TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CANCELLED', 'APPROVED', 'REJECTED')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_manager_id_fkey;
            ALTER TABLE leave_requests
                ADD CONSTRAINT leave_requests_manager_id_fkey
                FOREIGN KEY (manager_id)
                REFERENCES employees(id)
                ON DELETE CASCADE;
        `);

        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_manager ON leave_requests(manager_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status)`);

        await pool.query(`
            CREATE OR REPLACE FUNCTION update_leave_requests_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);

        await pool.query(`
            DROP TRIGGER IF EXISTS trg_leave_requests_updated ON leave_requests;
            CREATE TRIGGER trg_leave_requests_updated
                BEFORE UPDATE ON leave_requests
                FOR EACH ROW
                EXECUTE FUNCTION update_leave_requests_updated_at();
        `);
    })().catch((error) => {
        ensureLeaveRequestsTablePromise = null;
        console.error('Error ensuring leave_requests table:', error);
        throw error;
    });

    return ensureLeaveRequestsTablePromise;
};

// GET /api/leave-requests/managers
router.get('/managers', async (_req, res) => {
    try {
        const additionalManagerNames = [
            'Lê Phú Nhân',
            'Lê Phú Cường',
            'Cái Huy Ân',
            'Nguyễn Ngọc Minh Tuấn',
            'Huỳnh Phúc Văn',
            'Hoàng Đình Sách'
        ];

        let managerFilter = `(
                (chuc_danh IS NOT NULL AND chuc_danh ILIKE '%trưởng phòng%')
            )`;
        const params = [];

        if (additionalManagerNames.length > 0) {
            managerFilter = `(${managerFilter} OR ho_ten = ANY($1))`;
            params.push(additionalManagerNames);
        }

        const query = `
            SELECT id, ho_ten, email, chuc_danh, phong_ban
            FROM employees
            WHERE (trang_thai = 'ACTIVE' OR trang_thai = 'PENDING' OR trang_thai IS NULL)
              AND ${managerFilter}
            ORDER BY ho_ten NULLS LAST
        `;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            message: 'Danh sách trưởng phòng',
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching managers:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể lấy danh sách trưởng phòng: ' + error.message
        });
    }
});

// POST /api/leave-requests
router.post('/', async (req, res) => {
    try {
        await ensureLeaveRequestsTable();

        const {
            employeeId,
            managerId,
            requestType,
            startDate,
            endDate,
            reason,
            notes
        } = req.body;

        if (!employeeId || !requestType || !startDate || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc'
            });
        }

        if (!managerId) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp trưởng phòng phụ trách'
            });
        }

        if (!['LEAVE', 'RESIGN'].includes(requestType)) {
            return res.status(400).json({
                success: false,
                message: 'Loại yêu cầu không hợp lệ'
            });
        }

        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : null;

        if (Number.isNaN(start.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Ngày bắt đầu không hợp lệ'
            });
        }

        if (requestType === 'LEAVE') {
            if (!end || Number.isNaN(end.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Ngày kết thúc không hợp lệ'
                });
            }

            if (start > end) {
                return res.status(400).json({
                    success: false,
                    message: 'Ngày kết thúc phải sau ngày bắt đầu'
                });
            }
        }

        const employeeCheck = await pool.query(
            `SELECT id, ho_ten, email FROM employees WHERE id = $1`,
            [employeeId]
        );

        if (employeeCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên'
            });
        }

        const managerEmployee = await pool.query(
            `SELECT id, ho_ten, email, chuc_danh
             FROM employees
             WHERE id = $1
               AND (trang_thai = 'ACTIVE' OR trang_thai = 'PENDING' OR trang_thai IS NULL)
               AND chuc_danh IS NOT NULL
               AND chuc_danh ILIKE '%trưởng phòng%'`,
            [managerId]
        );

        if (managerEmployee.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy trưởng phòng phù hợp trong hệ thống'
            });
        }

        const managerRecord = managerEmployee.rows[0];

        const insertQuery = `
            INSERT INTO leave_requests (
                employee_id,
                manager_id,
                request_type,
                start_date,
                end_date,
                reason,
                notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const insertValues = [
            employeeId,
            managerRecord.id,
            requestType,
            start.toISOString().split('T')[0],
            end ? end.toISOString().split('T')[0] : null,
            reason,
            notes || null
        ];

        const insertResult = await pool.query(insertQuery, insertValues);
        const leaveRequest = insertResult.rows[0];

        const employee = employeeCheck.rows[0];

        // Notify manager if corresponding user account exists
        const managerUser = await pool.query(
            `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND trang_thai = 'ACTIVE' LIMIT 1`,
            [managerRecord.email]
        );

        if (managerUser.rows.length > 0) {
            await pool.query(
                `INSERT INTO notifications (user_id, type, title, message)
                 VALUES ($1, 'SYSTEM', $2, $3)`,
                [
                    managerUser.rows[0].id,
                    'Đơn xin nghỉ mới',
                    `Nhân viên ${employee.ho_ten || employee.email} đã gửi đơn xin ${requestType === 'LEAVE' ? 'nghỉ phép' : 'nghỉ việc'}.`
                ]
            );
        }

        res.status(201).json({
            success: true,
            message: 'Đã gửi đơn xin nghỉ thành công',
            data: leaveRequest
        });
    } catch (error) {
        console.error('Error creating leave request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi gửi đơn xin nghỉ: ' + error.message
        });
    }
});

module.exports = router;

