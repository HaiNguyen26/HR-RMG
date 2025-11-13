import React, { useEffect, useMemo, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import { attendanceAdjustmentsAPI } from '../../services/api';
import {
  formatDateToISO,
  formatDateToTimeString,
  parseISODateString,
  parseTimeStringToDate
} from '../../utils/dateUtils';
import { DATE_PICKER_LOCALE } from '../../utils/datepickerLocale';
import '../LeaveRequest/LeaveRequest.css';

const initialFormState = {
  date: '',
  checkType: 'BOTH',
  checkInTime: '',
  checkOutTime: '',
  reason: '',
  notes: ''
};

const ATTENDANCE_TYPE_OPTIONS = [
  { value: 'CHECK_IN', label: 'Quên chấm giờ vào' },
  { value: 'CHECK_OUT', label: 'Quên chấm giờ ra' },
  { value: 'BOTH', label: 'Quên cả giờ vào và ra' }
];

const AttendanceRequest = ({ currentUser, showToast }) => {
  const [formData, setFormData] = useState(initialFormState);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestHistory, setRequestHistory] = useState([]);
  const [error, setError] = useState('');
  const [deletingRequestId, setDeletingRequestId] = useState(null);
  const [attendanceTypeOpen, setAttendanceTypeOpen] = useState(false);
  const attendanceTypeRef = useRef(null);

  const directManagerName = useMemo(
    () => (currentUser?.quanLyTrucTiep || '').trim(),
    [currentUser]
  );
  const indirectManagerName = useMemo(
    () => (currentUser?.quanLyGianTiep || '').trim(),
    [currentUser]
  );
  const hasManagerInfo = Boolean(directManagerName) && Boolean(indirectManagerName);

  const statusConfig = useMemo(
    () => ({
      PENDING_TEAM_LEAD: { label: 'Chờ quản lý duyệt', className: 'status-pending-team' },
      PENDING_BRANCH: { label: 'Chờ quản lý gián tiếp duyệt', className: 'status-pending-branch' },
      APPROVED: { label: 'Đã duyệt', className: 'status-approved' },
      REJECTED: { label: 'Đã từ chối', className: 'status-rejected' },
      CANCELLED: { label: 'Đã hủy', className: 'status-cancelled' }
    }),
    []
  );

  const checkTypeLabels = useMemo(
    () => ({
      CHECK_IN: 'Bổ sung giờ vào',
      CHECK_OUT: 'Bổ sung giờ ra',
      BOTH: 'Bổ sung giờ vào/ra'
    }),
    []
  );

  const formatDateDisplay = (value, withTime = false) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...(withTime
        ? {
          hour: '2-digit',
          minute: '2-digit'
        }
        : {})
    });
  };

  const handleDeleteRequest = async (requestId) => {
    if (!currentUser?.id) {
      setError('Không xác định được thông tin nhân viên. Vui lòng đăng nhập lại.');
      return;
    }

    const confirmDelete = window.confirm('Bạn có chắc muốn xóa đơn bổ sung chấm công này?');
    if (!confirmDelete) return;

    try {
      setError('');
      setDeletingRequestId(requestId);
      await attendanceAdjustmentsAPI.remove(requestId, { employeeId: currentUser.id });
      setRequestHistory((prev) => prev.filter((request) => request.id !== requestId));
      if (showToast) {
        showToast('Đã xóa đơn bổ sung chấm công.', 'success');
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Không thể xóa đơn. Vui lòng thử lại.';
      setError(message);
      if (showToast) {
        showToast(message, 'error');
      }
    } finally {
      setDeletingRequestId(null);
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUser?.id) return;
      setLoadingHistory(true);
      try {
        const response = await attendanceAdjustmentsAPI.getAll({
          mode: 'employee',
          employeeId: currentUser.id
        });
        if (response.data.success) {
          setRequestHistory(Array.isArray(response.data.data) ? response.data.data : []);
        }
      } catch (err) {
        console.error('Error fetching attendance history:', err);
        if (showToast) {
          showToast('Không thể tải lịch sử đơn bổ sung chấm công.', 'error');
        }
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [currentUser?.id, showToast]);

  useEffect(() => {
    if (!attendanceTypeOpen) return undefined;
    const handleClickOutside = (event) => {
      if (attendanceTypeRef.current && !attendanceTypeRef.current.contains(event.target)) {
        setAttendanceTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [attendanceTypeOpen]);

  const handleFieldChange = (field, value) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        [field]: value
      };

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

  const handleDatePickerChange = (dateValue) => {
    setFormData((prev) => ({
      ...prev,
      date: dateValue ? formatDateToISO(dateValue) : ''
    }));
    setError('');
  };

  const handleTimePickerChange = (field) => (timeValue) => {
    const selectedTime = timeValue ? new Date(timeValue) : null;

    setFormData((prev) => {
      const next = { ...prev };

      if (!selectedTime) {
        next[field] = '';
        return next;
      }

      next[field] = formatDateToTimeString(selectedTime);

      if (field === 'checkInTime' && prev.checkOutTime) {
        const outTime = parseTimeStringToDate(prev.checkOutTime);
        if (outTime && outTime <= selectedTime) {
          next.checkOutTime = '';
        }
      }

      return next;
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentUser?.id) {
      setError('Không xác định được thông tin nhân viên. Vui lòng đăng nhập lại.');
      return;
    }

    if (!directManagerName) {
      setError('Không tìm thấy thông tin quản lý trực tiếp. Vui lòng liên hệ HR để cập nhật.');
      return;
    }

    if (!indirectManagerName) {
      setError('Không tìm thấy thông tin quản lý gián tiếp. Vui lòng liên hệ HR để cập nhật.');
      return;
    }

    if (!formData.date || !formData.reason) {
      setError('Vui lòng chọn ngày và nhập lý do bổ sung.');
      return;
    }

    if (formData.checkType !== 'CHECK_OUT' && !formData.checkInTime) {
      setError('Vui lòng nhập giờ vào thực tế hoặc chọn loại bổ sung phù hợp.');
      return;
    }

    if (formData.checkType !== 'CHECK_IN' && !formData.checkOutTime) {
      setError('Vui lòng nhập giờ ra thực tế hoặc chọn loại bổ sung phù hợp.');
      return;
    }

    if (
      formData.checkType === 'BOTH' &&
      formData.checkInTime &&
      formData.checkOutTime &&
      formData.checkOutTime <= formData.checkInTime
    ) {
      setError('Giờ ra phải sau giờ vào.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        employeeId: currentUser.id,
        adjustmentDate: formData.date,
        checkType: formData.checkType,
        checkInTime: formData.checkType === 'CHECK_OUT' ? null : formData.checkInTime || null,
        checkOutTime: formData.checkType === 'CHECK_IN' ? null : formData.checkOutTime || null,
        reason: formData.reason,
        notes: formData.notes || null
      };

      const response = await attendanceAdjustmentsAPI.create(payload);
      if (response.data.success) {
        setFormData(initialFormState);
        setRequestHistory((prev) => [response.data.data, ...prev]);
        if (showToast) {
          showToast('Đã gửi đơn bổ sung chấm công.', 'success');
        }
      }
    } catch (err) {
      console.error('Error submitting attendance adjustment:', err);
      const message =
        err.response?.data?.message || 'Không thể gửi đơn bổ sung chấm công. Vui lòng thử lại.';
      setError(message);
      if (showToast) {
        showToast(message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderTimelineStep = (title, action, actionAt, comment) => {
    let description = 'Đang chờ xử lý';
    if (action === 'APPROVED') {
      description = 'Đã phê duyệt';
    } else if (action === 'REJECTED') {
      description = 'Đã từ chối';
    } else if (action === 'ESCALATED') {
      description = 'Đã đẩy lên cấp tiếp theo';
    }

    return (
      <div className="leave-history-timeline-step">
        <div className="leave-history-step-header">
          <span className="leave-history-step-title">{title}</span>
          <span className={`leave-history-step-status leave-history-step-${(action || 'PENDING').toLowerCase()}`}>
            {description}
          </span>
        </div>
        <div className="leave-history-step-meta">
          <span>{actionAt ? formatDateDisplay(actionAt, true) : 'Chưa có thời gian xử lý'}</span>
          {comment && <span className="leave-history-step-comment">"{comment}"</span>}
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="leave-history-section">
      <div className="leave-history-header">
        <h2>Đơn bổ sung đã gửi</h2>
        {loadingHistory && <span className="leave-history-loading">Đang tải...</span>}
      </div>
      {!loadingHistory && requestHistory.length === 0 && (
        <p className="leave-history-empty">Bạn chưa gửi đơn bổ sung chấm công nào.</p>
      )}
      {!loadingHistory && requestHistory.length > 0 && (
        <div className="leave-history-list">
          {requestHistory.map((request) => {
            const statusInfo =
              statusConfig[request.status] || statusConfig.PENDING_TEAM_LEAD || {
                label: request.status,
                className: 'status-pending-team'
              };
            const canDeleteRequest = request.status === 'PENDING_TEAM_LEAD';
            return (
              <div key={request.id} className={`leave-history-card ${statusInfo.className}`}>
                <div className="leave-history-card-header">
                  <div>
                    <h3>{checkTypeLabels[request.check_type] || 'Đơn bổ sung'}</h3>
                    <p>
                      {formatDateDisplay(request.adjustment_date)} •{' '}
                      {request.check_in_time ? request.check_in_time.slice(0, 5) : '-'}
                      {' → '}
                      {request.check_out_time ? request.check_out_time.slice(0, 5) : '-'}
                    </p>
                  </div>
                  <div className="leave-history-header-right">
                    <div className="leave-history-status-group">
                      {request.isOverdue && request.status === 'PENDING_TEAM_LEAD' && (
                        <span className="leave-history-overdue">Quá hạn 24h</span>
                      )}
                      <span className={`leave-history-status ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    {canDeleteRequest && (
                      <button
                        type="button"
                        className="leave-history-action-btn"
                        onClick={() => handleDeleteRequest(request.id)}
                        disabled={deletingRequestId === request.id}
                      >
                        {deletingRequestId === request.id ? 'Đang xóa...' : 'Hủy đơn'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="leave-history-details">
                  <div className="leave-history-detail-block">
                    <span className="leave-history-detail-label">Lý do</span>
                    <p className="leave-history-detail-value">{request.reason}</p>
                  </div>
                  {request.notes && (
                    <div className="leave-history-detail-block">
                      <span className="leave-history-detail-label">Ghi chú</span>
                      <p className="leave-history-detail-value">{request.notes}</p>
                    </div>
                  )}
                  <div className="leave-history-detail-block">
                    <span className="leave-history-detail-label">Quản lý trực tiếp</span>
                    <p className="leave-history-detail-value">{request.team_lead_name || 'Chưa cập nhật'}</p>
                  </div>
                  <div className="leave-history-detail-block">
                    <span className="leave-history-detail-label">Quản lý gián tiếp</span>
                    <p className="leave-history-detail-value">{request.branch_manager_name || 'Chưa cập nhật'}</p>
                  </div>
                  <div className="leave-history-detail-block">
                    <span className="leave-history-detail-label">Gửi lúc</span>
                    <p className="leave-history-detail-value">{formatDateDisplay(request.created_at, true)}</p>
                  </div>
                  <div className="leave-history-detail-block">
                    <span className="leave-history-detail-label">Cập nhật</span>
                    <p className="leave-history-detail-value">{formatDateDisplay(request.updated_at, true)}</p>
                  </div>
                </div>

                <div className="leave-history-timeline">
                  {renderTimelineStep(
                    'Quản lý trực tiếp',
                    request.team_lead_action,
                    request.team_lead_action_at,
                    request.team_lead_comment
                  )}
                  {renderTimelineStep(
                    'Quản lý gián tiếp',
                    request.branch_action,
                    request.branch_action_at,
                    request.branch_comment
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="leave-request">
      <div className="leave-request-header">
        <h1 className="leave-request-title">Bổ sung chấm công</h1>
        <p className="leave-request-subtitle">
          Dùng khi quên chấm công hoặc cần điều chỉnh giờ vào/ra. Quản lý trực tiếp sẽ duyệt trước, quản lý gián tiếp sẽ nhận thông tin.
        </p>
      </div>

      <div className="leave-request-form-container">
        <form onSubmit={handleSubmit} className="leave-request-form">
          {error && (
            <div className="leave-request-error">
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

          <div className="leave-form-grid">
            <div className="leave-form-group">
              <label className="leave-form-label">
                Quản lý duyệt đơn *
              </label>
              <input
                className="leave-form-input"
                type="text"
                value={directManagerName || 'Chưa cập nhật'}
                disabled
              />
              <p className="leave-form-hint">
                Thông tin quản lý trực tiếp được lấy từ dữ liệu nhân sự. Vui lòng liên hệ HR nếu cần cập nhật.
              </p>
            </div>
            <div className="leave-form-group">
              <label className="leave-form-label">
                Quản lý gián tiếp nhận thông báo *
              </label>
              <input
                className="leave-form-input"
                type="text"
                value={indirectManagerName || 'Chưa cập nhật'}
                disabled
              />
              <p className="leave-form-hint">
                Quản lý gián tiếp sẽ tự động nhận thông báo khi bạn gửi đơn.
              </p>
            </div>
          </div>

          <div className="leave-form-grid">
            <div className="leave-form-group">
              <label htmlFor="attendanceDate" className="leave-form-label">
                Ngày cần bổ sung *
              </label>
              <DatePicker
                id="attendanceDate"
                selected={parseISODateString(formData.date)}
                onChange={handleDatePickerChange}
                dateFormat="dd/MM/yyyy"
                locale={DATE_PICKER_LOCALE}
                placeholderText="dd/mm/yyyy"
                className="leave-form-input leave-form-input--datepicker"
                calendarClassName="date-picker-calendar"
                popperClassName="date-picker-popper"
                wrapperClassName="date-picker-wrapper"
                required
                autoComplete="off"
              />
            </div>

            <div className="leave-form-group">
              <label htmlFor="attendanceType" className="leave-form-label">
                Mục cần bổ sung *
              </label>
              <div
                id="attendanceType"
                ref={attendanceTypeRef}
                className={`form-select-custom ${attendanceTypeOpen ? 'open' : ''}`}
              >
                <button
                  type="button"
                  className="form-select-custom__trigger"
                  onClick={() => setAttendanceTypeOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={attendanceTypeOpen}
                >
                  <span>
                    {ATTENDANCE_TYPE_OPTIONS.find((option) => option.value === formData.checkType)?.label ||
                      'Chọn mục bổ sung'}
                  </span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M6 9l6 6 6-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div className="form-select-custom__menu" role="listbox">
                  {ATTENDANCE_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`form-select-custom__option ${formData.checkType === option.value ? 'active' : ''}`}
                      onClick={() => {
                        handleFieldChange('checkType', option.value);
                        setAttendanceTypeOpen(false);
                      }}
                      role="option"
                      aria-selected={formData.checkType === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="leave-form-grid">
            <div className="leave-form-group">
              <label htmlFor="attendanceIn" className="leave-form-label">
                Giờ vào thực tế
              </label>
              <DatePicker
                id="attendanceIn"
                selected={parseTimeStringToDate(formData.checkInTime)}
                onChange={handleTimePickerChange('checkInTime')}
                showTimeSelect
                showTimeSelectOnly
                timeIntervals={5}
                timeCaption="Giờ"
                dateFormat="HH:mm"
                locale={DATE_PICKER_LOCALE}
                placeholderText="hh:mm"
                className="leave-form-input leave-form-input--datepicker leave-form-input--time"
                calendarClassName="date-picker-calendar time-picker-calendar"
                popperClassName="date-picker-popper time-picker-popper"
                wrapperClassName="date-picker-wrapper time-picker-wrapper"
                disabled={formData.checkType === 'CHECK_OUT'}
                autoComplete="off"
              />
            </div>
            <div className="leave-form-group">
              <label htmlFor="attendanceOut" className="leave-form-label">
                Giờ ra thực tế
              </label>
              <DatePicker
                id="attendanceOut"
                selected={parseTimeStringToDate(formData.checkOutTime)}
                onChange={handleTimePickerChange('checkOutTime')}
                showTimeSelect
                showTimeSelectOnly
                timeIntervals={5}
                timeCaption="Giờ"
                dateFormat="HH:mm"
                locale={DATE_PICKER_LOCALE}
                placeholderText="hh:mm"
                className="leave-form-input leave-form-input--datepicker leave-form-input--time"
                calendarClassName="date-picker-calendar time-picker-calendar"
                popperClassName="date-picker-popper time-picker-popper"
                wrapperClassName="date-picker-wrapper time-picker-wrapper"
                disabled={formData.checkType === 'CHECK_IN'}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="leave-form-group">
            <label htmlFor="attendanceReason" className="leave-form-label">
              Lý do bổ sung *
            </label>
            <textarea
              id="attendanceReason"
              value={formData.reason}
              onChange={(event) => handleFieldChange('reason', event.target.value)}
              className="leave-form-textarea"
              rows="3"
              placeholder="Mô tả lý do quên chấm công, xác nhận của khách hàng, đồng nghiệp..."
              required
            />
          </div>

          <div className="leave-form-group">
            <label htmlFor="attendanceNotes" className="leave-form-label">
              Ghi chú (tùy chọn)
            </label>
            <textarea
              id="attendanceNotes"
              value={formData.notes}
              onChange={(event) => handleFieldChange('notes', event.target.value)}
              className="leave-form-textarea"
              rows="2"
              placeholder="Thông tin bổ sung khác (nếu có)..."
            />
          </div>

          <div className="leave-form-actions">
            <button
              type="submit"
              className="leave-submit-btn leave-submit-btn--secondary"
              disabled={
                submitting ||
                !hasManagerInfo
              }
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {submitting ? 'Đang gửi...' : 'Gửi đơn'}
            </button>
            <p className="leave-form-hint leave-form-hint--info">
              Đơn bổ sung chấm công sẽ tự động gửi tới quản lý trực tiếp và thông báo cho quản lý gián tiếp theo lựa chọn bên trên.
            </p>
          </div>
        </form>

        <div className="leave-request-sidebar">
          <div className="leave-request-info">
            <div className="info-box">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="info-box-title">Hướng dẫn điền đơn</h3>
                <p className="info-box-text">
                  Ghi rõ ca làm, giờ vào/ra thực tế và lý do quên chấm công. Nếu có xác nhận từ khách hàng hoặc quản lý, hãy ghi rõ trong phần ghi chú.
                </p>
                <div className="info-box-divider" />
                <p className="info-box-text">
                  Hệ thống sẽ gửi tự động tới quản lý trực tiếp và quản lý gián tiếp dựa trên thông tin đã chọn.
                </p>
              </div>
            </div>
          </div>

          {renderHistory()}
        </div>
      </div>
    </div>
  );
};

export default AttendanceRequest;