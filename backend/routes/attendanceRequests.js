const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const normalizeManagerReference = (value) => {
    if (!value) return null;
    // Convert to string and trim
    let cleaned = String(value).trim();
    if (!cleaned) return null;
    
    // Remove content in parentheses
    cleaned = cleaned.replace(/\(.*?\)/g, ' ');
    
    // Split by common separators and take first part
    const splitTokens = [' - ', '|', '/', ','];
    for (const token of splitTokens) {
        if (cleaned.includes(token)) {
            cleaned = cleaned.split(token)[0];
        }
    }
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned || null;
};

const findManagerByReference = async (reference) => {
    const normalized = normalizeManagerReference(reference);
    if (!normalized) {
        return null;
    }

    // Get all active employees from HR database for accurate matching
    const allEmployeesQuery = `
        SELECT id, ho_ten, email, chuc_danh, quan_ly_truc_tiep, quan_ly_gian_tiep
        FROM employees
        WHERE (trang_thai = 'ACTIVE' OR trang_thai = 'PENDING' OR trang_thai IS NULL)
        ORDER BY id DESC
    `;
    
    const allEmployeesResult = await pool.query(allEmployeesQuery);
    const allEmployees = allEmployeesResult.rows;

    if (allEmployees.length === 0) {
        return null;
    }

    // Normalize the reference for comparison
    const refLower = normalized.toLowerCase().trim();

    // Try to find exact match first (by name or email)
    for (const emp of allEmployees) {
        const empName = (emp.ho_ten || '').toLowerCase().trim();
        const empEmail = (emp.email || '').toLowerCase().trim();
        
        // Exact name match
        if (empName === refLower) {
            return emp;
        }
        
        // Exact email match
        if (empEmail && empEmail === refLower) {
            return emp;
        }
    }

    // Try partial match - check if reference is contained in name or vice versa
    for (const emp of allEmployees) {
        const empName = (emp.ho_ten || '').toLowerCase().trim();
        
        // Reference contains employee name (with word boundaries)
        if (empName && refLower.includes(empName)) {
            return emp;
        }
        
        // Employee name contains reference (with word boundaries)
        if (empName && empName.includes(refLower)) {
            return emp;
        }
    }

    // Try word-by-word matching for Vietnamese names
    const refWords = refLower.split(/\s+/).filter(w => w.length > 0);
    
    if (refWords.length > 0) {
        // Try to find employee where all words of reference match
        for (const emp of allEmployees) {
            const empName = (emp.ho_ten || '').toLowerCase().trim();
            if (!empName) continue;
            
            const empWords = empName.split(/\s+/).filter(w => w.length > 0);
            
            // Check if all reference words are in employee name
            const allWordsMatch = refWords.every(refWord => 
                empWords.some(empWord => empWord.includes(refWord) || refWord.includes(empWord))
            );
            
            if (allWordsMatch && empWords.length > 0) {
                return emp;
            }
        }

        // Try matching by first and last word (common in Vietnamese names)
        if (refWords.length >= 2) {
            const firstWord = refWords[0];
            const lastWord = refWords[refWords.length - 1];
            
            for (const emp of allEmployees) {
                const empName = (emp.ho_ten || '').toLowerCase().trim();
                if (!empName) continue;
                
                const empWords = empName.split(/\s+/).filter(w => w.length > 0);
                
                // Check if first and last words match
                const firstMatches = empWords.length > 0 && (
                    empWords[0].includes(firstWord) || firstWord.includes(empWords[0])
                );
                const lastMatches = empWords.length > 0 && (
                    empWords[empWords.length - 1].includes(lastWord) || lastWord.includes(empWords[empWords.length - 1])
                );
                
                if (firstMatches && lastMatches) {
                    return emp;
                }
            }
        }

        // Try matching by last word only (usually the given name)
        const lastWord = refWords[refWords.length - 1];
        let exactMatch = null;
        let partialMatch = null;
        
        for (const emp of allEmployees) {
            const empName = (emp.ho_ten || '').toLowerCase().trim();
            if (!empName) continue;
            
            const empWords = empName.split(/\s+/).filter(w => w.length > 0);
            if (empWords.length === 0) continue;
            
            const empLastWord = empWords[empWords.length - 1];
            
            // Check if last word matches exactly
            if (empLastWord === lastWord) {
                exactMatch = emp;
                break; // Exact match found, prefer this
            }
            
            // Check for partial match
            if (!exactMatch && (empLastWord.includes(lastWord) || lastWord.includes(empLastWord))) {
                if (!partialMatch) {
                    partialMatch = emp;
                }
            }
        }
        
        // Return exact match first, then partial match
        if (exactMatch) {
            return exactMatch;
        }
        
        if (partialMatch) {
            return partialMatch;
        }
    }

    return null;
};

