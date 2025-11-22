import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { employeesAPI, requestsAPI, equipmentAPI } from '../../services/api';
import './EmployeeTable.css';

// Custom Dropdown Component
const CustomDropdown = ({ id, value, onChange, options, placeholder, error, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value) || null;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (option) => {
    if (option.value === '') return; // Prevent selecting placeholder
    onChange({ target: { value: option.value } });
    setIsOpen(false);
  };

  // Filter out placeholder option (empty value) from display
  const displayOptions = options.filter(opt => opt.value !== '');

  return (
    <div className={`custom-dropdown-wrapper ${className} ${error ? 'error' : ''}`} ref={dropdownRef}>
      <button
        id={id}
        type="button"
        className={`custom-dropdown-trigger ${isOpen ? 'open' : ''} ${error ? 'error' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        aria-labelledby={id ? `${id}-label` : undefined}
      >
        <span className="custom-dropdown-value">
          {selectedOption && selectedOption.value !== '' ? selectedOption.label : placeholder}
        </span>
        <svg className="custom-dropdown-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>
      {isOpen && (
        <div className="custom-dropdown-menu">
          {displayOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`custom-dropdown-option ${value === option.value ? 'selected' : ''}`}
              onClick={() => handleSelect(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const EmployeeTable = ({ employees, onRefresh, currentUser, showToast, showConfirm, onUpdateEquipment, branchFilter }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    mode: 'view',
    employee: null,
    equipment: [],
    loading: false,
  });
  const [editForm, setEditForm] = useState({
    hoTen: '',
    chiNhanh: '',
    chucDanh: '',
    phongBan: '',
    boPhan: '',
    ngayGiaNhap: '',
    quanLyTrucTiep: '',
    quanLyGianTiep: ''
  });
  const [formError, setFormError] = useState('');

  const userRole = currentUser?.role?.toUpperCase();
  const canManage = userRole === 'HR' || userRole === 'ADMIN';

  const getDepartmentLabel = (dept) => {
    const labels = {
      IT: 'Phòng IT',
      HR: 'Hành chính nhân sự',
      ACCOUNTING: 'Kế toán',
      OTHER: 'Phòng ban khác',
    };
    return labels[dept] || dept || '-';
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const normalizeDateForInput = (dateString) => {
    if (!dateString) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().split('T')[0];
  };

  const combineEquipmentData = async (employeeId) => {
    const combined = [];

    try {
      const requestsResponse = await requestsAPI.getAll({ employeeId });
      if (requestsResponse.data.success) {
        const requests = requestsResponse.data.data || [];
        requests.forEach((request) => {
          if (Array.isArray(request.items_detail)) {
            request.items_detail.forEach((item) => {
              if (item.status === 'COMPLETED' && item.quantity_provided > 0) {
                combined.push({
                  name: item.item_name,
                  quantity: item.quantity_provided,
                  department: request.target_department,
                  providedAt: item.provided_at,
                  providedBy: item.provided_by_name || 'HR',
                });
              }
            });
          }
        });
      }
    } catch (requestsError) {
      console.error('Error fetching requests for employee:', requestsError);
    }

    try {
      const equipmentResponse = await equipmentAPI.getByEmployeeId(employeeId);
      if (equipmentResponse.data.success) {
        const directEquipment = equipmentResponse.data.data || [];
        directEquipment.forEach((eq) => {
          combined.push({
            name: eq.ten_vat_dung,
            quantity: eq.so_luong,
            department: eq.phong_ban,
            providedAt: eq.ngay_phan_cong || eq.created_at,
            providedBy: eq.created_by || 'HR',
          });
        });
      }
    } catch (equipmentError) {
      console.error('Error fetching direct equipment for employee:', equipmentError);
    }

    combined.sort((a, b) => {
      const dateA = a.providedAt ? new Date(a.providedAt) : new Date(0);
      const dateB = b.providedAt ? new Date(b.providedAt) : new Date(0);
      return dateB - dateA;
    });

    return combined;
  };

  const handleRowClick = async (employee) => {
    setDetailModal({
      isOpen: true,
      mode: 'view',
      employee,
      equipment: [],
      loading: true,
    });

    const equipment = await combineEquipmentData(employee.id);
    setDetailModal((prev) => ({
      ...prev,
      equipment,
      loading: false,
    }));
  };

  const closeModal = () => {
    setDetailModal({ isOpen: false, mode: 'view', employee: null, equipment: [], loading: false });
    setEditForm({
      hoTen: '',
      chiNhanh: '',
      chucDanh: '',
      phongBan: '',
      boPhan: '',
      ngayGiaNhap: '',
      quanLyTrucTiep: '',
      quanLyGianTiep: ''
    });
    setFormError('');
  };

  const startEditing = () => {
    if (!detailModal.employee || !canManage) return;
    const emp = detailModal.employee;
    setEditForm({
      hoTen: emp.ho_ten || '',
      chiNhanh: emp.chi_nhanh || emp.chiNhanh || '',
      chucDanh: emp.chuc_danh || '',
      phongBan: emp.phong_ban || '',
      boPhan: emp.bo_phan || '',
      ngayGiaNhap: normalizeDateForInput(emp.ngay_gia_nhap),
      quanLyTrucTiep: emp.quan_ly_truc_tiep || emp.quanLyTrucTiep || '',
      quanLyGianTiep: emp.quan_ly_gian_tiep || emp.quanLyGianTiep || ''
    });
    setFormError('');
    setDetailModal((prev) => ({ ...prev, mode: 'edit' }));
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateEquipmentClick = () => {
    if (detailModal.employee && onUpdateEquipment) {
      onUpdateEquipment(detailModal.employee);
    }
    closeModal();
  };

  const handleCancelEdit = () => {
    setFormError('');
    setDetailModal((prev) => ({ ...prev, mode: 'view' }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!detailModal.employee || !canManage) return;

    if (!editForm.hoTen || !editForm.chucDanh || !editForm.phongBan || !editForm.boPhan || !editForm.ngayGiaNhap) {
      setFormError('Vui lòng điền đầy đủ các trường bắt buộc.');
      return;
    }

    setLoading(true);
    setFormError('');

    try {
      const payload = {
        hoTen: editForm.hoTen.trim(),
        chucDanh: editForm.chucDanh.trim(),
        phongBan: editForm.phongBan,
        boPhan: editForm.boPhan.trim(),
        chiNhanh: editForm.chiNhanh?.trim() || null,
        ngayGiaNhap: editForm.ngayGiaNhap,
        quanLyTrucTiep: editForm.quanLyTrucTiep?.trim() || null,
        quanLyGianTiep: editForm.quanLyGianTiep?.trim() || null,
      };

      const response = await employeesAPI.update(detailModal.employee.id, payload);
      if (response.data.success) {
        const updatedEmployee = response.data.data;
        if (showToast) {
          showToast('Cập nhật thông tin nhân viên thành công!', 'success');
        }
        setDetailModal((prev) => ({
          ...prev,
          mode: 'view',
          employee: updatedEmployee,
        }));
        if (onRefresh) {
          onRefresh();
        }
      } else {
        const message = response.data.message || 'Không thể cập nhật nhân viên';
        setFormError(message);
        if (showToast) {
          showToast(message, 'error');
        }
      }
    } catch (updateError) {
      const message = updateError.response?.data?.message || 'Lỗi khi cập nhật nhân viên';
      setFormError(message);
      if (showToast) {
        showToast(message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!detailModal.employee || !canManage) return;

    let confirmed = true;
    if (showConfirm) {
      confirmed = await showConfirm({
        title: 'Xóa nhân viên',
        message: `Bạn có chắc chắn muốn xóa nhân viên "${detailModal.employee.ho_ten}"?`,
        confirmText: 'Xóa',
        cancelText: 'Hủy',
        type: 'danger',
      });
    } else {
      confirmed = window.confirm(`Bạn có chắc chắn muốn xóa nhân viên "${detailModal.employee.ho_ten}"?`);
    }

    if (!confirmed) return;

    setLoading(true);
    setError('');

    try {
      const response = await employeesAPI.delete(detailModal.employee.id);
      if (response.data.success) {
        if (showToast) {
          showToast('Xóa nhân viên thành công!', 'success');
        }
        closeModal();
        onRefresh && onRefresh();
      } else {
        const message = response.data.message || 'Không thể xóa nhân viên';
        setError(message);
        if (showToast) {
          showToast(message, 'error');
        }
      }
    } catch (deleteError) {
      const message = deleteError.response?.data?.message || 'Lỗi khi xóa nhân viên';
      setError(message);
      if (showToast) {
        showToast(message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderEquipmentList = () => {
    if (detailModal.loading) {
      return (
        <div className="equipment-loading">
          <div className="spinner" />
          <span>Đang tải thông tin vật dụng...</span>
        </div>
      );
    }

    if (!detailModal.equipment || detailModal.equipment.length === 0) {
      return (
        <div className="equipment-empty-state">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10a9.97 9.97 0 00-1.382-5.016L12 12"></path>
          </svg>
          <h5>Chưa có vật dụng nào</h5>
          <p>Nhân viên này chưa được cấp vật dụng trực tiếp hoặc qua yêu cầu.</p>
        </div>
      );
    }

    return (
      <div className="equipment-list">
        {detailModal.equipment.map((item, index) => (
          <div key={`${item.name}-${index}`} className="equipment-item">
            <div className="equipment-item-info">
              <h6>{item.name}</h6>
              <p>
                <span className="equipment-item-quantity">Số lượng: {item.quantity}</span>
                <span className="equipment-item-department">{getDepartmentLabel(item.department)}</span>
              </p>
            </div>
            <div className="equipment-item-meta">
              {item.providedAt && (
                <span className="equipment-item-date">Cấp ngày: {formatDateShort(item.providedAt)}</span>
              )}
              {item.providedBy && (
                <span className="equipment-item-provider">Bởi: {item.providedBy}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const normalizedFilter = branchFilter
    ? branchFilter
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    : '';
  const filteredEmployees = normalizedFilter
    ? employees.filter((employee) =>
      (employee.chi_nhanh || employee.chiNhanh || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') === normalizedFilter)
    : employees;

  return (
    <div className="employee-table-body">
      {error && (
        <div className="employee-table-error">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="table-wrapper">
        <table className="employee-table">
          <thead className="employee-table-thead">
            <tr>
              <th>Mã Nhân Viên</th>
              <th>Họ Và Tên</th>
              <th>Chi Nhánh</th>
              <th>Phòng Ban</th>
              <th>Bộ Phận</th>
              <th>Chức Danh</th>
              <th>Ngày Nhận Việc</th>
              <th>Quản Lý Trực Tiếp</th>
              <th>Quản Lý Gián Tiếp</th>
            </tr>
          </thead>
          <tbody className="employee-table-tbody">
            {!filteredEmployees || filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={9} className="employee-table-empty">
                  <div className="empty-state-content">
                    <div className="empty-state-icon">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z">
                        </path>
                      </svg>
                    </div>
                    <p className="empty-state-title">Không có nhân viên nào khớp bộ lọc</p>
                    <p className="empty-state-description">Điều chỉnh bộ lọc hoặc thử lại sau</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredEmployees.map((employee) => {
                const isPendingEquipment =
                  (employee.trang_thai || employee.trangThai || employee.status) === 'PENDING';
                return (
                  <tr key={employee.id} onClick={() => handleRowClick(employee)}>
                    <td>{employee.ma_nhan_vien || '-'}</td>
                    <td>
                      <span>{employee.ho_ten}</span>
                      {isPendingEquipment && (
                        <span className="employee-warning-text">Cần cập nhật vật dụng</span>
                      )}
                    </td>
                    <td>{employee.chi_nhanh || employee.chiNhanh || '-'}</td>
                    <td>{getDepartmentLabel(employee.phong_ban)}</td>
                    <td>{employee.bo_phan || '-'}</td>
                    <td>{employee.chuc_danh}</td>
                    <td>{formatDateShort(employee.ngay_gia_nhap)}</td>
                    <td>{employee.quan_ly_truc_tiep || employee.quanLyTrucTiep || '-'}</td>
                    <td>{employee.quan_ly_gian_tiep || employee.quanLyGianTiep || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {detailModal.isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="detail-modal-overlay" onClick={closeModal}>
            <div className="detail-modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="detail-modal-header">
                <div className="detail-modal-title-wrapper">
                  {detailModal.mode === 'edit' && (
                    <div className="detail-modal-icon-edit">
                      <svg className="detail-modal-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                  )}
                  <h2 className="detail-modal-title">
                    {detailModal.mode === 'view' 
                      ? 'Thông tin nhân viên' 
                      : `Chỉnh sửa Hồ sơ ${detailModal.employee?.ho_ten || detailModal.employee?.hoTen || 'Nhân viên'}`}
                  </h2>
                </div>
                <button className="detail-modal-close" onClick={closeModal}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="detail-modal-body">
                {detailModal.mode === 'edit' ? (
                  <form onSubmit={handleEditSubmit} className="detail-form">
                    {/* Section 01: Thông tin cá nhân */}
                    <div className="detail-form-section">
                      <div className="detail-section-header">
                        <span className="detail-section-badge">01</span>
                        <h3 className="detail-section-title">Thông tin cá nhân</h3>
                      </div>
                      <div className="detail-form-grid">
                        <div className="form-group">
                          <label htmlFor="hoTen">Họ và tên *</label>
                          <input
                            type="text"
                            id="hoTen"
                            name="hoTen"
                            value={editForm.hoTen}
                            onChange={handleEditChange}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="chiNhanh">Chi nhánh</label>
                          <input
                            type="text"
                            id="chiNhanh"
                            name="chiNhanh"
                            value={editForm.chiNhanh}
                            onChange={handleEditChange}
                            placeholder="VD: Hà Nội, Hồ Chí Minh..."
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="ngayGiaNhap">Ngày nhận việc *</label>
                          <input
                            type="date"
                            id="ngayGiaNhap"
                            name="ngayGiaNhap"
                            value={editForm.ngayGiaNhap}
                            onChange={handleEditChange}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 02: Công việc & Tổ chức */}
                    <div className="detail-form-section">
                      <div className="detail-section-header">
                        <span className="detail-section-badge">02</span>
                        <h3 className="detail-section-title">Công việc & Tổ chức</h3>
                      </div>
                      <div className="detail-form-grid">
                        <div className="form-group">
                          <label htmlFor="chucDanh">Chức danh *</label>
                          <input
                            type="text"
                            id="chucDanh"
                            name="chucDanh"
                            value={editForm.chucDanh}
                            onChange={handleEditChange}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="phongBan">Phòng ban *</label>
                          <CustomDropdown
                            id="phongBan"
                            value={editForm.phongBan}
                            onChange={handleEditChange}
                            options={[
                              { value: '', label: 'Chọn phòng ban' },
                              { value: 'IT', label: 'Phòng IT' },
                              { value: 'HR', label: 'Hành chính nhân sự' },
                              { value: 'ACCOUNTING', label: 'Kế toán' },
                              { value: 'OTHER', label: 'Phòng ban khác' }
                            ]}
                            placeholder="Chọn phòng ban"
                            className="detail-form-custom-dropdown"
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="boPhan">Bộ phận *</label>
                          <input
                            type="text"
                            id="boPhan"
                            name="boPhan"
                            value={editForm.boPhan}
                            onChange={handleEditChange}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="quanLyTrucTiep">Quản lý trực tiếp</label>
                          <input
                            type="text"
                            id="quanLyTrucTiep"
                            name="quanLyTrucTiep"
                            value={editForm.quanLyTrucTiep}
                            onChange={handleEditChange}
                            placeholder="Ví dụ: Nguyễn Văn A"
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="quanLyGianTiep">Quản lý gián tiếp</label>
                          <input
                            type="text"
                            id="quanLyGianTiep"
                            name="quanLyGianTiep"
                            value={editForm.quanLyGianTiep}
                            onChange={handleEditChange}
                            placeholder="Ví dụ: Trần Thị B"
                          />
                        </div>
                      </div>
                    </div>
                    {formError && <p className="form-error">{formError}</p>}
                    {canManage && (
                      <div className="detail-modal-actions">
                        <button type="submit" className="action-btn save-btn" disabled={loading}>
                          {loading ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span>Đang lưu...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Lưu thay đổi</span>
                            </>
                          )}
                        </button>
                        <button type="button" onClick={handleCancelEdit} className="action-btn cancel-btn">
                          Hủy
                        </button>
                      </div>
                    )}
                  </form>
                ) : (
                  <>
                    <div className="detail-info-card">
                      <div className="detail-info-header">
                        <div className="detail-info-header-left">
                          <h3>{detailModal.employee.ho_ten}</h3>
                          <p>{detailModal.employee.chuc_danh || 'Chức danh chưa cập nhật'}</p>
                          <div className="detail-info-contact">
                            <span>Mã NV:</span>
                            <strong>{detailModal.employee.ma_nhan_vien || detailModal.employee.maNhanVien || '-'}</strong>
                          </div>
                        </div>
                        {canManage && (
                          <div className="detail-info-actions">
                            <button type="button" onClick={startEditing} className="action-btn edit-btn">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Chỉnh sửa
                            </button>
                            <button type="button" onClick={handleUpdateEquipmentClick} className="action-btn update-equipment-btn">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Cập nhật vật dụng
                            </button>
                            <button type="button" onClick={handleDelete} className="action-btn delete-btn" disabled={loading}>
                              {loading ? 'Đang xóa...' : 'Xóa nhân viên'}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="detail-info-grid">
                        <div className="detail-info-item">
                          <span className="detail-info-label">Mã nhân viên</span>
                          <p>{detailModal.employee.ma_nhan_vien || '-'}</p>
                        </div>
                        <div className="detail-info-item">
                          <span className="detail-info-label">Chi nhánh</span>
                          <p>{detailModal.employee.chi_nhanh || detailModal.employee.chiNhanh || '-'}</p>
                        </div>
                        <div className="detail-info-item">
                          <span className="detail-info-label">Chức danh</span>
                          <p>{detailModal.employee.chuc_danh || '-'}</p>
                        </div>
                        <div className="detail-info-item">
                          <span className="detail-info-label">Phòng ban</span>
                          <p>{getDepartmentLabel(detailModal.employee.phong_ban)}</p>
                        </div>
                        <div className="detail-info-item">
                          <span className="detail-info-label">Bộ phận</span>
                          <p>{detailModal.employee.bo_phan || '-'}</p>
                        </div>
                        <div className="detail-info-item">
                          <span className="detail-info-label">Ngày nhận việc</span>
                          <p>{formatDateShort(detailModal.employee.ngay_gia_nhap)}</p>
                        </div>
                        <div className="detail-info-item">
                          <span className="detail-info-label">Quản lý trực tiếp</span>
                          <p>{detailModal.employee.quan_ly_truc_tiep || detailModal.employee.quanLyTrucTiep || '-'}</p>
                        </div>
                        <div className="detail-info-item">
                          <span className="detail-info-label">Quản lý gián tiếp</span>
                          <p>{detailModal.employee.quan_ly_gian_tiep || detailModal.employee.quanLyGianTiep || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="detail-equipment-section">
                      <h3>Vật dụng đã cấp</h3>
                      {renderEquipmentList()}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default EmployeeTable;
