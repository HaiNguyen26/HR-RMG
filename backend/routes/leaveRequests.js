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

// Tìm giám đốc trong hệ thống (theo chức danh)
const findDirector = async () => {
    try {
        const directorQuery = `
            SELECT id, ho_ten, email, chuc_danh
            FROM employees
            WHERE (trang_thai = 'ACTIVE' OR trang_thai = 'PENDING' OR trang_thai IS NULL)
              AND (
                  LOWER(chuc_danh) LIKE '%giám đốc%'
                  OR LOWER(chuc_danh) LIKE '%director%'
                  OR LOWER(chuc_danh) LIKE '%tổng giám đốc%'
                  OR LOWER(chuc_danh) LIKE '%ceo%'
              )
            ORDER BY 
                CASE 
                    WHEN LOWER(chuc_danh) LIKE '%tổng giám đốc%' OR LOWER(chuc_danh) LIKE '%ceo%' THEN 1
                    WHEN LOWER(chuc_danh) LIKE '%giám đốc%' OR LOWER(chuc_danh) LIKE '%director%' THEN 2
                    ELSE 3
                END,
                id DESC
            LIMIT 1
        `;
        const result = await pool.query(directorQuery);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error finding director:', error);
        return null;
    }
};

// Tự động tìm quản lý gián tiếp dựa vào thông tin nhân viên (DEPRECATED - không dùng nữa)
const findIndirectManagerAuto = async (employee) => {
    // Nếu nhân viên có quan_ly_gian_tiep đã được cập nhật, ưu tiên sử dụng
    if (employee.quan_ly_gian_tiep) {
        const manager = await findManagerByReference(employee.quan_ly_gian_tiep);
        if (manager) {
            return manager;
        }
    }

    // Logic tự động tìm quản lý gián tiếp theo thứ tự ưu tiên:

    // 1. Tìm quản lý của quản lý trực tiếp (nếu có)
    if (employee.quan_ly_truc_tiep) {
        const directManager = await findManagerByReference(employee.quan_ly_truc_tiep);
        if (directManager && directManager.id) {
            // Lấy thông tin chi tiết của quản lý trực tiếp
            const directManagerDetail = await pool.query(
                `SELECT id, ho_ten, email, phong_ban, chi_nhanh, quan_ly_truc_tiep, quan_ly_gian_tiep
                 FROM employees WHERE id = $1`,
                [directManager.id]
            );

            if (directManagerDetail.rows.length > 0) {
                const dmDetail = directManagerDetail.rows[0];
                // Nếu quản lý trực tiếp có quản lý gián tiếp, sử dụng nó
                if (dmDetail.quan_ly_gian_tiep) {
                    const indirectManager = await findManagerByReference(dmDetail.quan_ly_gian_tiep);
                    if (indirectManager) {
                        return indirectManager;
                    }
                }
                // Nếu quản lý trực tiếp có quản lý trực tiếp khác, đó có thể là quản lý gián tiếp
                if (dmDetail.quan_ly_truc_tiep && dmDetail.quan_ly_truc_tiep !== employee.quan_ly_truc_tiep) {
                    const indirectManager = await findManagerByReference(dmDetail.quan_ly_truc_tiep);
                    if (indirectManager) {
                        return indirectManager;
                    }
                }
            }
        }
    }

    // 2. Tìm theo chi nhánh: Tìm nhân viên cùng chi nhánh có chức danh quản lý/giám đốc
    if (employee.chi_nhanh) {
        const branchManagerQuery = `
            SELECT id, ho_ten, email, chuc_danh
            FROM employees
            WHERE (trang_thai = 'ACTIVE' OR trang_thai = 'PENDING' OR trang_thai IS NULL)
              AND chi_nhanh = $1
              AND id != $2
              AND (
                  LOWER(chuc_danh) LIKE '%quản lý%'
                  OR LOWER(chuc_danh) LIKE '%giám đốc%'
                  OR LOWER(chuc_danh) LIKE '%trưởng phòng%'
                  OR LOWER(chuc_danh) LIKE '%director%'
                  OR LOWER(chuc_danh) LIKE '%manager%'
                  OR LOWER(chuc_danh) LIKE '%head%'
              )
            ORDER BY 
                CASE 
                    WHEN LOWER(chuc_danh) LIKE '%giám đốc%' OR LOWER(chuc_danh) LIKE '%director%' THEN 1
                    WHEN LOWER(chuc_danh) LIKE '%trưởng phòng%' OR LOWER(chuc_danh) LIKE '%head%' THEN 2
                    WHEN LOWER(chuc_danh) LIKE '%quản lý%' OR LOWER(chuc_danh) LIKE '%manager%' THEN 3
                    ELSE 4
                END,
                id DESC
            LIMIT 1
        `;
        const branchResult = await pool.query(branchManagerQuery, [employee.chi_nhanh, employee.id]);
        if (branchResult.rows.length > 0) {
            return branchResult.rows[0];
        }
    }

    // 3. Tìm theo phòng ban: Tìm nhân viên cùng phòng ban có chức danh quản lý/giám đốc
    if (employee.phong_ban) {
        const departmentManagerQuery = `
            SELECT id, ho_ten, email, chuc_danh
            FROM employees
            WHERE (trang_thai = 'ACTIVE' OR trang_thai = 'PENDING' OR trang_thai IS NULL)
              AND phong_ban = $1
              AND id != $2
              AND (
                  LOWER(chuc_danh) LIKE '%quản lý%'
                  OR LOWER(chuc_danh) LIKE '%giám đốc%'
                  OR LOWER(chuc_danh) LIKE '%trưởng phòng%'
                  OR LOWER(chuc_danh) LIKE '%director%'
                  OR LOWER(chuc_danh) LIKE '%manager%'
                  OR LOWER(chuc_danh) LIKE '%head%'
              )
            ORDER BY 
                CASE 
                    WHEN LOWER(chuc_danh) LIKE '%giám đốc%' OR LOWER(chuc_danh) LIKE '%director%' THEN 1
                    WHEN LOWER(chuc_danh) LIKE '%trưởng phòng%' OR LOWER(chuc_danh) LIKE '%head%' THEN 2
                    WHEN LOWER(chuc_danh) LIKE '%quản lý%' OR LOWER(chuc_danh) LIKE '%manager%' THEN 3
                    ELSE 4
                END,
                id DESC
            LIMIT 1
        `;
        const deptResult = await pool.query(departmentManagerQuery, [employee.phong_ban, employee.id]);
        if (deptResult.rows.length > 0) {
            return deptResult.rows[0];
        }
    }

    // 4. Tìm bất kỳ nhân viên nào có chức danh quản lý/giám đốc trong hệ thống (fallback)
    const anyManagerQuery = `
        SELECT id, ho_ten, email, chuc_danh
        FROM employees
        WHERE (trang_thai = 'ACTIVE' OR trang_thai = 'PENDING' OR trang_thai IS NULL)
          AND (
              LOWER(chuc_danh) LIKE '%giám đốc%'
              OR LOWER(chuc_danh) LIKE '%director%'
              OR LOWER(chuc_danh) LIKE '%trưởng phòng%'
              OR LOWER(chuc_danh) LIKE '%head%'
          )
        ORDER BY 
            CASE 
                WHEN LOWER(chuc_danh) LIKE '%giám đốc%' OR LOWER(chuc_danh) LIKE '%director%' THEN 1
                WHEN LOWER(chuc_danh) LIKE '%trưởng phòng%' OR LOWER(chuc_danh) LIKE '%head%' THEN 2
                ELSE 3
            END,
            id DESC
        LIMIT 1
    `;
    const anyManagerResult = await pool.query(anyManagerQuery);
    if (anyManagerResult.rows.length > 0) {
        return anyManagerResult.rows[0];
    }

    return null;
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
                            ''PENDING_DIRECTOR'',
                            ''PENDING_HR'',
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
    PENDING_BRANCH: 'PENDING_BRANCH', // Giữ lại để tương thích với dữ liệu cũ
    PENDING_DIRECTOR: 'PENDING_DIRECTOR', // Đơn được HR đẩy lên giám đốc
    PENDING_HR: 'PENDING_HR',
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
    BRANCH: 'BRANCH', // Giữ lại để tương thích với dữ liệu cũ
    DIRECTOR: 'DIRECTOR' // Giám đốc duyệt đơn được HR đẩy lên
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

// Notification system removed

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

        // Kiểm tra nếu nhân viên không có thông tin quản lý trực tiếp
        if (!employee.quan_ly_truc_tiep || employee.quan_ly_truc_tiep.trim() === '') {
            return res.status(400).json({
                success: false,
                message: `Nhân viên chưa có thông tin quản lý trực tiếp. Vui lòng cập nhật thông tin quản lý trực tiếp cho nhân viên "${employee.ho_ten || 'N/A'}" trong module Quản lý nhân viên.`
            });
        }

        const teamLead = await findManagerByReference(employee.quan_ly_truc_tiep);
        if (!teamLead) {
            console.error(`[LeaveRequest] Không tìm thấy quản lý trực tiếp. Nhân viên: ${employee.ho_ten}, quan_ly_truc_tiep: "${employee.quan_ly_truc_tiep}"`);
            return res.status(404).json({
                success: false,
                message: `Không tìm thấy quản lý trực tiếp "${employee.quan_ly_truc_tiep}" trong hệ thống. Vui lòng kiểm tra lại tên quản lý trực tiếp của nhân viên "${employee.ho_ten || 'N/A'}" trong module Quản lý nhân viên. Tên phải khớp chính xác với tên trong hệ thống.`
            });
        }

        // Không cần quản lý gián tiếp nữa - quy trình mới: Nhân viên -> Quản lý trực tiếp -> HR/Giám đốc
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
            null, // Không cần quản lý gián tiếp
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

        // Notification system removed

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

// DELETE /api/leave-requests/:id - Nhân viên xóa đơn chưa duyệt hoặc HR xóa đơn đã từ chối
router.delete('/:id', async (req, res) => {
    try {
        await ensureLeaveRequestsTable();

        const { id } = req.params;
        const { employeeId, role } = req.body;

        const requestId = Number(id);
        const employeeIdNumber = employeeId ? Number(employeeId) : null;

        if (!Number.isInteger(requestId) || requestId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Mã đơn không hợp lệ'
            });
        }

        // Kiểm tra đơn có tồn tại không
        const checkQuery = `SELECT id, status, employee_id FROM leave_requests WHERE id = $1`;
        const checkResult = await pool.query(checkQuery, [requestId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn'
            });
        }

        const request = checkResult.rows[0];

        // HR có thể xóa đơn đã bị từ chối
        if (role === 'HR' && request.status === LEAVE_STATUSES.REJECTED) {
            const deleteResult = await pool.query(
                `DELETE FROM leave_requests
                 WHERE id = $1
                   AND status = $2
                 RETURNING *`,
                [requestId, LEAVE_STATUSES.REJECTED]
            );

            if (deleteResult.rowCount === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể xóa đơn đã từ chối'
                });
            }

            return res.json({
                success: true,
                message: 'Đã xóa đơn đã từ chối'
            });
        }

        // Nhân viên chỉ có thể xóa đơn chưa duyệt của chính mình
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

        // Notification system removed

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
                message: 'Chỉ có thể đẩy đơn khi đơn đang chờ quản lý trực tiếp duyệt'
            });
        }

        // Tìm giám đốc để đẩy đơn lên
        const director = await findDirector();
        if (!director) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy giám đốc trong hệ thống. Vui lòng cập nhật thông tin nhân viên có chức danh giám đốc.'
            });
        }

        // HR có quyền đẩy đơn ngay lập tức, không cần kiểm tra thời gian ở backend
        // (Frontend đã kiểm tra và hiển thị cảnh báo nếu cần)
        const updateQuery = `
            UPDATE leave_requests
            SET status = $1,
                hr_admin_user_id = $2,
                branch_manager_id = $3,
                escalated_at = CURRENT_TIMESTAMP,
                team_lead_action = 'ESCALATED',
                team_lead_action_at = CURRENT_TIMESTAMP,
                team_lead_comment = COALESCE($4, team_lead_comment),
                due_at = NULL,
                overdue_notified = FALSE
            WHERE id = $5
            RETURNING *
        `;

        const updateResult = await pool.query(updateQuery, [
            LEAVE_STATUSES.PENDING_DIRECTOR,
            hrUserIdNumber,
            director.id, // Lưu ID giám đốc vào branch_manager_id để tương thích
            comment || null,
            id
        ]);

        const updatedRequest = mapLeaveRequestRow(await fetchLeaveRequestById(id));

        // Notification system removed

        res.json({
            success: true,
            message: 'Đơn đã được đẩy lên giám đốc',
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
                // Quy trình mới: Quản lý trực tiếp duyệt -> APPROVED (không qua quản lý gián tiếp)
                const updateQuery = `
                    UPDATE leave_requests
                    SET status = $1,
                        team_lead_action = 'APPROVED',
                        team_lead_action_at = $2,
                        team_lead_comment = $3,
                        due_at = NULL,
                        overdue_notified = FALSE
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

                // Notification system removed
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

                // Notification system removed
            }
        } else if (actorType === ACTOR_TYPES.DIRECTOR) {
            // Giám đốc duyệt đơn được HR đẩy lên
            if (!leaveRequest.branch_manager_id || leaveRequest.branch_manager_id !== actorIdNumber) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền xử lý đơn này'
                });
            }

            if (leaveRequest.status !== LEAVE_STATUSES.PENDING_DIRECTOR) {
                return res.status(400).json({
                    success: false,
                    message: 'Đơn không còn ở bước chờ giám đốc duyệt'
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

                // Notification system removed
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

                // Notification system removed
            }
        }
        // Bỏ logic xử lý quản lý gián tiếp (BRANCH actor) - quy trình mới không có bước này

        if (!updatedRequest) {
            return res.status(400).json({
                success: false,
                message: 'Loại người duyệt không hợp lệ hoặc không được hỗ trợ'
            });
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