let ensureAttendanceAdjustmentsTablePromise = null;
const ensureAttendanceAdjustmentsTable = async () => {
    if (ensureAttendanceAdjustmentsTablePromise) {
        return ensureAttendanceAdjustmentsTablePromise;
    }

    ensureAttendanceAdjustmentsTablePromise = (async () => {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance_adjustments (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                team_lead_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                branch_manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
                adjustment_date DATE NOT NULL,
                check_type VARCHAR(20) NOT NULL,
                check_in_time TIME,
                check_out_time TIME,
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
                    WHERE table_name = 'attendance_adjustments'
                      AND constraint_name = 'attendance_adjustments_check_type_check'
                ) THEN
                    ALTER TABLE attendance_adjustments DROP CONSTRAINT attendance_adjustments_check_type_check;
                END IF;

                ALTER TABLE attendance_adjustments
                    ADD CONSTRAINT attendance_adjustments_check_type_check
                    CHECK (check_type IN ('CHECK_IN', 'CHECK_OUT', 'BOTH'));
            END
            $$;
        `);

        await pool.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'attendance_adjustments'
                      AND constraint_name = 'attendance_adjustments_status_check'
                ) THEN
                    ALTER TABLE attendance_adjustments DROP CONSTRAINT attendance_adjustments_status_check;
                END IF;

                ALTER TABLE attendance_adjustments
                    ADD CONSTRAINT attendance_adjustments_status_check
                    CHECK (status IN ('PENDING_TEAM_LEAD', 'PENDING_BRANCH', 'APPROVED', 'REJECTED', 'CANCELLED'));
            END
            $$;
        `);

        await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_employee ON attendance_adjustments(employee_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_team_lead ON attendance_adjustments(team_lead_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_branch_manager ON attendance_adjustments(branch_manager_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_status ON attendance_adjustments(status)`);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_due_at
            ON attendance_adjustments(status, due_at)
            WHERE status = 'PENDING_TEAM_LEAD'
        `);

        await pool.query(`
            CREATE OR REPLACE FUNCTION update_attendance_adjustments_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);

        await pool.query(`
            DROP TRIGGER IF EXISTS trg_attendance_adjustments_updated ON attendance_adjustments;
            CREATE TRIGGER trg_attendance_adjustments_updated
                BEFORE UPDATE ON attendance_adjustments
                FOR EACH ROW
                EXECUTE FUNCTION update_attendance_adjustments_updated_at();
        `);
    })().catch((error) => {
        ensureAttendanceAdjustmentsTablePromise = null;
        console.error('Error ensuring attendance_adjustments table:', error);
        throw error;
    });

    return ensureAttendanceAdjustmentsTablePromise;
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

// Helper to get user IDs from employee IDs
const getUserIdFromEmployeeId = async (employeeIds) => {
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) return [];
    try {
        const result = await pool.query(
            `SELECT DISTINCT u.id 
             FROM users u
             INNER JOIN employees e ON u.email = e.email OR u.ho_ten = e.ho_ten
             WHERE e.id = ANY($1::int[])`,
            [employeeIds]
        );
        return result.rows.map(row => row.id);
    } catch (error) {
        console.error('[getUserIdFromEmployeeId] Error:', error);
        return [];
    }
};

// Notification system removed

const fetchAdjustmentById = async (id) => {
    const query = `
        SELECT adj.*,
               e.ho_ten AS employee_name,
               e.email AS employee_email,
               e.phong_ban AS employee_department,
               team.ho_ten AS team_lead_name,
               team.email AS team_lead_email,
               branch.ho_ten AS branch_manager_name,
               branch.email AS branch_manager_email
        FROM attendance_adjustments adj
        LEFT JOIN employees e ON adj.employee_id = e.id
        LEFT JOIN employees team ON adj.team_lead_id = team.id
        LEFT JOIN employees branch ON adj.branch_manager_id = branch.id
        WHERE adj.id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
};

const mapAdjustmentRow = (row) => {
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

// GET /api/attendance-adjustments
router.get('/', async (req, res) => {
    try {
        await ensureAttendanceAdjustmentsTable();

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
            conditions.push(`adj.employee_id = $${paramIndex}`);
            params.push(parseInt(employeeId, 10));
            paramIndex += 1;
        } else if (mode === 'teamLead') {
            if (!teamLeadId) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu teamLeadId'
                });
            }
            conditions.push(`adj.team_lead_id = $${paramIndex}`);
            params.push(parseInt(teamLeadId, 10));
            paramIndex += 1;
        } else if (mode === 'branchManager') {
            if (!branchManagerId) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu branchManagerId'
                });
            }
            conditions.push(`adj.branch_manager_id = $${paramIndex}`);
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
                conditions.push(`adj.status = ANY (ARRAY[${placeholders.join(', ')}])`);
                params.push(...statuses);
                paramIndex += statuses.length;
            }
        }

        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

        const query = `
            SELECT adj.*,
                   e.ho_ten AS employee_name,
                   e.email AS employee_email,
                   e.phong_ban AS employee_department,
                   team.ho_ten AS team_lead_name,
                   team.email AS team_lead_email,
                   branch.ho_ten AS branch_manager_name,
                   branch.email AS branch_manager_email
            FROM attendance_adjustments adj
            LEFT JOIN employees e ON adj.employee_id = e.id
            LEFT JOIN employees team ON adj.team_lead_id = team.id
            LEFT JOIN employees branch ON adj.branch_manager_id = branch.id
            WHERE ${whereClause}
            ORDER BY adj.created_at DESC
        `;

        const result = await pool.query(query, params);
        const mapped = result.rows.map(mapAdjustmentRow);
        const overdueCount = mapped.filter((item) => item.isOverdue).length;

        res.json({
            success: true,
            message: 'Danh sách đơn bổ sung chấm công',
            data: mapped,
            stats: {
                total: mapped.length,
                overdueCount
            }
        });
    } catch (error) {
        console.error('Error fetching attendance adjustments:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể lấy danh sách đơn bổ sung chấm công: ' + error.message
        });
    }
});

