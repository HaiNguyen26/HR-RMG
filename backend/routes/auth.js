const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Support both username and email for login
    const loginIdentifier = username || email;

    // Validate input
    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ username/email và password'
      });
    }

    // First, try to find in users table (HR, IT, Accounting, Admin)
    const userQuery = `
      SELECT id, username, password, role, ho_ten, email, trang_thai
      FROM users
      WHERE (username = $1 OR email = $1) AND trang_thai = 'ACTIVE'
    `;
    
    const userResult = await pool.query(userQuery, [loginIdentifier]);

    let authenticatedUser = null;
    let isEmployee = false;

    if (userResult.rows.length > 0) {
      // Found in users table
      const user = userResult.rows[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (isPasswordValid) {
        authenticatedUser = {
          id: user.id,
          username: user.username,
          role: user.role,
          hoTen: user.ho_ten,
          email: user.email
        };
      }
    } else {
      // Not found in users table, try employees table
      const employeeQuery = `
        SELECT id, ma_nhan_vien, ho_ten, email, password, trang_thai, phong_ban, chuc_danh, chi_nhanh
        FROM employees
        WHERE email = $1 AND trang_thai IN ('ACTIVE', 'PENDING')
      `;
      
      const employeeResult = await pool.query(employeeQuery, [loginIdentifier]);

      if (employeeResult.rows.length > 0) {
        const employee = employeeResult.rows[0];
        const isPasswordValid = await bcrypt.compare(password, employee.password);
        
        if (isPasswordValid) {
          isEmployee = true;
          authenticatedUser = {
            id: employee.id,
            username: employee.email, // Use email as username for employees
            role: 'EMPLOYEE',
            hoTen: employee.ho_ten,
            email: employee.email,
            maNhanVien: employee.ma_nhan_vien,
            phongBan: employee.phong_ban,
            chucDanh: employee.chuc_danh,
            chiNhanh: employee.chi_nhanh
          };
        }
      }
    }

    // Check if authentication was successful
    if (!authenticatedUser) {
      return res.status(401).json({
        success: false,
        message: 'Email/Username hoặc password không đúng'
      });
    }

    // Trả về thông tin user/employee
    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: authenticatedUser
    });

  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server: ' + error.message
    });
  }
});

module.exports = router;
