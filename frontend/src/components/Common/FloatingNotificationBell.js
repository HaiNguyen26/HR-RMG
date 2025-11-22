import React, { useState, useEffect, useRef } from 'react';
import { leaveRequestsAPI, overtimeRequestsAPI, attendanceAdjustmentsAPI, candidatesAPI } from '../../services/api';
import './FloatingNotificationBell.css';

const FloatingNotificationBell = ({ currentUser, showToast }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [readRequestIds, setReadRequestIds] = useState(new Set());
    const intervalRef = useRef(null);

    // Load read request IDs from localStorage
    useEffect(() => {
        if (!currentUser || currentUser.role !== 'HR') return;

        try {
            const stored = localStorage.getItem(`hr_read_requests_${currentUser.id}`);
            if (stored) {
                const ids = JSON.parse(stored);
                setReadRequestIds(new Set(ids));
            }
        } catch (error) {
            console.error('Error loading read requests:', error);
        }
    }, [currentUser]);

    // Save read request IDs to localStorage
    const saveReadRequestIds = (ids) => {
        if (!currentUser || currentUser.role !== 'HR') return;

        try {
            localStorage.setItem(`hr_read_requests_${currentUser.id}`, JSON.stringify(Array.from(ids)));
        } catch (error) {
            console.error('Error saving read requests:', error);
        }
    };

    // Fetch unread notifications count (leave + overtime + attendance + candidates)
    const fetchUnreadCount = async (currentReadIds = null) => {
        if (!currentUser || currentUser.role !== 'HR') return;

        try {
            // Fetch recent leave requests (pending, approved, rejected)
            const leaveResponse = await leaveRequestsAPI.getAll({
                mode: 'hr',
                hrUserId: currentUser.id,
                status: 'PENDING_TEAM_LEAD,PENDING_DIRECTOR,APPROVED,REJECTED'
            });

            // Fetch recent overtime requests (pending, approved, rejected)
            const overtimeResponse = await overtimeRequestsAPI.getAll({
                mode: 'hr',
                hrUserId: currentUser.id,
                status: 'PENDING_TEAM_LEAD,PENDING_DIRECTOR,APPROVED,REJECTED'
            });

            // Fetch recent attendance adjustment requests (pending, approved, rejected)
            const attendanceResponse = await attendanceAdjustmentsAPI.getAll({
                mode: 'hr',
                hrUserId: currentUser.id,
                status: 'PENDING_TEAM_LEAD,PENDING_DIRECTOR,APPROVED,REJECTED'
            });

            // Fetch candidates with status PASSED or FAILED (approved/rejected by manager)
            const candidatesResponse = await candidatesAPI.getAll({
                status: 'all',
                search: ''
            });

            const leaveRequests = leaveResponse.data?.success && Array.isArray(leaveResponse.data.data)
                ? leaveResponse.data.data
                : [];
            const overtimeRequests = overtimeResponse.data?.success && Array.isArray(overtimeResponse.data.data)
                ? overtimeResponse.data.data
                : [];
            const attendanceRequests = attendanceResponse.data?.success && Array.isArray(attendanceResponse.data.data)
                ? attendanceResponse.data.data
                : [];
            const candidates = candidatesResponse.data?.success && Array.isArray(candidatesResponse.data.data)
                ? candidatesResponse.data.data
                : [];

            // Combine and create unique IDs (type:leave_id, type:overtime_id, type:attendance_id, or type:candidate_id)
            // Filter to only count recent decisions (within last 7 days) or pending requests
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const allRequests = [
                ...leaveRequests
                    .filter(req => {
                        const isPending = req.status === 'PENDING_TEAM_LEAD' || req.status === 'PENDING_DIRECTOR';
                        if (isPending) return true;
                        const updatedAt = new Date(req.updated_at || req.team_lead_action_at || req.branch_manager_action_at || 0);
                        return updatedAt >= sevenDaysAgo;
                    })
                    .map(req => ({ ...req, notificationId: `leave:${req.id}:${req.status || 'UNKNOWN'}`, notificationType: 'leave' })),
                ...overtimeRequests
                    .filter(req => {
                        const isPending = req.status === 'PENDING_TEAM_LEAD' || req.status === 'PENDING_DIRECTOR';
                        if (isPending) return true;
                        const updatedAt = new Date(req.updated_at || req.team_lead_action_at || req.branch_manager_action_at || 0);
                        return updatedAt >= sevenDaysAgo;
                    })
                    .map(req => ({ ...req, notificationId: `overtime:${req.id}:${req.status || 'UNKNOWN'}`, notificationType: 'overtime' })),
                ...attendanceRequests
                    .filter(req => {
                        const isPending = req.status === 'PENDING_TEAM_LEAD' || req.status === 'PENDING_DIRECTOR';
                        if (isPending) return true;
                        const updatedAt = new Date(req.updated_at || req.team_lead_action_at || req.branch_manager_action_at || 0);
                        return updatedAt >= sevenDaysAgo;
                    })
                    .map(req => ({ ...req, notificationId: `attendance:${req.id}:${req.status || 'UNKNOWN'}`, notificationType: 'attendance' })),
                ...candidates
                    .filter(candidate => {
                        // Only show PASSED or FAILED candidates (approved/rejected by manager)
                        if (candidate.status !== 'PASSED' && candidate.status !== 'FAILED') return false;
                        // Only show if updated within last 7 days
                        const updatedAt = new Date(candidate.updatedAt || candidate.updated_at || candidate.createdAt || candidate.created_at || 0);
                        return updatedAt >= sevenDaysAgo;
                    })
                    .map(candidate => {
                        // Get candidate name - check both camelCase and snake_case
                        const candidateName = (candidate.hoTen || candidate.ho_ten || '').trim();
                        // Get manager name
                        const managerName = candidate.managerName || candidate.manager_name || 'N/A';
                        // Get position - map from value to label
                        const positionValue = candidate.viTriUngTuyen || candidate.vi_tri_ung_tuyen || '';
                        const positionLabel = getPositionLabel(positionValue);
                        
                        // Build employee_name: if candidate name exists, show "Manager - CandidateName", else just show candidate name or fallback
                        let employeeNameValue;
                        if (candidateName) {
                            employeeNameValue = managerName !== 'N/A' ? `${managerName} - ${candidateName}` : candidateName;
                        } else {
                            employeeNameValue = managerName !== 'N/A' ? managerName : 'Chưa có tên';
                        }
                        
                        return {
                            ...candidate,
                            notificationId: `candidate:${candidate.id}:${candidate.status || 'UNKNOWN'}`,
                            notificationType: 'candidate',
                            // Map candidate fields to notification fields for consistency
                            employee_name: employeeNameValue,
                            // Store both value and label for position
                            viTriUngTuyen: positionValue,
                            viTriUngTuyenLabel: positionLabel
                        };
                    })
            ];

            // Use provided readIds or current state
            const readIds = currentReadIds || readRequestIds;
            // Count only unread requests (not in readRequestIds)
            const unreadRequests = allRequests.filter(req => {
                if (!req.notificationId) return false;
                return !readIds.has(req.notificationId);
            });
            setUnreadCount(unreadRequests.length);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };

    // Fetch notifications for modal (leave + overtime + attendance + candidates)
    const fetchNotifications = async () => {
        if (!currentUser || currentUser.role !== 'HR') return;

        setLoading(true);
        try {
            // Fetch leave requests (pending, approved, rejected)
            const leaveResponse = await leaveRequestsAPI.getAll({
                mode: 'hr',
                hrUserId: currentUser.id,
                status: 'PENDING_TEAM_LEAD,PENDING_DIRECTOR,APPROVED,REJECTED'
            });

            // Fetch overtime requests (pending, approved, rejected)
            const overtimeResponse = await overtimeRequestsAPI.getAll({
                mode: 'hr',
                hrUserId: currentUser.id,
                status: 'PENDING_TEAM_LEAD,PENDING_DIRECTOR,APPROVED,REJECTED'
            });

            // Fetch attendance adjustment requests (pending, approved, rejected)
            const attendanceResponse = await attendanceAdjustmentsAPI.getAll({
                mode: 'hr',
                hrUserId: currentUser.id,
                status: 'PENDING_TEAM_LEAD,PENDING_DIRECTOR,APPROVED,REJECTED'
            });

            // Fetch candidates with status PASSED or FAILED (approved/rejected by manager)
            const candidatesResponse = await candidatesAPI.getAll({
                status: 'all',
                search: ''
            });

            const leaveRequests = leaveResponse.data?.success && Array.isArray(leaveResponse.data.data)
                ? leaveResponse.data.data
                : [];
            const overtimeRequests = overtimeResponse.data?.success && Array.isArray(overtimeResponse.data.data)
                ? overtimeResponse.data.data
                : [];
            const attendanceRequests = attendanceResponse.data?.success && Array.isArray(attendanceResponse.data.data)
                ? attendanceResponse.data.data
                : [];
            const candidates = candidatesResponse.data?.success && Array.isArray(candidatesResponse.data.data)
                ? candidatesResponse.data.data
                : [];

            // Combine and add metadata
            // Filter to only show recent decisions (within last 7 days) or pending requests
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const allNotifications = [
                ...leaveRequests
                    .filter(req => {
                        // Show if pending or if approved/rejected within last 7 days
                        const isPending = req.status === 'PENDING_TEAM_LEAD' || req.status === 'PENDING_DIRECTOR';
                        if (isPending) return true;
                        const updatedAt = new Date(req.updated_at || req.team_lead_action_at || req.branch_manager_action_at || 0);
                        return updatedAt >= sevenDaysAgo;
                    })
                    .map(req => ({
                        ...req,
                        notificationId: `leave:${req.id}:${req.status || 'UNKNOWN'}`,
                        notificationType: 'leave',
                        createdAt: req.created_at || req.request_date
                    })),
                ...overtimeRequests
                    .filter(req => {
                        const isPending = req.status === 'PENDING_TEAM_LEAD' || req.status === 'PENDING_DIRECTOR';
                        if (isPending) return true;
                        const updatedAt = new Date(req.updated_at || req.team_lead_action_at || req.branch_manager_action_at || 0);
                        return updatedAt >= sevenDaysAgo;
                    })
                    .map(req => ({
                        ...req,
                        notificationId: `overtime:${req.id}:${req.status || 'UNKNOWN'}`,
                        notificationType: 'overtime',
                        createdAt: req.created_at || req.request_date
                    })),
                ...attendanceRequests
                    .filter(req => {
                        const isPending = req.status === 'PENDING_TEAM_LEAD' || req.status === 'PENDING_DIRECTOR';
                        if (isPending) return true;
                        const updatedAt = new Date(req.updated_at || req.team_lead_action_at || req.branch_manager_action_at || 0);
                        return updatedAt >= sevenDaysAgo;
                    })
                    .map(req => ({
                        ...req,
                        notificationId: `attendance:${req.id}:${req.status || 'UNKNOWN'}`,
                        notificationType: 'attendance',
                        createdAt: req.created_at || req.adjustment_date
                    })),
                ...candidates
                    .filter(candidate => {
                        // Only show PASSED or FAILED candidates (approved/rejected by manager)
                        if (candidate.status !== 'PASSED' && candidate.status !== 'FAILED') return false;
                        // Only show if updated within last 7 days
                        const updatedAt = new Date(candidate.updatedAt || candidate.updated_at || candidate.createdAt || candidate.created_at || 0);
                        return updatedAt >= sevenDaysAgo;
                    })
                    .map(candidate => {
                        // Get candidate name - check both camelCase and snake_case
                        const candidateName = candidate.hoTen || candidate.ho_ten || '';
                        // Get manager name
                        const managerName = candidate.managerName || candidate.manager_name || 'N/A';
                        // Get position - map from value to label
                        const positionValue = candidate.viTriUngTuyen || candidate.vi_tri_ung_tuyen || '';
                        const positionLabel = getPositionLabel(positionValue);
                        
                        return {
                            ...candidate,
                            notificationId: `candidate:${candidate.id}:${candidate.status || 'UNKNOWN'}`,
                            notificationType: 'candidate',
                            createdAt: candidate.updatedAt || candidate.updated_at || candidate.createdAt || candidate.created_at,
                            // Map candidate fields to notification fields for consistency
                            employee_name: candidateName ? `${managerName} - ${candidateName}` : (managerName !== 'N/A' ? managerName : 'Chưa có tên'),
                            // Store both value and label for position
                            viTriUngTuyen: positionValue,
                            viTriUngTuyenLabel: positionLabel
                        };
                    })
            ];

            // Sort by created_at descending (most recent first)
            allNotifications.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0);
                const dateB = new Date(b.createdAt || 0);
                return dateB - dateA;
            });

            // Limit to 50 most recent notifications
            const limitedNotifications = allNotifications.slice(0, 50);
            setNotifications(limitedNotifications);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            if (showToast) {
                showToast('Không thể tải danh sách thông báo.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch and set up polling
    useEffect(() => {
        if (!currentUser || currentUser.role !== 'HR') return;

        // Initial fetch after readRequestIds is loaded
        const timer = setTimeout(() => {
            fetchUnreadCount();
        }, 100);

        // Set up polling every 30 seconds
        intervalRef.current = setInterval(() => {
            fetchUnreadCount();
        }, 30000); // 30 seconds

        return () => {
            if (timer) clearTimeout(timer);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [currentUser, readRequestIds.size]); // Re-run when readRequestIds changes

    // Fetch notifications when modal opens
    useEffect(() => {
        if (isModalOpen) {
            fetchNotifications();
        }
    }, [isModalOpen]);

    const handleBellClick = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    // Handle click on notification item - mark as read
    const handleNotificationClick = (notificationId) => {
        if (!notificationId) return;

        // Check if already read
        if (readRequestIds.has(notificationId)) return;

        const newReadIds = new Set(readRequestIds);
        newReadIds.add(notificationId);
        setReadRequestIds(newReadIds);
        saveReadRequestIds(newReadIds);

        // Update unread count immediately
        setUnreadCount(prev => Math.max(0, prev - 1));

        // Re-fetch to ensure accuracy
        fetchUnreadCount(newReadIds);
    };

    const formatDate = (dateString, withTime = false) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        if (withTime) {
            return date.toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const getStatusLabel = (status) => {
        const statusMap = {
            'PENDING_TEAM_LEAD': 'Chờ QL trực tiếp',
            'PENDING_DIRECTOR': 'Chờ Giám đốc',
            'APPROVED': 'Đã duyệt',
            'REJECTED': 'Đã từ chối',
            'PASSED': 'Đã duyệt',
            'FAILED': 'Đã từ chối'
        };
        return statusMap[status] || status;
    };

    const getRequestTypeLabel = (notificationType, type) => {
        if (notificationType === 'overtime') {
            return 'Đơn tăng ca';
        }
        if (notificationType === 'attendance') {
            return 'Đơn bổ sung chấm công';
        }
        if (notificationType === 'candidate') {
            return 'Ứng viên';
        }
        return type === 'RESIGNATION' ? 'Xin nghỉ việc' : 'Xin nghỉ phép';
    };

    const getCheckTypeLabel = (checkType) => {
        const checkTypeMap = {
            'CHECK_IN': 'Quên giờ vào',
            'CHECK_OUT': 'Quên giờ ra',
            'BOTH': 'Quên cả giờ vào và ra'
        };
        return checkTypeMap[checkType] || checkType;
    };

    const getPositionLabel = (positionValue) => {
        const positionMap = {
            'MUAHANG': 'Mua hàng',
            'TAPVU_NAUAN': 'Tạp vụ & nấu ăn',
            'HAN_BOMACH': 'Hàn bo mạch',
            'CHATLUONG': 'Chất lượng',
            'KHAOSAT_THIETKE': 'Khảo sát thiết kế',
            'ADMIN_DUAN': 'Admin dự án',
            'LAPRAP': 'Lắp ráp',
            'LAPRAP_JIG_PALLET': 'Lắp ráp JIG, Pallet',
            'DIEN_LAPTRINH_PLC': 'Điện lập trình PLC',
            'THIETKE_MAY_TUDONG': 'Thiết kế máy tự động',
            'VANHANH_MAY_CNC': 'Vận hành máy CNC',
            'DICHVU_KYTHUAT': 'Dịch vụ Kỹ thuật',
            'KETOAN_NOIBO': 'Kế toán nội bộ',
            'KETOAN_BANHANG': 'Kế toán bán hàng'
        };
        return positionMap[positionValue] || positionValue;
    };

    if (!currentUser || currentUser.role !== 'HR') {
        return null;
    }

    return (
        <>
            {/* Floating Bell Button */}
            <button
                type="button"
                className="floating-notification-bell"
                onClick={handleBellClick}
                aria-label="Thông báo đơn xin phép"
            >
                <svg className="floating-bell-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                </svg>
                {unreadCount > 0 && (
                    <span className="floating-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
            </button>

            {/* Modal */}
            {isModalOpen && (
                <div className="floating-notification-modal-overlay" onClick={handleCloseModal}>
                    <div className="floating-notification-modal-container" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="floating-notification-modal-header">
                            <div>
                                <h2 className="floating-notification-modal-title">Thông báo</h2>
                                <p className="floating-notification-modal-subtitle">
                                    Danh sách các đơn đang chờ xử lý
                                </p>
                            </div>
                            <button
                                type="button"
                                className="floating-notification-modal-close"
                                onClick={handleCloseModal}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="floating-notification-modal-content">
                            {loading ? (
                                <div className="floating-notification-loading">
                                    <div className="floating-notification-spinner"></div>
                                    <span>Đang tải danh sách...</span>
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="floating-notification-empty">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    <p>Chưa có thông báo nào</p>
                                </div>
                            ) : (
                                <div className="floating-notification-list">
                                    {notifications.map((notification) => {
                                        const isRead = readRequestIds.has(notification.notificationId);
                                        const isOvertime = notification.notificationType === 'overtime';
                                        const isAttendance = notification.notificationType === 'attendance';
                                        const isCandidate = notification.notificationType === 'candidate';
                                        return (
                                            <div
                                                key={notification.notificationId}
                                                className={`floating-notification-item ${isRead ? 'floating-notification-item--read' : 'floating-notification-item--unread'}`}
                                                onClick={() => handleNotificationClick(notification.notificationId)}
                                            >
                                                {!isRead && (
                                                    <div className="floating-notification-unread-indicator"></div>
                                                )}
                                                <div className="floating-notification-item-header">
                                                    <div className="floating-notification-item-title">
                                                        <span className="floating-notification-employee-name">
                                                            {(() => {
                                                                if (isCandidate) {
                                                                    // For candidates, extract candidate name from employee_name format "Manager - CandidateName"
                                                                    if (notification.employee_name && notification.employee_name.includes(' - ')) {
                                                                        return notification.employee_name.split(' - ')[1] || notification.hoTen || notification.ho_ten || 'Chưa có tên';
                                                                    }
                                                                    return notification.hoTen || notification.ho_ten || notification.employee_name || 'Chưa có tên';
                                                                }
                                                                return notification.employee_name || 'Chưa có tên';
                                                            })()}
                                                        </span>
                                                        <span className="floating-notification-request-type">
                                                            {getRequestTypeLabel(notification.notificationType, notification.type)}
                                                        </span>
                                                    </div>
                                                    <span className={`floating-notification-status floating-notification-status--${notification.status?.toLowerCase()}`}>
                                                        {getStatusLabel(notification.status)}
                                                    </span>
                                                </div>
                                                <div className="floating-notification-item-details">
                                                    {!isCandidate && (
                                                        <div className="floating-notification-detail">
                                                            <svg className="floating-notification-detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                            </svg>
                                                            <span>
                                                                {isOvertime
                                                                    ? formatDate(notification.request_date) || '-'
                                                                    : isAttendance
                                                                        ? formatDate(notification.adjustment_date) || '-'
                                                                        : notification.start_date && notification.end_date && notification.request_type === 'LEAVE'
                                                                            ? `${formatDate(notification.start_date)} - ${formatDate(notification.end_date)}`
                                                                            : formatDate(notification.start_date) || '-'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {isCandidate && (
                                                        <div className="floating-notification-detail">
                                                            <svg className="floating-notification-detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                                            </svg>
                                                            <span>
                                                                {(() => {
                                                                    // Try multiple sources for candidate name
                                                                    const candidateName = notification.hoTen || notification.ho_ten || 
                                                                                          (notification.employee_name && notification.employee_name.includes(' - ') 
                                                                                           ? notification.employee_name.split(' - ')[1] 
                                                                                           : null);
                                                                    return candidateName || 'Chưa có tên';
                                                                })()}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {isCandidate && (notification.viTriUngTuyen || notification.vi_tri_ung_tuyen) && (
                                                        <div className="floating-notification-detail">
                                                            <svg className="floating-notification-detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                                            </svg>
                                                            <span>{notification.viTriUngTuyenLabel || getPositionLabel(notification.viTriUngTuyen || notification.vi_tri_ung_tuyen)}</span>
                                                        </div>
                                                    )}
                                                    {isOvertime && notification.start_time && notification.end_time && (
                                                        <div className="floating-notification-detail">
                                                            <svg className="floating-notification-detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                            </svg>
                                                            <span>{notification.start_time} - {notification.end_time}</span>
                                                        </div>
                                                    )}
                                                    {isAttendance && notification.check_type && (
                                                        <div className="floating-notification-detail">
                                                            <svg className="floating-notification-detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                            </svg>
                                                            <span>{getCheckTypeLabel(notification.check_type)}</span>
                                                        </div>
                                                    )}
                                                    {isAttendance && notification.check_in_time && (
                                                        <div className="floating-notification-detail">
                                                            <svg className="floating-notification-detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                            </svg>
                                                            <span>Giờ vào: {notification.check_in_time}</span>
                                                        </div>
                                                    )}
                                                    {isAttendance && notification.check_out_time && (
                                                        <div className="floating-notification-detail">
                                                            <svg className="floating-notification-detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                            </svg>
                                                            <span>Giờ ra: {notification.check_out_time}</span>
                                                        </div>
                                                    )}
                                                    <div className="floating-notification-detail">
                                                        <svg className="floating-notification-detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                        </svg>
                                                        <span>{formatDate(notification.createdAt || notification.created_at, true)}</span>
                                                    </div>
                                                </div>
                                                {(notification.reason || (isCandidate && notification.notes)) && (
                                                    <div className="floating-notification-item-reason">
                                                        <strong>{isCandidate ? 'Ghi chú:' : 'Lý do:'}</strong> {notification.reason || notification.notes || '-'}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingNotificationBell;

