const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/equipment?employee_id=1 - Lấy danh sách vật dụng của nhân viên
 */
router.get('/', async (req, res) => {
    try {
        const { employee_id } = req.query;
        
        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu employee_id'
            });
        }
        
        const query = `
            SELECT 
                id,
                employee_id,
                phong_ban,
                ten_vat_dung,
                so_luong,
                trang_thai,
                ngay_phan_cong,
                ngay_tra,
                ghi_chu,
                created_at
            FROM equipment_assignments 
            WHERE employee_id = $1
            ORDER BY created_at DESC
        `;
        
        const result = await pool.query(query, [employee_id]);
        
        res.json({
            success: true,
            message: 'Danh sách vật dụng',
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách vật dụng: ' + error.message
        });
    }
});

/**
 * POST /api/equipment - Thêm vật dụng cho nhân viên
 */
router.post('/', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { employeeId, phongBan, equipmentList } = req.body;
        
        // Validate input
        if (!employeeId || !phongBan || !equipmentList || !Array.isArray(equipmentList)) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc'
            });
        }
        
        // Validate phong_ban
        const validPhongBan = ['IT', 'HR', 'ACCOUNTING', 'OTHER'];
        if (!validPhongBan.includes(phongBan)) {
            return res.status(400).json({
                success: false,
                message: 'Phòng ban không hợp lệ'
            });
        }
        
        await client.query('BEGIN');
        
        // Check employee exists
        const checkEmployeeQuery = 'SELECT id FROM employees WHERE id = $1';
        const checkEmployeeResult = await client.query(checkEmployeeQuery, [employeeId]);
        
        if (checkEmployeeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Nhân viên không tồn tại'
            });
        }
        
        // Insert từng vật dụng
        const insertQuery = `
            INSERT INTO equipment_assignments (
                employee_id,
                phong_ban,
                ten_vat_dung,
                so_luong,
                trang_thai
            ) VALUES ($1, $2, $3, $4, 'PENDING')
            RETURNING id
        `;
        
        const insertedIds = [];
        
        for (const equipment of equipmentList) {
            if (equipment.tenVatDung && equipment.tenVatDung.trim() !== '') {
                const result = await client.query(insertQuery, [
                    employeeId,
                    phongBan,
                    equipment.tenVatDung,
                    equipment.soLuong || 1
                ]);
                insertedIds.push(result.rows[0].id);
            }
        }
        
        await client.query('COMMIT');
        
        res.status(201).json({
            success: true,
            message: 'Thêm vật dụng thành công',
            data: {
                inserted_ids: insertedIds
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating equipment:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm vật dụng: ' + error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router;
