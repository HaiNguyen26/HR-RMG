const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const normalizeDepartment = (value) => {
    if (!value) return null;
    return value.toString().trim().toUpperCase();
};

const findDepartmentEmployeeIds = async (department) => {
    const normalized = normalizeDepartment(department);
    if (!normalized) return [];

    const result = await pool.query(
        `SELECT id
         FROM employees
         WHERE (trang_thai = 'ACTIVE' OR trang_thai IS NULL)
           AND (
                UPPER(COALESCE(phong_ban, '')) = $1
             OR UPPER(COALESCE(bo_phan, '')) = $1
           )`
        , [normalized]
    );

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

/**
 * GET /api/requests - Lấy danh sách requests
 * Query params:
 *   - targetDepartment: Lọc theo phòng ban (IT, HR, ACCOUNTING)
 *   - status: Lọc theo trạng thái (PENDING, APPROVED, IN_PROGRESS, COMPLETED, REJECTED)
 *   - userId: Lọc theo user (cho notifications)
 */
router.get('/', async (req, res) => {
    try {
        const { targetDepartment, status, userId, employeeId } = req.query;

        // Clean up orphaned requests (requests without valid employees or employees with INACTIVE status) before fetching
        // Xóa notifications và request_items trước, sau đó mới xóa requests
        const orphanedRequestIds = await pool.query(`
            SELECT id FROM requests 
            WHERE employee_id IS NULL 
            OR employee_id NOT IN (SELECT id FROM employees WHERE trang_thai = 'ACTIVE' OR trang_thai IS NULL)
        `);

        if (orphanedRequestIds.rows.length > 0) {
            const orphanedIds = orphanedRequestIds.rows.map(row => row.id);

            // Delete notifications
            await pool.query('DELETE FROM notifications WHERE request_id = ANY($1::int[])', [orphanedIds]);

            // Delete request_items
            await pool.query('DELETE FROM request_items WHERE request_id = ANY($1::int[])', [orphanedIds]);

            // Delete requests
            await pool.query('DELETE FROM requests WHERE id = ANY($1::int[])', [orphanedIds]);

            console.log(`✅ Cleaned up ${orphanedIds.length} orphaned requests`);
        }

        let query = `
            SELECT 
                r.*,
                e.ho_ten as employee_name,
                e.email as employee_email,
                e.ma_nhan_vien,
                u1.ho_ten as requested_by_name,
                u2.ho_ten as assigned_to_name,
                (SELECT json_agg(json_build_object(
                    'id', ri.id,
                    'item_name', ri.item_name,
                    'quantity', ri.quantity,
                    'quantity_provided', ri.quantity_provided,
                    'status', ri.status,
                    'notes', ri.notes,
                    'provided_by', ri.provided_by,
                    'provided_at', ri.provided_at,
                    'provided_by_name', u3.ho_ten
                ) ORDER BY ri.id) 
                FROM request_items ri
                LEFT JOIN users u3 ON ri.provided_by = u3.id
                WHERE ri.request_id = r.id) as items_detail
            FROM requests r
            INNER JOIN employees e ON r.employee_id = e.id
            LEFT JOIN users u1 ON r.requested_by = u1.id
            LEFT JOIN users u2 ON r.assigned_to = u2.id
            WHERE (e.trang_thai = 'ACTIVE' OR e.trang_thai IS NULL)
        `;

        const params = [];
        let paramIndex = 1;

        if (targetDepartment) {
            query += ` AND r.target_department = $${paramIndex}`;
            params.push(targetDepartment);
            paramIndex++;
        }

        if (status) {
            query += ` AND r.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (employeeId) {
            query += ` AND r.employee_id = $${paramIndex}`;
            params.push(employeeId);
            paramIndex++;
        }

        query += ` ORDER BY r.created_at DESC`;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            message: 'Danh sách yêu cầu',
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách yêu cầu: ' + error.message
        });
    }
});

/**
 * GET /api/requests/:id - Lấy chi tiết request
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                r.*,
                e.ho_ten as employee_name,
                e.email as employee_email,
                e.ma_nhan_vien,
                e.chuc_danh,
                e.phong_ban as employee_department,
                u1.ho_ten as requested_by_name,
                u1.username as requested_by_username,
                u2.ho_ten as assigned_to_name,
                u2.username as assigned_to_username,
                (SELECT json_agg(json_build_object(
                    'id', ri.id,
                    'item_name', ri.item_name,
                    'quantity', ri.quantity,
                    'quantity_provided', ri.quantity_provided,
                    'status', ri.status,
                    'notes', ri.notes,
                    'provided_by', ri.provided_by,
                    'provided_at', ri.provided_at,
                    'provided_by_name', u3.ho_ten
                ) ORDER BY ri.id) 
                FROM request_items ri
                LEFT JOIN users u3 ON ri.provided_by = u3.id
                WHERE ri.request_id = r.id) as items_detail
            FROM requests r
            INNER JOIN employees e ON r.employee_id = e.id
            LEFT JOIN users u1 ON r.requested_by = u1.id
            LEFT JOIN users u2 ON r.assigned_to = u2.id
            WHERE r.id = $1
            AND (e.trang_thai = 'ACTIVE' OR e.trang_thai IS NULL)
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu hoặc nhân viên đã bị xóa'
            });
        }

        res.json({
            success: true,
            message: 'Chi tiết yêu cầu',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy chi tiết yêu cầu: ' + error.message
        });
    }
});

/**
 * POST /api/requests - Tạo request mới
 */
router.post('/', async (req, res) => {
    try {
        const {
            employeeId,
            requestType,
            targetDepartment,
            title,
            description,
            items,
            priority,
            requestedBy
        } = req.body;

        // Validate
        if (!employeeId || !requestType || !targetDepartment || !title) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc'
            });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Tạo request
            const requestQuery = `
                INSERT INTO requests (
                    employee_id,
                    request_type,
                    target_department,
                    title,
                    description,
                    items,
                    priority,
                    requested_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;

            const requestValues = [
                employeeId,
                requestType,
                targetDepartment,
                title,
                description || null,
                items ? JSON.stringify(items) : null,
                priority || 'NORMAL',
                requestedBy || null
            ];

            const requestResult = await client.query(requestQuery, requestValues);
            const requestId = requestResult.rows[0].id;

            // Tạo request_items nếu có items
            if (items && Array.isArray(items) && items.length > 0) {
                for (const item of items) {
                    const itemName = typeof item === 'string' ? item : (item.name || item.tenVatDung || '');
                    const itemQuantity = typeof item === 'object' ? (item.quantity || 1) : 1;

                    if (itemName) {
                        await client.query(`
                            INSERT INTO request_items (request_id, item_name, quantity)
                            VALUES ($1, $2, $3)
                        `, [requestId, itemName, itemQuantity]);
                    }
                }
            }

            await client.query('COMMIT');

            // Lấy lại request với items
            const fullRequestResult = await client.query(`
                SELECT r.*, 
                    (SELECT json_agg(json_build_object(
                        'id', ri.id,
                        'item_name', ri.item_name,
                        'quantity', ri.quantity,
                        'quantity_provided', ri.quantity_provided,
                        'status', ri.status
                    )) FROM request_items ri WHERE ri.request_id = r.id) as items_detail
                FROM requests r
                WHERE r.id = $1
            `, [requestId]);

            const createdRequest = fullRequestResult.rows[0];
            // Notification system removed
            // Trigger sẽ tự động tạo notifications
            res.status(201).json({
                success: true,
                message: 'Yêu cầu đã được tạo thành công',
                data: createdRequest
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo yêu cầu: ' + error.message
        });
    }
});

/**
 * PUT /api/requests/:id - Cập nhật request
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            status,
            assignedTo,
            notes,
            priority
        } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        let statusChanged = false;

        if (status) {
            // Nếu muốn set status = COMPLETED, kiểm tra xem tất cả items đã đủ chưa
            if (status === 'COMPLETED') {
                // Kiểm tra tất cả items đã được cung cấp đủ chưa
                const itemsCheck = await pool.query(`
                    SELECT 
                        COUNT(*) as total_items,
                        COUNT(CASE WHEN quantity_provided >= quantity AND quantity > 0 THEN 1 END) as completed_items
                    FROM request_items
                    WHERE request_id = $1
                `, [id]);

                const itemsResult = itemsCheck.rows[0];
                const totalItems = parseInt(itemsResult.total_items) || 0;
                const completedItems = parseInt(itemsResult.completed_items) || 0;

                if (totalItems === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Yêu cầu này không có vật dụng nào để hoàn thành'
                    });
                }

                if (completedItems < totalItems) {
                    return res.status(400).json({
                        success: false,
                        message: `Không thể hoàn thành yêu cầu. Chỉ có ${completedItems}/${totalItems} vật dụng được cung cấp đủ. Yêu cầu sẽ trở về trạng thái PENDING.`
                    });
                }

                updates.push(`completed_at = CURRENT_TIMESTAMP`);
            }

            updates.push(`status = $${paramIndex}`);
            values.push(status);
            paramIndex++;
            statusChanged = true;
        }

        if (assignedTo !== undefined) {
            updates.push(`assigned_to = $${paramIndex}`);
            values.push(assignedTo);
            paramIndex++;
        }

        if (notes !== undefined) {
            updates.push(`notes = $${paramIndex}`);
            values.push(notes);
            paramIndex++;
        }

        if (priority) {
            updates.push(`priority = $${paramIndex}`);
            values.push(priority);
            paramIndex++;
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không có thông tin cần cập nhật'
            });
        }

        values.push(id);
        const query = `
            UPDATE requests
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu'
            });
        }

        const updatedRequest = result.rows[0];
        // Notification system removed
        // Trigger sẽ tự động tạo notifications
        res.json({
            success: true,
            message: 'Yêu cầu đã được cập nhật',
            data: updatedRequest
        });
    } catch (error) {
        console.error('Error updating request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật yêu cầu: ' + error.message
        });
    }
});

/**
 * DELETE /api/requests/:id - Xóa request (soft delete - chỉ HR/ADMIN)
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Chỉ cho phép xóa nếu status là PENDING
        const checkQuery = `SELECT status FROM requests WHERE id = $1`;
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu'
            });
        }

        if (checkResult.rows[0].status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể xóa yêu cầu ở trạng thái PENDING'
            });
        }

        const deleteQuery = `DELETE FROM requests WHERE id = $1 RETURNING *`;
        const result = await pool.query(deleteQuery, [id]);

        res.json({
            success: true,
            message: 'Yêu cầu đã được xóa',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa yêu cầu: ' + error.message
        });
    }
});

/**
 * GET /api/requests/stats/:department - Lấy thống kê requests theo phòng ban
 */
router.get('/stats/:department', async (req, res) => {
    try {
        const { department } = req.params;

        const query = `
            SELECT 
                status,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as count_last_7_days,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as count_last_30_days
            FROM requests
            WHERE target_department = $1
            GROUP BY status
        `;

        const result = await pool.query(query, [department]);

        res.json({
            success: true,
            message: 'Thống kê yêu cầu',
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching request stats:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thống kê: ' + error.message
        });
    }
});

/**
 * PUT /api/requests/:id/items/:itemId - Cập nhật số lượng đã cung cấp cho item
 */
router.put('/:id/items/:itemId', async (req, res) => {
    try {
        const { id, itemId } = req.params;
        const { quantityProvided, notes, providedBy } = req.body;

        if (quantityProvided === undefined || quantityProvided === null) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu số lượng đã cung cấp'
            });
        }

        // Kiểm tra request có tồn tại không
        const requestCheck = await pool.query('SELECT id FROM requests WHERE id = $1', [id]);
        if (requestCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu'
            });
        }

        // Kiểm tra item có tồn tại không
        const itemCheck = await pool.query(
            'SELECT id, quantity FROM request_items WHERE id = $1 AND request_id = $2',
            [itemId, id]
        );

        if (itemCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy item'
            });
        }

        const itemQuantity = itemCheck.rows[0].quantity;
        const providedQty = parseInt(quantityProvided) || 0;

        // Xác định status của item dựa trên quantity_provided
        let itemStatus = 'PENDING';
        if (providedQty >= itemQuantity && itemQuantity > 0) {
            itemStatus = 'COMPLETED';
        } else if (providedQty > 0 && providedQty < itemQuantity) {
            itemStatus = 'PARTIAL';
        } else if (providedQty === 0) {
            itemStatus = 'PENDING'; // Reset về PENDING nếu chưa cung cấp
        }

        // Cập nhật item
        const updateQuery = `
            UPDATE request_items
            SET quantity_provided = $1,
                status = $2,
                notes = $3,
                provided_by = $4,
                provided_at = CASE 
                    WHEN $1 > 0 AND provided_at IS NULL THEN CURRENT_TIMESTAMP
                    ELSE provided_at
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5 AND request_id = $6
            RETURNING *
        `;

        const result = await pool.query(updateQuery, [
            providedQty,
            itemStatus,
            notes || null,
            providedBy || null,
            itemId,
            id
        ]);

        const updatedItem = result.rows[0];
        if (updatedItem) {
            // Notification system removed
        }
        // Trigger sẽ tự động cập nhật status của request và tạo notifications

        res.json({
            success: true,
            message: 'Đã cập nhật số lượng cung cấp',
            data: updatedItem
        });
    } catch (error) {
        console.error('Error updating request item:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật item: ' + error.message
        });
    }
});

module.exports = router;

