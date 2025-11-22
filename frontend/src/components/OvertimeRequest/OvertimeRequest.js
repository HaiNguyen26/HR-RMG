import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { employeesAPI, overtimeRequestsAPI } from '../../services/api';
import { formatDateToISO, parseISODateString, today } from '../../utils/dateUtils';
import { DATE_PICKER_LOCALE } from '../../utils/datepickerLocale';
import './OvertimeRequest.css';

const OvertimeRequest = ({ currentUser, showToast }) => {
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    estimatedHours: '',
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
            console.error('[OvertimeRequest] Error fetching all employees:', err);
          }
        }

        setEmployeeProfile(profile);
      } catch (error) {
        console.error('[OvertimeRequest] Error fetching employee profile:', error);
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

  // Calculate estimated hours
  useEffect(() => {
    if (formData.startTime && formData.endTime) {
      const [startHour, startMin] = formData.startTime.split(':').map(Number);
      const [endHour, endMin] = formData.endTime.split(':').map(Number);

      if (startHour !== undefined && endHour !== undefined) {
        const startMinutes = startHour * 60 + (startMin || 0);
        const endMinutes = endHour * 60 + (endMin || 0);

        if (endMinutes > startMinutes) {
          const totalMinutes = endMinutes - startMinutes;
          const hours = (totalMinutes / 60).toFixed(2);
          setFormData(prev => ({ ...prev, estimatedHours: hours }));
        } else {
          setFormData(prev => ({ ...prev, estimatedHours: '' }));
        }
      }
    } else {
      setFormData(prev => ({ ...prev, estimatedHours: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.startTime, formData.endTime]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
    if (!formData.date || !formData.startTime || !formData.endTime || !formData.reason) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    if (formData.startTime && formData.endTime) {
      const [startHour, startMin] = formData.startTime.split(':').map(Number);
      const [endHour, endMin] = formData.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + (startMin || 0);
      const endMinutes = endHour * 60 + (endMin || 0);

      if (endMinutes <= startMinutes) {
        setError('Giờ kết thúc phải sau giờ bắt đầu.');
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
        requestDate: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        duration: formData.estimatedHours || null,
        reason: formData.reason
      };

      const response = await overtimeRequestsAPI.create(payload);

      if (response.data?.success) {
        if (showToast) {
          showToast('Đơn xin tăng ca đã được gửi thành công!', 'success');
        }

        // Reset form
        setFormData({
          date: '',
          startTime: '',
          endTime: '',
          estimatedHours: '',
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
    <div className="overtime-request-container">
      {/* Header with Title */}
      <div className="overtime-request-header">
        <div className="overtime-request-header-content">
          <div className="overtime-request-icon-wrapper">
            <svg className="overtime-request-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
          </div>
          <div>
            <h1 className="overtime-request-title">Đơn Xin Tăng ca</h1>
            <p className="overtime-request-subtitle">
              Điền đầy đủ thông tin để gửi đơn xin tăng ca đến quản lý duyệt.
            </p>
          </div>
        </div>
      </div>

      {/* Form Box */}
      <div className="overtime-request-form-wrapper">
        <form onSubmit={handleSubmit} className="overtime-request-form">
          {/* Error Message */}
          {error && (
            <div className="overtime-request-error">
              <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="overtime-form-fields">
            {/* Date Field - Highlighted */}
            <div className="overtime-form-group overtime-date-group-highlight">
              <label className="overtime-form-label overtime-date-label-highlight">
                <svg className="overtime-label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <span>Ngày tăng ca *</span>
              </label>
              <div className="overtime-date-picker-wrapper">
                <DatePicker
                  selected={formData.date ? parseISODateString(formData.date) : null}
                  onChange={handleDateChange}
                  minDate={today()}
                  dateFormat="dd/MM/yyyy"
                  locale={DATE_PICKER_LOCALE}
                  placeholderText="Chọn ngày tăng ca"
                  className="overtime-form-datepicker"
                  required
                  autoComplete="off"
                />
                <svg className="overtime-date-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
            </div>

            {/* Time Fields */}
            <div className="overtime-form-row">
              <div className="overtime-form-group">
                <label className="overtime-form-label">
                  <svg className="overtime-label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>Giờ bắt đầu *</span>
                </label>
                <div className="overtime-time-picker-wrapper">
                  <input
                    type="time"
                    className="overtime-form-timepicker"
                    value={formData.startTime}
                    onChange={handleTimeChange('startTime')}
                    onClick={(e) => e.target.showPicker?.()}
                    required
                  />
                  <svg className="overtime-time-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
              <div className="overtime-form-group">
                <label className="overtime-form-label">
                  <svg className="overtime-label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>Giờ kết thúc *</span>
                </label>
                <div className="overtime-time-picker-wrapper">
                  <input
                    type="time"
                    className="overtime-form-timepicker"
                    value={formData.endTime}
                    onChange={handleTimeChange('endTime')}
                    onClick={(e) => e.target.showPicker?.()}
                    required
                  />
                  <svg className="overtime-time-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
            </div>

            {/* Estimated Hours */}
            <div className="overtime-form-group">
              <label className="overtime-form-label">Thời lượng dự kiến</label>
              <div className="overtime-hours-input-wrapper">
                <input
                  type="text"
                  className="overtime-form-input overtime-hours-input"
                  value={formData.estimatedHours}
                  readOnly
                  disabled
                />
                <span className="overtime-hours-tag">giờ</span>
              </div>
            </div>

            {/* Manager Field */}
            <div className="overtime-form-group">
              <label className="overtime-form-label">
                <svg className="overtime-label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                <span>Quản lý duyệt/nhận TB *</span>
              </label>
              <input
                type="text"
                className="overtime-form-input overtime-form-input-readonly"
                value={directManagerName}
                readOnly
                disabled
              />
            </div>

            {/* Reason Field */}
            <div className="overtime-form-group">
              <label className="overtime-form-label">
                <svg className="overtime-label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span>Nội dung công việc / Lý do *</span>
              </label>
              <textarea
                className="overtime-form-textarea overtime-form-textarea-large"
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                placeholder="Vui lòng nhập nội dung công việc hoặc lý do xin tăng ca..."
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="overtime-submit-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="overtime-button-spinner"></div>
                <span>Đang gửi...</span>
              </>
            ) : (
              <>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="overtime-submit-icon">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
                <span>Gửi Đơn Tăng ca</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OvertimeRequest;