// POST /api/attendance-adjustments
router.post('/', async (req, res) => {
    try {
        await ensureAttendanceAdjustmentsTable();

        const {
            employeeId,
            adjustmentDate,
            checkType,
            checkInTime,
            checkOutTime,
            reason,
            notes
        } = req.body;

        if (!employeeId || !adjustmentDate || !checkType || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc'
            });
        }

        const normalizedCheckType = String(checkType).toUpperCase();
        if (!['CHECK_IN', 'CHECK_OUT', 'BOTH'].includes(normalizedCheckType)) {
            return res.status(400).json({
                success: false,
                message: 'Loại bổ sung chấm công không hợp lệ'
            });
        }

        if (normalizedCheckType !== 'CHECK_OUT') {
            if (!isValidTime(checkInTime)) {
                return res.status(400).json({
                    success: false,
                    message: 'Giờ vào không hợp lệ'
                });
            }
        }

        if (normalizedCheckType !== 'CHECK_IN') {
            if (!isValidTime(checkOutTime)) {
                return res.status(400).json({
                    success: false,
                    message: 'Giờ ra không hợp lệ'
                });
            }
        }

        if (
            normalizedCheckType === 'BOTH' &&
            isValidTime(checkInTime) &&
            isValidTime(checkOutTime) &&
            checkInTime >= checkOutTime
        ) {
            return res.status(400).json({
                success: false,
                message: 'Giờ ra phải sau giờ vào'
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

        // Kiểm tra nếu nhân viên không có thông tin quản lý trực tiếp
        if (!employee.quan_ly_truc_tiep || employee.quan_ly_truc_tiep.trim() === '') {
            return res.status(400).json({
                success: false,
                message: `Nhân viên chưa có thông tin quản lý trực tiếp. Vui lòng cập nhật thông tin quản lý trực tiếp cho nhân viên "${employee.ho_ten || 'N/A'}" trong module Quản lý nhân viên.`
            });
        }

        const teamLead = await findManagerByReference(employee.quan_ly_truc_tiep);
        if (!teamLead) {
            console.error(`[AttendanceRequest] Không tìm thấy quản lý trực tiếp. Nhân viên: ${employee.ho_ten}, quan_ly_truc_tiep: "${employee.quan_ly_truc_tiep}"`);
            return res.status(404).json({
                success: false,
                message: `Không tìm thấy quản lý trực tiếp "${employee.quan_ly_truc_tiep}" trong hệ thống. Vui lòng kiểm tra lại tên quản lý trực tiếp của nhân viên "${employee.ho_ten || 'N/A'}" trong module Quản lý nhân viên. Tên phải khớp chính xác với tên trong hệ thống.`
            });
        }

        // Không cần quản lý gián tiếp nữa - quy trình mới: Nhân viên -> Quản lý trực tiếp -> HR
        const dueAt = computeDueDate();
        const insertQuery = `
            INSERT INTO attendance_adjustments (
                employee_id,
                team_lead_id,
                branch_manager_id,
                adjustment_date,
                check_type,
                check_in_time,
                check_out_time,
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
            null, // Không cần quản lý gián tiếp
            adjustmentDate,
            normalizedCheckType,
            normalizedCheckType === 'CHECK_OUT' ? null : (checkInTime || null),
            normalizedCheckType === 'CHECK_IN' ? null : (checkOutTime || null),
            reason,
            notes || null,
            STATUSES.PENDING_TEAM_LEAD,
            dueAt.toISOString()
        ];

        const insertResult = await pool.query(insertQuery, insertValues);
        const insertedRow = insertResult.rows[0];
        const adjustment = mapAdjustmentRow(await fetchAdjustmentById(insertedRow.id));

        // Notification system removed

        res.status(201).json({
            success: true,
            message: 'Đã gửi đơn bổ sung chấm công thành công',
            data: adjustment
        });
    } catch (error) {
        console.error('Error creating attendance adjustment:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi gửi đơn bổ sung chấm công: ' + error.message
        });
    }
});

// DELETE /api/attendance-adjustments/:id - Nhân viên xóa đơn bổ sung khi chưa duyệt, HR xóa đơn đã từ chối
router.delete('/:id', async (req, res) => {
    try {
        await ensureAttendanceAdjustmentsTable();

        const { id } = req.params;
        const { employeeId, role } = req.body;

        const requestId = Number(id);
        const employeeIdNumber = employeeId ? Number(employeeId) : null;
        const isHR = role === 'HR';

        if (!Number.isInteger(requestId) || requestId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Mã đơn không hợp lệ'
            });
        }

        // Get the request first to check status and employee_id
        const requestResult = await pool.query(
            `SELECT id, employee_id, status FROM attendance_adjustments WHERE id = $1`,
            [requestId]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn'
            });
        }

        const request = requestResult.rows[0];

        let deleteQuery;
        let deleteParams;

        if (isHR) {
            // HR can delete rejected requests
            if (request.status !== STATUSES.REJECTED) {
                return res.status(400).json({
                    success: false,
                    message: 'HR chỉ có thể xóa các đơn đã từ chối'
                });
            }
            deleteQuery = `DELETE FROM attendance_adjustments WHERE id = $1 AND status = $2 RETURNING *`;
            deleteParams = [requestId, STATUSES.REJECTED];
        } else {
            // Employee can only delete their own pending requests
            if (!Number.isInteger(employeeIdNumber) || employeeIdNumber <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu thông tin nhân viên'
                });
            }

            if (request.employee_id !== employeeIdNumber) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn chỉ có thể xóa đơn của chính mình'
                });
            }

            if (request.status !== STATUSES.PENDING_TEAM_LEAD) {
                return res.status(400).json({
                    success: false,
                    message: 'Chỉ có thể xóa đơn đang chờ duyệt'
                });
            }

            deleteQuery = `DELETE FROM attendance_adjustments WHERE id = $1 AND employee_id = $2 AND status = $3 RETURNING *`;
            deleteParams = [requestId, employeeIdNumber, STATUSES.PENDING_TEAM_LEAD];
        }

        const deleteResult = await pool.query(deleteQuery, deleteParams);

        if (deleteResult.rowCount === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa đơn. Có thể đơn đã được xử lý hoặc không tồn tại.'
            });
        }

        res.json({
            success: true,
            message: isHR ? 'Đã xóa đơn bổ sung chấm công đã từ chối' : 'Đã xóa đơn bổ sung chấm công trước khi duyệt'
        });
    } catch (error) {
        console.error('Error deleting attendance adjustment:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa đơn bổ sung chấm công: ' + error.message
        });
    }
});

// POST /api/attendance-adjustments/overdue/process
router.post('/overdue/process', async (_req, res) => {
    try {
        await ensureAttendanceAdjustmentsTable();

        const overdueQuery = `
            SELECT adj.id,
                   adj.employee_id,
                   adj.team_lead_id,
                   adj.created_at,
                   adj.due_at,
                   e.ho_ten AS employee_name,
                   team.ho_ten AS team_lead_name
            FROM attendance_adjustments adj
            LEFT JOIN employees e ON adj.employee_id = e.id
            LEFT JOIN employees team ON adj.team_lead_id = team.id
            WHERE adj.status = $1
              AND adj.due_at IS NOT NULL
              AND adj.due_at < NOW()
              AND adj.overdue_notified = FALSE
        `;

        const overdueResult = await pool.query(overdueQuery, [STATUSES.PENDING_TEAM_LEAD]);
        const overdueAdjustments = overdueResult.rows;

        if (overdueAdjustments.length === 0) {
            return res.json({
                success: true,
                message: 'Không có đơn bổ sung chấm công quá hạn',
                data: {
                    processed: 0
                }
            });
        }

        const ids = overdueAdjustments.map((row) => row.id);
        const placeholders = ids.map((_id, idx) => `$${idx + 1}`).join(', ');

        await pool.query(
            `UPDATE attendance_adjustments
             SET overdue_notified = TRUE
             WHERE id IN (${placeholders})`,
            ids
        );

        // Notification system removed

        res.json({
            success: true,
            message: 'Đã gửi cảnh báo đơn bổ sung chấm công quá hạn cho HR Admin',
            data: {
                processed: overdueAdjustments.length
            }
        });
    } catch (error) {
        console.error('Error processing attendance adjustment overdue:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xử lý đơn bổ sung chấm công quá hạn: ' + error.message
        });
    }
});

// POST /api/attendance-adjustments/:id/escalate
router.post('/:id/escalate', async (req, res) => {
    try {
        await ensureAttendanceAdjustmentsTable();

        const { id } = req.params;
        const { hrUserId, comment } = req.body;

        const hrUserIdNumber = Number(hrUserId);
        if (!Number.isInteger(hrUserIdNumber) || hrUserIdNumber <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu hrUserId'
            });
        }

        const adjustment = await fetchAdjustmentById(id);

        if (!adjustment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn bổ sung chấm công'
            });
        }

        if (adjustment.status !== STATUSES.PENDING_TEAM_LEAD) {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể chuyển đơn khi đang chờ quản lý duyệt'
            });
        }

        if (!adjustment.branch_manager_id) {
            return res.status(400).json({
                success: false,
                message: 'Đơn này chưa có thông tin quản lý gián tiếp, không thể chuyển đơn'
            });
        }

        const newDueAt = computeDueDate();

        await pool.query(
            `UPDATE attendance_adjustments
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

        const updatedRequest = mapAdjustmentRow(await fetchAdjustmentById(id));

        // Notification system removed

        res.json({
            success: true,
            message: 'Đơn bổ sung chấm công đã được chuyển cho quản lý gián tiếp',
            data: updatedRequest
        });
    } catch (error) {
        console.error('Error escalating attendance adjustment:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đẩy đơn bổ sung chấm công: ' + error.message
        });
    }
});

