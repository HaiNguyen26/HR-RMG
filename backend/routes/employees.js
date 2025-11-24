const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcrypt');

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'RMG123@';

let ensureChiNhanhColumnPromise = null;
const ensureChiNhanhColumn = async () => {
    if (ensureChiNhanhColumnPromise) {
        return ensureChiNhanhColumnPromise;
    }

    ensureChiNhanhColumnPromise = (async () => {
        const checkQuery = `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'employees'
            AND column_name = 'chi_nhanh'
            LIMIT 1
        `;

        const result = await pool.query(checkQuery);

        if (result.rowCount === 0) {
            await pool.query(`
                ALTER TABLE employees
                ADD COLUMN chi_nhanh VARCHAR(255);
            `);

            await pool.query(`
                COMMENT ON COLUMN employees.chi_nhanh IS 'Chi nhánh làm việc của nhân viên';
            `);
        }
    })().catch((error) => {
        ensureChiNhanhColumnPromise = null;
        console.error('Error ensuring chi_nhanh column exists:', error);
        throw error;
    });

    return ensureChiNhanhColumnPromise;
};

let ensurePhongBanConstraintPromise = null;
const ensurePhongBanConstraintDropped = async () => {
    if (ensurePhongBanConstraintPromise) {
        return ensurePhongBanConstraintPromise;
    }

    ensurePhongBanConstraintPromise = (async () => {
        const checkQuery = `
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'employees'
              AND constraint_type = 'CHECK'
              AND constraint_name = 'employees_phong_ban_check'
            LIMIT 1
        `;

        const result = await pool.query(checkQuery);
        if (result.rowCount > 0) {
            await pool.query('ALTER TABLE employees DROP CONSTRAINT employees_phong_ban_check');
        }
    })().catch((error) => {
        ensurePhongBanConstraintPromise = null;
        console.error('Error removing phong_ban check constraint:', error);
        throw error;
    });

    return ensurePhongBanConstraintPromise;
};

const sanitizeDepartment = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    return raw !== '' ? raw : null;
};

let ensureManagerColumnsPromise = null;
const ensureManagerColumns = async () => {
    if (ensureManagerColumnsPromise) {
        return ensureManagerColumnsPromise;
    }

    ensureManagerColumnsPromise = (async () => {
        const checkQuery = `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'employees'
              AND column_name IN ('quan_ly_truc_tiep', 'quan_ly_gian_tiep')
        `;

        const result = await pool.query(checkQuery);
        const existingColumns = new Set(result.rows.map((row) => row.column_name));

        if (!existingColumns.has('quan_ly_truc_tiep')) {
            await pool.query(`
                ALTER TABLE employees
                    ADD COLUMN quan_ly_truc_tiep VARCHAR(255)
            `);
        }

        if (!existingColumns.has('quan_ly_gian_tiep')) {
            await pool.query(`
                ALTER TABLE employees
                    ADD COLUMN quan_ly_gian_tiep VARCHAR(255)
            `);
        }
    })().catch((error) => {
        ensureManagerColumnsPromise = null;
        console.error('Error ensuring manager columns exist:', error);
        throw error;
    });

    return ensureManagerColumnsPromise;
};

/**
 * POST /api/employees/bulk - Tạo nhiều nhân viên từ danh sách
 */
