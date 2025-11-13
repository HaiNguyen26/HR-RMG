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

let ensureOvertimeRequestsTablePromise = null;
const ensureOvertimeRequestsTable = async () => {
    if (ensureOvertimeRequestsTablePromise) {
        return ensureOvertimeRequestsTablePromise;
    }

    ensureOvertimeRequestsTablePromise = (async () => {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS overtime_requests (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                team_lead_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                branch_manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
                request_date DATE NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                duration TEXT,
                reason TEXT NOT NULL,
                notes TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDING_TEAM_LEAD',
                team_lead_action VARCHAR(20),
                team_lead_action_at TIMESTAMP,
                team_lead_comment TEXT,
                branch_action VARCHAR(20),
                branch_action_at TIMESTAMP,
                branch_comment TEXT,
                hr_admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                escalated_at TIMESTAMP,
                due_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours',
                overdue_notified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'overtime_requests'
                      AND constraint_name = 'overtime_requests_status_check'
                ) THEN
                    ALTER TABLE overtime_requests DROP CONSTRAINT overtime_requests_status_check;
                END IF;

                ALTER TABLE overtime_requests
                    ADD CONSTRAINT overtime_requests_status_check
                    CHECK (status IN ('PENDING_TEAM_LEAD', 'PENDING_BRANCH', 'APPROVED', 'REJECTED', 'CANCELLED'));
            END
            $$;
        `);

        await pool.query(`CREATE INDEX IF NOT EXISTS idx_overtime_requests_employee ON overtime_requests(employee_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_overtime_requests_team_lead ON overtime_requests(team_lead_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_overtime_requests_branch_manager ON overtime_requests(branch_manager_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_overtime_requests_status ON overtime_requests(status)`);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_overtime_requests_due_at
            ON overtime_requests(status, due_at)
            WHERE status = 'PENDING_TEAM_LEAD'
        `);

        await pool.query(`
            CREATE OR REPLACE FUNCTION update_overtime_requests_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);

        await pool.query(`
            DROP TRIGGER IF EXISTS trg_overtime_requests_updated ON overtime_requests;
            CREATE TRIGGER trg_overtime_requests_updated
                BEFORE UPDATE ON overtime_requests
                FOR EACH ROW
                EXECUTE FUNCTION update_overtime_requests_updated_at();
        `);
    })().catch((error) => {
        ensureOvertimeRequestsTablePromise = null;
        console.error('Error ensuring overtime_requests table:', error);
        throw error;
    });

    return ensureOvertimeRequestsTablePromise;
};

const STATUSES = {
    PENDING_TEAM_LEAD: 'PENDING_TEAM_LEAD',
    PENDING_BRANCH: 'PENDING_BRANCH',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED'
};

const DECISIONS = {
    APPROVE: 'APPROVE',
    REJECT: 'REJECT'
};

const ACTORS = {
    TEAM_LEAD: 'TEAM_LEAD',
    BRANCH: 'BRANCH'
};

const DEFAULT_DUE_HOURS = 24;

const computeDueDate = (hours = DEFAULT_DUE_HOURS) => {
    const now = new Date();
    now.setHours(now.getHours() + hours);
    return now;
};

const isValidTime = (value) => {
    if (!value || typeof value !== 'string') return false;
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
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

    const insertValues = userIds
        .map((_, idx) => `($${idx + 1}, NULL, 'SYSTEM', $${userIds.length + 1}, $${userIds.length + 2})`);
    const params = [...userIds, title, message];

    await pool.query(
        `INSERT INTO notifications (user_id, employee_id, type, title, message)
         VALUES ${insertValues.join(', ')}`,
        params
    );
};

const notifyEmployees = async (employeeIds, title, message) => {
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) return;

    const insertValues = employeeIds
        .map((_, idx) => `(NULL, $${idx + 1}, 'SYSTEM', $${employeeIds.length + 1}, $${employeeIds.length + 2})`);
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

const fetchOvertimeRequestById = async (id) => {
    const query = `
        SELECT orq.*,
               e.ho_ten AS employee_name,
               e.email AS employee_email,
               e.phong_ban AS employee_department,
               team.ho_ten AS team_lead_name,
               team.email AS team_lead_email,
               branch.ho_ten AS branch_manager_name,
               branch.email AS branch_manager_email
        FROM overtime_requests orq
        LEFT JOIN employees e ON orq.employee_id = e.id
        LEFT JOIN employees team ON orq.team_lead_id = team.id
        LEFT JOIN employees branch ON orq.branch_manager_id = branch.id
        WHERE orq.id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
};

const mapOvertimeRow = (row) => {
    if (!row) return null;
    const isOverdue =
        row.status === STATUSES.PENDING_TEAM_LEAD &&
        row.due_at &&
        new Date(row.due_at) < new Date();

    return {
        ...row,
        is_overdue: isOverdue,
        isOverdue
    };
};

// GET /api/overtime-requests
router.get('/', async (req, res) => {
    try {
        await ensureOvertimeRequestsTable();

        const {
            mode,
            employeeId,
            teamLeadId,
            branchManagerId,
            hrUserId,
            status
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
            conditions.push(`orq.employee_id = $${paramIndex}`);
            params.push(parseInt(employeeId, 10));
            paramIndex += 1;
        } else if (mode === 'teamLead') {
            if (!teamLeadId) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu teamLeadId'
                });
            }
            conditions.push(`orq.team_lead_id = $${paramIndex}`);
            params.push(parseInt(teamLeadId, 10));
            paramIndex += 1;
        } else if (mode === 'branchManager') {
            if (!branchManagerId) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu branchManagerId'
                });
            }
            conditions.push(`orq.branch_manager_id = $${paramIndex}`);
            params.push(parseInt(branchManagerId, 10));
            paramIndex += 1;
        } else if (mode === 'hr') {
            if (!hrUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu hrUserId'
                });
            }
        }

        if (status) {
            const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
            if (statuses.length > 0) {
                const placeholders = statuses.map((_s, idx) => `$${paramIndex + idx}`);
                conditions.push(`orq.status = ANY (ARRAY[${placeholders.join(', ')}])`);
                params.push(...statuses);
                paramIndex += statuses.length;
            }
        }

        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

        const query = `
            SELECT orq.*,
                   e.ho_ten AS employee_name,
                   e.email AS employee_email,
                   e.phong_ban AS employee_department,
                   team.ho_ten AS team_lead_name,
                   team.email AS team_lead_email,
                   branch.ho_ten AS branch_manager_name,
                   branch.email AS branch_manager_email
            FROM overtime_requests orq
            LEFT JOIN employees e ON orq.employee_id = e.id
            LEFT JOIN employees team ON orq.team_lead_id = team.id
            LEFT JOIN employees branch ON orq.branch_manager_id = branch.id
            WHERE ${whereClause}
            ORDER BY orq.created_at DESC
        `;

        const result = await pool.query(query, params);
        const mapped = result.rows.map(mapOvertimeRow);
        const overdueCount = mapped.filter((item) => item.isOverdue).length;

        res.json({
            success: true,
            message: 'Danh sách đơn tăng ca',
            data: mapped,
            stats: {
                total: mapped.length,
                overdueCount
            }
        });
    } catch (error) {
        console.error('Error fetching overtime requests:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể lấy danh sách đơn tăng ca: ' + error.message
        });
    }
});

