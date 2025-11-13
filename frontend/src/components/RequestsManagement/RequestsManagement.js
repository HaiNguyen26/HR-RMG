import React, { useState, useEffect, useCallback } from 'react';
import { requestsAPI } from '../../services/api';
import './RequestsManagement.css';

const RequestsManagement = ({ currentUser, showToast, showConfirm }) => {
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]); // Store all requests for stats calculation
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'approved', 'in_progress', 'completed'
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingItems, setUpdatingItems] = useState({}); // Track which items are being updated

  // HR có thể xem tất cả requests, nhưng hr_admin chỉ xem requests gửi đến phòng HR
  // ADMIN xem tất cả, các phòng ban khác chỉ xem requests của mình
  let targetDepartment = null;
  if (currentUser?.role === 'ADMIN') {
    targetDepartment = null; // ADMIN xem tất cả
  } else if (currentUser?.role === 'HR') {
    // Nếu là hr_admin, chỉ xem requests gửi đến phòng HR
    // Nếu là hr (tạo nhân viên), xem tất cả để theo dõi
    if (currentUser?.username === 'hr_admin') {
      targetDepartment = 'HR';
    } else {
      targetDepartment = null; // hr xem tất cả
    }
  } else {
    targetDepartment = currentUser?.role; // IT, ACCOUNTING chỉ xem của mình
  }

  const applyFilter = useCallback((requestsToFilter = null) => {
    const dataToFilter = requestsToFilter || allRequests;
    if (!dataToFilter || dataToFilter.length === 0) {
      setRequests([]);
      return;
    }

    const groupedByEmployee = dataToFilter.reduce((acc, request) => {
      const employeeId = request.employee_id || 'unknown';
      if (!acc[employeeId]) {
        acc[employeeId] = [];
      }
      acc[employeeId].push(request);
      return acc;
    }, {});

    const filteredEmployeeGroups = Object.entries(groupedByEmployee).filter(([, employeeRequests]) => {
      if (filter === 'completed') {
        return employeeRequests.some(r => isRequestFullyCompleted(r));
      }
      if (filter === 'all') {
        return employeeRequests.some(r => !isRequestFullyCompleted(r));
      }
      const statusMap = {
        pending: 'PENDING',
        approved: 'APPROVED',
        in_progress: 'IN_PROGRESS',
      };
      return employeeRequests.some(r => r.status === statusMap[filter]);
    });

    const filteredData = filteredEmployeeGroups.flatMap(([, employeeRequests]) => {
      if (filter === 'completed') {
        return employeeRequests.filter(r => isRequestFullyCompleted(r));
      }
      if (filter === 'all') {
        return employeeRequests;
      }
      const statusMap = {
        pending: 'PENDING',
        approved: 'APPROVED',
        in_progress: 'IN_PROGRESS',
      };
      return employeeRequests.filter(r => r.status === statusMap[filter]);
    });

    setRequests(filteredData);
  }, [allRequests, filter]);

  const fetchAllRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      // HR/ADMIN xem tất cả, các phòng ban khác chỉ xem của mình
      if (targetDepartment) {
        params.targetDepartment = targetDepartment;
      }
      // Don't apply status filter here - fetch all for stats
      const res = await requestsAPI.getAll(params);
      if (res.data.success) {
        setAllRequests(res.data.data);
        applyFilter(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      if (showToast) {
        showToast('Lỗi khi tải danh sách yêu cầu', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [applyFilter, showToast, targetDepartment]);

  useEffect(() => {
    fetchAllRequests();
  }, [fetchAllRequests]);

  useEffect(() => {
    if (allRequests.length > 0 || filter === 'all') {
      applyFilter();
    }
  }, [allRequests, filter, applyFilter]);

  // Check if a request is fully completed (all items are COMPLETED)
  const isRequestFullyCompleted = (request) => {
    if (request.status !== 'COMPLETED') return false;
    if (!request.items_detail || !Array.isArray(request.items_detail)) return false;
    if (request.items_detail.length === 0) return false;
    return request.items_detail.every(item =>
      item.status === 'COMPLETED' && item.quantity_provided >= item.quantity
    );
  };

  const handleStatusChange = async (requestId, newStatus, notes = '') => {
    try {
      setUpdatingStatus(true);
      await requestsAPI.update(requestId, {
        status: newStatus,
        assignedTo: currentUser?.id || null,
        notes: notes,
      });
      await fetchAllRequests();
      if (showToast) {
        showToast('Đã cập nhật trạng thái yêu cầu', 'success');
      }
    } catch (error) {
      console.error('Error updating request:', error);
      const errorMessage = error.response?.data?.message || 'Lỗi khi cập nhật yêu cầu';
      if (showToast) {
        showToast(errorMessage, 'error');
      }
      // Refresh requests để cập nhật trạng thái (có thể đã bị reset về PENDING)
      await fetchAllRequests();
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusUpdate = async (request, newStatus) => {
    const statusLabels = {
      'APPROVED': 'Phê duyệt',
      'IN_PROGRESS': 'Đang xử lý',
      'COMPLETED': 'Hoàn thành',
      'REJECTED': 'Từ chối',
    };

    const confirmed = await showConfirm({
      title: 'Xác nhận',
      message: `Bạn có chắc chắn muốn ${statusLabels[newStatus]?.toLowerCase()} yêu cầu này?`,
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
      type: 'info',
    });

    if (confirmed) {
      let notes = '';
      if (newStatus === 'REJECTED' || newStatus === 'COMPLETED') {
        const notesResult = await showConfirm({
          title: 'Ghi chú',
          message: 'Nhập ghi chú (tùy chọn):',
          confirmText: 'Xác nhận',
          cancelText: 'Bỏ qua',
          type: 'info',
          notesInput: {
            placeholder: 'Nhập ghi chú...',
            label: 'Ghi chú (tùy chọn):'
          }
        });
        notes = notesResult ? notesResult.notes || '' : '';
      }
      await handleStatusChange(request.id, newStatus, notes);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { label: 'Chờ xử lý', class: 'pending' },
      APPROVED: { label: 'Đã phê duyệt', class: 'approved' },
      IN_PROGRESS: { label: 'Đang xử lý', class: 'in-progress' },
      COMPLETED: { label: 'Hoàn thành', class: 'completed' },
      REJECTED: { label: 'Từ chối', class: 'rejected' },
    };

    const config = statusConfig[status] || { label: status, class: 'default' };
    return (
      <span className={`status-badge ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      LOW: { label: 'Thấp', class: 'low' },
      NORMAL: { label: 'Bình thường', class: 'normal' },
      HIGH: { label: 'Cao', class: 'high' },
      URGENT: { label: 'Khẩn cấp', class: 'urgent' },
    };

    const config = priorityConfig[priority] || { label: priority, class: 'normal' };
    return (
      <span className={`priority-badge ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const getDepartmentLabel = (dept) => {
    const labels = {
      IT: 'Phòng IT',
      HR: 'Hành chính nhân sự',
      ACCOUNTING: 'Kế toán',
      OTHER: 'Phòng ban khác',
    };
    return labels[dept] || dept;
  };

  const getActionButtons = (request) => {
    if (request.status === 'PENDING') {
      return (
        <div className="request-actions">
          <button
            className="btn-action btn-approve"
            onClick={() => handleStatusUpdate(request, 'APPROVED')}
            disabled={updatingStatus}
          >
            Phê duyệt
          </button>
          <button
            className="btn-action btn-reject"
            onClick={() => handleStatusUpdate(request, 'REJECTED')}
            disabled={updatingStatus}
          >
            Từ chối
          </button>
        </div>
      );
    } else if (request.status === 'APPROVED') {
      return (
        <div className="request-actions">
          <button
            className="btn-action btn-start"
            onClick={() => handleStatusUpdate(request, 'IN_PROGRESS')}
            disabled={updatingStatus}
          >
            Bắt đầu xử lý
          </button>
        </div>
      );
    } else if (request.status === 'IN_PROGRESS') {
      return (
        <div className="request-actions">
          <button
            className="btn-action btn-complete"
            onClick={() => handleStatusUpdate(request, 'COMPLETED')}
            disabled={updatingStatus}
          >
            Hoàn thành
          </button>
        </div>
      );
    }
    return null;
  };

  const parseItems = (items) => {
    if (!items) return [];
    try {
      if (typeof items === 'string') {
        return JSON.parse(items);
      }
      return items;
    } catch {
      return [];
    }
  };

  const handleItemUpdate = async (requestId, itemId, quantityProvided, notes = '') => {
    try {
      setUpdatingItems(prev => ({ ...prev, [itemId]: true }));
      await requestsAPI.updateItem(requestId, itemId, {
        quantityProvided: parseInt(quantityProvided) || 0,
        notes: notes,
        providedBy: currentUser?.id || null,
      });
      await fetchAllRequests();
      if (showToast) {
        showToast('Đã cập nhật số lượng cung cấp', 'success');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      if (showToast) {
        showToast('Lỗi khi cập nhật item', 'error');
      }
    } finally {
      setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const handleItemQuantityUpdate = async (requestId, itemId, currentProvided, quantity) => {
    const result = await showConfirm({
      title: 'Cập nhật số lượng cung cấp',
      message: `Nhập số lượng đã cung cấp cho item này (tối đa: ${quantity}):`,
      confirmText: 'Cập nhật',
      cancelText: 'Hủy',
      type: 'info',
      input: {
        type: 'number',
        defaultValue: currentProvided || 0,
        min: 0,
        max: quantity,
        placeholder: `Nhập số lượng (0-${quantity})`,
        label: `Số lượng đã cung cấp (tối đa: ${quantity}):`,
        required: true
      },
      notesInput: {
        placeholder: 'Ghi chú (tùy chọn)',
        label: 'Ghi chú (tùy chọn):'
      }
    });

    if (result && result.value !== null && result.value !== undefined) {
      const qty = parseInt(result.value);
      if (isNaN(qty) || qty < 0) {
        if (showToast) {
          showToast('Số lượng không hợp lệ', 'error');
        }
        return;
      }
      if (qty > quantity) {
        if (showToast) {
          showToast(`Số lượng không được vượt quá ${quantity}`, 'error');
        }
        return;
      }
      const notes = result.notes || '';
      await handleItemUpdate(requestId, itemId, qty, notes);
    }
  };

  const getItemStatusBadge = (status, quantityProvided, quantity) => {
    const statusConfig = {
      PENDING: { label: 'Chưa cung cấp', class: 'pending', color: '#f59e0b' },
      PARTIAL: { label: `Đã cung cấp ${quantityProvided}/${quantity}`, class: 'partial', color: '#3b82f6' },
      COMPLETED: { label: `Đã cung cấp đủ ${quantity}/${quantity}`, class: 'completed', color: '#10b981' },
      CANCELLED: { label: 'Đã hủy', class: 'cancelled', color: '#ef4444' },
    };

    const config = statusConfig[status] || { label: status, class: 'pending', color: '#6b7280' };
    return (
      <span className={`item-status-badge ${config.class}`} style={{ backgroundColor: config.color + '20', color: config.color }}>
        {config.label}
      </span>
    );
  };

  // Group requests by employee
  // For completed filter: only show fully completed requests
  // For other filters: show all requests for employees that match the filter
  const groupedByEmployee = requests.reduce((acc, request) => {
    const employeeId = request.employee_id || 'unknown';
    if (!acc[employeeId]) {
      acc[employeeId] = {
        employee_id: request.employee_id,
        employee_name: request.employee_name,
        employee_email: request.employee_email,
        ma_nhan_vien: request.ma_nhan_vien,
        requests: []
      };
    }
    // For completed filter, only add fully completed requests
    // For other filters, add all requests that passed the filter
    if (filter === 'completed') {
      if (isRequestFullyCompleted(request)) {
        acc[employeeId].requests.push(request);
      }
    } else {
      acc[employeeId].requests.push(request);
    }
    return acc;
  }, {});

  // Sort employee groups by name
  const employeeGroups = Object.values(groupedByEmployee).sort((a, b) => {
    const nameA = (a.employee_name || '').toLowerCase();
    const nameB = (b.employee_name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // Calculate stats from allRequests (not filtered requests)
  // For completed, count only fully completed requests
  // For total, count only requests that are not fully completed
  const stats = {
    total: allRequests.filter(r => !isRequestFullyCompleted(r)).length,
    pending: allRequests.filter(r => r.status === 'PENDING').length,
    approved: allRequests.filter(r => r.status === 'APPROVED').length,
    inProgress: allRequests.filter(r => r.status === 'IN_PROGRESS').length,
    completed: allRequests.filter(r => isRequestFullyCompleted(r)).length,
  };

  return (
    <div className="requests-management">
      <div className="requests-header">
        <div>
          <h1 className="requests-title">
            {targetDepartment
              ? `Quản lý yêu cầu - ${getDepartmentLabel(targetDepartment)}`
              : 'Quản lý yêu cầu - Tất cả phòng ban'}
          </h1>
          <p className="requests-subtitle">
            {targetDepartment
              ? 'Xem và xử lý các yêu cầu từ HR'
              : 'Xem và theo dõi tất cả các yêu cầu từ HR đến các phòng ban'}
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="requests-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Tổng yêu cầu</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Chờ xử lý</div>
        </div>
        <div className="stat-card approved">
          <div className="stat-value">{stats.approved}</div>
          <div className="stat-label">Đã phê duyệt</div>
        </div>
        <div className="stat-card in-progress">
          <div className="stat-value">{stats.inProgress}</div>
          <div className="stat-label">Đang xử lý</div>
        </div>
        <div className="stat-card completed">
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">Hoàn thành</div>
        </div>
      </div>

      {/* Filters */}
      <div className="requests-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tất cả ({stats.total})
        </button>
        <button
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Chờ xử lý ({stats.pending})
        </button>
        <button
          className={`filter-btn ${filter === 'approved' ? 'active' : ''}`}
          onClick={() => setFilter('approved')}
        >
          Đã phê duyệt ({stats.approved})
        </button>
        <button
          className={`filter-btn ${filter === 'in_progress' ? 'active' : ''}`}
          onClick={() => setFilter('in_progress')}
        >
          Đang xử lý ({stats.inProgress})
        </button>
        <button
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Hoàn thành ({stats.completed})
        </button>
      </div>

      {/* Employee Requests List - Grouped by Employee */}
      <div className="requests-list">
        {loading ? (
          <div className="requests-loading">Đang tải...</div>
        ) : employeeGroups.length === 0 ? (
          <div className="requests-empty">
            <p>Không có yêu cầu nào</p>
          </div>
        ) : (
          employeeGroups.map((employeeGroup) => (
            <div key={employeeGroup.employee_id} className="employee-request-card">
              {/* Employee Header */}
              <div className="employee-card-header">
                <div className="employee-header-info">
                  <h3 className="employee-name">
                    {employeeGroup.employee_name || 'N/A'}
                    {employeeGroup.ma_nhan_vien && (
                      <span className="employee-code"> ({employeeGroup.ma_nhan_vien})</span>
                    )}
                  </h3>
                  <div className="employee-email">{employeeGroup.employee_email || 'N/A'}</div>
                </div>
                <div className="employee-requests-count">
                  {employeeGroup.requests.length} yêu cầu
                </div>
              </div>

              {/* Departments Requests Grid */}
              <div className="employee-departments-grid">
                {employeeGroup.requests.map((request) => (
                  <div key={request.id} className="department-request-section">
                    <div className="department-request-header">
                      <h4 className="department-name">
                        {getDepartmentLabel(request.target_department)}
                      </h4>
                      <div className="department-request-meta">
                        {getStatusBadge(request.status)}
                        {getPriorityBadge(request.priority)}
                        <span className="department-request-date">
                          {formatDate(request.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="department-request-body">
                      {/* Items Detail with Tracking */}
                      {request.items_detail && Array.isArray(request.items_detail) && request.items_detail.length > 0 ? (
                        <div className="department-items-list">
                          {request.items_detail.map((item) => (
                            <div key={item.id} className="department-item-card">
                              <div className="department-item-header">
                                <strong className="department-item-name">{item.item_name}</strong>
                                {getItemStatusBadge(item.status, item.quantity_provided, item.quantity)}
                              </div>
                              <div className="department-item-quantity">
                                Yêu cầu: {item.quantity} | Đã cung cấp: {item.quantity_provided || 0}
                              </div>

                              {/* Actions for department */}
                              {(request.status === 'APPROVED' || request.status === 'IN_PROGRESS') &&
                                targetDepartment &&
                                request.target_department === targetDepartment && (
                                  <button
                                    className="btn-update-item-small"
                                    onClick={() => handleItemQuantityUpdate(request.id, item.id, item.quantity_provided, item.quantity)}
                                    disabled={updatingItems[item.id]}
                                  >
                                    {updatingItems[item.id] ? 'Đang cập nhật...' : 'Cập nhật'}
                                  </button>
                                )}

                              {/* Tracking info for HR */}
                              {(!targetDepartment || request.target_department !== targetDepartment) && (
                                <div className="item-tracking-info-small">
                                  {item.quantity_provided > 0 && item.provided_by_name && (
                                    <div className="provided-by-info-small">
                                      Cung cấp bởi: {item.provided_by_name}
                                    </div>
                                  )}
                                  {item.provided_at && (
                                    <div className="provided-at-info-small">
                                      Lúc: {formatDate(item.provided_at)}
                                    </div>
                                  )}
                                </div>
                              )}

                              {item.quantity_provided > 0 && (
                                <div className="item-progress-small">
                                  <div className="item-progress-bar-small">
                                    <div
                                      className="item-progress-fill-small"
                                      style={{
                                        width: `${Math.min(100, (item.quantity_provided / item.quantity) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="item-progress-text-small">
                                    {Math.round((item.quantity_provided / item.quantity) * 100)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : request.items && parseItems(request.items).length > 0 ? (
                        <ul className="department-items-list-simple">
                          {parseItems(request.items).map((item, idx) => (
                            <li key={idx}>
                              {typeof item === 'string' ? item : item.name || item.tenVatDung || JSON.stringify(item)}
                              {item.quantity && ` (x${item.quantity})`}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="department-no-items">
                          Chưa có vật dụng nào được yêu cầu
                        </div>
                      )}
                    </div>

                    {/* Action buttons for department request */}
                    {targetDepartment && request.target_department === targetDepartment && (
                      <div className="department-request-footer">
                        {getActionButtons(request)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RequestsManagement;