router.post('/bulk', async (req, res) => {
    const client = await pool.connect();
    try {
        const { employees } = req.body; // Array of employee objects

        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Danh sách nhân viên không hợp lệ'
            });
        }

        await ensureChiNhanhColumn();
        await ensurePhongBanConstraintDropped();
        await ensureManagerColumns();

        await client.query('BEGIN');

        const results = {
            success: [],
            failed: [],
            placeholders: []
        };

        for (let index = 0; index < employees.length; index++) {
            const empData = employees[index];
            if (index < 3) {
                console.log('[BulkImport] Incoming employee', index + 1, empData);
            }
            try {
                const {
                    maNhanVien,
                    hoTen,
                    chucDanh,
                    phongBan,
                    boPhan,
                    ngayGiaNhap,
                    email,
                    chiNhanh,
                    quanLyTrucTiep,
                    quanLyGianTiep
                } = empData;

                // Validation
                if (!hoTen || !hoTen.trim() || !phongBan || !phongBan.trim()) {
                    results.failed.push({
                        data: empData,
                        error: 'Thiếu thông tin bắt buộc (Họ tên, Phòng ban)'
                    });
                    continue;
                }

                // Trim values to ensure no empty strings
                const finalPhongBan = sanitizeDepartment(phongBan);
                const finalBoPhan = sanitizeDepartment(boPhan);
                const finalChiNhanh = chiNhanh && chiNhanh.trim() !== '' ? chiNhanh.trim() : null;
                const finalEmail = email && email.trim() !== '' ? email.trim() : null;
                const finalChucDanh = chucDanh && chucDanh.trim() !== '' ? chucDanh.trim() : null;
                const finalNgayGiaNhap = ngayGiaNhap && String(ngayGiaNhap).trim() !== ''
                    ? String(ngayGiaNhap).trim()
                    : null;
                const finalQuanLyTrucTiep = quanLyTrucTiep && quanLyTrucTiep.trim() !== '' ? quanLyTrucTiep.trim() : null;
                const finalQuanLyGianTiep = quanLyGianTiep && quanLyGianTiep.trim() !== '' ? quanLyGianTiep.trim() : null;

                // Check email uniqueness (case-insensitive)
                if (finalEmail) {
                    const checkEmailResult = await client.query(`
                        SELECT id FROM employees 
                        WHERE LOWER(email) = LOWER($1) 
                        AND email IS NOT NULL 
                        AND email != ''
                        AND (trang_thai = 'ACTIVE' OR trang_thai IS NULL)
                    `, [finalEmail]);

                    if (checkEmailResult.rows.length > 0) {
                        results.failed.push({
                            data: empData,
                            error: 'Email đã tồn tại trong hệ thống'
                        });
                        continue;
                    }
                }

                // Check mã nhân viên uniqueness
                if (maNhanVien && maNhanVien.trim() !== '') {
                    const checkMaNVResult = await client.query(`
                        SELECT id FROM employees 
                        WHERE ma_nhan_vien = $1 
                        AND ma_nhan_vien IS NOT NULL 
                        AND ma_nhan_vien != ''
                        AND (trang_thai = 'ACTIVE' OR trang_thai IS NULL)
                    `, [maNhanVien.trim()]);

                    if (checkMaNVResult.rows.length > 0) {
                        results.failed.push({
                            data: empData,
                            error: 'Mã nhân viên đã tồn tại'
                        });
                        continue;
                    }
                }

                // Clean up inactive records
                if (finalEmail) {
                    await client.query(`
                        DELETE FROM employees 
                        WHERE LOWER(email) = LOWER($1) 
                        AND email IS NOT NULL 
                        AND email != ''
                        AND (trang_thai != 'ACTIVE' OR trang_thai IS NULL)
                    `, [finalEmail]);
                }

                if (maNhanVien && maNhanVien.trim() !== '') {
                    await client.query(`
                        DELETE FROM employees 
                        WHERE ma_nhan_vien = $1 
                        AND ma_nhan_vien IS NOT NULL 
                        AND ma_nhan_vien != ''
                        AND (trang_thai != 'ACTIVE' OR trang_thai IS NULL)
                    `, [maNhanVien.trim()]);
                }

                // Hash password mặc định
                const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

                // Insert employee with PENDING status (chờ cập nhật vật dụng)
                const insertQuery = `
                    INSERT INTO employees (
                        ma_nhan_vien, 
                        ho_ten, 
                        chuc_danh, 
                        phong_ban, 
                        bo_phan, 
                        chi_nhanh, 
                        ngay_gia_nhap, 
                        email, 
                        password, 
                        quan_ly_truc_tiep, 
                        quan_ly_gian_tiep, 
                        trang_thai
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING')
                    RETURNING id, ma_nhan_vien, ho_ten, email
                `;

                const insertResult = await client.query(insertQuery, [
                    maNhanVien && maNhanVien.trim() ? maNhanVien.trim() : null,
                    hoTen.trim(),
                    finalChucDanh,
                    finalPhongBan,
                    finalBoPhan,
                    finalChiNhanh,
                    finalNgayGiaNhap,
                    finalEmail,
                    hashedPassword,
                    finalQuanLyTrucTiep,
                    finalQuanLyGianTiep
                ]);

                results.success.push(insertResult.rows[0]);

            } catch (error) {
                results.failed.push({
                    data: empData,
                    error: error.message
                });
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Đã import ${results.success.length} nhân viên thành công, ${results.failed.length} nhân viên thất bại`,
            data: {
                success: results.success,
                failed: results.failed,
                total: employees.length,
                successCount: results.success.length,
                failedCount: results.failed.length,
                placeholders: results.placeholders
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error bulk importing employees:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi import nhân viên: ' + error.message
        });
    } finally {
        client.release();
    }
});

/**
 * GET /api/employees - Lấy danh sách nhân viên
 */
router.get('/', async (req, res) => {
    try {
        await ensureChiNhanhColumn();
        await ensurePhongBanConstraintDropped();
        await ensureManagerColumns();

        const query = `
            SELECT 
                id, 
                ma_nhan_vien,
                ho_ten, 
                chuc_danh, 
                phong_ban, 
                bo_phan, 
                chi_nhanh,
                ngay_gia_nhap, 
                email, 
                quan_ly_truc_tiep,
                quan_ly_gian_tiep,
                trang_thai,
                created_at,
                updated_at
            FROM employees 
            WHERE trang_thai IN ('ACTIVE', 'PENDING')
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query);

        res.json({
            success: true,
            message: 'Danh sách nhân viên',
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách nhân viên: ' + error.message
        });
    }
});

