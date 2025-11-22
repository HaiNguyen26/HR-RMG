import React, { useState, useEffect } from 'react';
import './RequestHistory.css';
import { leaveRequestsAPI, overtimeRequestsAPI, attendanceAdjustmentsAPI } from '../../services/api';
import { formatDateDisplay } from '../../utils/dateUtils';

const RequestHistory = ({ currentUser }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailRequestData, setDetailRequestData] = useState(null);

  useEffect(() => {
    fetchAllRequests();
  }, [currentUser]);

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      if (!currentUser?.id) {
        setLoading(false);
        return;
      }

      // Fetch all types of requests
      const [leaveRes, overtimeRes, attendanceRes] = await Promise.all([
        leaveRequestsAPI.getAll({ employeeId: currentUser.id }),
        overtimeRequestsAPI.getAll({ mode: 'employee', employeeId: currentUser.id }),
        attendanceAdjustmentsAPI.getAll({ mode: 'employee', employeeId: currentUser.id })
      ]);

      const allRequests = [];

      // Process leave requests
      if (leaveRes?.data?.success && leaveRes.data.data) {
        leaveRes.data.data.forEach(req => {
          allRequests.push({
            id: req.id,
            type: req.type === 'LEAVE' ? 'Nghỉ phép' : 'Nghỉ việc',
            typeCode: req.type,
            code: `LP${String(req.id).padStart(6, '0')}`,
            startDate: req.start_date,
            endDate: req.end_date,
            status: req.status,
            reason: req.reason,
            notes: req.notes,
            requestType: 'leave',
            // Additional fields for detail view
            team_lead_name: req.team_lead_name,
            branch_manager_name: req.branch_manager_name,
            created_at: req.created_at,
            updated_at: req.updated_at,
            rawData: req
          });
        });
      }

      // Process overtime requests
      if (overtimeRes?.data?.success && overtimeRes.data.data) {
        overtimeRes.data.data.forEach(req => {
          // Backend uses request_date, start_time, end_time
          const date = req.request_date || req.date || '';
          const startTime = req.start_time || '';
          const endTime = req.end_time || '';
          // Create proper datetime strings, only if both date and time exist
          const startDateTime = (date && startTime) ? `${date} ${startTime}` : (date || startTime || null);
          const endDateTime = (date && endTime) ? `${date} ${endTime}` : (date || endTime || null);

          allRequests.push({
            id: req.id,
            type: 'Tăng ca',
            typeCode: 'OVERTIME',
            code: `TC${String(req.id).padStart(6, '0')}`,
            startDate: startDateTime,
            endDate: endDateTime,
            date: date,
            startTime: startTime,
            endTime: endTime,
            status: req.status,
            reason: req.reason,
            workContent: req.work_content,
            requestType: 'overtime',
            // Additional fields for detail view
            team_lead_name: req.team_lead_name,
            branch_manager_name: req.branch_manager_name,
            created_at: req.created_at,
            updated_at: req.updated_at,
            rawData: req
          });
        });
      }

      // Process attendance adjustment requests
      if (attendanceRes?.data?.success && attendanceRes.data.data) {
        attendanceRes.data.data.forEach(req => {
          // Backend uses adjustment_date, check_in_time, check_out_time
          const date = req.adjustment_date || req.date || '';
          const timeIn = req.check_in_time || req.time_in || '';
          const timeOut = req.check_out_time || req.time_out || '';
          // Create proper datetime strings, only if both date and time exist
          const startDateTime = (date && timeIn) ? `${date} ${timeIn}` : (date || timeIn || null);
          const endDateTime = (date && timeOut) ? `${date} ${timeOut}` : (date || timeOut || null);

          allRequests.push({
            id: req.id,
            type: 'Bổ sung chấm công',
            typeCode: 'ATTENDANCE',
            code: `BC${String(req.id).padStart(6, '0')}`,
            startDate: startDateTime,
            endDate: endDateTime,
            date: date,
            timeIn: timeIn,
            timeOut: timeOut,
            status: req.status,
            reason: req.reason,
            adjustmentType: req.adjustment_type || req.check_type,
            requestType: 'attendance',
            // Additional fields for detail view
            team_lead_name: req.team_lead_name,
            branch_manager_name: req.branch_manager_name,
            created_at: req.created_at,
            updated_at: req.updated_at,
            rawData: req
          });
        });
      }

      // Sort by created date (newest first)
      allRequests.sort((a, b) => {
        // Use created_at for sorting if available, otherwise use startDate
        const dateA = a.created_at ? new Date(a.created_at) : new Date(a.startDate);
        const dateB = b.created_at ? new Date(b.created_at) : new Date(b.startDate);

        // Handle Invalid Date cases
        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;

        return dateB - dateA;
      });

      setRequests(allRequests);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'PENDING_TEAM_LEAD': 'Chờ duyệt',
      'PENDING_DIRECTOR': 'Chờ giám đốc',
      'PENDING_HR': 'Chờ HR',
      'APPROVED': 'Đã duyệt',
      'REJECTED': 'Đã từ chối'
    };
    return statusMap[status] || status;
  };

  const getStatusTagClass = (status) => {
    if (status === 'APPROVED') return 'request-status-tag--approved';
    if (status === 'REJECTED') return 'request-status-tag--rejected';
    return 'request-status-tag--pending';
  };

  const getTypeTagClass = (typeCode) => {
    if (typeCode === 'OVERTIME') return 'request-type-tag--overtime'; // Xanh Dương
    if (typeCode === 'RESIGNATION') return 'request-type-tag--resignation'; // Tím
    if (typeCode === 'ATTENDANCE') return 'request-type-tag--attendance'; // Vàng
    return 'request-type-tag--leave'; // Nghỉ phép
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return '-';
    const date = new Date(dateTime);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      // If invalid, try to parse as-is or return the original string
      return dateTime || '-';
    }
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRequestTime = (request) => {
    if (request.requestType === 'overtime') {
      // Try to get date from multiple sources
      const rawDate = request.date || request.rawData?.request_date || request.rawData?.date || '';
      const date = rawDate ? formatDateDisplay(rawDate) : '-';
      const startTime = request.startTime || request.rawData?.start_time || '-';
      const endTime = request.endTime || request.rawData?.end_time || '-';
      return `${date} ${startTime} → ${endTime}`;
    }
    if (request.requestType === 'attendance') {
      // Try to get date from multiple sources
      const rawDate = request.date || request.rawData?.adjustment_date || request.rawData?.date || '';
      const date = rawDate ? formatDateDisplay(rawDate) : '-';

      // Try to get time from multiple sources
      const rawTimeIn = request.timeIn || request.rawData?.check_in_time || request.rawData?.time_in || '';
      const rawTimeOut = request.timeOut || request.rawData?.check_out_time || request.rawData?.time_out || '';

      const timeIn = rawTimeIn || '';
      const timeOut = rawTimeOut || '';

      // Handle cases where only one time exists (based on adjustment_type)
      const adjType = request.adjustmentType || request.rawData?.adjustment_type || request.rawData?.check_type || '';

      if (adjType === 'CHECK_IN' && !timeOut) {
        return timeIn ? `${date} ${timeIn} → -` : date;
      }
      if (adjType === 'CHECK_OUT' && !timeIn) {
        return timeOut ? `${date} - → ${timeOut}` : date;
      }

      // Both or default - only show times if at least one exists
      if (!timeIn && !timeOut) {
        return date;
      }

      return `${date} ${timeIn || '-'} → ${timeOut || '-'}`;
    }
    // For leave requests, use the existing formatDateTime
    return `${formatDateTime(request.startDate)} → ${formatDateTime(request.endDate)}`;
  };

  const handleViewDetail = async (request) => {
    setSelectedRequest(request);
    setDetailRequestData(request.rawData || request);
    setIsDetailModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsDetailModalOpen(false);
    setSelectedRequest(null);
    setDetailRequestData(null);
  };

  const buildTimeline = (request) => {
    if (!request) return [];
    const timeline = [];
    const createdDate = request.created_at ? new Date(request.created_at) : null;

    // Step 1: Gửi đơn
    timeline.push({
      step: 1,
      title: 'Đã gửi đơn',
      status: 'completed',
      date: createdDate,
      description: 'Đơn từ đã được gửi thành công'
    });

    // Step 2: QLTT duyệt
    if (request.status === 'PENDING_TEAM_LEAD' || request.status === 'PENDING_DIRECTOR' || request.status === 'APPROVED') {
      const isPending = request.status === 'PENDING_TEAM_LEAD';
      timeline.push({
        step: 2,
        title: 'Chờ quản lý trực tiếp duyệt',
        status: isPending ? 'pending' : 'completed',
        date: request.updated_at && !isPending ? new Date(request.updated_at) : null,
        description: request.team_lead_name ? `Đang chờ ${request.team_lead_name} duyệt` : 'Đang chờ quản lý trực tiếp duyệt'
      });
    }

    // Step 3: HR/QLGT duyệt
    if (request.status === 'PENDING_DIRECTOR' || request.status === 'APPROVED') {
      const isPending = request.status === 'PENDING_DIRECTOR';
      timeline.push({
        step: 3,
        title: request.status === 'PENDING_DIRECTOR' ? 'Chờ giám đốc duyệt' : 'Đã duyệt',
        status: isPending ? 'pending' : 'completed',
        date: request.updated_at && !isPending ? new Date(request.updated_at) : null,
        description: request.branch_manager_name
          ? (isPending ? `Đang chờ ${request.branch_manager_name} duyệt` : `Đã được ${request.branch_manager_name} duyệt`)
          : (isPending ? 'Đang chờ giám đốc duyệt' : 'Đã được duyệt')
      });
    }

    // Step 4: Từ chối
    if (request.status === 'REJECTED') {
      timeline.push({
        step: timeline.length + 1,
        title: 'Đã từ chối',
        status: 'rejected',
        date: request.updated_at ? new Date(request.updated_at) : null,
        description: 'Đơn từ đã bị từ chối'
      });
    }

    return timeline;
  };

  return (
    <div className="request-history-container">
      {/* Header với Gradient Calm Integrity */}
      <div className="request-history-header">
        <div className="request-history-header-content">
          <div className="request-history-icon-wrapper">
            <svg className="request-history-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {/* Icon Clipboard/History */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <div>
            <h1 className="request-history-title">Lịch sử đơn từ</h1>
            <p className="request-history-subtitle">Xem lịch sử tất cả các đơn từ đã gửi của bạn</p>
          </div>
        </div>
      </div>

      <div className="request-history-content">
        {loading ? (
          <div className="request-history-loading">
            <div className="request-history-spinner"></div>
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="request-history-empty">
            <p>Chưa có đơn từ nào.</p>
          </div>
        ) : (
          <div className="request-history-table-wrapper">
            <table className="request-history-table">
              <thead>
                <tr>
                  <th>Mã Đơn</th>
                  <th>Loại Đơn</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={`${request.requestType}-${request.id}`}>
                    <td className="request-code-cell">
                      <span className="request-code">{request.code}</span>
                    </td>
                    <td>
                      <span className={`request-type-tag ${getTypeTagClass(request.typeCode)}`}>
                        {request.type}
                      </span>
                    </td>
                    <td className="request-time-cell">
                      <span className="request-time">
                        {formatRequestTime(request)}
                      </span>
                    </td>
                    <td>
                      <span className={`request-status-tag ${getStatusTagClass(request.status)}`}>
                        {getStatusLabel(request.status)}
                      </span>
                    </td>
                    <td className="request-detail-cell">
                      <button
                        className="request-detail-btn"
                        onClick={() => handleViewDetail(request)}
                        title="Xem chi tiết"
                      >
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal with Slide-In & Fade Effect */}
      {isDetailModalOpen && selectedRequest && (
        <div className="request-detail-modal-overlay" onClick={handleCloseModal}>
          <div className="request-detail-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="request-detail-modal-header">
              <h2 className="request-detail-modal-title">Chi tiết đơn từ</h2>
              <button className="request-detail-modal-close" onClick={handleCloseModal}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="request-detail-modal-body">
              {/* Left Column: Form Read-only */}
              <div className="request-detail-form-panel">
                <div className="request-detail-form-content">
                  <div className="request-detail-field">
                    <label>Mã Đơn:</label>
                    <span className="request-detail-value request-detail-value--highlight">{selectedRequest.code}</span>
                  </div>
                  <div className="request-detail-field">
                    <label>Loại Đơn:</label>
                    <span className={`request-type-tag ${getTypeTagClass(selectedRequest.typeCode)}`}>
                      {selectedRequest.type}
                    </span>
                  </div>

                  {/* Leave/Resignation Request Fields */}
                  {(selectedRequest.requestType === 'leave') && (
                    <>
                      <div className="request-detail-field">
                        <label>Ngày bắt đầu:</label>
                        <span className="request-detail-value">{formatDateTime(selectedRequest.startDate)}</span>
                      </div>
                      {selectedRequest.endDate && (
                        <div className="request-detail-field">
                          <label>Ngày kết thúc:</label>
                          <span className="request-detail-value">{formatDateTime(selectedRequest.endDate)}</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Overtime Request Fields */}
                  {selectedRequest.requestType === 'overtime' && (
                    <>
                      <div className="request-detail-field">
                        <label>Ngày tăng ca:</label>
                        <span className="request-detail-value">
                          {(() => {
                            const date = selectedRequest.date || selectedRequest.rawData?.request_date || selectedRequest.rawData?.date || '';
                            return date ? formatDateDisplay(date) : '-';
                          })()}
                        </span>
                      </div>
                      <div className="request-detail-field">
                        <label>Giờ bắt đầu:</label>
                        <span className="request-detail-value">
                          {selectedRequest.startTime || selectedRequest.rawData?.start_time || '-'}
                        </span>
                      </div>
                      <div className="request-detail-field">
                        <label>Giờ kết thúc:</label>
                        <span className="request-detail-value">
                          {selectedRequest.endTime || selectedRequest.rawData?.end_time || '-'}
                        </span>
                      </div>
                      {(selectedRequest.workContent || selectedRequest.rawData?.work_content) && (
                        <div className="request-detail-field">
                          <label>Nội dung công việc:</label>
                          <span className="request-detail-value">
                            {selectedRequest.workContent || selectedRequest.rawData?.work_content || '-'}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Attendance Adjustment Request Fields */}
                  {selectedRequest.requestType === 'attendance' && (
                    <>
                      <div className="request-detail-field">
                        <label>Ngày cần bổ sung:</label>
                        <span className="request-detail-value">{selectedRequest.date ? formatDateDisplay(selectedRequest.date) : '-'}</span>
                      </div>
                      <div className="request-detail-field">
                        <label>Loại bổ sung:</label>
                        <span className="request-detail-value">
                          {selectedRequest.adjustmentType === 'CHECK_IN' ? 'Quên giờ vào' :
                            selectedRequest.adjustmentType === 'CHECK_OUT' ? 'Quên giờ ra' :
                              selectedRequest.adjustmentType === 'BOTH' ? 'Quên cả giờ vào và ra' : selectedRequest.adjustmentType}
                        </span>
                      </div>
                      {selectedRequest.timeIn && (
                        <div className="request-detail-field">
                          <label>Giờ vào:</label>
                          <span className="request-detail-value">{selectedRequest.timeIn}</span>
                        </div>
                      )}
                      {selectedRequest.timeOut && (
                        <div className="request-detail-field">
                          <label>Giờ ra:</label>
                          <span className="request-detail-value">{selectedRequest.timeOut}</span>
                        </div>
                      )}
                    </>
                  )}

                  <div className="request-detail-field">
                    <label>Trạng thái:</label>
                    <span className={`request-status-tag ${getStatusTagClass(selectedRequest.status)}`}>
                      {getStatusLabel(selectedRequest.status)}
                    </span>
                  </div>
                  {selectedRequest.reason && (
                    <div className="request-detail-field">
                      <label>Lý do:</label>
                      <span className="request-detail-value">{selectedRequest.reason}</span>
                    </div>
                  )}
                  {selectedRequest.notes && (
                    <div className="request-detail-field">
                      <label>Ghi chú:</label>
                      <span className="request-detail-value">{selectedRequest.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Timeline */}
              <div className="request-detail-timeline-panel">
                <h3 className="request-detail-timeline-title">Lịch sử duyệt</h3>
                <div className="request-detail-timeline">
                  {buildTimeline(selectedRequest).map((item, index) => (
                    <div key={index} className={`request-timeline-item request-timeline-item--${item.status}`}>
                      <div className="request-timeline-node">
                        {item.status === 'completed' && (
                          <svg className="request-timeline-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                        )}
                        {item.status === 'pending' && (
                          <svg className="request-timeline-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                        )}
                        {item.status === 'rejected' && (
                          <svg className="request-timeline-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        )}
                      </div>
                      <div className="request-timeline-content">
                        <div className="request-timeline-title-text">{item.title}</div>
                        <div className="request-timeline-description">{item.description}</div>
                        {item.date && (
                          <div className="request-timeline-date">{formatDateTime(item.date)}</div>
                        )}
                      </div>
                      {index < buildTimeline(selectedRequest).length - 1 && (
                        <div className="request-timeline-connector"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestHistory;

