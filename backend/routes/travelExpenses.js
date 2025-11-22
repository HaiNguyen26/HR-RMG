const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const ensureTable = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS travel_expense_requests (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            title TEXT,
            purpose TEXT,
            location TEXT NOT NULL,
            location_type VARCHAR(20) NOT NULL,
            start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            end_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            is_overnight BOOLEAN NOT NULL DEFAULT FALSE,
            requires_ceo BOOLEAN NOT NULL DEFAULT FALSE,
            status VARCHAR(40) NOT NULL DEFAULT 'PENDING_LEVEL_1',
            current_step VARCHAR(40) NOT NULL DEFAULT 'LEVEL_1',
            estimated_cost NUMERIC(12, 2),
            requested_by INTEGER,
            manager_id INTEGER,
            manager_decision VARCHAR(20),
            manager_notes TEXT,
            manager_decision_at TIMESTAMP WITHOUT TIME ZONE,
            ceo_id INTEGER,
            ceo_decision VARCHAR(20),
            ceo_notes TEXT,
            ceo_decision_at TIMESTAMP WITHOUT TIME ZONE,
            finance_id INTEGER,
            finance_decision VARCHAR(20),
            finance_notes TEXT,
            finance_decision_at TIMESTAMP WITHOUT TIME ZONE,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createStatusIndex = `
        CREATE INDEX IF NOT EXISTS idx_travel_expense_status ON travel_expense_requests(status);
    `;

    const createEmployeeIndex = `
        CREATE INDEX IF NOT EXISTS idx_travel_expense_employee ON travel_expense_requests(employee_id);
    `;

    await pool.query(createTableQuery);
    await pool.query(createStatusIndex);
    await pool.query(createEmployeeIndex);
};

ensureTable().catch((error) => {
    console.error('Error ensuring travel_expense_requests table:', error);
});

const VIETNAMESE_PROVINCES = [
    'ha noi', 'ho chi minh', 'hai phong', 'da nang', 'can tho', 'an giang', 'ba ria vung tau',
    'bac giang', 'bac kan', 'bac lieu', 'bac ninh', 'ben tre', 'binh dinh', 'binh duong',
    'binh phuoc', 'binh thuan', 'ca mau', 'cao bang', 'dak lak', 'dak nong', 'dien bien',
    'dong nai', 'dong thap', 'gia lai', 'ha giang', 'ha nam', 'ha tinh', 'hai duong',
    'hau giang', 'hoa binh', 'hung yen', 'khánh hoà', 'khanh hoa', 'kien giang', 'kon tum',
    'lai chau', 'lang son', 'lao cai', 'lam dong', 'long an', 'nam dinh', 'nghe an',
    'ninh binh', 'ninh thuan', 'phu tho', 'phu yen', 'quang binh', 'quang nam', 'quang ngai',
    'quang ninh', 'quang tri', 'soc trang', 'son la', 'tay ninh', 'thai binh', 'thai nguyen',
    'thanh hoa', 'thua thien hue', 'tien giang', 'tra vinh', 'tuyen quang', 'vinh long',
    'vinh phuc', 'yen bai', 'binh duong', 'binh dinh', 'gia lai', 'daklak', 'daklak', 'daknong',
    'haiduong', 'langson', 'haiduong', 'hoabinh'
];