/**
 * GET /api/employees/:id - Lấy thông tin một nhân viên theo ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const numericId = parseInt(id, 10);

        if (isNaN(numericId) || numericId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'ID nhân viên không hợp lệ'
            });
        }

        await ensureChiNhanhColumn();
        await ensurePhongBanConstraintDropped();
        await ensureManagerColumns();

        const query = `
            SELECT 
                id, 
                ma_nhan_vien,
                ho_ten, 
                chuc_danh, 
                phong_ban, 
                bo_phan, 
                chi_nhanh,
                ngay_gia_nhap, 
                email, 
                quan_ly_truc_tiep,
                quan_ly_gian_tiep,
                trang_thai,
                created_at,
                updated_at
            FROM employees 
            WHERE id = $1
            AND trang_thai IN ('ACTIVE', 'PENDING')
        `;

        const result = await pool.query(query, [numericId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên'
            });
        }

        res.json({
            success: true,
            message: 'Thông tin nhân viên',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thông tin nhân viên: ' + error.message
        });
    }
});

/**
 * POST /api/employees - Tạo nhân viên mới
 */
router.post('/', async (req, res) => {
    const client = await pool.connect();

    try {
        const { maNhanVien, hoTen, chucDanh, phongBan, boPhan, chiNhanh, ngayGiaNhap, email, quanLyTrucTiep, quanLyGianTiep } = req.body;

        await ensureChiNhanhColumn();
        await ensurePhongBanConstraintDropped();
        await ensureManagerColumns();

        // Validate input
        const required = ['hoTen', 'chucDanh', 'phongBan', 'boPhan', 'ngayGiaNhap'];
        for (const field of required) {
            if (!req.body[field]) {
                return res.status(400).json({
                    success: false,
                    message: `Thiếu thông tin: ${field}`
                });
            }
        }

        // Validate email format
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Email không hợp lệ'
                });
            }
        }

        // Validate phong_ban
        const sanitizedPhongBan = sanitizeDepartment(phongBan) || 'Chưa cập nhật';

        await client.query('BEGIN');

        // Check email đã tồn tại chưa (trong cả employees và users) - case-insensitive
        // Chỉ check employees có status ACTIVE hoặc không có status (backward compatibility)
        const checkEmailEmployeesQuery = `
            SELECT id, email, trang_thai FROM employees 
            WHERE LOWER(email) = LOWER($1) 
            AND email IS NOT NULL 
            AND email != ''
        `;
        const checkEmailEmployeesResult = await client.query(checkEmailEmployeesQuery, [email]);

        // Filter only ACTIVE employees (or NULL status for backward compatibility)
        const activeEmployees = checkEmailEmployeesResult.rows.filter(emp =>
            !emp.trang_thai || emp.trang_thai === 'ACTIVE'
        );

        if (email && activeEmployees.length > 0) {
            await client.query('ROLLBACK');
            console.log(`Email conflict in employees: ${email}`, activeEmployees);
            return res.status(400).json({
                success: false,
                message: 'Email đã tồn tại trong hệ thống'
            });
        }

        // Check email trong bảng users (case-insensitive)
        // Chỉ check users có status ACTIVE
        const checkEmailUsersQuery = `
            SELECT id, email, trang_thai FROM users 
            WHERE LOWER(email) = LOWER($1) 
            AND email IS NOT NULL 
            AND email != ''
        `;
        const checkEmailUsersResult = await client.query(checkEmailUsersQuery, [email]);

        // Filter only ACTIVE users (or NULL status for backward compatibility)
        const activeUsers = checkEmailUsersResult.rows.filter(user =>
            !user.trang_thai || user.trang_thai === 'ACTIVE'
        );

        if (email && activeUsers.length > 0) {
            await client.query('ROLLBACK');
            console.log(`Email conflict in users: ${email}`, activeUsers);
            return res.status(400).json({
                success: false,
                message: 'Email đã được sử dụng bởi tài khoản hệ thống'
            });
        }

        // Hash password mặc định
        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        // Check mã nhân viên đã tồn tại chưa (nếu có nhập)
        // Chỉ kiểm tra các record có status ACTIVE
        if (maNhanVien && maNhanVien.trim() !== '') {
            const checkMaNVQuery = `
                SELECT id, ma_nhan_vien, trang_thai FROM employees 
                WHERE ma_nhan_vien = $1 
                AND ma_nhan_vien IS NOT NULL 
                AND ma_nhan_vien != ''
            `;
            const checkMaNVResult = await client.query(checkMaNVQuery, [maNhanVien.trim()]);

            // Filter only ACTIVE employees (or NULL status for backward compatibility)
            const activeEmployeesWithMaNV = checkMaNVResult.rows.filter(emp =>
                !emp.trang_thai || emp.trang_thai === 'ACTIVE'
            );

            if (activeEmployeesWithMaNV.length > 0) {
                await client.query('ROLLBACK');
                console.log(`Mã nhân viên conflict: ${maNhanVien.trim()}`, activeEmployeesWithMaNV);
                return res.status(400).json({
                    success: false,
                    message: 'Mã nhân viên đã tồn tại'
                });
            }

            // Clean up: Delete any employees with the same ma_nhan_vien that are not ACTIVE
            // This prevents unique constraint violation on ma_nhan_vien
            // We already checked that no ACTIVE employees have this ma_nhan_vien above
            await client.query(`
                DELETE FROM employees 
                WHERE ma_nhan_vien = $1 
                AND ma_nhan_vien IS NOT NULL 
                AND ma_nhan_vien != ''
                AND (trang_thai != 'ACTIVE' OR trang_thai IS NULL)
            `, [maNhanVien.trim()]);
        }

        // Clean up: Delete any employees with the same email that are not ACTIVE
        // This prevents unique constraint violation on email
        // We already checked that no ACTIVE employees have this email above
        if (email) {
            await client.query(`
                DELETE FROM employees 
                WHERE LOWER(email) = LOWER($1) 
                AND email IS NOT NULL 
                AND email != ''
                AND (trang_thai != 'ACTIVE' OR trang_thai IS NULL)
            `, [email]);
        }

        // Insert employee
        const insertQuery = `
            INSERT INTO employees (
                ma_nhan_vien,
                ho_ten, 
                chuc_danh, 
                phong_ban, 
                bo_phan, 
                chi_nhanh,
                ngay_gia_nhap, 
                email, 
                password,
                quan_ly_truc_tiep,
                quan_ly_gian_tiep
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, ma_nhan_vien, ho_ten, chuc_danh, phong_ban, bo_phan, chi_nhanh, ngay_gia_nhap, email, quan_ly_truc_tiep, quan_ly_gian_tiep, trang_thai
        `;

        const insertResult = await client.query(insertQuery, [
            maNhanVien && maNhanVien.trim() !== '' ? maNhanVien.trim() : null,
            hoTen,
            chucDanh || 'Chưa cập nhật',
            sanitizedPhongBan,
            boPhan || sanitizedPhongBan,
            chiNhanh && chiNhanh.trim() !== '' ? chiNhanh.trim() : null,
            ngayGiaNhap || new Date().toISOString().split('T')[0],
            email || null,
            hashedPassword,
            quanLyTrucTiep && quanLyTrucTiep.trim() !== '' ? quanLyTrucTiep.trim() : null,
            quanLyGianTiep && quanLyGianTiep.trim() !== '' ? quanLyGianTiep.trim() : null
        ]);

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Tạo nhân viên thành công',
            data: insertResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo nhân viên: ' + error.message
        });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/employees/:id - Cập nhật thông tin nhân viên
 */
