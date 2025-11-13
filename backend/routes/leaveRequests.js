const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const normalizeManagerReference = (value) => {
    if (!value) return null;
    let cleaned = value;
    cleaned = cleaned.replace(/\(.*?\)/g, ' ');
    const splitTokens = [' - ', '|', '/', ','];
    for (const token of splitTokens) {
        if (cleaned.includes(token)) {
            cleaned = cleaned.split(token)[0];
        }
    }
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned || null;
};

const findManagerByReference = async (reference) => {
    const normalized = normalizeManagerReference(reference);
    if (!normalized) {
        return null;
    }

    const strictMatchQuery = `
        SELECT id, ho_ten, email, chuc_danh
        FROM employees
        WHERE (trang_thai = 'ACTIVE' OR trang_thai = 'PENDING' OR trang_thai IS NULL)
          AND (
              LOWER(TRIM(ho_ten)) = LOWER(TRIM($1))
           OR LOWER(TRIM(email)) = LOWER(TRIM($1))
          )
        ORDER BY id DESC
        LIMIT 1
    `;

    const strictResult = await pool.query(strictMatchQuery, [normalized]);
    if (strictResult.rows.length > 0) {
        return strictResult.rows[0];
    }

    const partialMatchQuery = `
        SELECT id, ho_ten, email, chuc_danh
        FROM employees
        WHERE (trang_thai = 'ACTIVE' OR trang_thai = 'PENDING' OR trang_thai IS NULL)
          AND LOWER(ho_ten) LIKE LOWER($1)
        ORDER BY id DESC
        LIMIT 1
    `;

    const partialResult = await pool.query(partialMatchQuery, [`%${normalized}%`]);
    return partialResult.rows[0] || null;
};

