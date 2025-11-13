import React, { useState, useEffect, useRef } from 'react';
import StatisticsCards from './StatisticsCards';
import EmployeeTable from '../EmployeeTable/EmployeeTable';
import { statisticsAPI, employeesAPI } from '../../services/api';
import { exportEmployeeTemplate, exportEmployeesToExcel, parseExcelFile } from '../../utils/excelUtils';
import './Dashboard.css';

const Dashboard = ({ onAddEmployee, employees, onRefreshEmployees, currentUser, showToast, showConfirm, onUpdateEquipment }) => {
  const [statistics, setStatistics] = useState({
    tongNhanVien: 0,
    tyLeTheoPhongBan: [],
    donNghiPhep: 0,
    donNghiViec: 0,
    offboarding: 0,
    nghiPhepConLai: 0,
    donDaDuyet: 0,
    choDuyet: 0,
    tyLeNghiPhep: 0,
  });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const [branchFilter, setBranchFilter] = useState('');
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const branchSelectRef = useRef(null);

  useEffect(() => {
    if (!branchDropdownOpen) {
      return undefined;
    }
    const handleClickOutside = (event) => {
      if (branchSelectRef.current && !branchSelectRef.current.contains(event.target)) {
        setBranchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [branchDropdownOpen]);

  useEffect(() => {
    fetchStatistics();
    // Chỉ fetch lại khi employees thay đổi (thêm/sửa/xóa nhân viên)
  }, [employees.length]);

  const handleExportTemplate = () => {
    exportEmployeeTemplate();
    if (showToast) {
      showToast('Đã xuất file mẫu Excel', 'success');
    }
  };

  const handleExportEmployees = () => {
    exportEmployeesToExcel(employees);
    if (showToast) {
      showToast('Đã xuất danh sách nhân viên ra Excel', 'success');
    }
  };

  const BRANCH_OPTIONS = [
    { value: '', label: 'Tất cả chi nhánh' },
    { value: 'Head Office', label: 'Head Office' },
    { value: 'Hà Nội', label: 'Hà Nội' },
    { value: 'Hồ Chí Minh', label: 'Hồ Chí Minh' },
    { value: 'Quảng Ngãi', label: 'Quảng Ngãi' },
  ];

  const getBranchLabel = (value) => BRANCH_OPTIONS.find((option) => option.value === value)?.label || 'Tất cả chi nhánh';

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      if (showToast) {
        showToast('Vui lòng chọn file Excel (.xlsx hoặc .xls)', 'error');
      }
      return;
    }

    setImporting(true);

    try {
      // Parse Excel file
      const employeesData = await parseExcelFile(file);

      if (employeesData.length === 0) {
        if (showToast) {
          showToast('Không tìm thấy dữ liệu nhân viên trong file', 'error');
        }
        return;
      }

      console.log('[Import] Sample parsed employee:', employeesData[0]);

      // Confirm import
      const confirmed = await showConfirm({
        title: 'Xác nhận import',
        message: `Bạn có muốn import ${employeesData.length} nhân viên từ file Excel?`,
        confirmText: 'Import',
        cancelText: 'Hủy',
        type: 'info',
      });

      if (!confirmed) {
        setImporting(false);
        return;
      }

      // Import employees
      const response = await employeesAPI.bulkCreate(employeesData);

      if (response.data.success) {
        const { successCount, failedCount, failed, placeholders } = response.data.data;

        // Log details to help inspection
        if (process.env.NODE_ENV === 'development') {
          console.group('Bulk Import Result');
          console.log('Success count:', successCount);
          console.log('Failed count:', failedCount);
          if (failedCount > 0) {
            console.log('Failed rows:', failed);
          }
          if (placeholders && placeholders.length > 0) {
            console.log('Generated placeholders:', placeholders);
          }
          console.groupEnd();
        }

        if (showToast) {
          if (failedCount === 0) {
            showToast(`Đã import thành công ${successCount} nhân viên`, 'success');
          } else {
            // Show detailed error message
            let errorMsg = `Đã import thành công ${successCount} nhân viên, ${failedCount} nhân viên thất bại.`;
            if (failed && failed.length > 0) {
              const firstError = failed[0];
              errorMsg += `\nVí dụ: ${firstError.data?.hoTen || 'N/A'} - ${firstError.error}`;
            }
            showToast(errorMsg, 'warning');
          }
        }

        // Refresh employees list
        if (onRefreshEmployees) {
          onRefreshEmployees();
        }
      } else {
        if (showToast) {
          showToast(response.data.message || 'Lỗi khi import nhân viên', 'error');
        }
      }
    } catch (error) {
      console.error('Error importing employees:', error);
      if (showToast) {
        showToast(error.message || 'Lỗi khi đọc file Excel', 'error');
      }
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await statisticsAPI.getStatistics();
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
      // Giữ lại giá trị cũ nếu lỗi
    } finally {
      setLoading(false);
    }
  };

  const renderSummaryCards = () => (
    <>
      {/* Card 1: Đơn nghỉ phép chờ duyệt */}
      <div className="summary-card">
        <div className="summary-card-content">
          <div>
            <p className="summary-card-label">Đơn nghỉ phép</p>
            <p className="summary-card-value blue">{statistics.donNghiPhep || 0}</p>
          </div>
          <div className="summary-card-icon blue">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
              </path>
            </svg>
          </div>
        </div>
      </div>

      {/* Card 2: Đơn nghỉ việc chờ duyệt */}
      <div className="summary-card">
        <div className="summary-card-content">
          <div>
            <p className="summary-card-label">Đơn nghỉ việc</p>
            <p className="summary-card-value orange">{statistics.donNghiViec || 0}</p>
          </div>
          <div className="summary-card-icon orange">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 4v16m8-8H4"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Card 3: Quy trình Offboarding */}
      <div className="summary-card">
        <div className="summary-card-content">
          <div>
            <p className="summary-card-label">Offboarding</p>
            <p className="summary-card-value green">{statistics.offboarding || 0}</p>
          </div>
          <div className="summary-card-icon green">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z">
              </path>
            </svg>
          </div>
        </div>
      </div>

      {/* Card 4: Ngày nghỉ phép còn lại */}
      <div className="summary-card">
        <div className="summary-card-content">
          <div>
            <p className="summary-card-label">Nghỉ phép còn lại</p>
            <p className="summary-card-value purple">{statistics.nghiPhepConLai || 0}</p>
          </div>
          <div className="summary-card-icon purple">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="dashboard-view">
      {/* Company Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-header-title">Dashboard</h1>
      </div>

      {/* Summary Cards Row 1 */}
      <div className="summary-cards-wrapper">
        <div className="summary-cards-row">
          {renderSummaryCards()}
        </div>
      </div>

      {/* Statistics Cards Row 2 */}
      <StatisticsCards statistics={statistics} loading={loading} />

      {/* Employee Table & Statistics */}
      <div className="dashboard-main-grid">
        {/* Employee Table */}
        <div className="employee-table-section">
          <div className="employee-table-header">
            <div className="employee-table-title-wrapper">
              <h2 className="employee-table-title">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z">
                  </path>
                </svg>
                Danh sách nhân viên
              </h2>
              <div className="employee-table-title-meta">
                <span className="employee-table-count">
                  Tổng: <strong>{statistics.tongNhanVien || employees.length}</strong> nhân viên
                </span>
                <div ref={branchSelectRef} className={`branch-select ${branchDropdownOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="branch-select-trigger"
                    onClick={() => setBranchDropdownOpen((prev) => !prev)}
                  >
                    <span>{getBranchLabel(branchFilter)}</span>
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>
                  </button>
                  <div className="branch-select-menu">
                    {BRANCH_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option.value || 'all'}
                        className={`branch-select-option ${branchFilter === option.value ? 'active' : ''}`}
                        onClick={() => {
                          setBranchFilter(option.value);
                          setBranchDropdownOpen(false);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Chỉ hiển thị các nút quản trị cho HR, ADMIN - không hiển thị cho EMPLOYEE */}
            {currentUser?.role !== 'EMPLOYEE' && (
              <div className="employee-table-actions-group">
                <button
                  className="btn-action-secondary"
                  onClick={handleExportTemplate}
                  title="Xuất file mẫu Excel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                    </path>
                  </svg>
                  <span>Xuất mẫu</span>
                </button>
                <button
                  className="btn-action-secondary"
                  onClick={handleExportEmployees}
                  title="Xuất danh sách nhân viên ra Excel"
                  disabled={employees.length === 0}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4">
                    </path>
                  </svg>
                  <span>Xuất Excel</span>
                </button>
                <button
                  className="btn-action-secondary"
                  onClick={handleImportClick}
                  disabled={importing}
                  title="Import nhân viên từ file Excel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12">
                    </path>
                  </svg>
                  <span>{importing ? 'Đang import...' : 'Import Excel'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <button className="btn-add-employee-header" onClick={onAddEmployee}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M12 4v16m8-8H4"></path>
                  </svg>
                  <span>Thêm nhân viên</span>
                </button>
              </div>
            )}
          </div>
          <EmployeeTable
            employees={employees}
            onRefresh={onRefreshEmployees}
            currentUser={currentUser}
            showToast={showToast}
            showConfirm={showConfirm}
            onUpdateEquipment={onUpdateEquipment}
            branchFilter={branchFilter}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