const normalizeText = (value = '') => {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

const detectLocationTypeFromText = (location) => {
    const normalizedLocation = normalizeText(location);
    if (!normalizedLocation) return null;

    for (const province of VIETNAMESE_PROVINCES) {
        if (normalizedLocation.includes(province)) {
            return 'DOMESTIC';
        }
    }
    return 'INTERNATIONAL';
};

const normalizeLocationType = (value, location) => {
    if (!value) return null;
    const normalized = value.toString().trim().toUpperCase();
    if (['DOMESTIC', 'TRONG_NUOC', 'LOCAL', 'VN'].includes(normalized)) {
        return 'DOMESTIC';
    }
    if (['INTERNATIONAL', 'NUOC_NGOAI', 'ABROAD', 'GLOBAL'].includes(normalized)) {
        return 'INTERNATIONAL';
    }
    const detected = detectLocationTypeFromText(location);
    return detected || null;
};

const mapRowToResponse = (row) => {
    if (!row) return null;

    const flow = [
        {
            key: 'STEP_EMPLOYEE',
            order: 1,
            actor: 'Nhân viên',
            action: 'Gửi yêu cầu Công tác',
            status: 'COMPLETED',
            decision: 'APPROVED',
            decidedAt: row.created_at,
        },
        {
            key: 'STEP_MANAGER',
            order: 2,
            actor: 'Quản lý Trực tiếp',
            action: 'Phê duyệt Cấp 1',
            status: row.manager_decision
                ? row.manager_decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
                : row.status === 'PENDING_LEVEL_1' ? 'PENDING' : row.status === 'REJECTED' ? 'REJECTED' : 'COMPLETED',
            decision: row.manager_decision,
            decidedAt: row.manager_decision_at,
            notes: row.manager_notes,
        },
    ];

    if (row.requires_ceo) {
        flow.push({
            key: 'STEP_CEO',
            order: 3,
            actor: 'Tổng Giám đốc',
            action: 'Phê duyệt Cấp 2 bắt buộc',
            status: row.ceo_decision
                ? row.ceo_decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
                : row.status === 'PENDING_CEO'
                    ? 'PENDING'
                    : row.manager_decision === 'REJECT'
                        ? 'REJECTED'
                        : row.status === 'REJECTED'
                            ? 'REJECTED'
                            : row.status === 'PENDING_FINANCE'
                                ? 'COMPLETED'
                                : 'PENDING',
            decision: row.ceo_decision,
            decidedAt: row.ceo_decision_at,
            notes: row.ceo_notes,
        });
    }

    flow.push({
        key: 'STEP_FINANCE',
        order: row.requires_ceo ? 4 : 3,
        actor: 'Kế toán / HR',
        action: 'Kiểm tra & Duyệt chi phí cuối',
        status: row.finance_decision
            ? row.finance_decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
            : row.status === 'PENDING_FINANCE'
                ? 'PENDING'
                : row.status === 'APPROVED'
                    ? 'APPROVED'
                    : row.status === 'REJECTED'
                        ? 'REJECTED'
                        : row.requires_ceo && row.ceo_decision !== 'APPROVE'
                            ? 'PENDING'
                            : 'PENDING',
        decision: row.finance_decision,
        decidedAt: row.finance_decision_at,
        notes: row.finance_notes,
    });

    return {
        id: row.id,
        employeeId: row.employee_id,
        title: row.title,
        purpose: row.purpose,
        location: row.location,
        locationType: row.location_type,
        startTime: row.start_time,
        endTime: row.end_time,
        isOvernight: row.is_overnight,
        requiresCEO: row.requires_ceo,
        status: row.status,
        currentStep: row.current_step,
        estimatedCost: row.estimated_cost ? Number(row.estimated_cost) : null,
        requestedBy: row.requested_by,
        decisions: {
            manager: {
                actorId: row.manager_id,
                decision: row.manager_decision,
                notes: row.manager_notes,
                decidedAt: row.manager_decision_at,
            },
            ceo: {
                actorId: row.ceo_id,
                decision: row.ceo_decision,
                notes: row.ceo_notes,
                decidedAt: row.ceo_decision_at,
            },
            finance: {
                actorId: row.finance_id,
                decision: row.finance_decision,
                notes: row.finance_notes,
                decidedAt: row.finance_decision_at,
            },
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        approvalFlow: flow,
    };
};

router.get('/', async (req, res) => {
    try {
        const { employeeId, status } = req.query;
        const params = [];
        const conditions = [];

        if (employeeId) {
            params.push(employeeId);
            conditions.push(`employee_id = $${params.length}`);
        }

        if (status) {
            params.push(status);
            conditions.push(`status = $${params.length}`);
        }

        const query = `
            SELECT *
            FROM travel_expense_requests
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            message: 'Danh sách yêu cầu chi phí công tác',
            data: result.rows.map(mapRowToResponse),
        });
    } catch (error) {
        console.error('Error fetching travel expenses:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách chi phí công tác: ' + error.message,
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM travel_expense_requests WHERE id = $1', [id]);

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu chi phí công tác',
            });
        }

        res.json({
            success: true,
            message: 'Chi tiết yêu cầu chi phí công tác',
            data: mapRowToResponse(result.rows[0]),
        });
    } catch (error) {
        console.error('Error fetching travel expense request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy chi tiết chi phí công tác: ' + error.message,
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const {
            employeeId,
            title,
            purpose,
            location,
            locationType,
            startTime,
            endTime,
            estimatedCost,
            requestedBy,
        } = req.body;

        if (!employeeId || !location || !locationType || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc (employeeId, location, locationType, thời gian)',
            });
        }

        const normalizedLocationType =
            normalizeLocationType(locationType, location) || detectLocationTypeFromText(location) || 'DOMESTIC';

        if (!normalizedLocationType) {
            return res.status(400).json({
                success: false,
                message: 'Loại địa điểm không hợp lệ. Hãy chọn Trong nước hoặc Nước ngoài.',
            });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Thời gian không hợp lệ',
            });
        }

        if (end <= start) {
            return res.status(400).json({
                success: false,
                message: 'Thời gian kết thúc phải lớn hơn thời gian bắt đầu',
            });
        }

        const isOvernight = end.getTime() - start.getTime() > DAY_IN_MS;
        const requiresCEO = normalizedLocationType === 'INTERNATIONAL';
        const initialStatus = 'PENDING_LEVEL_1';
        const initialStep = 'LEVEL_1';

        const insertQuery = `
            INSERT INTO travel_expense_requests (
                employee_id,
                title,
                purpose,
                location,
                location_type,
                start_time,
                end_time,
                is_overnight,
                requires_ceo,
                status,
                current_step,
                estimated_cost,
                requested_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;

        const values = [
            employeeId,
            title || null,
            purpose || null,
            location,
            normalizedLocationType,
            start.toISOString(),
            end.toISOString(),
            isOvernight,
            requiresCEO,
            initialStatus,
            initialStep,
            estimatedCost !== undefined && estimatedCost !== null ? estimatedCost : null,
            requestedBy || null,
        ];

        const result = await pool.query(insertQuery, values);
        const created = mapRowToResponse(result.rows[0]);

        res.status(201).json({
            success: true,
            message: 'Đã tạo yêu cầu chi phí công tác',
            data: created,
        });
    } catch (error) {
        console.error('Error creating travel expense request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo yêu cầu chi phí công tác: ' + error.message,
        });
    }
});

router.post('/:id/decision', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { actorRole, actorId, decision, notes } = req.body;

        if (!actorRole || !decision) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin actorRole hoặc decision',
            });
        }

        const normalizedDecision = decision.toString().trim().toUpperCase();
        if (!['APPROVE', 'REJECT'].includes(normalizedDecision)) {
            return res.status(400).json({
                success: false,
                message: 'Quyết định không hợp lệ (APPROVE hoặc REJECT)',
            });
        }

        const normalizedRole = actorRole.toString().trim().toUpperCase();
        if (!['MANAGER', 'CEO', 'FINANCE'].includes(normalizedRole)) {
            return res.status(400).json({
                success: false,
                message: 'actorRole không hợp lệ. Hãy sử dụng MANAGER, CEO hoặc FINANCE',
            });
        }

        await client.query('BEGIN');
        const requestResult = await client.query('SELECT * FROM travel_expense_requests WHERE id = $1 FOR UPDATE', [id]);

        if (!requestResult.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu chi phí công tác',
            });
        }

        const request = requestResult.rows[0];
        let nextStatus = request.status;
        let nextStep = request.current_step;

        const timestamp = new Date().toISOString();

        const setFields = ['updated_at = $1'];
        const setValues = [timestamp];
        let setIndex = 2;

        const applyDecision = (fieldPrefix) => {
            setFields.push(`${fieldPrefix}_decision = $${setIndex++}`);
            setValues.push(normalizedDecision);
            setFields.push(`${fieldPrefix}_decision_at = $${setIndex++}`);
            setValues.push(timestamp);
            setFields.push(`${fieldPrefix}_notes = $${setIndex++}`);
            setValues.push(notes || null);
            setFields.push(`${fieldPrefix}_id = $${setIndex++}`);
            setValues.push(actorId || null);
        };

        if (normalizedRole === 'MANAGER') {
            if (request.status !== 'PENDING_LEVEL_1') {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: 'Yêu cầu không nằm trong bước phê duyệt của Quản lý',
                });
            }
            applyDecision('manager');

            if (normalizedDecision === 'APPROVE') {
                if (request.requires_ceo) {
                    nextStatus = 'PENDING_CEO';
                    nextStep = 'CEO';
                } else {
                    nextStatus = 'PENDING_FINANCE';
                    nextStep = 'FINANCE';
                }
            } else {
                nextStatus = 'REJECTED';
                nextStep = 'MANAGER';
            }
        } else if (normalizedRole === 'CEO') {
            if (!request.requires_ceo) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: 'Yêu cầu này không yêu cầu phê duyệt bởi Tổng Giám đốc',
                });
            }
            if (request.status !== 'PENDING_CEO') {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: 'Yêu cầu không nằm trong bước phê duyệt của Tổng Giám đốc',
                });
            }
            applyDecision('ceo');

            if (normalizedDecision === 'APPROVE') {
                nextStatus = 'PENDING_FINANCE';
                nextStep = 'FINANCE';
            } else {
                nextStatus = 'REJECTED';
                nextStep = 'CEO';
            }
        } else if (normalizedRole === 'FINANCE') {
            if (!['PENDING_FINANCE', 'APPROVED', 'REJECTED'].includes(request.status)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: 'Yêu cầu không nằm trong bước phê duyệt của Kế toán/HR',
                });
            }
            if (request.status !== 'PENDING_FINANCE') {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: 'Chỉ có thể xử lý khi yêu cầu đang chờ Kế toán/HR',
                });
            }
            applyDecision('finance');

            if (normalizedDecision === 'APPROVE') {
                nextStatus = 'APPROVED';
                nextStep = 'COMPLETED';
            } else {
                nextStatus = 'REJECTED';
                nextStep = 'FINANCE';
            }
        }

        setFields.push(`status = $${setIndex++}`);
        setValues.push(nextStatus);
        setFields.push(`current_step = $${setIndex++}`);
        setValues.push(nextStep);
        setValues.push(id);

        const updateQuery = `
            UPDATE travel_expense_requests
            SET ${setFields.join(', ')}
            WHERE id = $${setIndex}
            RETURNING *
        `;

        const updateResult = await client.query(updateQuery, setValues);
        const updatedRequest = updateResult.rows[0];

        await client.query('COMMIT');

        // Send real-time SSE notifications after commit
        try {
            // Get employee ID to send notification
            const employeeId = updatedRequest.employee_id;

            // Get HR users for notifications
            const hrResult = await pool.query(
                `SELECT id FROM users 
                 WHERE UPPER(role) = 'HR' 
                 AND (trang_thai = 'ACTIVE' OR trang_thai IS NULL)`
            );
            const hrUserIds = hrResult.rows.map(row => row.id);

            // Get employee user ID if exists
            let employeeUserIds = [];
            if (employeeId) {
                const employeeUserResult = await pool.query(
                    `SELECT DISTINCT u.id 
                     FROM users u
                     INNER JOIN employees e ON u.email = e.email OR u.ho_ten = e.ho_ten
                     WHERE e.id = $1`,
                    [employeeId]
                );
                employeeUserIds = employeeUserResult.rows.map(row => row.id);
            }

            // Notification system removed
        } catch (sseError) {
            console.error('[Travel Expense Decision] SSE Error:', sseError);
            // Don't fail the main request if SSE fails
        }

        res.json({
            success: true,
            message: 'Đã cập nhật phê duyệt chi phí công tác',
            data: mapRowToResponse(updatedRequest),
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating travel expense decision:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật phê duyệt chi phí công tác: ' + error.message,
        });
    } finally {
        client.release();
    }
});

module.exports = router;