let ensureLeaveRequestsTablePromise = null;
const ensureLeaveRequestsTable = async () => {
    if (ensureLeaveRequestsTablePromise) {
        return ensureLeaveRequestsTablePromise;
    }

    ensureLeaveRequestsTablePromise = (async () => {
        // Base table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leave_requests (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                team_lead_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                branch_manager_id INTEGER,
                request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('LEAVE', 'RESIGN')),
                start_date DATE NOT NULL,
                end_date DATE,
                reason TEXT NOT NULL,
                notes TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDING_TEAM_LEAD',
                team_lead_action VARCHAR(20),
                team_lead_action_at TIMESTAMP,
                team_lead_comment TEXT,
                branch_action VARCHAR(20),
                branch_action_at TIMESTAMP,
                branch_comment TEXT,
                hr_admin_user_id INTEGER,
                escalated_at TIMESTAMP,
                due_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours',
                overdue_notified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Rename and ensure columns
        await pool.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'leave_requests'
                      AND column_name = 'manager_id'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'leave_requests'
                      AND column_name = 'team_lead_id'
                ) THEN
                    EXECUTE 'ALTER TABLE leave_requests RENAME COLUMN manager_id TO team_lead_id';
                END IF;
            END
            $$
        `);

        const alterStatements = [
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS branch_manager_id INTEGER`,
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS hr_admin_user_id INTEGER`,
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS team_lead_action VARCHAR(20)`,
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS team_lead_action_at TIMESTAMP`,
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS team_lead_comment TEXT`,
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS branch_action VARCHAR(20)`,
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS branch_action_at TIMESTAMP`,
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS branch_comment TEXT`,
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP`,
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS due_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours'`,
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS overdue_notified BOOLEAN DEFAULT FALSE`
        ];
        for (const statement of alterStatements) {
            await pool.query(statement);
        }

        await pool.query(`
            DO $$
            DECLARE
                constraint_name TEXT;
            BEGIN
                SELECT tc.constraint_name INTO constraint_name
                FROM information_schema.table_constraints tc
                WHERE tc.table_name = 'leave_requests'
                  AND tc.constraint_type = 'CHECK'
                  AND tc.constraint_name ILIKE 'leave_requests_status%';

                IF constraint_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE leave_requests DROP CONSTRAINT %I', constraint_name);
                END IF;

                EXECUTE '
                    ALTER TABLE leave_requests
                        ADD CONSTRAINT leave_requests_status_check
                        CHECK (status IN (
                            ''PENDING_TEAM_LEAD'',
                            ''PENDING_BRANCH'',
                            ''APPROVED'',
                            ''REJECTED'',
                            ''CANCELLED''
                        ))
                ';
            END;
            $$
        `);

        await pool.query(`
            ALTER TABLE leave_requests
                ALTER COLUMN status SET DEFAULT 'PENDING_TEAM_LEAD'
        `);

        await pool.query(`
            ALTER TABLE leave_requests
                ALTER COLUMN due_at SET DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours'
        `);

        await pool.query(`
            ALTER TABLE leave_requests
                DROP CONSTRAINT IF EXISTS leave_requests_team_lead_id_fkey;
        `);
        await pool.query(`
            ALTER TABLE leave_requests
                ADD CONSTRAINT leave_requests_team_lead_id_fkey
                FOREIGN KEY (team_lead_id)
                REFERENCES employees(id)
                ON DELETE CASCADE;
        `);

        await pool.query(`
            ALTER TABLE leave_requests
                DROP CONSTRAINT IF EXISTS leave_requests_branch_manager_id_fkey;
        `);
        await pool.query(`
            ALTER TABLE leave_requests
                ADD CONSTRAINT leave_requests_branch_manager_id_fkey
                FOREIGN KEY (branch_manager_id)
                REFERENCES employees(id)
                ON DELETE SET NULL;
        `);

        await pool.query(`
            ALTER TABLE leave_requests
                DROP CONSTRAINT IF EXISTS leave_requests_hr_admin_user_id_fkey;
        `);
        await pool.query(`
            ALTER TABLE leave_requests
                ADD CONSTRAINT leave_requests_hr_admin_user_id_fkey
                FOREIGN KEY (hr_admin_user_id)
                REFERENCES users(id)
                ON DELETE SET NULL;
        `);

        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_team_lead ON leave_requests(team_lead_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_branch_manager ON leave_requests(branch_manager_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status)`);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_leave_requests_due_at
            ON leave_requests(status, due_at)
            WHERE status = 'PENDING_TEAM_LEAD'
        `);

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

const LEAVE_STATUSES = {
    PENDING_TEAM_LEAD: 'PENDING_TEAM_LEAD',
    PENDING_BRANCH: 'PENDING_BRANCH',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED'
};

const DECISION_TYPES = {
    APPROVE: 'APPROVE',
    REJECT: 'REJECT'
};

const ACTOR_TYPES = {
    TEAM_LEAD: 'TEAM_LEAD',
    BRANCH: 'BRANCH'
};

const DEFAULT_DUE_HOURS = 24;

const computeDueDate = (hours = DEFAULT_DUE_HOURS) => {
    const now = new Date();
    now.setHours(now.getHours() + hours);
    return now;
};

const formatDateOnly = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString().split('T')[0];
};

const getUserIdsByEmails = async (emails = []) => {
    if (!emails.length) return [];
    const query = `
        SELECT id
        FROM users
        WHERE LOWER(email) = ANY($1)
          AND trang_thai = 'ACTIVE'
    `;
    const result = await pool.query(query, [emails.map((email) => email.toLowerCase())]);
    return result.rows.map((row) => row.id);
};

const notifyUsers = async (userIds, title, message) => {
    if (!Array.isArray(userIds) || userIds.length === 0) return;

    const insertValues = userIds.map((_, idx) => `($${idx + 1}, NULL, 'SYSTEM', $${userIds.length + 1}, $${userIds.length + 2})`);
    const params = [...userIds, title, message];

    await pool.query(
        `INSERT INTO notifications (user_id, employee_id, type, title, message)
         VALUES ${insertValues.join(', ')}`,
        params
    );
};

const notifyEmployees = async (employeeIds, title, message) => {
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) return;

    const insertValues = employeeIds.map((_, idx) => `(NULL, $${idx + 1}, 'SYSTEM', $${employeeIds.length + 1}, $${employeeIds.length + 2})`);
    const params = [...employeeIds, title, message];

    await pool.query(
        `INSERT INTO notifications (user_id, employee_id, type, title, message)
         VALUES ${insertValues.join(', ')}`,
        params
    );
};

const notifyHrAdmins = async (title, message) => {
    const result = await pool.query(
        `SELECT id FROM users WHERE role = 'HR' AND trang_thai = 'ACTIVE'`
    );
    const userIds = result.rows.map((row) => row.id);
    await notifyUsers(userIds, title, message);
};

const fetchLeaveRequestById = async (id) => {
    const query = `
        SELECT lr.*,
               e.ho_ten as employee_name,
               e.email as employee_email,
               team.ho_ten as team_lead_name,
               team.email as team_lead_email,
               branch.ho_ten as branch_manager_name,
               branch.email as branch_manager_email
        FROM leave_requests lr
        LEFT JOIN employees e ON lr.employee_id = e.id
        LEFT JOIN employees team ON lr.team_lead_id = team.id
        LEFT JOIN employees branch ON lr.branch_manager_id = branch.id
        WHERE lr.id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
};

