import React, { useState } from 'react';
import './EmployeeForm.css';

const EmployeeForm = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    maNhanVien: '',
    hoTen: '',
    chucDanh: '',
    phongBan: '',
    boPhan: '',
    chiNhanh: '',
    ngayGiaNhap: '',
    email: '',
  });

  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate form
    if (!formData.hoTen || !formData.chucDanh || !formData.phongBan || !formData.boPhan || !formData.ngayGiaNhap || !formData.email) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    // Chỉ lưu thông tin tạm thời, chưa tạo nhân viên trong database
    // Nhân viên sẽ được tạo khi nhấn "Hoàn tất" ở EquipmentAssignment
    onSuccess(formData);
  };

  return (
    <div className="employee-form-view">
      <div className="employee-form-container">
        {/* Back to Dashboard Button */}
        <button onClick={onCancel} className="btn-back-dashboard">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          <span>Quay lại Dashboard</span>
        </button>

        {/* Employee Form */}
        <div className="employee-form-content">
          <div className="employee-form-header">
            <div className="employee-form-icon">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
            </div>
            <h2 className="employee-form-title">Thông tin nhân viên mới</h2>
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="employee-form">
            <div className="form-grid">
              {/* Mã nhân viên */}
              <div className="form-group">
                <label htmlFor="maNhanVien" className="form-label">
                  Mã nhân viên
                </label>
                <input
                  type="text"
                  id="maNhanVien"
                  name="maNhanVien"
                  value={formData.maNhanVien}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="VD: NV0001 (tự động nếu để trống)"
                />
                <p className="form-help-text">Để trống để tự động tạo mã</p>
              </div>

              {/* Họ tên */}
              <div className="form-group">
                <label htmlFor="hoTen" className="form-label">
                  Họ tên *
                </label>
                <input
                  type="text"
                  id="hoTen"
                  name="hoTen"
                  value={formData.hoTen}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="Nhập họ và tên"
                />
              </div>

              {/* Chi nhánh */}
              <div className="form-group">
                <label htmlFor="chiNhanh" className="form-label">
                  Chi nhánh
                </label>
                <input
                  type="text"
                  id="chiNhanh"
                  name="chiNhanh"
                  value={formData.chiNhanh}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="VD: Hồ Chí Minh, Hà Nội..."
                />
              </div>

              {/* Chức danh */}
              <div className="form-group">
                <label htmlFor="chucDanh" className="form-label">
                  Chức danh *
                </label>
                <input
                  type="text"
                  id="chucDanh"
                  name="chucDanh"
                  value={formData.chucDanh}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="Nhập chức danh"
                />
              </div>

              {/* Phòng ban */}
              <div className="form-group">
                <label htmlFor="phongBan" className="form-label">
                  Phòng ban *
                </label>
                <select
                  id="phongBan"
                  name="phongBan"
                  value={formData.phongBan}
                  onChange={handleChange}
                  required
                  className="form-input"
                >
                  <option value="">Chọn phòng ban</option>
                  <option value="IT">Phòng IT</option>
                  <option value="HR">Hành chính nhân sự</option>
                  <option value="ACCOUNTING">Kế toán</option>
                  <option value="OTHER">Phòng ban khác</option>
                </select>
              </div>

              {/* Bộ phận */}
              <div className="form-group">
                <label htmlFor="boPhan" className="form-label">
                  Bộ phận *
                </label>
                <input
                  type="text"
                  id="boPhan"
                  name="boPhan"
                  value={formData.boPhan}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="Nhập bộ phận"
                />
              </div>

              {/* Ngày gia nhập */}
              <div className="form-group">
                <label htmlFor="ngayGiaNhap" className="form-label">
                  Ngày gia nhập *
                </label>
                <input
                  type="date"
                  id="ngayGiaNhap"
                  name="ngayGiaNhap"
                  value={formData.ngayGiaNhap}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>

              {/* Email */}
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="example@company.com"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="form-actions">
              <button
                type="submit"
                className="btn-submit"
              >
                <span className="btn-submit-shine"></span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Xác nhận</span>
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="btn-cancel"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmployeeForm;