router.put('/:id', async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { hoTen, chucDanh, phongBan, boPhan, chiNhanh, ngayGiaNhap, email, quanLyTrucTiep, quanLyGianTiep, trang_thai } = req.body;

        await ensureChiNhanhColumn();
        await ensurePhongBanConstraintDropped();
        await ensureManagerColumns();

        // Check employee exists (allow ACTIVE or PENDING)
        const checkEmployeeQuery = 'SELECT id, trang_thai FROM employees WHERE id = $1';
        const checkEmployeeResult = await client.query(checkEmployeeQuery, [id]);

        if (checkEmployeeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên'
            });
        }

        await client.query('BEGIN');

        const existingEmployee = checkEmployeeResult.rows[0];

        // Nếu chỉ cập nhật trạng thái (không có các trường khác)
        const hasOtherFields = (
            hoTen !== undefined ||
            chucDanh !== undefined ||
            phongBan !== undefined ||
            boPhan !== undefined ||
            chiNhanh !== undefined ||
            ngayGiaNhap !== undefined ||
            email !== undefined
        );

        if (trang_thai && !hasOtherFields) {
            // Validate trạng thái
            const validStatuses = ['ACTIVE', 'PENDING', 'INACTIVE'];
            if (!validStatuses.includes(trang_thai)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: 'Trạng thái không hợp lệ'
                });
            }

            const updateQuery = `
                UPDATE employees 
                SET trang_thai = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING id, ma_nhan_vien, ho_ten, chuc_danh, phong_ban, bo_phan, chi_nhanh, ngay_gia_nhap, email, trang_thai
            `;

            const updateResult = await client.query(updateQuery, [trang_thai, id]);
            await client.query('COMMIT');

            return res.json({
                success: true,
                message: 'Cập nhật trạng thái nhân viên thành công',
                data: updateResult.rows[0]
            });
        }

        // Validate input cho cập nhật đầy đủ
        const required = ['hoTen', 'chucDanh', 'phongBan', 'boPhan', 'ngayGiaNhap'];
        for (const field of required) {
            if (!req.body[field]) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: `Thiếu thông tin: ${field}`
                });
            }
        }

        // Validate email format
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: 'Email không hợp lệ'
                });
            }
        }

        // Validate phong_ban
        const validPhongBan = ['IT', 'HR', 'ACCOUNTING', 'OTHER'];
        if (!validPhongBan.includes(phongBan)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Phòng ban không hợp lệ'
            });
        }

        // Check email đã tồn tại chưa (trừ chính nhân viên này) - trong cả employees và users (case-insensitive)
        // Chỉ check employees có status ACTIVE
        const checkEmailEmployeesQuery = `
            SELECT id FROM employees 
            WHERE LOWER(email) = LOWER($1) 
            AND id != $2
            AND email IS NOT NULL 
            AND email != ''
            AND (trang_thai = 'ACTIVE' OR trang_thai IS NULL)
        `;
        const checkEmailEmployeesResult = await client.query(checkEmailEmployeesQuery, [email, id]);

        if (email && checkEmailEmployeesResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Email đã tồn tại trong hệ thống'
            });
        }

        // Check email trong bảng users (case-insensitive)
        // Chỉ check users có status ACTIVE
        const checkEmailUsersQuery = `
            SELECT id FROM users 
            WHERE LOWER(email) = LOWER($1) 
            AND email IS NOT NULL 
            AND email != ''
            AND (trang_thai = 'ACTIVE' OR trang_thai IS NULL)
        `;
        const checkEmailUsersResult = await client.query(checkEmailUsersQuery, [email]);

        if (email && checkEmailUsersResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Email đã được sử dụng bởi tài khoản hệ thống'
            });
        }

        // Update employee với tất cả các trường
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        if (hoTen) {
            updateFields.push(`ho_ten = $${paramIndex++}`);
            updateValues.push(hoTen);
        }
        if (chucDanh) {
            updateFields.push(`chuc_danh = $${paramIndex++}`);
            updateValues.push(chucDanh);
        }
        if (phongBan) {
            updateFields.push(`phong_ban = $${paramIndex++}`);
            updateValues.push(sanitizeDepartment(phongBan) || 'Chưa cập nhật');
        }
        if (boPhan) {
            updateFields.push(`bo_phan = $${paramIndex++}`);
            updateValues.push(boPhan);
        }
        if (chiNhanh !== undefined) {
            updateFields.push(`chi_nhanh = $${paramIndex++}`);
            updateValues.push(chiNhanh && chiNhanh.trim() !== '' ? chiNhanh.trim() : null);
        }
        if (ngayGiaNhap) {
            updateFields.push(`ngay_gia_nhap = $${paramIndex++}`);
            updateValues.push(ngayGiaNhap);
        }
        if (email) {
            updateFields.push(`email = $${paramIndex++}`);
            updateValues.push(email);
        }
        if (quanLyTrucTiep !== undefined) {
            updateFields.push(`quan_ly_truc_tiep = $${paramIndex++}`);
            updateValues.push(quanLyTrucTiep && quanLyTrucTiep.trim() !== '' ? quanLyTrucTiep.trim() : null);
        }
        if (quanLyGianTiep !== undefined) {
            updateFields.push(`quan_ly_gian_tiep = $${paramIndex++}`);
            updateValues.push(quanLyGianTiep && quanLyGianTiep.trim() !== '' ? quanLyGianTiep.trim() : null);
        }
        if (trang_thai) {
            updateFields.push(`trang_thai = $${paramIndex++}`);
            updateValues.push(trang_thai);
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(id);

        const updateQuery = `
            UPDATE employees 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING id, ma_nhan_vien, ho_ten, chuc_danh, phong_ban, bo_phan, chi_nhanh, ngay_gia_nhap, email, quan_ly_truc_tiep, quan_ly_gian_tiep, trang_thai
        `;

        const updateResult = await client.query(updateQuery, updateValues);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Cập nhật nhân viên thành công',
            data: updateResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật nhân viên: ' + error.message
        });
    } finally {
        client.release();
    }
});

