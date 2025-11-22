import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { requestsAPI } from '../../services/api';
import './RequestsManagement.css';

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
                type="button"
                className={`custom-dropdown-trigger ${isOpen ? 'open' : ''} ${error ? 'error' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
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

const RequestsManagement = ({ currentUser, showToast, showConfirm }) => {
  const [allRequests, setAllRequests] = useState([]); // Store all requests for stats calculation
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'approved', 'in_progress', 'completed'
  const [searchQuery, setSearchQuery] = useState(''); // Search query
  const [requestTypeFilter, setRequestTypeFilter] = useState('all'); // Filter by request type
  const [dateFilter, setDateFilter] = useState('all'); // Filter by date
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingItems, setUpdatingItems] = useState({}); // Track which items are being updated
  const showToastRef = useRef(showToast);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

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
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      if (showToastRef.current) {
        showToastRef.current('Lỗi khi tải danh sách yêu cầu', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [targetDepartment]);

  useEffect(() => {
    fetchAllRequests();
  }, [fetchAllRequests]);

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
      <span className={`status-tag ${config.class}`}>
        {config.label}
      </span>
    );
  };

  // Get request type from items or department
  const getRequestType = (request) => {
    // Simple logic: check if has equipment in items or target department
    if (request.items_detail && request.items_detail.length > 0) {
      const itemNames = request.items_detail.map(item => (item.item_name || '').toLowerCase()).join(' ');
      if (itemNames.includes('máy') || itemNames.includes('thiết bị') || itemNames.includes('laptop') || itemNames.includes('computer')) {
        return 'Trang thiết bị';
      }
      if (itemNames.includes('vật liệu') || itemNames.includes('vật dụng')) {
        return 'Vật liệu';
      }
    }
    return 'Khác';
  };

  // Format request ID
  const formatRequestId = (id) => {
    return `YC${String(id).padStart(6, '0')}`;
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

  const filteredRequests = useMemo(() => {
    if (!allRequests || allRequests.length === 0) return [];

    // Filter by status first
    const grouped = allRequests.reduce((acc, request) => {
      const employeeId = request.employee_id || 'unknown';
      if (!acc[employeeId]) {
        acc[employeeId] = [];
      }
      acc[employeeId].push(request);
      return acc;
    }, {});

    const statusMap = {
      pending: 'PENDING',
      approved: 'APPROVED',
      in_progress: 'IN_PROGRESS',
    };

    const filteredGroups = Object.entries(grouped).filter(([, employeeRequests]) => {
      if (filter === 'completed') {
        return employeeRequests.some(r => isRequestFullyCompleted(r));
      }
      if (filter === 'all') {
        return employeeRequests.length > 0;
      }
      return employeeRequests.some(r => r.status === statusMap[filter]);
    });

    let flattened = filteredGroups.flatMap(([, employeeRequests]) => {
      if (filter === 'completed') {
        return employeeRequests.filter(r => isRequestFullyCompleted(r));
      }
      if (filter === 'all') {
        return employeeRequests;
      }
      return employeeRequests.filter(r => r.status === statusMap[filter]);
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      flattened = flattened.filter(request => {
        const employeeName = (request.employee_name || '').toLowerCase();
        const maNhanVien = (request.ma_nhan_vien || '').toLowerCase();
        const employeeEmail = (request.employee_email || '').toLowerCase();
        return employeeName.includes(query) || maNhanVien.includes(query) || employeeEmail.includes(query);
      });
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      flattened = flattened.filter(request => {
        const requestDate = new Date(request.created_at);
        
        switch (dateFilter) {
          case 'today':
            return requestDate >= today;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return requestDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return requestDate >= monthAgo;
          case 'quarter':
            const quarterAgo = new Date(today);
            quarterAgo.setMonth(quarterAgo.getMonth() - 3);
            return requestDate >= quarterAgo;
          default:
            return true;
        }
      });
    }

    // Apply request type filter (if needed in future)
    // For now, we don't have request type field, so skip this filter

    return flattened;
  }, [allRequests, filter, searchQuery, dateFilter]);

  const groupedByEmployee = useMemo(() => {
    return filteredRequests.reduce((acc, request) => {
      const employeeId = request.employee_id || 'unknown';
      if (!acc[employeeId]) {
        acc[employeeId] = {
          employee_id: request.employee_id,
          employee_name: request.employee_name,
          employee_email: request.employee_email,
          ma_nhan_vien: request.ma_nhan_vien,
          requests: [],
        };
      }
      acc[employeeId].requests.push(request);
      return acc;
    }, {});
  }, [filteredRequests]);

  const employeeGroups = useMemo(() => {
    return Object.values(groupedByEmployee).sort((a, b) => {
      const nameA = (a.employee_name || '').toLowerCase();
      const nameB = (b.employee_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [groupedByEmployee]);

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
      {/* Header với Gradient Calm Integrity */}
      <div className="requests-header">
        <div className="requests-header-content">
          <div className="requests-icon-wrapper">
            <svg className="requests-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {/* Icon Clipboard/Giấy tờ */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
            </svg>
          </div>
          <div>
            <h1 className="requests-title">Theo dõi yêu cầu</h1>
            <p className="requests-subtitle">Quản lý và theo dõi tất cả các yêu cầu của nhân viên</p>
          </div>
        </div>
      </div>

      {/* Nội dung chính */}
      <div className="requests-content">
        {/* Status Tabs/Filters */}
        <div className="requests-status-tabs">
          <button
            className={`status-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <span className="status-tab-label">Tất cả</span>
            <span className="status-tab-count">{stats.total}</span>
          </button>
          <button
            className={`status-tab pending ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            <span className="status-tab-label">Chờ xử lý</span>
            <span className="status-tab-count">{stats.pending}</span>
          </button>
          <button
            className={`status-tab approved ${filter === 'approved' ? 'active' : ''}`}
            onClick={() => setFilter('approved')}
          >
            <span className="status-tab-label">Đã phê duyệt</span>
            <span className="status-tab-count">{stats.approved}</span>
          </button>
          <button
            className={`status-tab in-progress ${filter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setFilter('in_progress')}
          >
            <span className="status-tab-label">Đang xử lý</span>
            <span className="status-tab-count">{stats.inProgress}</span>
          </button>
          <button
            className={`status-tab completed ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            <span className="status-tab-label">Hoàn thành</span>
            <span className="status-tab-count">{stats.completed}</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="requests-filter-search-bar">
          {/* Filter Dropdowns */}
          <div className="requests-filter-group">
            {/* Filter by Request Type */}
            <div className="filter-dropdown-wrapper">
              <label htmlFor="request-type-filter" className="filter-label">
                Loại yêu cầu
              </label>
              <CustomDropdown
                id="request-type-filter"
                value={requestTypeFilter}
                onChange={(e) => setRequestTypeFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'Tất cả' },
                  { value: 'equipment', label: 'Trang thiết bị' },
                  { value: 'material', label: 'Vật liệu' },
                  { value: 'other', label: 'Khác' }
                ]}
                placeholder="Chọn loại yêu cầu"
                className="filter-dropdown-custom"
              />
            </div>

            {/* Filter by Date */}
            <div className="filter-dropdown-wrapper">
              <label htmlFor="date-filter" className="filter-label">
                Thời gian
              </label>
              <CustomDropdown
                id="date-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'Tất cả' },
                  { value: 'today', label: 'Hôm nay' },
                  { value: 'week', label: 'Tuần này' },
                  { value: 'month', label: 'Tháng này' },
                  { value: 'quarter', label: 'Quý này' }
                ]}
                placeholder="Chọn thời gian"
                className="filter-dropdown-custom"
              />
            </div>
          </div>

          {/* Search Bar */}
          <div className="requests-search-wrapper">
            <div className="requests-search-input-wrapper">
              <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input
                type="text"
                className="requests-search-input"
                placeholder="Tìm kiếm theo tên nhân viên, mã nhân viên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Xóa tìm kiếm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Request Table */}
        <div className="requests-table-container">
          {loading ? (
            <div className="requests-loading">
              <div className="loading-spinner"></div>
              <p>Đang tải dữ liệu...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="requests-empty">
              <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <p>Không có yêu cầu nào</p>
            </div>
          ) : (
            <table className="requests-table">
              <thead>
                <tr>
                  <th>Mã yêu cầu</th>
                  <th>Loại yêu cầu</th>
                  <th>Người liên quan</th>
                  <th>Ngày tạo</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="request-row">
                    <td className="request-id-cell">
                      <span className="request-id">{formatRequestId(request.id)}</span>
                    </td>
                    <td className="request-type-cell">
                      <span className="request-type">{getRequestType(request)}</span>
                    </td>
                    <td className="request-people-cell">
                      <div className="request-people-info">
                        <div className="request-sender">
                          <strong>Người gửi:</strong> {request.employee_name || 'N/A'}
                          {request.ma_nhan_vien && <span className="employee-code"> ({request.ma_nhan_vien})</span>}
                        </div>
                        {request.target_department && (
                          <div className="request-target">
                            <strong>Phòng ban:</strong> {getDepartmentLabel(request.target_department)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="request-date-cell">
                      <span className="request-date">{formatDate(request.created_at)}</span>
                    </td>
                    <td className="request-status-cell">
                      {getStatusBadge(request.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestsManagement;