const mapLeaveRequestRow = (row) => {
    if (!row) return null;
    const isOverdue =
        row.status === LEAVE_STATUSES.PENDING_TEAM_LEAD &&
        row.due_at &&
        new Date(row.due_at) < new Date();

    return {
        ...row,
        is_overdue: isOverdue,
        isOverdue
    };
};

// GET /api/leave-requests/managers
router.get('/managers', async (req, res) => {
    try {
        const { type } = req.query;
        const includeTeamLeads = !type || type.toLowerCase() !== 'branch';
        const includeBranchManagers = !type || type.toLowerCase() !== 'teamlead';

        const teamLeadQuery = `
            SELECT DISTINCT e.id, e.ho_ten, e.email, e.chuc_danh, e.phong_ban, e.chi_nhanh
            FROM employees e
            INNER JOIN employees staff ON LOWER(TRIM(staff.quan_ly_truc_tiep)) = LOWER(TRIM(e.ho_ten))
            WHERE (e.trang_thai = 'ACTIVE' OR e.trang_thai = 'PENDING' OR e.trang_thai IS NULL)
            ORDER BY e.ho_ten NULLS LAST
        `;

        const branchManagerQuery = `
            SELECT DISTINCT e.id, e.ho_ten, e.email, e.chuc_danh, e.phong_ban, e.chi_nhanh
            FROM employees e
            INNER JOIN employees staff ON LOWER(TRIM(staff.quan_ly_gian_tiep)) = LOWER(TRIM(e.ho_ten))
            WHERE (e.trang_thai = 'ACTIVE' OR e.trang_thai = 'PENDING' OR e.trang_thai IS NULL)
            ORDER BY e.ho_ten NULLS LAST
        `;

        const [teamLeadsResult, branchManagersResult] = await Promise.all([
            includeTeamLeads ? pool.query(teamLeadQuery) : { rows: [] },
            includeBranchManagers ? pool.query(branchManagerQuery) : { rows: [] }
        ]);

        res.json({
            success: true,
            message: 'Danh sách người duyệt',
            data: {
                teamLeads: teamLeadsResult.rows,
                branchManagers: branchManagersResult.rows
            }
        });
    } catch (error) {
        console.error('Error fetching managers:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể lấy danh sách người duyệt: ' + error.message
        });
    }
});

