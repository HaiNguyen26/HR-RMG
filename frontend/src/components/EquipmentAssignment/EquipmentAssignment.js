import React, { useState } from 'react';
import { equipmentAPI, employeesAPI, requestsAPI } from '../../services/api';
import './EquipmentAssignment.css';

const EquipmentAssignment = ({ employee, onComplete, onCancel, currentUser, showToast }) => {
  const [equipmentData, setEquipmentData] = useState({
    it: [{ name: '', quantity: 1 }],
    hr: [{ name: '', quantity: 1 }],
    accounting: [{ name: '', quantity: 1 }],
    other: [{ name: '', quantity: 1 }],
  });

  // Mode cho mỗi department: 'request' (yêu cầu) hoặc 'direct' (cấp trực tiếp)
  const [departmentModes, setDepartmentModes] = useState({
    it: 'direct', // Mặc định: cấp trực tiếp
    hr: 'direct',
    accounting: 'direct',
    other: 'direct',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getDepartmentName = (code) => {
    const departments = {
      'IT': 'Phòng IT',
      'HR': 'Hành chính nhân sự',
      'ACCOUNTING': 'Kế toán',
      'OTHER': 'Phòng ban khác'
    };
    return departments[code] || code;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';

    try {
      // Nếu dateString đã có format đầy đủ (có time), dùng trực tiếp
      // Nếu chỉ có date (YYYY-MM-DD), thêm time để tránh timezone issues
      let date;
      if (dateString.includes('T') || dateString.includes(' ')) {
        // Đã có time hoặc datetime format
        date = new Date(dateString);
      } else {
        // Chỉ có date, thêm time để tránh timezone issues
        date = new Date(dateString + 'T00:00:00');
      }

      // Kiểm tra date hợp lệ
      if (isNaN(date.getTime())) {
        return '-';
      }

      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return '-';
    }
  };

  const addItem = (department) => {
    setEquipmentData((prev) => ({
      ...prev,
      [department]: [...prev[department], { name: '', quantity: 1 }],
    }));
  };

  const removeItem = (department, index) => {
    if (equipmentData[department].length > 1) {
      setEquipmentData((prev) => ({
        ...prev,
        [department]: prev[department].filter((_, i) => i !== index),
      }));
    } else {
      setEquipmentData((prev) => ({
        ...prev,
        [department]: [{ name: '', quantity: 1 }],
      }));
    }
  };

  const handleItemNameChange = (department, index, value) => {
    setEquipmentData((prev) => {
      const newData = { ...prev };
      newData[department] = [...newData[department]];
      newData[department][index] = {
        ...newData[department][index],
        name: value
      };
      return newData;
    });
  };

  const handleItemQuantityChange = (department, index, value) => {
    const quantity = parseInt(value) || 1;
    setEquipmentData((prev) => {
      const newData = { ...prev };
      newData[department] = [...newData[department]];
      newData[department][index] = {
        ...newData[department][index],
        quantity: quantity > 0 ? quantity : 1
      };
      return newData;
    });
  };

  const handleDepartmentModeChange = (department, mode) => {
    setDepartmentModes((prev) => ({
      ...prev,
      [department]: mode
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Bước 1: Tạo nhân viên trước (nếu chưa có id)
      let employeeId = employee.id;

      if (!employeeId) {
        // employee là formData từ EmployeeForm, chưa có id
        // Tạo nhân viên mới
        const createResponse = await employeesAPI.create({
          maNhanVien: employee.maNhanVien || employee.ma_nhan_vien || null,
          hoTen: employee.hoTen || employee.ho_ten,
          chucDanh: employee.chucDanh || employee.chuc_danh,
          phongBan: employee.phongBan || employee.phong_ban,
          boPhan: employee.boPhan || employee.bo_phan,
          chiNhanh: employee.chiNhanh || employee.chi_nhanh,
          ngayGiaNhap: employee.ngayGiaNhap || employee.ngay_gia_nhap,
          email: employee.email,
        });

        if (!createResponse.data.success) {
          throw new Error(createResponse.data.message || 'Lỗi khi tạo nhân viên');
        }

        employeeId = createResponse.data.data.id;
      }

      // Bước 2: Tạo equipment assignments và requests
      const departmentMap = {
        it: 'IT',
        hr: 'HR',
        accounting: 'ACCOUNTING',
        other: 'OTHER',
      };

      const requestTypeMap = {
        it: 'IT_EQUIPMENT',
        hr: 'OFFICE_SUPPLIES',
        accounting: 'ACCOUNTING',
        other: 'OTHER',
      };

      const departmentNameMap = {
        it: 'Phòng IT',
        hr: 'Hành chính nhân sự',
        accounting: 'Kế toán',
        other: 'Phòng ban khác',
      };

      // Kiểm tra xem có phải nhân viên import (PENDING) hay nhân viên mới
      // Kiểm tra cả snake_case và camelCase để đảm bảo tương thích
      const employeeStatus = employee.trang_thai || employee.trangThai || employee.status;
      const isImportedEmployee = !!(employee.id && employeeStatus === 'PENDING');
      const isNewEmployee = !employee.id;

      let hasDirectAssignment = false;

      // Tạo equipment assignments và requests theo mode đã chọn
      for (const [key, items] of Object.entries(equipmentData)) {
        const validItems = items.filter(item => item.name && item.name.trim() !== '');
        const mode = departmentModes[key]; // 'request' hoặc 'direct'

        if (validItems.length > 0) {
          if (mode === 'direct') {
            // Cấp trực tiếp: Tạo equipment assignment
            hasDirectAssignment = true;
            const equipmentList = validItems.map(item => ({
              tenVatDung: item.name.trim(),
              soLuong: item.quantity || 1
            }));

            const equipmentResponse = await equipmentAPI.create({
              employeeId: employeeId,
              phongBan: departmentMap[key],
              equipmentList: equipmentList,
            });

            if (!equipmentResponse.data.success) {
              throw new Error(equipmentResponse.data.message || 'Lỗi khi thêm vật dụng');
            }

            if (showToast) {
              showToast(`Đã cấp vật dụng từ ${departmentNameMap[key]}`, 'success');
            }
          } else if (mode === 'request') {
            // Yêu cầu: Tạo request (không tạo equipment trực tiếp)
            const requestTitle = `Yêu cầu ${departmentNameMap[key]} cho nhân viên ${employee.hoTen || employee.ho_ten}`;

            try {
              await requestsAPI.create({
                employeeId: employeeId,
                requestType: requestTypeMap[key],
                targetDepartment: departmentMap[key],
                requestTitle: requestTitle,
                items: validItems.map(item => ({
                  item_name: item.name.trim(),
                  quantity: item.quantity || 1
                })),
              });

              if (showToast) {
                showToast(`Đã gửi yêu cầu đến ${departmentNameMap[key]}`, 'success');
              }
            } catch (requestError) {
              console.error('Error creating request:', requestError);
              throw new Error(requestError.response?.data?.message || 'Lỗi khi tạo yêu cầu');
            }
          }
        }
      }

      // Cập nhật trạng thái thành ACTIVE nếu employee đã tồn tại và có trạng thái PENDING
      // Chỉ cập nhật nếu có ít nhất 1 equipment được cấp trực tiếp
      if (isImportedEmployee && hasDirectAssignment) {
        try {
          await employeesAPI.update(employee.id, {
            trang_thai: 'ACTIVE'
          });
        } catch (updateError) {
          console.error('Error updating employee status:', updateError);
          // Không throw error, chỉ log vì equipment đã được tạo thành công
        }
      }

      // Hiển thị thông báo tổng kết
      if (showToast) {
        const directCount = Object.values(departmentModes).filter(m => m === 'direct').length;
        const requestCount = Object.values(departmentModes).filter(m => m === 'request').length;

        if (hasDirectAssignment && requestCount > 0) {
          showToast('Đã cấp vật dụng và gửi yêu cầu thành công!', 'success');
        } else if (hasDirectAssignment) {
          showToast('Đã cấp vật dụng cho nhân viên thành công!', 'success');
        } else {
          showToast('Đã gửi yêu cầu thành công!', 'success');
        }
      }
      onComplete();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="equipment-assignment-view">
      {error && (
        <div className="error-message">{error}</div>
      )}

      {/* Employee Info Display */}
      <div className="employee-info-card">
        <div className="employee-info-bg-decoration-top"></div>
        <div className="employee-info-bg-decoration-bottom"></div>
        <div className="employee-info-content">
          <div className="employee-info-header">
            <div className="employee-info-icon">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
            </div>
            <div>
              <h2 className="employee-info-title">
                Nhân viên: <span>{employee.hoTen || employee.ho_ten}</span>
              </h2>
              <p className="employee-info-email">{employee.email}</p>
            </div>
          </div>
          <div className="employee-info-grid">
            {(employee.maNhanVien || employee.ma_nhan_vien) && (
              <div className="employee-info-item">
                <span className="employee-info-label">Mã nhân viên</span>
                <p className="employee-info-value">{employee.maNhanVien || employee.ma_nhan_vien}</p>
              </div>
            )}
            <div className="employee-info-item">
              <span className="employee-info-label">Chức danh</span>
              <p className="employee-info-value">{employee.chucDanh || employee.chuc_danh}</p>
            </div>
            <div className="employee-info-item">
              <span className="employee-info-label">Chi nhánh</span>
              <p className="employee-info-value">{employee.chiNhanh || employee.chi_nhanh || '-'}</p>
            </div>
            <div className="employee-info-item">
              <span className="employee-info-label">Phòng ban</span>
              <p className="employee-info-value">{getDepartmentName(employee.phongBan || employee.phong_ban)}</p>
            </div>
            <div className="employee-info-item">
              <span className="employee-info-label">Bộ phận</span>
              <p className="employee-info-value">{employee.boPhan || employee.bo_phan}</p>
            </div>
            <div className="employee-info-item">
              <span className="employee-info-label">Ngày gia nhập</span>
              <p className="employee-info-value">{formatDate(employee.ngayGiaNhap || employee.ngay_gia_nhap)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Column Equipment Form */}
      <div className="equipment-columns-grid">
        {/* Column 1: Phòng IT */}
        <div className="equipment-column blue">
          <div className="equipment-column-header">
            <h3 className="equipment-column-title">
              <span className="equipment-column-dot blue"></span>
              <span>Phòng IT</span>
            </h3>
          </div>

          {/* Mode Selector */}
          <div className="equipment-mode-selector">
            <button
              type="button"
              className={`equipment-mode-btn ${departmentModes.it === 'direct' ? 'active' : ''}`}
              onClick={() => handleDepartmentModeChange('it', 'direct')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Cấp trực tiếp
            </button>
            <button
              type="button"
              className={`equipment-mode-btn ${departmentModes.it === 'request' ? 'active' : ''}`}
              onClick={() => handleDepartmentModeChange('it', 'request')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Yêu cầu
            </button>
          </div>

          <div className="equipment-items-list">
            {equipmentData.it.map((item, index) => (
              <div key={index} className="equipment-item">
                <div className="equipment-item-row">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemNameChange('it', index, e.target.value)}
                    placeholder="Nhập vật dụng/thiết bị..."
                    className="equipment-input blue"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemQuantityChange('it', index, e.target.value)}
                    className="equipment-quantity-input"
                    placeholder="SL"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem('it', index)}
                  className="btn-remove-item"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addItem('it')}
              className="btn-add-equipment blue"
            >
              <span className="btn-add-shine"></span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 4v16m8-8H4"></path>
              </svg>
              <span>Thêm</span>
            </button>
          </div>
        </div>

        {/* Column 2: Hành chính nhân sự */}
        <div className="equipment-column green">
          <div className="equipment-column-header">
            <h3 className="equipment-column-title">
              <span className="equipment-column-dot green"></span>
              <span>Hành chính nhân sự</span>
            </h3>
          </div>

          {/* Mode Selector */}
          <div className="equipment-mode-selector">
            <button
              type="button"
              className={`equipment-mode-btn ${departmentModes.hr === 'direct' ? 'active' : ''}`}
              onClick={() => handleDepartmentModeChange('hr', 'direct')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Cấp trực tiếp
            </button>
            <button
              type="button"
              className={`equipment-mode-btn ${departmentModes.hr === 'request' ? 'active' : ''}`}
              onClick={() => handleDepartmentModeChange('hr', 'request')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Yêu cầu
            </button>
          </div>

          <div className="equipment-items-list">
            {equipmentData.hr.map((item, index) => (
              <div key={index} className="equipment-item">
                <div className="equipment-item-row">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemNameChange('hr', index, e.target.value)}
                    placeholder="Nhập vật dụng/thiết bị..."
                    className="equipment-input green"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemQuantityChange('hr', index, e.target.value)}
                    className="equipment-quantity-input"
                    placeholder="SL"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem('hr', index)}
                  className="btn-remove-item"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addItem('hr')}
              className="btn-add-equipment green"
            >
              <span className="btn-add-shine"></span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 4v16m8-8H4"></path>
              </svg>
              <span>Thêm</span>
            </button>
          </div>
        </div>

        {/* Column 3: Kế toán */}
        <div className="equipment-column yellow">
          <div className="equipment-column-header">
            <h3 className="equipment-column-title">
              <span className="equipment-column-dot yellow"></span>
              <span>Kế toán</span>
            </h3>
          </div>

          {/* Mode Selector */}
          <div className="equipment-mode-selector">
            <button
              type="button"
              className={`equipment-mode-btn ${departmentModes.accounting === 'direct' ? 'active' : ''}`}
              onClick={() => handleDepartmentModeChange('accounting', 'direct')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Cấp trực tiếp
            </button>
            <button
              type="button"
              className={`equipment-mode-btn ${departmentModes.accounting === 'request' ? 'active' : ''}`}
              onClick={() => handleDepartmentModeChange('accounting', 'request')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Yêu cầu
            </button>
          </div>

          <div className="equipment-items-list">
            {equipmentData.accounting.map((item, index) => (
              <div key={index} className="equipment-item">
                <div className="equipment-item-row">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemNameChange('accounting', index, e.target.value)}
                    placeholder="Nhập vật dụng/thiết bị..."
                    className="equipment-input yellow"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemQuantityChange('accounting', index, e.target.value)}
                    className="equipment-quantity-input"
                    placeholder="SL"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem('accounting', index)}
                  className="btn-remove-item"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addItem('accounting')}
              className="btn-add-equipment yellow"
            >
              <span className="btn-add-shine"></span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 4v16m8-8H4"></path>
              </svg>
              <span>Thêm</span>
            </button>
          </div>
        </div>

        {/* Column 4: Phòng ban */}
        <div className="equipment-column purple">
          <div className="equipment-column-header">
            <h3 className="equipment-column-title">
              <span className="equipment-column-dot purple"></span>
              <span>Phòng ban</span>
            </h3>
          </div>

          {/* Mode Selector */}
          <div className="equipment-mode-selector">
            <button
              type="button"
              className={`equipment-mode-btn ${departmentModes.other === 'direct' ? 'active' : ''}`}
              onClick={() => handleDepartmentModeChange('other', 'direct')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Cấp trực tiếp
            </button>
            <button
              type="button"
              className={`equipment-mode-btn ${departmentModes.other === 'request' ? 'active' : ''}`}
              onClick={() => handleDepartmentModeChange('other', 'request')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Yêu cầu
            </button>
          </div>

          <div className="equipment-items-list">
            {equipmentData.other.map((item, index) => (
              <div key={index} className="equipment-item">
                <div className="equipment-item-row">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemNameChange('other', index, e.target.value)}
                    placeholder="Nhập vật dụng/thiết bị..."
                    className="equipment-input purple"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemQuantityChange('other', index, e.target.value)}
                    className="equipment-quantity-input"
                    placeholder="SL"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem('other', index)}
                  className="btn-remove-item"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addItem('other')}
              className="btn-add-equipment purple"
            >
              <span className="btn-add-shine"></span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 4v16m8-8H4"></path>
              </svg>
              <span>Thêm</span>
            </button>
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="equipment-actions">
        <button
          onClick={onCancel}
          className="btn-back-equipment"
          disabled={loading}
        >
          <span className="btn-back-shine"></span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          <span>Quay lại</span>
        </button>
        <button
          onClick={handleSubmit}
          className="btn-complete-equipment"
          disabled={loading}
        >
          {loading ? 'Đang xử lý...' : 'Hoàn tất'}
        </button>
      </div>
    </div>
  );
};

export default EquipmentAssignment;
