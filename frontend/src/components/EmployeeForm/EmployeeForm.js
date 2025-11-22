import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import { formatDateToISO, parseISODateString, today } from '../../utils/dateUtils';
import { DATE_PICKER_LOCALE } from '../../utils/datepickerLocale';
import { employeesAPI } from '../../services/api';
import EquipmentAssignment from '../EquipmentAssignment/EquipmentAssignment';
import 'react-datepicker/dist/react-datepicker.css';
import './EmployeeForm.css';

// Custom Dropdown Component
const CustomDropdown = ({ id, name, value, onChange, options, placeholder, error, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value)) || null;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Use setTimeout to ensure the menu is rendered before attaching listener
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (option, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (option.value === '' || option.value === null || option.value === undefined) {
      return; // Prevent selecting placeholder
    }
    const eventObject = { 
      target: { 
        name: name || id, 
        value: option.value 
      } 
    };
    onChange(eventObject);
    setIsOpen(false);
  };

  // Filter out placeholder option (empty value) from display
  const displayOptions = options.filter(opt => opt.value !== '');

  return (
    <div className={`custom-dropdown-wrapper ${className} ${error ? 'error' : ''} ${isOpen ? 'open' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        className={`custom-dropdown-trigger ${isOpen ? 'open' : ''} ${error ? 'error' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => {
          // Prevent blur when clicking the trigger
          if (!isOpen) {
            e.preventDefault();
          }
        }}
      >
        <span className="custom-dropdown-value">
          {selectedOption && String(selectedOption.value) !== '' ? selectedOption.label : placeholder}
        </span>
        <svg className="custom-dropdown-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>
      {isOpen && (
        <div 
          ref={menuRef}
          className="custom-dropdown-menu"
        >
          {displayOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`custom-dropdown-option ${String(value) === String(option.value) ? 'selected' : ''}`}
              onMouseDown={(e) => {
                // Prevent blur event and allow click to work
                e.preventDefault();
                // Manually trigger click
                handleSelect(option, e);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const EmployeeForm = ({ onSuccess, onCancel, currentUser, showToast, showConfirm }) => {
  const [formData, setFormData] = useState({
    maNhanVien: '',
    hoTen: '',
    chucDanh: '',
    phongBan: '',
    boPhan: '',
    chiNhanh: '',
    ngayGiaNhap: '',
    quanLyTrucTiep: '',
    quanLyGianTiep: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [createdEmployee, setCreatedEmployee] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleDateChange = (date) => {
    if (date) {
      const isoDate = formatDateToISO(date);
      setFormData((prev) => ({
        ...prev,
        ngayGiaNhap: isoDate,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        ngayGiaNhap: '',
      }));
    }
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate form
    if (!formData.hoTen || !formData.chucDanh || !formData.phongBan || !formData.boPhan || !formData.ngayGiaNhap) {
      setError('Vui lòng điền đầy đủ thông tin');
      setLoading(false);
      return;
    }

    try {
      // Bước 1: Tạo nhân viên trong database
      const createResponse = await employeesAPI.create({
        maNhanVien: formData.maNhanVien || null,
        hoTen: formData.hoTen,
        chucDanh: formData.chucDanh,
        phongBan: formData.phongBan,
        boPhan: formData.boPhan,
        chiNhanh: formData.chiNhanh || null,
        ngayGiaNhap: formData.ngayGiaNhap,
        quanLyTrucTiep: formData.quanLyTrucTiep || null,
        quanLyGianTiep: formData.quanLyGianTiep || null,
      });

      if (!createResponse.data.success) {
        throw new Error(createResponse.data.message || 'Lỗi khi tạo nhân viên');
      }

      const newEmployee = createResponse.data.data;
      setLoading(false);

      // Bước 2: Hiển thị modal xác nhận có muốn cập nhật/yêu cầu vật dụng không
      if (showConfirm) {
        const confirmed = await showConfirm({
          title: 'Cập nhật vật dụng',
          message: 'Bạn có muốn cập nhật hoặc yêu cầu vật dụng cho nhân viên mới này không?',
          confirmText: 'Có',
          cancelText: 'Không',
          type: 'info',
        });

        if (confirmed) {
          // Nếu chọn "Có", mở modal EquipmentAssignment
          setCreatedEmployee(newEmployee);
          setIsEquipmentModalOpen(true);
        } else {
          // Nếu chọn "Không", chỉ đóng form và refresh
          if (showToast) {
            showToast('Đã tạo nhân viên thành công!', 'success');
          }
          onSuccess(newEmployee);
        }
      } else {
        // Nếu không có showConfirm, chỉ đóng form
        if (showToast) {
          showToast('Đã tạo nhân viên thành công!', 'success');
        }
        onSuccess(newEmployee);
      }
    } catch (err) {
      console.error('Error creating employee:', err);
      setError(err.response?.data?.message || err.message || 'Có lỗi xảy ra khi tạo nhân viên');
      setLoading(false);
    }
  };

  return (
    <div className="employee-form-modal-overlay" onClick={onCancel}>
      <div className="employee-form-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header với tiêu đề và icon */}
        <div className="employee-form-header">
          <div className="employee-form-icon-large">
            <svg className="employee-form-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              ></path>
            </svg>
          </div>
          <h1 className="employee-form-title">Thông tin nhân viên mới</h1>
          <button
            type="button"
            className="employee-form-close-btn"
            onClick={onCancel}
            aria-label="Đóng"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="employee-form">
          {/* Section 01: Thông tin cá nhân */}
          <div className="form-section">
            <div className="section-header">
              <span className="section-badge">01</span>
              <h3 className="section-title">Thông tin cá nhân</h3>
            </div>

            <div className="form-grid">
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
                <p className="form-help-text">Để trống để hệ thống tự tạo mã</p>
              </div>

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

              <div className="form-group">
                <label htmlFor="ngayGiaNhap" className="form-label">
                  Ngày nhận việc *
                </label>
                <DatePicker
                  id="ngayGiaNhap"
                  selected={formData.ngayGiaNhap ? parseISODateString(formData.ngayGiaNhap) : null}
                  onChange={handleDateChange}
                  dateFormat="dd/MM/yyyy"
                  locale={DATE_PICKER_LOCALE}
                  className="form-input employee-form-datepicker"
                  placeholderText="Chọn ngày nhận việc"
                  withPortal
                  autoComplete="off"
                  required
                />
              </div>

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
            </div>
          </div>

          {/* Section 02: Công việc & Tổ chức */}
          <div className="form-section">
            <div className="section-header">
              <span className="section-badge">02</span>
              <h3 className="section-title">Công việc & Tổ chức</h3>
            </div>

            <div className="form-grid">
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

              <div className="form-group">
                <label htmlFor="phongBan" className="form-label">
                  Phòng ban *
                </label>
                <CustomDropdown
                  id="phongBan"
                  name="phongBan"
                  value={formData.phongBan}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Chọn phòng ban' },
                    { value: 'IT', label: 'Phòng IT' },
                    { value: 'HR', label: 'Hành chính nhân sự' },
                    { value: 'ACCOUNTING', label: 'Kế toán' },
                    { value: 'OTHER', label: 'Phòng ban khác' }
                  ]}
                  placeholder="Chọn phòng ban"
                  className="form-input-custom-dropdown"
                />
              </div>

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

              <div className="form-group">
                <label htmlFor="quanLyTrucTiep" className="form-label">
                  Quản lý trực tiếp
                </label>
                <input
                  type="text"
                  id="quanLyTrucTiep"
                  name="quanLyTrucTiep"
                  value={formData.quanLyTrucTiep}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </div>

              <div className="form-group">
                <label htmlFor="quanLyGianTiep" className="form-label">
                  Quản lý gián tiếp
                </label>
                <input
                  type="text"
                  id="quanLyGianTiep"
                  name="quanLyGianTiep"
                  value={formData.quanLyGianTiep}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Ví dụ: Trần Thị B"
                />
              </div>

              {/* Form Actions - Nằm cùng hàng với Quản lý gián tiếp */}
              <div className="form-group form-actions-inline">
                <label className="form-label" style={{ visibility: 'hidden' }}>Actions</label>
                    <div className="form-actions">
                      <button type="button" onClick={onCancel} className="btn-cancel" disabled={loading}>
                        Hủy
                      </button>
                      <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? (
                          <>
                            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              ></path>
                            </svg>
                            <span>Đang xử lý...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                              ></path>
                            </svg>
                            <span>Lưu lại</span>
                          </>
                        )}
                      </button>
                    </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Equipment Assignment Modal */}
      {isEquipmentModalOpen && createdEmployee && (
        <EquipmentAssignment
          employee={createdEmployee}
          onComplete={() => {
            setIsEquipmentModalOpen(false);
            setCreatedEmployee(null);
            if (showToast) {
              showToast('Đã cập nhật vật dụng cho nhân viên thành công!', 'success');
            }
            onSuccess(createdEmployee);
          }}
          onCancel={() => {
            setIsEquipmentModalOpen(false);
            setCreatedEmployee(null);
            onSuccess(createdEmployee);
          }}
          currentUser={currentUser}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default EmployeeForm;