// GET /api/leave-requests
router.get('/', async (req, res) => {
    try {
        await ensureLeaveRequestsTable();

        const {
            mode,
            employeeId,
            teamLeadId,
            branchManagerId,
            hrUserId,
            status,
            requestType
        } = req.query;

        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (mode === 'employee') {
            if (!employeeId) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu employeeId'
                });
            }
            conditions.push(`lr.employee_id = $${paramIndex}`);
            params.push(parseInt(employeeId, 10));
            paramIndex += 1;
        } else if (mode === 'teamLead') {
            if (!teamLeadId) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu teamLeadId'
                });
            }
            conditions.push(`lr.team_lead_id = $${paramIndex}`);
            params.push(parseInt(teamLeadId, 10));
            paramIndex += 1;
        } else if (mode === 'branchManager') {
            if (!branchManagerId) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu branchManagerId'
                });
            }
            conditions.push(`lr.branch_manager_id = $${paramIndex}`);
            params.push(parseInt(branchManagerId, 10));
            paramIndex += 1;
        } else if (mode === 'hr') {
            if (!hrUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu hrUserId'
                });
            }
            // HR có thể xem tất cả các đơn
        }

        if (status) {
            const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
            if (statuses.length > 0) {
                const placeholders = statuses.map((_s, idx) => `$${paramIndex + idx}`);
                conditions.push(`lr.status = ANY (ARRAY[${placeholders.join(', ')}])`);
                params.push(...statuses);
                paramIndex += statuses.length;
            }
        }

        if (requestType) {
            conditions.push(`lr.request_type = $${paramIndex}`);
            params.push(requestType.toUpperCase() === 'RESIGN' ? 'RESIGN' : 'LEAVE');
            paramIndex += 1;
        }

        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

        const query = `
            SELECT lr.*,
                   e.ho_ten as employee_name,
                   e.email as employee_email,
                   e.phong_ban as employee_department,
                   team.ho_ten as team_lead_name,
                   team.email as team_lead_email,
                   branch.ho_ten as branch_manager_name,
                   branch.email as branch_manager_email
            FROM leave_requests lr
            LEFT JOIN employees e ON lr.employee_id = e.id
            LEFT JOIN employees team ON lr.team_lead_id = team.id
            LEFT JOIN employees branch ON lr.branch_manager_id = branch.id
            WHERE ${whereClause}
            ORDER BY lr.created_at DESC
        `;

        const result = await pool.query(query, params);
        const mapped = result.rows.map(mapLeaveRequestRow);

        const overdueCount = mapped.filter((item) => item.isOverdue).length;

        res.json({
            success: true,
            message: 'Danh sách đơn xin nghỉ',
            data: mapped,
            stats: {
                total: mapped.length,
                overdueCount
            }
        });
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể lấy danh sách đơn xin nghỉ: ' + error.message
        });
    }
});