/**
 * GET /api/employees/departments - Lấy danh sách phòng ban (DISTINCT)
 */
router.get('/departments', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT phong_ban as department
            FROM employees
            WHERE phong_ban IS NOT NULL AND phong_ban != ''
            ORDER BY phong_ban ASC
        `;
        const result = await pool.query(query);
        res.json({
            success: true,
            data: result.rows.map(row => row.department)
        });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách phòng ban: ' + error.message
        });
    }
});

/**
 * GET /api/employees/job-titles - Lấy danh sách chức danh (DISTINCT)
 */
router.get('/job-titles', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT chuc_danh as job_title
            FROM employees
            WHERE chuc_danh IS NOT NULL AND chuc_danh != ''
            ORDER BY chuc_danh ASC
        `;
        const result = await pool.query(query);
        res.json({
            success: true,
            data: result.rows.map(row => row.job_title)
        });
    } catch (error) {
        console.error('Error fetching job titles:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách chức danh: ' + error.message
        });
    }
});

/**
 * GET /api/employees/managers - Lấy danh sách nhân viên có thể làm quản lý
 */
router.get('/managers', async (req, res) => {
    try {
        // Thử query trực tiếp, nếu table không tồn tại thì trả về empty array
        const query = `
            SELECT id, ho_ten, chuc_danh, phong_ban, email
            FROM employees
            WHERE (trang_thai = 'ACTIVE' OR trang_thai = 'PENDING' OR trang_thai IS NULL)
            ORDER BY ho_ten ASC
        `;
        
        try {
            const result = await pool.query(query);
            res.json({
                success: true,
                data: result.rows || []
            });
        } catch (dbError) {
            // Nếu lỗi là table không tồn tại hoặc column không tồn tại, trả về empty array
            if (dbError.code === '42P01' || dbError.code === '42703') {
                console.warn('⚠️ Employees table or columns not found, returning empty array:', dbError.message);
                res.json({
                    success: true,
                    data: []
                });
            } else {
                // Lỗi khác, throw lại để catch block bên ngoài xử lý
                throw dbError;
            }
        }
    } catch (error) {
        console.error('Error fetching managers:', error);
        // Trả về success với empty array thay vì error để frontend vẫn có thể hoạt động
        res.json({
            success: true,
            data: [],
            warning: 'Không thể tải danh sách quản lý: ' + error.message
        });
    }
});

