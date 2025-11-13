import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { overtimeRequestsAPI } from '../../services/api';
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
  startTime: '',
  endTime: '',
  duration: '',
  reason: '',
  notes: ''
};

const OvertimeRequest = ({ currentUser, showToast }) => {
  const [formData, setFormData] = useState(initialFormState);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestHistory, setRequestHistory] = useState([]);
  const [error, setError] = useState('');
  const [deletingRequestId, setDeletingRequestId] = useState(null);

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

    const confirmDelete = window.confirm('Bạn có chắc muốn xóa đơn tăng ca này?');
    if (!confirmDelete) return;

    try {
      setError('');
      setDeletingRequestId(requestId);
      await overtimeRequestsAPI.remove(requestId, { employeeId: currentUser.id });
      setRequestHistory((prev) => prev.filter((request) => request.id !== requestId));
      if (showToast) {
        showToast('Đã xóa đơn tăng ca.', 'success');
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
        const response = await overtimeRequestsAPI.getAll({
          mode: 'employee',
          employeeId: currentUser.id
        });
        if (response.data.success) {
          setRequestHistory(Array.isArray(response.data.data) ? response.data.data : []);
        }
      } catch (err) {
        console.error('Error fetching overtime history:', err);
        if (showToast) {
          showToast('Không thể tải lịch sử đơn tăng ca.', 'error');
        }
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [currentUser?.id, showToast]);

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
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
    setFormData((prev) => {
      const next = { ...prev };
      if (!timeValue) {
        next[field] = '';
        return next;
      }

      next[field] = formatDateToTimeString(timeValue);

      if (field === 'startTime' && prev.endTime) {
        const endDate = parseTimeStringToDate(prev.endTime);
        if (endDate && endDate <= timeValue) {
          next.endTime = '';
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

    if (!formData.date || !formData.startTime || !formData.endTime || !formData.reason) {
      setError('Vui lòng điền đầy đủ ngày, thời gian và nội dung tăng ca.');
      return;
    }

    if (formData.endTime <= formData.startTime) {
      setError('Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        employeeId: currentUser.id,
        requestDate: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        duration: formData.duration || null,
        reason: formData.reason,
        notes: formData.notes || null
      };

      const response = await overtimeRequestsAPI.create(payload);
      if (response.data.success) {
        setFormData(initialFormState);
        setRequestHistory((prev) => [response.data.data, ...prev]);
        if (showToast) {
          showToast('Đã gửi đơn tăng ca thành công.', 'success');
        }
      }
    } catch (err) {
      console.error('Error submitting overtime request:', err);
      const message = err.response?.data?.message || 'Không thể gửi đơn tăng ca. Vui lòng thử lại.';
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
        <h2>Đơn tăng ca đã gửi</h2>
        {loadingHistory && <span className="leave-history-loading">Đang tải...</span>}
      </div>
      {!loadingHistory && requestHistory.length === 0 && (
        <p className="leave-history-empty">Bạn chưa có đơn tăng ca nào.</p>
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
                    <h3>Đề xuất tăng ca</h3>
                    <p>
                      {formatDateDisplay(request.request_date)} • {request.start_time?.slice(0, 5)} →{' '}
                      {request.end_time?.slice(0, 5)}
                      {request.duration ? ` • ${request.duration}` : ''}
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
                    <span className="leave-history-detail-label">Nội dung công việc</span>
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
        <h1 className="leave-request-title">Xin tăng ca</h1>
        <p className="leave-request-subtitle">
          Điền chi tiết đề xuất tăng ca để gửi quản lý duyệt và quản lý gián tiếp theo dõi.
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
              <p className="leave-form-hint">Thông tin quản lý được lấy từ hồ sơ nhân sự của bạn.</p>
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
              <p className="leave-form-hint">Hệ thống sẽ gửi thông báo tới quản lý gián tiếp khi bạn gửi đơn.</p>
            </div>
          </div>

          <div className="leave-form-grid">
            <div className="leave-form-group">
              <label htmlFor="overtimeDate" className="leave-form-label">
                Ngày tăng ca *
              </label>
              <DatePicker
                id="overtimeDate"
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
              <label htmlFor="overtimeDuration" className="leave-form-label">
                Thời lượng dự kiến
              </label>
              <input
                type="text"
                id="overtimeDuration"
                value={formData.duration}
                onChange={(event) => handleFieldChange('duration', event.target.value)}
                className="leave-form-input"
                placeholder="Ví dụ: 2 giờ"
              />
            </div>
          </div>

          <div className="leave-form-grid">
            <div className="leave-form-group">
              <label htmlFor="overtimeStart" className="leave-form-label">
                Giờ bắt đầu *
              </label>
              <DatePicker
                id="overtimeStart"
                selected={parseTimeStringToDate(formData.startTime)}
                onChange={handleTimePickerChange('startTime')}
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
                required
                autoComplete="off"
              />
            </div>
            <div className="leave-form-group">
              <label htmlFor="overtimeEnd" className="leave-form-label">
                Giờ kết thúc *
              </label>
              <DatePicker
                id="overtimeEnd"
                selected={parseTimeStringToDate(formData.endTime)}
                onChange={handleTimePickerChange('endTime')}
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
                required
                disabled={!formData.startTime}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="leave-form-group">
            <label htmlFor="overtimeReason" className="leave-form-label">
              Nội dung công việc / Lý do *
            </label>
            <textarea
              id="overtimeReason"
              value={formData.reason}
              onChange={(event) => handleFieldChange('reason', event.target.value)}
              className="leave-form-textarea"
              rows="3"
              placeholder="Mô tả công việc tăng ca, mục tiêu hoàn thành..."
              required
            />
          </div>

          <div className="leave-form-group">
            <label htmlFor="overtimeNotes" className="leave-form-label">
              Ghi chú (tùy chọn)
            </label>
            <textarea
              id="overtimeNotes"
              value={formData.notes}
              onChange={(event) => handleFieldChange('notes', event.target.value)}
              className="leave-form-textarea"
              rows="2"
              placeholder="Thêm thông tin bổ sung nếu cần..."
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
              Đơn tăng ca sẽ tự động gửi tới quản lý trực tiếp và thông báo cho quản lý gián tiếp theo lựa chọn phía trên.
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
                  Ghi rõ nội dung công việc tăng ca, thời lượng dự kiến và ca làm việc để quản lý trực tiếp dễ dàng phê duyệt. Nếu có xác nhận từ khách hàng/đối tác,
                  bạn có thể đính kèm mô tả trong phần ghi chú.
                </p>
                <div className="info-box-divider" />
                <p className="info-box-text">
                  Hệ thống sẽ gửi thông báo tới quản lý trực tiếp và quản lý gián tiếp dựa trên thông tin đã chọn.
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

export default OvertimeRequest;