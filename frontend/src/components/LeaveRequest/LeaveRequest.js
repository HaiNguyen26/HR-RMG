import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { leaveRequestsAPI, employeesAPI } from '../../services/api';
import { formatDateToISO, parseISODateString, today } from '../../utils/dateUtils';
import { DATE_PICKER_LOCALE } from '../../utils/datepickerLocale';
import './LeaveRequest.css';

const LeaveRequest = ({ currentUser, showToast }) => {
  const [requestType, setRequestType] = useState('leave'); // 'leave' or 'resign'
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [employeeProfile, setEmployeeProfile] = useState(null);

  // Fetch employee profile to get manager info
  useEffect(() => {
    const fetchEmployeeProfile = async () => {
      if (!currentUser) return;

      try {
        // Try to get employee profile by user ID
        const candidateIds = [
          currentUser.employeeId,
          currentUser.employee_id,
          currentUser.employee?.id,
          currentUser.id
        ]
          .filter(Boolean)
          .map(id => {
            if (typeof id === 'number') return id;
            const str = String(id).trim();
            const numericMatch = str.match(/^\d+/);
            if (numericMatch) {
              return parseInt(numericMatch[0], 10);
            }
            return null;
          })
          .filter(id => id !== null && !isNaN(id) && id > 0);

        let profile = null;

        for (const id of candidateIds) {
          try {
            const response = await employeesAPI.getById(id);
            if (response.data?.data) {
              profile = response.data.data;
              break;
            }
          } catch (err) {
            if (err.response?.status !== 404) {
              console.warn('[LeaveRequest] Error fetching employee:', err);
            }
          }
        }

        // If not found by ID, try fetching all and matching
        if (!profile) {
          try {
            const allResponse = await employeesAPI.getAll();
            const employees = allResponse.data?.data || [];
            profile = employees.find((emp) => {
              const targetIds = new Set([
                currentUser.id,
                currentUser.employeeId,
                currentUser.employee_id,
              ].filter(Boolean));
              return targetIds.has(emp.id) || targetIds.has(emp.employeeId) || targetIds.has(emp.employee_id);
            }) || null;
          } catch (err) {
            console.error('[LeaveRequest] Error fetching all employees:', err);
          }
        }

        setEmployeeProfile(profile);
      } catch (error) {
        console.error('[LeaveRequest] Error fetching employee profile:', error);
      }
    };

    fetchEmployeeProfile();
  }, [currentUser]);


  // Helper to get value from multiple sources
  const getValue = (...keys) => {
    const sources = [employeeProfile, currentUser];
    for (const source of sources) {
      if (!source) continue;
      for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
    }
    return null;
  };

  const directManagerName = getValue('quanLyTrucTiep', 'quan_ly_truc_tiep') || 'Chưa cập nhật';

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const handleDateChange = (field) => (date) => {
    if (!date) {
      handleInputChange(field, '');
      if (field === 'startDate' && requestType === 'leave') {
        handleInputChange('endDate', '');
      }
    } else {
      handleInputChange(field, formatDateToISO(date));
      // If start date changes and is after end date, clear end date
      if (field === 'startDate' && requestType === 'leave' && formData.endDate) {
        const endDate = parseISODateString(formData.endDate);
        if (endDate && endDate < date) {
          handleInputChange('endDate', '');
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentUser?.id) {
      setError('Không xác định được thông tin nhân viên. Vui lòng đăng nhập lại.');
      return;
    }

    // Validation
    if (!formData.startDate || !formData.reason) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    if (requestType === 'leave' && !formData.endDate) {
      setError('Vui lòng chọn ngày kết thúc nghỉ phép.');
      return;
    }

    if (requestType === 'leave' && new Date(formData.startDate) > new Date(formData.endDate)) {
      setError('Ngày kết thúc phải sau ngày bắt đầu.');
      return;
    }

    if (!directManagerName || directManagerName === 'Chưa cập nhật') {
      setError('Không tìm thấy thông tin quản lý trực tiếp. Vui lòng liên hệ HR để cập nhật.');
      return;
    }

    // Quản lý gián tiếp sẽ được hệ thống tự động tìm dựa vào thông tin nhân viên
    // Không cần validate ở frontend nữa

    setLoading(true);
    try {
      const payload = {
        employeeId: currentUser.id,
        requestType: requestType === 'leave' ? 'LEAVE' : 'RESIGN',
        startDate: formData.startDate,
        endDate: requestType === 'leave' ? formData.endDate : null,
        reason: formData.reason,
        notes: formData.notes || ''
      };

      const response = await leaveRequestsAPI.create(payload);

      if (response.data.success) {
        if (showToast) {
          showToast(
            requestType === 'leave'
              ? 'Đơn xin nghỉ phép đã được gửi thành công!'
              : 'Đơn xin nghỉ việc đã được gửi thành công!',
            'success'
          );
        }
        // Reset form
        setFormData({
          startDate: '',
          endDate: '',
          reason: '',
          notes: ''
        });
      } else {
        throw new Error(response.data.message || 'Không thể gửi đơn. Vui lòng thử lại.');
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
      setError(message);
      if (showToast) {
        showToast(message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const startDateValue = parseISODateString(formData.startDate);
  const endDateValue = parseISODateString(formData.endDate);

  return (
    <div className="leave-request-container">
      {/* Header with Title */}
      <div className="leave-request-header">
        <div className="leave-request-header-content">
          <button
            className="leave-request-back-button"
            onClick={() => {
              // Navigate back if needed - currently just placeholder
            }}
            style={{ display: 'none' }}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
          </button>
          <div className="leave-request-icon-wrapper">
            <svg className="leave-request-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div>
            <h1 className="leave-request-title">
              {requestType === 'leave' ? 'Đơn xin nghỉ phép' : 'Đơn xin nghỉ việc'}
            </h1>
            <p className="leave-request-subtitle">
              Điền đầy đủ thông tin để gửi đơn đến quản lý duyệt.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - 2 Columns */}
      <div className="leave-request-content">
        {/* Left Column - Form */}
        <div className="leave-request-form-wrapper">
          <form onSubmit={handleSubmit} className="leave-request-form">
            {/* Error Message */}
            {error && (
              <div className="leave-request-error">
                <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Request Type Tabs */}
            <div className="leave-request-type-tabs">
              <button
                type="button"
                className={`leave-type-tab ${requestType === 'leave' ? 'active' : ''}`}
                onClick={() => {
                  setRequestType('leave');
                  setError('');
                }}
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <span>Xin nghỉ phép</span>
              </button>
              <button
                type="button"
                className={`leave-type-tab ${requestType === 'resign' ? 'active' : ''}`}
                onClick={() => {
                  setRequestType('resign');
                  setError('');
                  // Clear end date for resign
                  handleInputChange('endDate', '');
                }}
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
                <span>Xin nghỉ việc</span>
              </button>
            </div>

            {/* Form Fields */}
            <div className="leave-form-fields">
              {/* Date Fields */}
              <div className="leave-form-row">
                <div className="leave-form-group">
                  <label className="leave-form-label">
                    {requestType === 'leave' ? 'Ngày bắt đầu nghỉ *' : 'Ngày nghỉ việc *'}
                  </label>
                  <div className="leave-date-picker-wrapper">
                    <DatePicker
                      selected={startDateValue}
                      onChange={handleDateChange('startDate')}
                      minDate={today()}
                      dateFormat="dd/MM/yyyy"
                      locale={DATE_PICKER_LOCALE}
                      placeholderText="dd/mm/yyyy"
                      className="leave-form-datepicker"
                      required
                      autoComplete="off"
                    />
                    <svg className="leave-date-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                </div>

                {requestType === 'leave' && (
                  <div className="leave-form-group">
                    <label className="leave-form-label">Ngày kết thúc nghỉ *</label>
                    <div className="leave-date-picker-wrapper">
                      <DatePicker
                        selected={endDateValue}
                        onChange={handleDateChange('endDate')}
                        minDate={startDateValue || today()}
                        dateFormat="dd/MM/yyyy"
                        locale={DATE_PICKER_LOCALE}
                        placeholderText="dd/mm/yyyy"
                        className="leave-form-datepicker"
                        required
                        disabled={!startDateValue}
                        autoComplete="off"
                      />
                      <svg className="leave-date-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Manager Field */}
              <div className="leave-form-group">
                <label className="leave-form-label">Quản lý duyệt đơn *</label>
                <input
                  type="text"
                  className="leave-form-input leave-form-input-readonly"
                  value={directManagerName}
                  readOnly
                  disabled
                />
                <p className="leave-form-hint">
                  Thông tin quản lý trực tiếp từ hồ sơ nhân sự. Nếu quá 24h không duyệt, HR sẽ đẩy đơn lên giám đốc.
                </p>
              </div>

              {/* Reason Field */}
              <div className="leave-form-group">
                <label className="leave-form-label">
                  Lý do {requestType === 'leave' ? 'xin nghỉ phép' : 'xin nghỉ việc'} *
                </label>
                <textarea
                  className="leave-form-textarea"
                  rows="3"
                  value={formData.reason}
                  onChange={(e) => handleInputChange('reason', e.target.value)}
                  placeholder={
                    requestType === 'leave'
                      ? 'Vui lòng nhập lý do xin nghỉ phép...'
                      : 'Vui lòng nhập lý do xin nghỉ việc...'
                  }
                  required
                />
              </div>

              {/* Notes Field */}
              <div className="leave-form-group">
                <label className="leave-form-label">Ghi chú thêm (tùy chọn)</label>
                <textarea
                  className="leave-form-textarea"
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Thêm ghi chú nếu cần..."
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="leave-submit-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="leave-button-spinner"></div>
                  <span>Đang gửi...</span>
                </>
              ) : (
                <>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="leave-submit-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                  </svg>
                  <span>Gửi đơn</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column - Leave Policy & Process Panel */}
        <div className="leave-request-panel">
          <div className="leave-policy-card">
            <div className="leave-policy-header">
              <svg className="leave-policy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h2 className="leave-policy-title">Quy trình & Nội quy xin nghỉ</h2>
            </div>
            <div className="leave-policy-content">
              <div className="leave-policy-placeholder">
                <p>Nội dung quy trình và nội quy xin nghỉ sẽ được cập nhật tại đây.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequest;