/**
 * DELETE /api/employees/:id - Xóa nhân viên (hard delete - xóa hoàn toàn khỏi database)
 */
router.delete('/:id', async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        await client.query('BEGIN');

        // Check employee exists
        const checkEmployeeQuery = 'SELECT id, email FROM employees WHERE id = $1';
        const checkEmployeeResult = await client.query(checkEmployeeQuery, [id]);

        if (checkEmployeeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên'
            });
        }

        const employee = checkEmployeeResult.rows[0];

        // Get email for deletion (handle null/empty email)
        const employeeEmail = employee.email || '';

        // Delete related records manually (even though CASCADE should handle it, we do it explicitly for clarity)
        // 1. Delete equipment assignments
        await client.query('DELETE FROM equipment_assignments WHERE employee_id = $1', [id]);

        // 2. Delete requests and related data
        // First, get all request IDs for this employee
        const requestIdsResult = await client.query('SELECT id FROM requests WHERE employee_id = $1', [id]);
        const requestIds = requestIdsResult.rows.map(row => row.id);

        if (requestIds.length > 0) {
            // Notification system removed

            // Delete request_items for these requests
            await client.query('DELETE FROM request_items WHERE request_id = ANY($1::int[])', [requestIds]);

            // Delete requests (CASCADE will handle request_items, but we delete explicitly for clarity)
            await client.query('DELETE FROM requests WHERE employee_id = $1', [id]);
        } else {
            // No requests, but still check and delete if any exist
            await client.query('DELETE FROM requests WHERE employee_id = $1', [id]);
        }

        // 3. Delete user account if exists (users table may have email reference)
        // Delete all users with matching email (case-insensitive to handle any case variations)
        // Only delete if email exists and is not empty
        if (employeeEmail && employeeEmail.trim() !== '') {
            await client.query('DELETE FROM users WHERE LOWER(email) = LOWER($1) AND email IS NOT NULL', [employeeEmail]);
        }

        // 4. Finally, delete the employee (hard delete)
        const deleteQuery = `
            DELETE FROM employees 
            WHERE id = $1
            RETURNING id, ma_nhan_vien, ho_ten
        `;

        const deleteResult = await client.query(deleteQuery, [id]);

        if (deleteResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Không thể xóa nhân viên'
            });
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Đã xóa nhân viên và tất cả dữ liệu liên quan khỏi database',
            data: deleteResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting employee:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa nhân viên: ' + error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router;
