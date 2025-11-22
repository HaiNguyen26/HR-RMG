import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { employeesAPI, attendanceAdjustmentsAPI } from '../../services/api';
import { formatDateToISO, parseISODateString, today } from '../../utils/dateUtils';
import { DATE_PICKER_LOCALE } from '../../utils/datepickerLocale';
import './AttendanceRequest.css';

const ATTENDANCE_TYPE_OPTIONS = [
  {
    value: 'CHECK_IN',
    label: 'Quên giờ vào',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
  },
  {
    value: 'CHECK_OUT',
    label: 'Quên giờ ra',
    icon: 'M11 17l8-8m0 0V3m0 8H7'
  },
  {
    value: 'BOTH',
    label: 'Quên cả giờ vào và ra',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
  }
];

const AttendanceRequest = ({ currentUser, showToast }) => {
  const [formData, setFormData] = useState({
    date: '',
    checkType: '',
    checkInTime: '',
    checkOutTime: '',
    reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [employeeProfile, setEmployeeProfile] = useState(null);

  // Fetch employee profile to get manager info
  useEffect(() => {
    const fetchEmployeeProfile = async () => {
      if (!currentUser) return;

      try {
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
            continue;
          }
        }

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
            console.error('[AttendanceRequest] Error fetching all employees:', err);
          }
        }

        setEmployeeProfile(profile);
      } catch (error) {
        console.error('[AttendanceRequest] Error fetching employee profile:', error);
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

  const directManagerName = getValue('quanLyTrucTiep', 'quan_ly_truc_tiep', 'team_lead_name') || 'Chưa cập nhật';

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };

      // Clear time fields when checkType changes
      if (field === 'checkType') {
        if (value === 'CHECK_OUT') {
          next.checkInTime = '';
        } else if (value === 'CHECK_IN') {
          next.checkOutTime = '';
        }
      }

      return next;
    });
    setError('');
  };

  const handleDateChange = (date) => {
    if (!date) {
      handleInputChange('date', '');
    } else {
      handleInputChange('date', formatDateToISO(date));
    }
  };

  const handleTimeChange = (field) => (e) => {
    const value = e.target.value;
    // Validate time format hh:mm
    if (value === '' || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      handleInputChange(field, value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.date || !formData.checkType || !formData.reason) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    if (formData.checkType !== 'CHECK_OUT' && !formData.checkInTime) {
      setError('Vui lòng nhập giờ vào thực tế.');
      return;
    }

    if (formData.checkType !== 'CHECK_IN' && !formData.checkOutTime) {
      setError('Vui lòng nhập giờ ra thực tế.');
      return;
    }

    if (formData.checkType === 'BOTH' && formData.checkInTime && formData.checkOutTime) {
      const [inHour, inMin] = formData.checkInTime.split(':').map(Number);
      const [outHour, outMin] = formData.checkOutTime.split(':').map(Number);
      const inMinutes = inHour * 60 + (inMin || 0);
      const outMinutes = outHour * 60 + (outMin || 0);

      if (outMinutes <= inMinutes) {
        setError('Giờ ra phải sau giờ vào.');
        return;
      }
    }

    setLoading(true);
    try {
      if (!currentUser?.id) {
        setError('Không xác định được thông tin nhân viên. Vui lòng đăng nhập lại.');
        return;
      }

      const payload = {
        employeeId: currentUser.id,
        adjustmentDate: formData.date,
        checkType: formData.checkType,
        checkInTime: formData.checkInTime || null,
        checkOutTime: formData.checkOutTime || null,
        reason: formData.reason
      };

      const response = await attendanceAdjustmentsAPI.create(payload);

      if (response.data?.success) {
        if (showToast) {
          showToast('Đơn bổ sung chấm công đã được gửi thành công!', 'success');
        }

        // Reset form
        setFormData({
          date: '',
          checkType: '',
          checkInTime: '',
          checkOutTime: '',
          reason: ''
        });
      } else {
        throw new Error(response.data?.message || 'Không thể gửi đơn. Vui lòng thử lại.');
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

  return (
    <div className="attendance-request-container">
      {/* Header with Title */}
      <div className="attendance-request-header">
        <div className="attendance-request-header-content">
          <div className="attendance-request-icon-wrapper">
            <svg className="attendance-request-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div>
            <h1 className="attendance-request-title">Đơn Bổ sung Chấm công</h1>
            <p className="attendance-request-subtitle">
              Điền đầy đủ thông tin để gửi đơn bổ sung chấm công đến quản lý duyệt.
            </p>
          </div>
        </div>
      </div>

      {/* Form Box - Clean White - 2 Columns */}
      <div className="attendance-request-form-wrapper">
        <form onSubmit={handleSubmit} className="attendance-request-form">
          {/* Error Message */}
          {error && (
            <div className="attendance-request-error">
              <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form Content - 2 Columns */}
          <div className="attendance-form-content">
            {/* Left Column - Cột 1: Thông tin Ngày/Giờ */}
            <div className="attendance-form-column">
              {/* Section I: Thông tin cơ bản */}
              <div className="attendance-form-section">
                <h3 className="attendance-section-title">I. Thông tin cơ bản</h3>

                {/* Date Field */}
                <div className="attendance-form-group">
                  <label className="attendance-form-label">
                    <svg className="attendance-label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    <span>Ngày cần bổ sung *</span>
                  </label>
                  <div className="attendance-date-picker-wrapper">
                    <DatePicker
                      selected={formData.date ? parseISODateString(formData.date) : null}
                      onChange={handleDateChange}
                      minDate={today()}
                      dateFormat="dd/MM/yyyy"
                      locale={DATE_PICKER_LOCALE}
                      placeholderText="Chọn ngày cần bổ sung"
                      className="attendance-form-datepicker"
                      required
                      autoComplete="off"
                    />
                    <svg className="attendance-date-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                </div>

                {/* Check Type - Toggle Buttons */}
                <div className="attendance-form-group">
                  <label className="attendance-form-label">
                    <svg className="attendance-label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    <span>Mục cần bổ sung *</span>
                  </label>
                  <div className="attendance-type-toggle-buttons">
                    {ATTENDANCE_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`attendance-type-toggle-btn ${formData.checkType === option.value ? 'active' : ''}`}
                        onClick={() => handleInputChange('checkType', option.value)}
                      >
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="attendance-type-icon">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={option.icon}></path>
                        </svg>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Fields - Progressive Disclosure */}
                {(formData.checkType === 'CHECK_IN' || formData.checkType === 'BOTH') && (
                  <div className="attendance-form-group">
                    <label className="attendance-form-label">
                      <svg className="attendance-label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span>Giờ vào thực tế *</span>
                    </label>
                    <div className="attendance-time-picker-wrapper">
                      <input
                        type="time"
                        className="attendance-form-timepicker"
                        value={formData.checkInTime}
                        onChange={handleTimeChange('checkInTime')}
                        onClick={(e) => e.target.showPicker?.()}
                        required
                      />
                      <svg className="attendance-time-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </div>
                  </div>
                )}

                {(formData.checkType === 'CHECK_OUT' || formData.checkType === 'BOTH') && (
                  <div className="attendance-form-group">
                    <label className="attendance-form-label">
                      <svg className="attendance-label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span>Giờ ra thực tế *</span>
                    </label>
                    <div className="attendance-time-picker-wrapper">
                      <input
                        type="time"
                        className="attendance-form-timepicker"
                        value={formData.checkOutTime}
                        onChange={handleTimeChange('checkOutTime')}
                        onClick={(e) => e.target.showPicker?.()}
                        required
                      />
                      <svg className="attendance-time-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Cột 2: Thông tin Duyệt/Lý do */}
            <div className="attendance-form-column">
              {/* Section II: Thông tin Duyệt */}
              <div className="attendance-form-section">
                <h3 className="attendance-section-title">II. Thông tin Duyệt</h3>

                <div className="attendance-form-group">
                  <label className="attendance-form-label">
                    <svg className="attendance-label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                    <span>Quản lý trực tiếp *</span>
                  </label>
                  <div className="attendance-form-input-wrapper">
                    <input
                      type="text"
                      className="attendance-form-input attendance-form-input-readonly"
                      value={directManagerName}
                      readOnly
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* Section III: Chi tiết Giờ & Lý do */}
              <div className="attendance-form-section">
                <h3 className="attendance-section-title">III. Chi tiết Giờ & Lý do</h3>

                <div className="attendance-form-group">
                  <label className="attendance-form-label">
                    <svg className="attendance-label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <span>Lý do bổ sung *</span>
                  </label>
                  <div className="attendance-form-textarea-wrapper">
                    <textarea
                      className="attendance-form-textarea attendance-form-textarea-large"
                      value={formData.reason}
                      onChange={(e) => handleInputChange('reason', e.target.value)}
                      placeholder="Mô tả lý do quên chấm công, xác nhận của khách hàng, đồng nghiệp..."
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="attendance-submit-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="attendance-button-spinner"></div>
                <span>Đang gửi...</span>
              </>
            ) : (
              <>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="attendance-submit-icon">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
                <span>Gửi Yêu cầu Bổ sung</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AttendanceRequest;