// POST /api/overtime-requests
router.post('/', async (req, res) => {
    try {
        await ensureOvertimeRequestsTable();

        const {
            employeeId,
            requestDate,
            startTime,
            endTime,
            duration,
            reason,
            notes
        } = req.body;

        if (!employeeId || !requestDate || !startTime || !endTime || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc'
            });
        }

        if (!isValidTime(startTime) || !isValidTime(endTime)) {
            return res.status(400).json({
                success: false,
                message: 'Giờ bắt đầu hoặc kết thúc không hợp lệ'
            });
        }

        if (startTime >= endTime) {
            return res.status(400).json({
                success: false,
                message: 'Giờ kết thúc phải sau giờ bắt đầu'
            });
        }

        const employeeResult = await pool.query(
            `SELECT id, ho_ten, email, phong_ban, quan_ly_truc_tiep, quan_ly_gian_tiep
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
            INSERT INTO overtime_requests (
                employee_id,
                team_lead_id,
                branch_manager_id,
                request_date,
                start_time,
                end_time,
                duration,
                reason,
                notes,
                status,
                due_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;

        const insertValues = [
            employeeId,
            teamLead.id,
            branchManager.id,
            requestDate,
            startTime,
            endTime,
            duration || null,
            reason,
            notes || null,
            STATUSES.PENDING_TEAM_LEAD,
            dueAt.toISOString()
        ];

        const insertResult = await pool.query(insertQuery, insertValues);
        const insertedRow = insertResult.rows[0];
        const overtimeRequest = mapOvertimeRow(await fetchOvertimeRequestById(insertedRow.id));

        await notifyEmployees(
            [teamLead.id],
            'Đơn tăng ca mới',
            `Nhân viên ${employee.ho_ten || employee.email || employee.id} đã gửi đơn xin tăng ca.`
        );

        await notifyEmployees(
            [branchManager.id],
            'Thông báo đơn tăng ca',
            `Nhân viên ${employee.ho_ten || employee.email || employee.id} đã gửi đơn xin tăng ca. Bạn được thông báo với vai trò quản lý gián tiếp.`
        );

        res.status(201).json({
            success: true,
            message: 'Đã gửi đơn tăng ca thành công',
            data: overtimeRequest
        });
    } catch (error) {
        console.error('Error creating overtime request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi gửi đơn tăng ca: ' + error.message
        });
    }
});

// DELETE /api/overtime-requests/:id - Nhân viên xóa đơn tăng ca khi chưa duyệt
router.delete('/:id', async (req, res) => {
    try {
        await ensureOvertimeRequestsTable();

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
            `DELETE FROM overtime_requests
             WHERE id = $1
               AND employee_id = $2
               AND status = $3
             RETURNING *`,
            [requestId, employeeIdNumber, STATUSES.PENDING_TEAM_LEAD]
        );

        if (deleteResult.rowCount === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa đơn. Có thể đơn đã được xử lý hoặc không tồn tại.'
            });
        }

        res.json({
            success: true,
            message: 'Đã xóa đơn tăng ca trước khi duyệt'
        });
    } catch (error) {
        console.error('Error deleting overtime request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa đơn tăng ca: ' + error.message
        });
    }
});

// POST /api/overtime-requests/overdue/process
router.post('/overdue/process', async (_req, res) => {
    try {
        await ensureOvertimeRequestsTable();

        const overdueQuery = `
            SELECT orq.id,
                   orq.employee_id,
                   orq.team_lead_id,
                   orq.created_at,
                   orq.due_at,
                   e.ho_ten AS employee_name,
                   team.ho_ten AS team_lead_name
            FROM overtime_requests orq
            LEFT JOIN employees e ON orq.employee_id = e.id
            LEFT JOIN employees team ON orq.team_lead_id = team.id
            WHERE orq.status = $1
              AND orq.due_at IS NOT NULL
              AND orq.due_at < NOW()
              AND orq.overdue_notified = FALSE
        `;

        const overdueResult = await pool.query(overdueQuery, [STATUSES.PENDING_TEAM_LEAD]);
        const overdueRequests = overdueResult.rows;

        if (overdueRequests.length === 0) {
            return res.json({
                success: true,
                message: 'Không có đơn tăng ca quá hạn',
                data: {
                    processed: 0
                }
            });
        }

        const ids = overdueRequests.map((row) => row.id);
        const placeholders = ids.map((_id, idx) => `$${idx + 1}`).join(', ');

        await pool.query(
            `UPDATE overtime_requests
             SET overdue_notified = TRUE
             WHERE id IN (${placeholders})`,
            ids
        );

        await notifyHrAdmins(
            'Đơn tăng ca quá hạn',
            `Có ${overdueRequests.length} đơn tăng ca đã chờ duyệt hơn 24 giờ. Vui lòng kiểm tra và xử lý.`
        );

        res.json({
            success: true,
            message: 'Đã gửi cảnh báo đơn tăng ca quá hạn cho HR Admin',
            data: {
                processed: overdueRequests.length
            }
        });
    } catch (error) {
        console.error('Error processing overtime overdue requests:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xử lý đơn tăng ca quá hạn: ' + error.message
        });
    }
});

// POST /api/overtime-requests/:id/escalate
router.post('/:id/escalate', async (req, res) => {
    try {
        await ensureOvertimeRequestsTable();

        const { id } = req.params;
        const { hrUserId, comment } = req.body;

        const hrUserIdNumber = Number(hrUserId);
        if (!Number.isInteger(hrUserIdNumber) || hrUserIdNumber <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu hrUserId'
            });
        }

        const overtimeRequest = await fetchOvertimeRequestById(id);

        if (!overtimeRequest) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn tăng ca'
            });
        }

        if (overtimeRequest.status !== STATUSES.PENDING_TEAM_LEAD) {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể chuyển đơn khi đang chờ quản lý duyệt'
            });
        }

        if (!overtimeRequest.branch_manager_id) {
            return res.status(400).json({
                success: false,
                message: 'Đơn này chưa có thông tin quản lý gián tiếp, không thể chuyển đơn'
            });
        }

        const newDueAt = computeDueDate();

        await pool.query(
            `UPDATE overtime_requests
             SET status = $1,
                 hr_admin_user_id = $2,
                 escalated_at = CURRENT_TIMESTAMP,
                 team_lead_action = 'ESCALATED',
                 team_lead_action_at = CURRENT_TIMESTAMP,
                 team_lead_comment = COALESCE($3, team_lead_comment),
                 due_at = $4,
                 overdue_notified = FALSE
             WHERE id = $5`,
            [
                STATUSES.PENDING_BRANCH,
                hrUserIdNumber,
                comment || null,
                newDueAt.toISOString(),
                id
            ]
        );

        const updatedRequest = mapOvertimeRow(await fetchOvertimeRequestById(id));

        await notifyEmployees(
            [overtimeRequest.branch_manager_id].filter(Boolean),
            'Đơn tăng ca cần duyệt',
            `Đơn tăng ca của nhân viên ${overtimeRequest.employee_name || overtimeRequest.employee_email || overtimeRequest.employee_id} đã được HR chuyển cho quản lý gián tiếp.`
        );

        res.json({
            success: true,
            message: 'Đơn tăng ca đã được chuyển cho quản lý gián tiếp',
            data: updatedRequest
        });
    } catch (error) {
        console.error('Error escalating overtime request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đẩy đơn tăng ca: ' + error.message
        });
    }
});

// POST /api/overtime-requests/:id/decision
router.post('/:id/decision', async (req, res) => {
    try {
        await ensureOvertimeRequestsTable();

        const { id } = req.params;
        const { actorType, actorId, decision, comment } = req.body;

        if (!actorType || !actorId || !decision) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin hành động duyệt'
            });
        }

        if (!Object.values(ACTORS).includes(actorType)) {
            return res.status(400).json({
                success: false,
                message: 'Loại người duyệt không hợp lệ'
            });
        }

        if (!Object.values(DECISIONS).includes(decision)) {
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

        const overtimeRequest = await fetchOvertimeRequestById(id);
        if (!overtimeRequest) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn tăng ca'
            });
        }

        const now = new Date();
        let updatedRequest = null;

        if (actorType === ACTORS.TEAM_LEAD) {
            if (overtimeRequest.team_lead_id !== actorIdNumber) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền xử lý đơn này'
                });
            }

            if (overtimeRequest.status !== STATUSES.PENDING_TEAM_LEAD) {
                return res.status(400).json({
                    success: false,
                    message: 'Đơn không còn ở bước quản lý duyệt'
                });
            }

            if (decision === DECISIONS.APPROVE) {
                const dueAt = computeDueDate();
                await pool.query(
                    `UPDATE overtime_requests
                     SET status = $1,
                         team_lead_action = 'APPROVED',
                         team_lead_action_at = $2,
                         team_lead_comment = $3,
                         due_at = $4,
                         overdue_notified = FALSE
                     WHERE id = $5`,
                    [
                        STATUSES.PENDING_BRANCH,
                        now.toISOString(),
                        comment || null,
                        dueAt.toISOString(),
                        id
                    ]
                );

                updatedRequest = mapOvertimeRow(await fetchOvertimeRequestById(id));

                await notifyEmployees(
                    [overtimeRequest.branch_manager_id].filter(Boolean),
                    'Đơn tăng ca cần duyệt',
                    `Quản lý ${overtimeRequest.team_lead_name || overtimeRequest.team_lead_email || overtimeRequest.team_lead_id} đã duyệt đơn tăng ca. Quản lý gián tiếp vui lòng xem xét.`
                );
            } else {
                await pool.query(
                    `UPDATE overtime_requests
                     SET status = $1,
                         team_lead_action = 'REJECTED',
                         team_lead_action_at = $2,
                         team_lead_comment = $3,
                         due_at = NULL
                     WHERE id = $4`,
                    [
                        STATUSES.REJECTED,
                        now.toISOString(),
                        comment || null,
                        id
                    ]
                );

                updatedRequest = mapOvertimeRow(await fetchOvertimeRequestById(id));

                await notifyHrAdmins(
                    'Đơn tăng ca bị từ chối',
                    `Quản lý ${overtimeRequest.team_lead_name || overtimeRequest.team_lead_email || overtimeRequest.team_lead_id} đã từ chối đơn tăng ca của ${overtimeRequest.employee_name || overtimeRequest.employee_email || overtimeRequest.employee_id}.`
                );
            }
        } else if (actorType === ACTORS.BRANCH) {
            if (overtimeRequest.branch_manager_id !== actorIdNumber) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền xử lý đơn này'
                });
            }

            if (overtimeRequest.status !== STATUSES.PENDING_BRANCH) {
                return res.status(400).json({
                    success: false,
                    message: 'Đơn không còn ở bước quản lý gián tiếp duyệt'
                });
            }

            if (decision === DECISIONS.APPROVE) {
                await pool.query(
                    `UPDATE overtime_requests
                     SET status = $1,
                         branch_action = 'APPROVED',
                         branch_action_at = $2,
                         branch_comment = $3,
                         due_at = NULL
                     WHERE id = $4`,
                    [
                        STATUSES.APPROVED,
                        now.toISOString(),
                        comment || null,
                        id
                    ]
                );

                updatedRequest = mapOvertimeRow(await fetchOvertimeRequestById(id));

                await notifyHrAdmins(
                    'Đơn tăng ca đã được duyệt',
                    `Quản lý gián tiếp ${overtimeRequest.branch_manager_name || overtimeRequest.branch_manager_email || overtimeRequest.branch_manager_id} đã duyệt đơn tăng ca của ${overtimeRequest.employee_name || overtimeRequest.employee_email || overtimeRequest.employee_id}.`
                );

                await notifyEmployees(
                    [overtimeRequest.team_lead_id].filter(Boolean),
                    'Đơn tăng ca hoàn tất',
                    `Đơn tăng ca của ${overtimeRequest.employee_name || overtimeRequest.employee_email || overtimeRequest.employee_id} đã được quản lý gián tiếp phê duyệt.`
                );
            } else {
                await pool.query(
                    `UPDATE overtime_requests
                     SET status = $1,
                         branch_action = 'REJECTED',
                         branch_action_at = $2,
                         branch_comment = $3,
                         due_at = NULL
                     WHERE id = $4`,
                    [
                        STATUSES.REJECTED,
                        now.toISOString(),
                        comment || null,
                        id
                    ]
                );

                updatedRequest = mapOvertimeRow(await fetchOvertimeRequestById(id));

                await notifyHrAdmins(
                    'Đơn tăng ca bị từ chối',
                    `Quản lý gián tiếp ${overtimeRequest.branch_manager_name || overtimeRequest.branch_manager_email || overtimeRequest.branch_manager_id} đã từ chối đơn tăng ca của ${overtimeRequest.employee_name || overtimeRequest.employee_email || overtimeRequest.employee_id}.`
                );

                await notifyEmployees(
                    [overtimeRequest.team_lead_id].filter(Boolean),
                    'Đơn tăng ca bị từ chối',
                    `Đơn tăng ca của ${overtimeRequest.employee_name || overtimeRequest.employee_email || overtimeRequest.employee_id} đã bị quản lý gián tiếp từ chối.`
                );
            }
        }

        res.json({
            success: true,
            message: 'Đã cập nhật trạng thái đơn tăng ca',
            data: updatedRequest
        });
    } catch (error) {
        console.error('Error updating overtime decision:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật đơn tăng ca: ' + error.message
        });
    }
});

module.exports = router;