// POST /api/attendance-adjustments/:id/decision
router.post('/:id/decision', async (req, res) => {
    try {
        await ensureAttendanceAdjustmentsTable();

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

        const adjustment = await fetchAdjustmentById(id);
        if (!adjustment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn bổ sung chấm công'
            });
        }

        const now = new Date();
        let updatedRequest = null;

        if (actorType === ACTORS.TEAM_LEAD) {
            if (adjustment.team_lead_id !== actorIdNumber) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền xử lý đơn này'
                });
            }

            if (adjustment.status !== STATUSES.PENDING_TEAM_LEAD) {
                return res.status(400).json({
                    success: false,
                    message: 'Đơn không còn ở bước quản lý duyệt'
                });
            }

            if (decision === DECISIONS.APPROVE) {
                const dueAt = computeDueDate();
                await pool.query(
                    `UPDATE attendance_adjustments
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

                updatedRequest = mapAdjustmentRow(await fetchAdjustmentById(id));

                // Notification system removed
            } else {
                await pool.query(
                    `UPDATE attendance_adjustments
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

                updatedRequest = mapAdjustmentRow(await fetchAdjustmentById(id));

                // Notification system removed
            }
        } else if (actorType === ACTORS.BRANCH) {
            if (adjustment.branch_manager_id !== actorIdNumber) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền xử lý đơn này'
                });
            }

            if (adjustment.status !== STATUSES.PENDING_BRANCH) {
                return res.status(400).json({
                    success: false,
                    message: 'Đơn không còn ở bước quản lý gián tiếp duyệt'
                });
            }

            if (decision === DECISIONS.APPROVE) {
                await pool.query(
                    `UPDATE attendance_adjustments
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

                updatedRequest = mapAdjustmentRow(await fetchAdjustmentById(id));

                // Notification system removed
            } else {
                await pool.query(
                    `UPDATE attendance_adjustments
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

                updatedRequest = mapAdjustmentRow(await fetchAdjustmentById(id));

                // Notification system removed
            }
        }

        res.json({
            success: true,
            message: 'Đã cập nhật trạng thái đơn bổ sung chấm công',
            data: updatedRequest
        });
    } catch (error) {
        console.error('Error updating attendance adjustment decision:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật đơn bổ sung chấm công: ' + error.message
        });
    }
});

module.exports = router;

