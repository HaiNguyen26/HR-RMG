const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/notifications - Lấy danh sách notifications của user
 * Query params:
 *   - userId: ID của user (bắt buộc)
 *   - isRead: Lọc theo đã đọc/chưa đọc (true/false)
 *   - limit: Giới hạn số lượng (mặc định: 50)
 */
router.get('/', async (req, res) => {
    try {
        const { userId, isRead, limit = 50 } = req.query;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu userId'
            });
        }
        
        let query = `
            SELECT 
                n.*,
                r.title as request_title,
                r.status as request_status,
                r.target_department as request_department
            FROM notifications n
            LEFT JOIN requests r ON n.request_id = r.id
            LEFT JOIN employees e ON r.employee_id = e.id
            WHERE n.user_id = $1
            AND (r.id IS NULL OR (e.id IS NOT NULL AND (e.trang_thai = 'ACTIVE' OR e.trang_thai IS NULL)))
        `;
        
        const params = [userId];
        let paramIndex = 2;
        
        if (isRead !== undefined) {
            query += ` AND n.is_read = $${paramIndex}`;
            params.push(isRead === 'true');
            paramIndex++;
        }
        
        query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit));
        
        const result = await pool.query(query, params);
        
        // Đếm số thông báo chưa đọc (chỉ đếm notifications của requests có employee còn tồn tại)
        const unreadCountQuery = `
            SELECT COUNT(*) as count 
            FROM notifications n
            LEFT JOIN requests r ON n.request_id = r.id
            LEFT JOIN employees e ON r.employee_id = e.id
            WHERE n.user_id = $1 
            AND n.is_read = FALSE
            AND (r.id IS NULL OR e.id IS NOT NULL)
        `;
        const unreadCountResult = await pool.query(unreadCountQuery, [userId]);
        
        res.json({
            success: true,
            message: 'Danh sách thông báo',
            data: result.rows,
            unreadCount: parseInt(unreadCountResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách thông báo: ' + error.message
        });
    }
});

/**
 * GET /api/notifications/unread-count/:userId - Lấy số lượng thông báo chưa đọc
 */
router.get('/unread-count/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Chỉ đếm notifications của requests có employee còn tồn tại
        const query = `
            SELECT COUNT(*) as count 
            FROM notifications n
            LEFT JOIN requests r ON n.request_id = r.id
            LEFT JOIN employees e ON r.employee_id = e.id
            WHERE n.user_id = $1 
            AND n.is_read = FALSE
            AND (r.id IS NULL OR e.id IS NOT NULL)
        `;
        const result = await pool.query(query, [userId]);
        
        res.json({
            success: true,
            message: 'Số lượng thông báo chưa đọc',
            count: parseInt(result.rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy số lượng thông báo: ' + error.message
        });
    }
});

/**
 * PUT /api/notifications/:id/read - Đánh dấu thông báo đã đọc
 */
router.put('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            UPDATE notifications
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;
        
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông báo'
            });
        }
        
        res.json({
            success: true,
            message: 'Thông báo đã được đánh dấu đã đọc',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đánh dấu thông báo: ' + error.message
        });
    }
});

/**
 * PUT /api/notifications/read-all/:userId - Đánh dấu tất cả thông báo đã đọc
 */
router.put('/read-all/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const query = `
            UPDATE notifications
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND is_read = FALSE
            RETURNING COUNT(*)
        `;
        
        const result = await pool.query(query, [userId]);
        
        res.json({
            success: true,
            message: 'Tất cả thông báo đã được đánh dấu đã đọc',
            count: result.rowCount
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đánh dấu thông báo: ' + error.message
        });
    }
});

/**
 * DELETE /api/notifications/:id - Xóa thông báo
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `DELETE FROM notifications WHERE id = $1 RETURNING *`;
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông báo'
            });
        }
        
        res.json({
            success: true,
            message: 'Thông báo đã được xóa',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa thông báo: ' + error.message
        });
    }
});

module.exports = router;

