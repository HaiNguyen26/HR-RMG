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

        // Use try-catch for each query to prevent one failure from breaking all statistics
        let leaveStatsResult = { rows: [{}] };
        let overtimeStatsResult = { rows: [{}] };
        let attendanceStatsResult = { rows: [{}] };
        let pendingCandidatesResult = { rows: [{ count: 0 }] };

        const leaveStatsQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE request_type = 'LEAVE')::INTEGER AS total_leave,
                COUNT(*) FILTER (WHERE request_type = 'RESIGN')::INTEGER AS total_resign,
                COUNT(*) FILTER (WHERE status = 'APPROVED' AND request_type = 'LEAVE')::INTEGER AS approved_leave,
                COUNT(*) FILTER (WHERE status = 'APPROVED' AND request_type = 'RESIGN')::INTEGER AS approved_resign,
                COUNT(*) FILTER (WHERE status = 'PENDING_TEAM_LEAD' OR status = 'PENDING_BRANCH')::INTEGER AS pending_leave
            FROM leave_requests
        `;

        const overtimeStatsQuery = `
            SELECT 
                COUNT(*)::INTEGER AS total_overtime,
                COUNT(*) FILTER (WHERE status = 'APPROVED')::INTEGER AS approved_overtime,
                COUNT(*) FILTER (WHERE status = 'PENDING_TEAM_LEAD' OR status = 'PENDING_BRANCH')::INTEGER AS pending_overtime
            FROM overtime_requests
        `;

        const attendanceStatsQuery = `
            SELECT 
                COUNT(*)::INTEGER AS total_attendance,
                COUNT(*) FILTER (WHERE status = 'APPROVED')::INTEGER AS approved_attendance,
                COUNT(*) FILTER (WHERE status = 'PENDING_TEAM_LEAD' OR status = 'PENDING_BRANCH')::INTEGER AS pending_attendance
            FROM attendance_adjustments
        `;

        // Check if candidates table exists before querying
        let pendingCandidates = 0;
        try {
            // First check if table exists
            const tableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'candidates'
                )
            `);

            if (tableCheck.rows[0]?.exists) {
                const pendingCandidatesQuery = `
                    SELECT COUNT(*)::INTEGER AS count
                    FROM candidates
                    WHERE status = 'PENDING_MANAGER'
                `;
                const pendingCandidatesResult = await pool.query(pendingCandidatesQuery);
                pendingCandidates = pendingCandidatesResult.rows[0]?.count || 0;
                console.log(`[Statistics] Pending candidates count: ${pendingCandidates}`);
            } else {
                console.log('[Statistics] Candidates table does not exist yet');
            }
        } catch (err) {
            console.warn('Error fetching pending candidates:', err.message);
            pendingCandidates = 0;
        }

        // Execute other queries in parallel with individual error handling
        try {
            [leaveStatsResult, overtimeStatsResult, attendanceStatsResult] = await Promise.all([
                pool.query(leaveStatsQuery).catch(err => {
                    console.warn('Error fetching leave stats:', err.message);
                    return { rows: [{}] };
                }),
                pool.query(overtimeStatsQuery).catch(err => {
                    console.warn('Error fetching overtime stats:', err.message);
                    return { rows: [{}] };
                }),
                pool.query(attendanceStatsQuery).catch(err => {
                    console.warn('Error fetching attendance stats:', err.message);
                    return { rows: [{}] };
                })
            ]);
        } catch (error) {
            console.warn('Error fetching statistics queries:', error.message);
            // Continue with default values
        }

        const leaveStats = leaveStatsResult.rows[0] || {};
        const overtimeStats = overtimeStatsResult.rows[0] || {};
        const attendanceStats = attendanceStatsResult.rows[0] || {};
        // pendingCandidates already calculated above

        const totalRequests =
            (leaveStats.total_leave || 0) +
            (leaveStats.total_resign || 0) +
            (overtimeStats.total_overtime || 0) +
            (attendanceStats.total_attendance || 0);

        const approvedRequests =
            (leaveStats.approved_leave || 0) +
            (overtimeStats.approved_overtime || 0) +
            (attendanceStats.approved_attendance || 0);

        // Chờ duyệt bao gồm: đơn nghỉ phép/tăng ca/chấm công chờ duyệt + đơn phỏng vấn đang chờ quản lý phỏng vấn
        const pendingRequests =
            (leaveStats.pending_leave || 0) +
            (overtimeStats.pending_overtime || 0) +
            (attendanceStats.pending_attendance || 0) +
            pendingCandidates;

        let activeEmployees = 0;
        let newEmployees = 0;
        try {
            const activeEmployeesQuery = `
                SELECT COUNT(*)::INTEGER AS active_count
                FROM employees
                WHERE trang_thai IS NULL OR trang_thai = 'ACTIVE'
            `;
            const activeEmployeesResult = await pool.query(activeEmployeesQuery);
            activeEmployees = activeEmployeesResult.rows[0]?.active_count || 0;

            // Đếm nhân viên mới nhận việc trong 30 ngày qua (dựa vào ngay_gia_nhap hoặc created_at)
            // Ưu tiên ngay_gia_nhap, nếu không có thì dùng created_at
            const newEmployeesQuery = `
                SELECT COUNT(*)::INTEGER AS new_count
                FROM employees
                WHERE (trang_thai IS NULL OR trang_thai = 'ACTIVE')
                AND (
                    (ngay_gia_nhap IS NOT NULL AND ngay_gia_nhap >= CURRENT_DATE - INTERVAL '30 days')
                    OR (ngay_gia_nhap IS NULL AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days')
                )
            `;
            const newEmployeesResult = await pool.query(newEmployeesQuery);
            newEmployees = newEmployeesResult.rows[0]?.new_count || 0;
        } catch (error) {
            console.warn('Error fetching active/new employees count:', error.message);
            // Use total as fallback
            activeEmployees = total;
        }

        const statistics = {
            tongNhanVien: total,
            tyLeTheoPhongBan,
            donNghiPhep: leaveStats.total_leave || 0,
            donNghiViec: leaveStats.total_resign || 0,
            donTangCa: overtimeStats.total_overtime || 0,
            donChamCong: attendanceStats.total_attendance || 0,
            donDaDuyet: approvedRequests,
            choDuyet: pendingRequests,
            tongDon: totalRequests,
            // Tỷ lệ nhân viên mới nhận việc = (Tổng nhân viên mới / Tổng nhân viên hiện có) * 100
            tyLeNghiPhep: activeEmployees > 0 ? Math.round((newEmployees * 100) / activeEmployees) : 0,
            tyLeNghiViec: activeEmployees > 0 ? Math.round(((leaveStats.approved_resign || 0) * 100) / activeEmployees) : 0,
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
