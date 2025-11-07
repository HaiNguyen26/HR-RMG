const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/statistics - Lấy thống kê tỷ lệ nhân viên và các thống kê khác
 */
router.get('/', async (req, res) => {
    try {
        // Tổng số nhân viên (đếm tất cả bản ghi)
        const totalQuery = 'SELECT COUNT(*)::INTEGER AS total FROM employees';
        const totalResult = await pool.query(totalQuery);
        const total = totalResult.rows[0]?.total || 0;

        // Tỷ lệ theo phòng ban tính trên tổng bản ghi
        const ratioQuery = `
      SELECT phong_ban AS "phongBan", COUNT(*)::INTEGER AS "soLuong"
      FROM employees
      GROUP BY phong_ban
      ORDER BY "soLuong" DESC
    `;

        const ratioResult = await pool.query(ratioQuery);

        const tyLeTheoPhongBan = ratioResult.rows.map((row) => ({
            phongBan: row.phongBan,
            soLuong: row.soLuong,
            tyLe: total > 0 ? Math.round((row.soLuong * 100) / total) : 0,
        }));

        const statistics = {
            tongNhanVien: total,
            tyLeTheoPhongBan,
            donNghiPhep: 0,
            donNghiViec: 0,
            offboarding: 0,
            nghiPhepConLai: 0,
            donDaDuyet: 0,
            choDuyet: 0,
            tyLeNghiPhep: 0,
        };

        res.json({
            success: true,
            message: 'Thống kê nhân viên',
            data: statistics,
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thống kê: ' + error.message,
        });
    }
});

module.exports = router;
