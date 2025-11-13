import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { leaveRequestsAPI } from '../../services/api';
import { formatDateToISO, parseISODateString, today } from '../../utils/dateUtils';
import { DATE_PICKER_LOCALE } from '../../utils/datepickerLocale';
import './LeaveRequest.css';

const REQUEST_TABS = [
  {
    key: 'leave',
    label: 'Xin nghỉ phép',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    ),
    description:
      'Điền đầy đủ thông tin để gửi đơn xin nghỉ phép. Đơn sẽ đi qua quản lý trực tiếp duyệt trước khi quản lý gián tiếp nhận thông tin.'
  },
  {
    key: 'resign',
    label: 'Xin nghỉ việc',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    ),
    description:
      'Trình bày kế hoạch nghỉ việc và lý do chi tiết. Quản lý trực tiếp sẽ duyệt trước khi quản lý gián tiếp tiếp nhận.'
  }
];

const initialFormsState = {
  leave: {
    startDate: '',
    endDate: '',
    reason: '',
    notes: ''
  },
  resign: {
    startDate: '',
    reason: '',
    notes: ''
  }
};

const LeaveRequest = ({ currentUser, showToast }) => {
  const [requestType, setRequestType] = useState('leave');
  const [forms, setForms] = useState(initialFormsState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [myRequests, setMyRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState(null);

  const activeForm = useMemo(() => forms[requestType], [forms, requestType]);
  const directManagerName = useMemo(
    () => (currentUser?.quanLyTrucTiep || '').trim(),
    [currentUser]
  );
  const indirectManagerName = useMemo(
    () => (currentUser?.quanLyGianTiep || '').trim(),
    [currentUser]
  );
  const hasManagerInfo = Boolean(directManagerName) && Boolean(indirectManagerName);

  const fetchMyRequests = async () => {
    if (!currentUser?.id) return;
    setLoadingRequests(true);
    try {
      const response = await leaveRequestsAPI.getAll({
        mode: 'employee',
        employeeId: currentUser.id
      });
      if (response.data.success) {
        setMyRequests(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching leave requests:', err);
      if (showToast) {
        showToast('Không thể tải lịch sử đơn xin nghỉ.', 'error');
      }
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchMyRequests();
    }
  }, [currentUser]);

  const resetFormForType = (typeKey) => {
    setForms((prev) => ({
      ...prev,
      [typeKey]: { ...initialFormsState[typeKey] }
    }));
    setError('');
  };

  const handleFieldChange = (field, value) => {
    setForms((prev) => ({
      ...prev,
      [requestType]: {
        ...prev[requestType],
        [field]: value
      }
    }));
    setError('');
  };

  const handleDatePickerChange = (field) => (dateValue) => {
    setForms((prev) => {
      const nextForm = { ...prev[requestType] };

      if (!dateValue) {
        nextForm[field] = '';
        if (requestType === 'leave' && field === 'startDate') {
          nextForm.endDate = '';
        }
      } else {
        nextForm[field] = formatDateToISO(dateValue);

        if (
          requestType === 'leave' &&
          field === 'startDate' &&
          nextForm.endDate
        ) {
          const currentEndDate = parseISODateString(nextForm.endDate);
          if (currentEndDate && currentEndDate < dateValue) {
            nextForm.endDate = '';
          }
        }
      }

      return {
        ...prev,
        [requestType]: nextForm
      };
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

    setLoading(true);
    try {
      if (requestType === 'leave') {
        if (!activeForm.startDate || !activeForm.endDate || !activeForm.reason) {
          setError('Vui lòng điền đầy đủ thông tin bắt buộc.');
          setLoading(false);
          return;
        }

        if (new Date(activeForm.startDate) > new Date(activeForm.endDate)) {
          setError('Ngày kết thúc phải sau ngày bắt đầu.');
          setLoading(false);
          return;
        }
      }

      if (requestType === 'resign') {
        if (!activeForm.startDate || !activeForm.reason) {
          setError('Vui lòng điền đầy đủ thông tin bắt buộc.');
          setLoading(false);
          return;
        }
      }

      if (!directManagerName) {
        setError('Không tìm thấy thông tin quản lý trực tiếp. Vui lòng liên hệ HR để cập nhật.');
        setLoading(false);
        return;
      }

      if (!indirectManagerName) {
        setError('Không tìm thấy thông tin quản lý gián tiếp. Vui lòng liên hệ HR để cập nhật.');
        setLoading(false);
        return;
      }

      const payload = {
        employeeId: currentUser.id,
        requestType: requestType === 'leave' ? 'LEAVE' : 'RESIGN',
        startDate: activeForm.startDate,
        endDate: requestType === 'leave' ? activeForm.endDate : null,
        reason: activeForm.reason,
        notes: activeForm.notes
      };

      const response = await leaveRequestsAPI.create(payload);

      if (response.data.success) {
        if (showToast) {
          showToast(
            requestType === 'leave'
              ? 'Đơn xin nghỉ phép đã được gửi đến quản lý duyệt.'
              : 'Đơn xin nghỉ việc đã được gửi đến quản lý duyệt.',
            'success'
          );
        }

        resetFormForType(requestType);
        await fetchMyRequests();
      } else {
        const message = response.data.message || 'Không thể gửi đơn. Vui lòng thử lại.';
        setError(message);
        if (showToast) {
          showToast(message, 'error');
        }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
      setError(message);
      if (showToast) {
        showToast(message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async (requestId) => {
    if (!currentUser?.id) {
      setError('Không xác định được thông tin nhân viên. Vui lòng đăng nhập lại.');
      return;
    }

    const confirmDelete = window.confirm('Bạn có chắc muốn xóa đơn xin nghỉ này?');
    if (!confirmDelete) return;

    try {
      setDeletingRequestId(requestId);
      await leaveRequestsAPI.remove(requestId, { employeeId: currentUser.id });
      setMyRequests((prev) => prev.filter((req) => req.id !== requestId));
      if (showToast) {
        showToast('Đã xóa đơn xin nghỉ.', 'success');
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

  const renderSharedApproverSelects = () => (
    <div className="leave-form-grid">
      <div className="leave-form-group">
        <label className="leave-form-label">Quản lý duyệt đơn *</label>
        <input
          className="leave-form-input"
          type="text"
          value={directManagerName || 'Chưa cập nhật'}
          disabled
        />
        <p className="leave-form-hint">
          Thông tin quản lý trực tiếp được lấy từ hồ sơ nhân sự. Vui lòng liên hệ HR nếu cần cập nhật.
        </p>
      </div>
      <div className="leave-form-group">
        <label className="leave-form-label">Quản lý gián tiếp nhận thông báo *</label>
        <input
          className="leave-form-input"
          type="text"
          value={indirectManagerName || 'Chưa cập nhật'}
          disabled
        />
        <p className="leave-form-hint">
          Quản lý gián tiếp sẽ luôn nhận được thông báo khi bạn gửi đơn.
        </p>
      </div>
    </div>
  );

  const renderLeaveOrResignForm = () => {
    const startDateValue = parseISODateString(activeForm.startDate);
    const endDateValue = parseISODateString(activeForm.endDate);

    return (
      <>
        <div className="leave-form-grid">
          <div className="leave-form-group">
            <label htmlFor="startDate" className="leave-form-label">
              {requestType === 'leave' ? 'Ngày bắt đầu nghỉ *' : 'Ngày nghỉ việc *'}
            </label>
            <DatePicker
              id="startDate"
              selected={startDateValue}
              onChange={handleDatePickerChange('startDate')}
              minDate={today()}
              dateFormat="dd/MM/yyyy"
              locale={DATE_PICKER_LOCALE}
              placeholderText="dd/mm/yyyy"
              className="leave-form-input leave-form-input--datepicker"
              calendarClassName="date-picker-calendar"
              popperClassName="date-picker-popper"
              wrapperClassName="date-picker-wrapper"
              selectsStart
              startDate={startDateValue}
              endDate={requestType === 'leave' ? endDateValue : undefined}
              required
              autoComplete="off"
            />
          </div>

          {requestType === 'leave' && (
            <div className="leave-form-group">
              <label htmlFor="endDate" className="leave-form-label">
                Ngày kết thúc nghỉ *
              </label>
              <DatePicker
                id="endDate"
                selected={endDateValue}
                onChange={handleDatePickerChange('endDate')}
                minDate={startDateValue || today()}
                dateFormat="dd/MM/yyyy"
                locale={DATE_PICKER_LOCALE}
                placeholderText="dd/mm/yyyy"
                className="leave-form-input leave-form-input--datepicker"
                calendarClassName="date-picker-calendar"
                popperClassName="date-picker-popper"
                wrapperClassName="date-picker-wrapper"
                selectsEnd
                startDate={startDateValue}
                endDate={endDateValue}
                required
                disabled={!startDateValue}
                autoComplete="off"
              />
            </div>
          )}
        </div>

        <div className="leave-form-group">
          <label htmlFor="reason" className="leave-form-label">
            Lý do * {requestType === 'leave' ? '(Xin nghỉ phép)' : '(Xin nghỉ việc)'}
          </label>
          <textarea
            id="reason"
            value={activeForm.reason}
            onChange={(event) => handleFieldChange('reason', event.target.value)}
            className="leave-form-textarea"
            rows="3"
            placeholder={
              requestType === 'leave'
                ? 'Vui lòng nhập lý do xin nghỉ phép...'
                : 'Vui lòng nhập lý do xin nghỉ việc...'
            }
            required
          />
        </div>

        <div className="leave-form-group">
          <label htmlFor="notes" className="leave-form-label">
            Ghi chú thêm (tùy chọn)
          </label>
          <textarea
            id="notes"
            value={activeForm.notes}
            onChange={(event) => handleFieldChange('notes', event.target.value)}
            className="leave-form-textarea"
            rows="2"
            placeholder="Thêm ghi chú nếu cần..."
          />
        </div>
      </>
    );
  };

  const primaryButtonDisabled = loading || !hasManagerInfo;

  const statusConfig = {
    PENDING_TEAM_LEAD: { label: 'Chờ quản lý duyệt', className: 'status-pending-team' },
    PENDING_BRANCH: { label: 'Chờ quản lý gián tiếp duyệt', className: 'status-pending-branch' },
    APPROVED: { label: 'Đã duyệt', className: 'status-approved' },
    REJECTED: { label: 'Đã từ chối', className: 'status-rejected' },
    CANCELLED: { label: 'Đã hủy', className: 'status-cancelled' },
  };

  const requestTypeLabels = {
    LEAVE: 'Xin nghỉ phép',
    RESIGN: 'Xin nghỉ việc'
  };

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

  const renderTimelineStep = (title, action, actionAt, comment) => {
    let description = 'Đang chờ xử lý';
    if (action === 'APPROVED') {
      description = 'Đã phê duyệt';
    } else if (action === 'REJECTED') {
      description = 'Đã từ chối';
    } else if (action === 'ESCALATED') {
      description = 'Đã được đẩy lên cấp kế tiếp';
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

  return (
    <div className="leave-request">
      <div className="leave-request-header">
        <h1 className="leave-request-title">
          {REQUEST_TABS.find((tab) => tab.key === requestType)?.label || 'Gửi đơn nội bộ'}
        </h1>
        <p className="leave-request-subtitle">
          {REQUEST_TABS.find((tab) => tab.key === requestType)?.description ||
            'Điền thông tin chi tiết để gửi đơn nội bộ.'}
        </p>
      </div>

      <div className="leave-request-tabs">
        {REQUEST_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`leave-tab ${requestType === tab.key ? 'active' : ''}`}
            onClick={() => {
              setRequestType(tab.key);
              setError('');
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {tab.icon}
            </svg>
            <span>{tab.label}</span>
          </button>
        ))}
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

          {renderSharedApproverSelects()}
          {renderLeaveOrResignForm()}

          <div className="leave-form-actions">
            <button
              type="submit"
              className="leave-submit-btn"
              disabled={primaryButtonDisabled}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Đang gửi...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Gửi đơn
                </>
              )}
            </button>
          </div>
        </form>

        <div className="leave-request-sidebar">
          <div className="leave-history-section">
            <div className="leave-history-header">
              <h2>Đơn đã gửi</h2>
              {loadingRequests && <span className="leave-history-loading">Đang tải...</span>}
            </div>
            {!loadingRequests && myRequests.length === 0 && (
              <p className="leave-history-empty">Bạn chưa có đơn xin nghỉ nào.</p>
            )}
            {!loadingRequests && myRequests.length > 0 && (
              <div className="leave-history-list">
                {myRequests.map((request) => {
                  const statusInfo = statusConfig[request.status] || { label: request.status, className: 'status-default' };
                  const typeLabel = requestTypeLabels[request.request_type] || request.request_type;
                  const canDeleteRequest = request.status === 'PENDING_TEAM_LEAD';
                  return (
                    <div key={request.id} className={`leave-history-card ${statusInfo.className}`}>
                      <div className="leave-history-card-header">
                        <div>
                          <h3>{typeLabel}</h3>
                          <p>
                            {formatDateDisplay(request.start_date)}{' '}
                            {request.request_type === 'LEAVE' && request.end_date
                              ? `→ ${formatDateDisplay(request.end_date)}`
                              : ''}
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

          <div className="leave-request-info">
            <div className="info-box">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="info-box-title">Quy trình duyệt</h3>
                <p className="info-box-text">
                  Tất cả đơn sẽ được gửi đến quản lý trực tiếp để duyệt đầu tiên. Sau khi quản lý trực tiếp xác nhận,
                  quản lý gián tiếp sẽ nhận thông tin để theo dõi. Danh sách quản lý được đồng bộ từ dữ liệu nhân sự.
                </p>
                <div className="info-box-divider" />
                <p className="info-box-text">
                  Hãy đảm bảo lý do xin nghỉ chi tiết để quản lý trực tiếp và quản lý gián tiếp có đủ thông tin phê duyệt.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequest;