// POST /api/leave-requests
router.post('/', async (req, res) => {
    try {
        await ensureLeaveRequestsTable();

        const {
            employeeId,
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

        const normalizedType = requestType === 'RESIGN' ? 'RESIGN' : 'LEAVE';

        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : null;

        if (Number.isNaN(start.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Ngày bắt đầu không hợp lệ'
            });
        }

        if (normalizedType === 'LEAVE') {
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

        const employeeResult = await pool.query(
            `SELECT id, ho_ten, email, phong_ban, chi_nhanh, quan_ly_truc_tiep, quan_ly_gian_tiep
             FROM employees
             WHERE id = $1`,
            [employeeId]
        );

        if (employeeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên'
            });
        }

        const employee = employeeResult.rows[0];

        const teamLead = await findManagerByReference(employee.quan_ly_truc_tiep);
        if (!teamLead) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quản lý trực tiếp trong hệ thống. Vui lòng cập nhật thông tin quản lý cho nhân viên.'
            });
        }

        const branchManager = await findManagerByReference(employee.quan_ly_gian_tiep);
        if (!branchManager) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quản lý gián tiếp trong hệ thống. Vui lòng cập nhật thông tin quản lý gián tiếp cho nhân viên.'
            });
        }

        const dueAt = computeDueDate();
        const insertQuery = `
            INSERT INTO leave_requests (
                employee_id,
                team_lead_id,
                branch_manager_id,
                request_type,
                start_date,
                end_date,
                reason,
                notes,
                status,
                due_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;

        const insertValues = [
            employeeId,
            teamLead.id,
            branchManager.id,
            normalizedType,
            formatDateOnly(start),
            normalizedType === 'LEAVE' ? formatDateOnly(end) : null,
            reason,
            notes || null,
            LEAVE_STATUSES.PENDING_TEAM_LEAD,
            dueAt.toISOString()
        ];

        const insertResult = await pool.query(insertQuery, insertValues);
        const insertedRow = insertResult.rows[0];
        const leaveRequest = mapLeaveRequestRow(await fetchLeaveRequestById(insertedRow.id));

        // Gửi thông báo cho quản lý trực tiếp
        await notifyEmployees(
            [teamLead.id],
            'Đơn xin nghỉ mới',
            `Nhân viên ${employee.ho_ten || employee.email || employee.id} đã gửi đơn xin ${normalizedType === 'LEAVE' ? 'nghỉ phép' : 'nghỉ việc'}.`
        );

        // Gửi thông báo cho quản lý gián tiếp
        await notifyEmployees(
            [branchManager.id],
            'Thông báo đơn xin nghỉ',
            `Nhân viên ${employee.ho_ten || employee.email || employee.id} đã gửi đơn xin ${normalizedType === 'LEAVE' ? 'nghỉ phép' : 'nghỉ việc'}. Bạn được thông báo với vai trò quản lý gián tiếp.`
        );

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

// DELETE /api/leave-requests/:id - Nhân viên xóa đơn chưa duyệt
router.delete('/:id', async (req, res) => {
    try {
        await ensureLeaveRequestsTable();

        const { id } = req.params;
        const { employeeId } = req.body;

        const requestId = Number(id);
        const employeeIdNumber = Number(employeeId);

        if (!Number.isInteger(requestId) || requestId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Mã đơn không hợp lệ'
            });
        }

        if (!Number.isInteger(employeeIdNumber) || employeeIdNumber <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin nhân viên'
            });
        }

        const deleteResult = await pool.query(
            `DELETE FROM leave_requests
             WHERE id = $1
               AND employee_id = $2
               AND status = $3
             RETURNING *`,
            [requestId, employeeIdNumber, LEAVE_STATUSES.PENDING_TEAM_LEAD]
        );

        if (deleteResult.rowCount === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa đơn. Có thể đơn đã được xử lý hoặc không tồn tại.'
            });
        }

        res.json({
            success: true,
            message: 'Đã xóa đơn xin nghỉ trước khi duyệt'
        });
    } catch (error) {
        console.error('Error deleting leave request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa đơn xin nghỉ: ' + error.message
        });
    }
});

// POST /api/leave-requests/overdue/process - Cảnh báo HR về đơn quá hạn
router.post('/overdue/process', async (_req, res) => {
    try {
        await ensureLeaveRequestsTable();

        const overdueQuery = `
            SELECT lr.id, lr.employee_id, lr.team_lead_id, lr.created_at, lr.due_at,
                   e.ho_ten AS employee_name,
                   team.ho_ten AS team_lead_name
            FROM leave_requests lr
            LEFT JOIN employees e ON lr.employee_id = e.id
            LEFT JOIN employees team ON lr.team_lead_id = team.id
            WHERE lr.status = $1
              AND lr.due_at IS NOT NULL
              AND lr.due_at < NOW()
              AND lr.overdue_notified = FALSE
        `;

        const overdueResult = await pool.query(overdueQuery, [LEAVE_STATUSES.PENDING_TEAM_LEAD]);
        const overdueRequests = overdueResult.rows;

        if (overdueRequests.length === 0) {
            return res.json({
                success: true,
                message: 'Không có đơn xin nghỉ quá hạn',
                data: {
                    processed: 0
                }
            });
        }

        const ids = overdueRequests.map((row) => row.id);
        const placeholders = ids.map((_id, idx) => `$${idx + 1}`).join(', ');

        await pool.query(
            `UPDATE leave_requests
             SET overdue_notified = TRUE
             WHERE id IN (${placeholders})`,
            ids
        );

        await notifyHrAdmins(
            'Đơn xin nghỉ quá hạn',
            `Có ${overdueRequests.length} đơn xin nghỉ đã chờ duyệt hơn 24 giờ. Vui lòng xem xét và xử lý.`
        );

        res.json({
            success: true,
            message: 'Đã gửi cảnh báo đơn quá hạn cho HR Admin',
            data: {
                processed: overdueRequests.length
            }
        });
    } catch (error) {
        console.error('Error processing overdue leave requests:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xử lý đơn quá hạn: ' + error.message
        });
    }
});

// POST /api/leave-requests/:id/escalate - HR Admin đẩy đơn lên BLĐ
router.post('/:id/escalate', async (req, res) => {
    try {
        await ensureLeaveRequestsTable();

        const { id } = req.params;
        const { hrUserId, comment } = req.body;

        const hrUserIdNumber = Number(hrUserId);

        if (!Number.isInteger(hrUserIdNumber) || hrUserIdNumber <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu hrUserId'
            });
        }

        const leaveRequest = await fetchLeaveRequestById(id);

        if (!leaveRequest) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn xin nghỉ'
            });
        }

        if (leaveRequest.status !== LEAVE_STATUSES.PENDING_TEAM_LEAD) {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể chuyển phiếu khi đơn đang chờ quản lý duyệt'
            });
        }

        if (!leaveRequest.branch_manager_id) {
            return res.status(400).json({
                success: false,
                message: 'Đơn này chưa có thông tin quản lý gián tiếp, không thể chuyển phiếu'
            });
        }

        const newDueAt = computeDueDate();

        const updateQuery = `
            UPDATE leave_requests
            SET status = $1,
                hr_admin_user_id = $2,
                escalated_at = CURRENT_TIMESTAMP,
                team_lead_action = 'ESCALATED',
                team_lead_action_at = CURRENT_TIMESTAMP,
                team_lead_comment = COALESCE($3, team_lead_comment),
                due_at = $4,
                overdue_notified = FALSE
            WHERE id = $5
            RETURNING *
        `;

        const updateResult = await pool.query(updateQuery, [
            LEAVE_STATUSES.PENDING_BRANCH,
            hrUserIdNumber,
            comment || null,
            newDueAt.toISOString(),
            id
        ]);

        const updatedRequest = mapLeaveRequestRow(await fetchLeaveRequestById(id));

        await notifyEmployees(
            [leaveRequest.branch_manager_id].filter(Boolean),
            'Đơn xin nghỉ cần duyệt',
            `Đơn xin nghỉ của nhân viên ${leaveRequest.employee_name || leaveRequest.employee_email || leaveRequest.employee_id} đã được HR chuyển cho quản lý gián tiếp để xử lý.`
        );

        res.json({
            success: true,
            message: 'Đơn đã được chuyển cho quản lý gián tiếp',
            data: updatedRequest
        });
    } catch (error) {
        console.error('Error escalating leave request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đẩy phiếu: ' + error.message
        });
    }
});

// POST /api/leave-requests/:id/decision - Duyệt/Từ chối đơn
router.post('/:id/decision', async (req, res) => {
    try {
        await ensureLeaveRequestsTable();

        const { id } = req.params;
        const { actorType, actorId, decision, comment } = req.body;

        if (!actorType || !actorId || !decision) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin hành động duyệt'
            });
        }

        if (!Object.values(ACTOR_TYPES).includes(actorType)) {
            return res.status(400).json({
                success: false,
                message: 'Loại người duyệt không hợp lệ'
            });
        }

        if (!Object.values(DECISION_TYPES).includes(decision)) {
            return res.status(400).json({
                success: false,
                message: 'Hành động không hợp lệ'
            });
        }

        const actorIdNumber = Number(actorId);
        if (!Number.isInteger(actorIdNumber) || actorIdNumber <= 0) {
            return res.status(400).json({
                success: false,
                message: 'actorId không hợp lệ'
            });
        }

        const leaveRequest = await fetchLeaveRequestById(id);
        if (!leaveRequest) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn xin nghỉ'
            });
        }

        const now = new Date();
        let updatedRequest = null;

        if (actorType === ACTOR_TYPES.TEAM_LEAD) {
            if (leaveRequest.team_lead_id !== actorIdNumber) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền xử lý đơn này'
                });
            }

            if (leaveRequest.status !== LEAVE_STATUSES.PENDING_TEAM_LEAD) {
                return res.status(400).json({
                    success: false,
                    message: 'Đơn không còn ở bước quản lý duyệt'
                });
            }

            if (decision === DECISION_TYPES.APPROVE) {
                const dueAt = computeDueDate();
                const updateQuery = `
                    UPDATE leave_requests
                    SET status = $1,
                        team_lead_action = 'APPROVED',
                        team_lead_action_at = $2,
                        team_lead_comment = $3,
                        due_at = $4,
                        overdue_notified = FALSE
                    WHERE id = $5
                    RETURNING *
                `;

                const updateResult = await pool.query(updateQuery, [
                    LEAVE_STATUSES.PENDING_BRANCH,
                    now.toISOString(),
                    comment || null,
                    dueAt.toISOString(),
                    id
                ]);

                updatedRequest = mapLeaveRequestRow(await fetchLeaveRequestById(id));

                await notifyEmployees(
                    [leaveRequest.branch_manager_id].filter(Boolean),
                    'Đơn xin nghỉ cần duyệt',
                    `Quản lý ${leaveRequest.team_lead_name || leaveRequest.team_lead_email || leaveRequest.team_lead_id} đã duyệt đơn xin nghỉ. Quản lý gián tiếp vui lòng xem xét.`
                );
            } else {
                const updateQuery = `
                    UPDATE leave_requests
                    SET status = $1,
                        team_lead_action = 'REJECTED',
                        team_lead_action_at = $2,
                        team_lead_comment = $3,
                        due_at = NULL
                    WHERE id = $4
                    RETURNING *
                `;

                const updateResult = await pool.query(updateQuery, [
                    LEAVE_STATUSES.REJECTED,
                    now.toISOString(),
                    comment || null,
                    id
                ]);

                updatedRequest = mapLeaveRequestRow(await fetchLeaveRequestById(id));

                await notifyHrAdmins(
                    'Đơn xin nghỉ bị từ chối',
                    `Quản lý ${leaveRequest.team_lead_name || leaveRequest.team_lead_email || leaveRequest.team_lead_id} đã từ chối đơn xin nghỉ của ${leaveRequest.employee_name || leaveRequest.employee_email || leaveRequest.employee_id}.`
                );
            }
        } else if (actorType === ACTOR_TYPES.BRANCH) {
            if (leaveRequest.branch_manager_id !== actorIdNumber) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền xử lý đơn này'
                });
            }

            if (leaveRequest.status !== LEAVE_STATUSES.PENDING_BRANCH) {
                return res.status(400).json({
                    success: false,
                    message: 'Đơn không còn ở bước quản lý gián tiếp duyệt'
                });
            }

            if (decision === DECISION_TYPES.APPROVE) {
                const updateQuery = `
                    UPDATE leave_requests
                    SET status = $1,
                        branch_action = 'APPROVED',
                        branch_action_at = $2,
                        branch_comment = $3,
                        due_at = NULL
                    WHERE id = $4
                    RETURNING *
                `;

                const updateResult = await pool.query(updateQuery, [
                    LEAVE_STATUSES.APPROVED,
                    now.toISOString(),
                    comment || null,
                    id
                ]);

                updatedRequest = mapLeaveRequestRow(await fetchLeaveRequestById(id));

                await notifyHrAdmins(
                    'Đơn xin nghỉ đã được duyệt',
                    `Quản lý gián tiếp ${leaveRequest.branch_manager_name || leaveRequest.branch_manager_email || leaveRequest.branch_manager_id} đã duyệt đơn xin nghỉ của ${leaveRequest.employee_name || leaveRequest.employee_email || leaveRequest.employee_id}.`
                );

                await notifyEmployees(
                    [leaveRequest.team_lead_id].filter(Boolean),
                    'Đơn xin nghỉ hoàn tất',
                    `Đơn xin nghỉ của ${leaveRequest.employee_name || leaveRequest.employee_email || leaveRequest.employee_id} đã được quản lý gián tiếp phê duyệt.`
                );
            } else {
                const updateQuery = `
                    UPDATE leave_requests
                    SET status = $1,
                        branch_action = 'REJECTED',
                        branch_action_at = $2,
                        branch_comment = $3,
                        due_at = NULL
                    WHERE id = $4
                    RETURNING *
                `;

                const updateResult = await pool.query(updateQuery, [
                    LEAVE_STATUSES.REJECTED,
                    now.toISOString(),
                    comment || null,
                    id
                ]);

                updatedRequest = mapLeaveRequestRow(await fetchLeaveRequestById(id));

                await notifyHrAdmins(
                    'Đơn xin nghỉ bị từ chối',
                    `Quản lý gián tiếp ${leaveRequest.branch_manager_name || leaveRequest.branch_manager_email || leaveRequest.branch_manager_id} đã từ chối đơn xin nghỉ của ${leaveRequest.employee_name || leaveRequest.employee_email || leaveRequest.employee_id}.`
                );

                await notifyEmployees(
                    [leaveRequest.team_lead_id].filter(Boolean),
                    'Đơn xin nghỉ bị từ chối',
                    `Đơn xin nghỉ của ${leaveRequest.employee_name || leaveRequest.employee_email || leaveRequest.employee_id} đã bị quản lý gián tiếp từ chối.`
                );
            }
        }

        res.json({
            success: true,
            message: 'Đã cập nhật trạng thái đơn xin nghỉ',
            data: updatedRequest
        });
    } catch (error) {
        console.error('Error updating leave request decision:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật đơn xin nghỉ: ' + error.message
        });
    }
});

module.exports = router;

