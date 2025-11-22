import React, { useEffect, useMemo, useState } from 'react';
import {
    attendanceAdjustmentsAPI,
    leaveRequestsAPI,
    overtimeRequestsAPI
} from '../../services/api';
import './LeaveApprovals.css';

const STATUS_LABELS = {
    PENDING_TEAM_LEAD: 'Chờ quản lý',
    PENDING_BRANCH: 'Chờ quản lý gián tiếp',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Đã từ chối',
    CANCELLED: 'Đã hủy',
    ESCALATED: 'Đã chuyển quản lý gián tiếp'
};

const REQUEST_TYPE_LABELS = {
    LEAVE: 'Xin nghỉ phép',
    RESIGN: 'Xin nghỉ việc'
};

const MODULE_OPTIONS = [
    {
        key: 'leave',
        label: 'Đơn xin nghỉ',
        header: {
            teamLead: 'Đơn nghỉ chờ quản lý duyệt',
            branch: 'Đơn nghỉ chờ quản lý gián tiếp duyệt',
            hr: 'Theo dõi đơn nghỉ'
        },
        description: {
            teamLead: 'Xem và xử lý các đơn xin nghỉ của nhân viên thuộc nhóm bạn phụ trách.',
            branch: 'Xác nhận các đơn đã được quản lý trực tiếp phê duyệt và đưa ra quyết định cuối cùng.',
            hr: 'Theo dõi trạng thái, xử lý escalations và đảm bảo tiến độ phê duyệt.'
        }
    },
    {
        key: 'overtime',
        label: 'Đơn tăng ca',
        header: {
            teamLead: 'Đơn tăng ca chờ quản lý duyệt',
            branch: 'Đơn tăng ca chờ quản lý gián tiếp duyệt',
            hr: 'Theo dõi đơn tăng ca'
        },
        description: {
            teamLead: 'Xem và xử lý các đề xuất tăng ca do nhân viên gửi.',
            branch: 'Quyết định cuối cùng cho các đơn tăng ca đã được quản lý trực tiếp duyệt.',
            hr: 'Theo dõi tiến độ và hỗ trợ đẩy các đơn tăng ca khi cần thiết.'
        }
    },
    {
        key: 'attendance',
        label: 'Đơn bổ sung công',
        header: {
            teamLead: 'Đơn bổ sung công chờ quản lý duyệt',
            branch: 'Đơn bổ sung công chờ quản lý gián tiếp duyệt',
            hr: 'Theo dõi đơn bổ sung công'
        },
        description: {
            teamLead: 'Xử lý các yêu cầu bổ sung giờ vào/ra của nhân viên.',
            branch: 'Quyết định cuối cùng cho các đơn bổ sung công đã được quản lý trực tiếp chấp thuận.',
            hr: 'Theo dõi, nhắc nhở và đẩy các đơn bổ sung công khi cần.'
        }
    }
];

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

const deriveViewerMode = (currentUser) => {
    if (!currentUser) return null;
    if (currentUser.role && currentUser.role !== 'EMPLOYEE') {
        return 'hr';
    }
    const title = (currentUser.chucDanh || '').toLowerCase();
    if (
        title.includes('quản lý gián tiếp') ||
        title.includes('giám đốc') ||
        title.includes('ban lãnh đạo')
    ) {
        return 'branchManager';
    }
    if (title.includes('quản lý') || title.includes('team lead')) {
        return 'teamLead';
    }
    return null;
};

const LeaveApprovals = ({ currentUser, showToast, showConfirm }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('PENDING');
    const [stats, setStats] = useState({ total: 0, overdueCount: 0 });
    const [refreshToken, setRefreshToken] = useState(0);
    const [activeModule, setActiveModule] = useState('leave');
    const [managerOverride, setManagerOverride] = useState(null);
    const [managerResolved, setManagerResolved] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const determineManagerMode = async () => {
            if (!currentUser?.id) {
                if (isMounted) {
                    setManagerOverride(null);
                    setManagerResolved(true);
                }
                return;
            }

            if (currentUser.role && currentUser.role !== 'EMPLOYEE') {
                if (isMounted) {
                    setManagerOverride('hr');
                    setManagerResolved(true);
                }
                return;
            }

            try {
                const response = await leaveRequestsAPI.getManagers();
                const managers = response.data?.data || {};
                const normalizedName = (currentUser.hoTen || currentUser.username || '').trim().toLowerCase();

                const isTeamLead = Array.isArray(managers.teamLeads) && managers.teamLeads.some((lead) => {
                    if (!lead) return false;
                    if (lead.id && lead.id === currentUser.id) return true;
                    const leadName = (lead.ho_ten || '').trim().toLowerCase();
                    return leadName && leadName === normalizedName;
                });

                if (isTeamLead) {
                    if (isMounted) {
                        setManagerOverride('teamLead');
                        setManagerResolved(true);
                    }
                    return;
                }

                const isBranchManagerMatch = Array.isArray(managers.branchManagers) && managers.branchManagers.some((manager) => {
                    if (!manager) return false;
                    if (manager.id && manager.id === currentUser.id) return true;
                    const managerName = (manager.ho_ten || '').trim().toLowerCase();
                    return managerName && managerName === normalizedName;
                });

                if (isBranchManagerMatch) {
                    if (isMounted) {
                        setManagerOverride('branchManager');
                        setManagerResolved(true);
                    }
                    return;
                }

                if (isMounted) {
                    setManagerOverride(null);
                    setManagerResolved(true);
                }
            } catch (error) {
                console.error('Error resolving manager role:', error);
                if (isMounted) {
                    setManagerOverride(null);
                    setManagerResolved(true);
                }
            }
        };

        determineManagerMode();

        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    const baseViewerMode = useMemo(() => deriveViewerMode(currentUser), [currentUser]);
    const viewerMode = managerResolved ? (managerOverride ?? baseViewerMode) : null;
    const isTeamLead = viewerMode === 'teamLead';
    const isBranchManager = viewerMode === 'branchManager';
    const isHr = viewerMode === 'hr';

    const statusFilters = useMemo(() => {
        if (isTeamLead) {
            return [
                { key: 'PENDING', label: 'Chờ tôi duyệt' },
                { key: 'PENDING_BRANCH', label: 'Đang chờ quản lý gián tiếp' },
                { key: 'APPROVED', label: 'Đã duyệt' },
                { key: 'REJECTED', label: 'Đã từ chối' }
            ];
        }
        if (isBranchManager) {
            return [
                { key: 'PENDING_BRANCH', label: 'Chờ tôi duyệt' },
                { key: 'APPROVED', label: 'Đã duyệt' },
                { key: 'REJECTED', label: 'Đã từ chối' }
            ];
        }
        return [
            { key: 'PENDING', label: 'Đơn chờ xử lý' },
            { key: 'PENDING_BRANCH', label: 'Đang chờ quản lý gián tiếp' },
            { key: 'APPROVED', label: 'Đã duyệt' },
            { key: 'REJECTED', label: 'Đã từ chối' },
            { key: 'ALL', label: 'Tất cả' }
        ];
    }, [isTeamLead, isBranchManager]);

    const buildStatusQuery = (filterKey) => {
        if (filterKey === 'ALL') return null;
        if (filterKey === 'PENDING') {
            return 'PENDING_TEAM_LEAD';
        }
        return filterKey;
    };

    const moduleApiMap = useMemo(
        () => ({
            leave: leaveRequestsAPI,
            overtime: overtimeRequestsAPI,
            attendance: attendanceAdjustmentsAPI
        }),
        []
    );

    const currentModuleConfig = useMemo(
        () => MODULE_OPTIONS.find((module) => module.key === activeModule) || MODULE_OPTIONS[0],
        [activeModule]
    );

    const fetchRequests = async () => {
        if (!viewerMode || !currentUser?.id) return;

        setLoading(true);
        try {
            const params = {};
            if (isTeamLead) {
                params.mode = 'teamLead';
                params.teamLeadId = currentUser.id;
            } else if (isBranchManager) {
                params.mode = 'branchManager';
                params.branchManagerId = currentUser.id;
            } else {
                params.mode = 'hr';
                params.hrUserId = currentUser.id;
            }

            const statusQuery = buildStatusQuery(selectedStatus);
            if (statusQuery) {
                params.status = statusQuery;
            }

            const response = await moduleApiMap[activeModule].getAll(params);
            if (response.data.success) {
                setRequests(response.data.data || []);
                setStats(response.data.stats || { total: 0, overdueCount: 0 });
            }
        } catch (error) {
            console.error('Error fetching approvals:', error);
            if (showToast) {
                showToast('Không thể tải danh sách đơn.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!viewerMode) return;
        if (isBranchManager) {
            setSelectedStatus('PENDING_BRANCH');
        } else {
            setSelectedStatus('PENDING');
        }
    }, [viewerMode, isBranchManager, activeModule]);

    useEffect(() => {
        if (!viewerMode) return;
        fetchRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewerMode, selectedStatus, currentUser?.id, refreshToken, activeModule]);

    const askForComment = async ({ title, message, required = false }) => {
        if (showConfirm) {
            const result = await showConfirm({
                title,
                message,
                confirmText: 'Xác nhận',
                cancelText: 'Bỏ qua',
                type: 'info',
                notesInput: {
                    placeholder: 'Nhập ghi chú (tùy chọn)',
                    label: 'Ghi chú:',
                    required
                }
            });

            if (!result) {
                return result === false ? false : '';
            }
            return result.notes || '';
        }

        const value = window.prompt(message || title || 'Nhập ghi chú');
        if (value === null) return false;
        if (required && !value.trim()) return '';
        return value || '';
    };

    const handleDecision = async (request, decision) => {
        try {
            const isReject = decision === 'REJECT';
            let comment = '';
            if (isReject) {
                const result = await askForComment({
                    title: 'Nhập lý do từ chối (tùy chọn)',
                    message: 'Bạn có thể thêm ghi chú để nhân viên hiểu quyết định.',
                    required: false
                });
                if (result === false) {
                    return;
                }
                comment = result;
            }

            const payload = {
                actorType: isTeamLead ? 'TEAM_LEAD' : 'BRANCH',
                actorId: currentUser.id,
                decision,
                comment
            };

            await moduleApiMap[activeModule].decide(request.id, payload);

            if (showToast) {
                const moduleLabel = MODULE_OPTIONS.find(m => m.key === activeModule)?.label || 'đơn';
                showToast(
                    decision === 'APPROVE'
                        ? `Đã phê duyệt ${moduleLabel} thành công!`
                        : `Đã từ chối ${moduleLabel}.`,
                    'success'
                );
            }

            setRefreshToken((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating decision:', error);
            if (showToast) {
                const message =
                    error.response?.data?.message || 'Không thể cập nhật trạng thái đơn. Vui lòng thử lại.';
                showToast(message, 'error');
            }
        }
    };

    const handleDelete = async (request) => {
        if (!showConfirm) return;

        const confirmed = await showConfirm({
            title: 'Xác nhận xóa đơn',
            message: `Bạn có chắc chắn muốn xóa đơn đã từ chối này? Hành động này không thể hoàn tác.`,
            confirmText: 'Xóa',
            cancelText: 'Hủy',
            type: 'warning'
        });

        if (!confirmed) return;

        try {
            await moduleApiMap[activeModule].remove(request.id, {
                employeeId: request.employee_id || request.employeeId || request.employee?.id || currentUser?.id,
                role: currentUser?.role
            });

            if (showToast) {
                showToast('Đã xóa đơn đã từ chối', 'success');
            }

            setRefreshToken((prev) => prev + 1);
        } catch (error) {
            console.error('Error deleting request:', error);
            if (showToast) {
                const message =
                    error.response?.data?.message || 'Không thể xóa đơn. Vui lòng thử lại.';
                showToast(message, 'error');
            }
        }
    };

    const handleEscalate = async (request) => {
        try {
            // Kiểm tra thời gian: cảnh báo nếu đơn chưa vượt quá 24h
            let shouldShowWarning = false;
            let warningMessage = '';
            if (request.created_at) {
                const createdAt = new Date(request.created_at);
                const now = new Date();
                const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);

                if (hoursElapsed < 24) {
                    shouldShowWarning = true;
                    warningMessage = `Đơn này mới được tạo ${hoursElapsed.toFixed(1)} giờ trước, chưa vượt quá 24 giờ quy định. Bạn có chắc chắn muốn đẩy đơn lên Giám đốc ngay bây giờ?`;
                }
            }

            // Nếu có cảnh báo, hiển thị confirm modal trước
            if (shouldShowWarning && showConfirm) {
                const confirmed = await showConfirm({
                    title: '⚠️ Cảnh báo',
                    message: warningMessage,
                    confirmText: 'Xác nhận đẩy đơn',
                    cancelText: 'Hủy',
                    type: 'warning'
                });

                if (!confirmed) {
                    return; // User hủy, không thực hiện escalate
                }
            }

            // Yêu cầu nhập ghi chú (tùy chọn)
            const result = await askForComment({
                title: 'Đẩy đơn lên Giám đốc',
                message: 'Nhập ghi chú gửi kèm (tùy chọn).',
                required: false
            });
            if (result === false) {
                return;
            }

            // Thực hiện escalate
            await moduleApiMap[activeModule].escalate(request.id, {
                hrUserId: currentUser.id,
                comment: result || null
            });

            if (showToast) {
                const toastMessage = shouldShowWarning
                    ? 'Đã đẩy đơn lên Giám đốc (mặc dù chưa đủ 24h).'
                    : 'Đã đẩy đơn lên Giám đốc.';
                showToast(toastMessage, 'success');
            }

            setRefreshToken((prev) => prev + 1);
        } catch (error) {
            console.error('Error escalating request:', error);
            if (showToast) {
                const message =
                    error.response?.data?.message || 'Không thể chuyển đơn cho quản lý gián tiếp. Vui lòng thử lại.';
                showToast(message, 'error');
            }
        }
    };

    const handleProcessOverdue = async () => {
        try {
            const confirmed = showConfirm
                ? await showConfirm({
                    title: 'Gửi cảnh báo đơn quá hạn?',
                    message: 'Hệ thống sẽ gửi thông báo đến HR Admin cho các đơn chờ quá 24h.',
                    confirmText: 'Gửi cảnh báo',
                    cancelText: 'Hủy',
                    type: 'warning'
                })
                : window.confirm('Gửi cảnh báo đến HR Admin cho các đơn chờ quá 24h?');

            if (!confirmed) return;

            const response = await moduleApiMap[activeModule].processOverdue();
            if (response.data.success && showToast) {
                showToast(`Đã xử lý ${response.data.data?.processed || 0} đơn quá hạn.`, 'success');
            }
            setRefreshToken((prev) => prev + 1);
        } catch (error) {
            console.error('Error processing overdue requests:', error);
            if (showToast) {
                const message =
                    error.response?.data?.message ||
                    'Không thể xử lý cảnh báo đơn quá hạn. Vui lòng thử lại.';
                showToast(message, 'error');
            }
        }
    };

    if (!viewerMode) {
        return (
            <div className="leave-approvals">
                <div className="leave-approvals-empty-state">
                    <h2>Bạn không có quyền duyệt đơn</h2>
                    <p>Vui lòng liên hệ HR Admin nếu bạn cần quyền truy cập.</p>
                </div>
            </div>
        );
    }

    const getStatusLabel = (status) => STATUS_LABELS[status] || status;
    const getRequestTypeLabel = (type) => REQUEST_TYPE_LABELS[type] || type;

    const renderModuleTabs = () => (
        <div className="leave-approvals-modules">
            {MODULE_OPTIONS.map((module) => (
                <button
                    key={module.key}
                    type="button"
                    className={`module-chip ${activeModule === module.key ? 'active' : ''}`}
                    onClick={() => {
                        setActiveModule(module.key);
                        setRefreshToken((prev) => prev + 1);
                    }}
                >
                    {module.label}
                </button>
            ))}
        </div>
    );

    const renderCardHeader = (request) => {
        if (activeModule === 'leave') {
            return (
                <>
                    <h3>{getRequestTypeLabel(request.request_type)}</h3>
                    <p className="leave-approvals-period">
                        {formatDateDisplay(request.start_date)}
                        {request.request_type === 'LEAVE' && request.end_date
                            ? ` → ${formatDateDisplay(request.end_date)}`
                            : ''}
                    </p>
                </>
            );
        }

        if (activeModule === 'overtime') {
            return (
                <>
                    <h3>Đơn tăng ca</h3>
                    <p className="leave-approvals-period">
                        {formatDateDisplay(request.request_date)} • {request.start_time?.slice(0, 5)} →{' '}
                        {request.end_time?.slice(0, 5)}
                        {request.duration ? ` • ${request.duration}` : ''}
                    </p>
                </>
            );
        }

        return (
            <>
                <h3>Đơn bổ sung chấm công</h3>
                <p className="leave-approvals-period">
                    {formatDateDisplay(request.adjustment_date)} •{' '}
                    {request.check_type === 'CHECK_OUT' ? '-' : request.check_in_time?.slice(0, 5) || '-'}
                    {' → '}
                    {request.check_type === 'CHECK_IN' ? '-' : request.check_out_time?.slice(0, 5) || '-'}
                </p>
            </>
        );
    };

    const renderReasonSection = (request) => {
        let title = 'Lý do';
        if (activeModule === 'overtime') {
            title = 'Nội dung công việc';
        } else if (activeModule === 'attendance') {
            title = 'Lý do bổ sung';
        }

        return (
            <div className="leave-approvals-reason">
                <span className="info-label">{title}</span>
                <p>{request.reason}</p>
                {request.notes && (
                    <div className="leave-approvals-notes">
                        <span className="info-label">Ghi chú</span>
                        <p>{request.notes}</p>
                    </div>
                )}
            </div>
        );
    };

    const mapDecisionLabel = (value, fallback) => {
        if (!value && fallback) return getStatusLabel(fallback);
        if (!value) return '-';
        return getStatusLabel(value);
    };

    const renderDecisionTrace = (request) => (
        <div className="leave-approvals-steps">
            <div
                className={`step ${['PENDING_TEAM_LEAD', 'PENDING_BRANCH', 'APPROVED', 'REJECTED'].includes(request.status)
                    ? 'completed'
                    : ''
                    }`}
            >
                <span>Quản lý trực tiếp</span>
                <p>{mapDecisionLabel(request.team_lead_action, request.status)}</p>
            </div>
            <div
                className={`step ${['PENDING_BRANCH', 'APPROVED', 'REJECTED'].includes(request.status) ? 'completed' : ''
                    }`}
            >
                <span>Quản lý gián tiếp</span>
                <p>
                    {mapDecisionLabel(
                        request.branch_action,
                        request.status === 'PENDING_TEAM_LEAD' ? null : request.status
                    )}
                </p>
            </div>
        </div>
    );

    const renderActionButtons = (request) => (
        <div className="leave-approvals-actions-row">
            {isTeamLead && request.status === 'PENDING_TEAM_LEAD' && (
                <>
                    <button
                        type="button"
                        className="btn-approve"
                        onClick={() => handleDecision(request, 'APPROVE')}
                    >
                        Duyệt
                    </button>
                    <button
                        type="button"
                        className="btn-reject"
                        onClick={() => handleDecision(request, 'REJECT')}
                    >
                        Từ chối
                    </button>
                </>
            )}
            {isBranchManager && request.status === 'PENDING_BRANCH' && (
                <>
                    <button
                        type="button"
                        className="btn-approve"
                        onClick={() => handleDecision(request, 'APPROVE')}
                    >
                        Duyệt
                    </button>
                    <button
                        type="button"
                        className="btn-reject"
                        onClick={() => handleDecision(request, 'REJECT')}
                    >
                        Từ chối
                    </button>
                </>
            )}
            {isHr && request.status === 'PENDING_TEAM_LEAD' && (
                <button type="button" className="btn-escalate" onClick={() => handleEscalate(request)}>
                    Đẩy lên Giám đốc
                </button>
            )}
            {isHr && request.status === 'REJECTED' && (
                <button type="button" className="btn-delete" onClick={() => handleDelete(request)}>
                    Xóa đơn
                </button>
            )}
        </div>
    );

    return (
        <div className="leave-approvals">
            {/* Tiêu đề chính */}
            <div className="leave-approvals-header">
                <div className="leave-approvals-header-content">
                    <div className="leave-approvals-icon-wrapper">
                        <svg className="leave-approvals-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                    </div>
                    <div>
                        <h1 className="leave-approvals-title">Duyệt đơn nghỉ</h1>
                        <p className="leave-approvals-subtitle">
                            Xem và phê duyệt các đơn xin nghỉ phép, nghỉ việc từ nhân viên trong bộ phận của bạn.
                        </p>
                    </div>
                </div>
            </div>

            {/* Nội dung sẽ được thiết kế tiếp */}
            <div className="leave-approvals-content">
                {/* Main Filter Bar - Lọc theo Loại Yêu cầu */}
                <div className="leave-approvals-main-filter-bar">
                    <div className="request-type-filter-group">
                        {MODULE_OPTIONS.map((module) => (
                            <button
                                key={module.key}
                                type="button"
                                className={`request-type-filter-chip ${module.key} ${activeModule === module.key ? 'active' : ''}`}
                                onClick={() => setActiveModule(module.key)}
                            >
                                <span className="request-type-filter-label">{module.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Status Filter Bar - Lọc theo Trạng thái Xử lý */}
                <div className="leave-approvals-status-filter-bar">
                    <div className="status-filter-group">
                        {statusFilters.map((filter) => (
                            <button
                                key={filter.key}
                                type="button"
                                className={`status-filter-chip ${filter.key.toLowerCase()} ${selectedStatus === filter.key ? 'active' : ''}`}
                                onClick={() => setSelectedStatus(filter.key)}
                            >
                                <span className="status-filter-label">{filter.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Nút Hành động Khẩn cấp - Chỉ hiển thị cho HR */}
                    {isHr && (
                        <div className="leave-approvals-urgent-actions">
                            <button
                                type="button"
                                className="btn-send-overdue-alert"
                                onClick={handleProcessOverdue}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                </svg>
                                <span>Gửi cảnh báo đơn quá hạn</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Leave Request Table */}
                <div className="leave-approvals-table-container">
                    {loading ? (
                        <div className="leave-approvals-loading">
                            <div className="loading-spinner"></div>
                            <p>Đang tải dữ liệu...</p>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="leave-approvals-empty">
                            <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <p>Không có đơn nào phù hợp bộ lọc</p>
                        </div>
                    ) : (
                        <table className="leave-approvals-table">
                            <thead>
                                <tr>
                                    <th>Mã đơn</th>
                                    <th>Tên nhân viên</th>
                                    {activeModule === 'leave' && (
                                        <>
                                            <th>Loại nghỉ</th>
                                            <th>Ngày bắt đầu/kết thúc</th>
                                            <th>Tổng số ngày nghỉ</th>
                                        </>
                                    )}
                                    {activeModule === 'overtime' && (
                                        <>
                                            <th>Ngày tăng ca</th>
                                            <th>Giờ bắt đầu/kết thúc</th>
                                            <th>Thời lượng</th>
                                        </>
                                    )}
                                    {activeModule === 'attendance' && (
                                        <>
                                            <th>Ngày bổ sung</th>
                                            <th>Loại bổ sung</th>
                                            <th>Giờ vào/ra</th>
                                        </>
                                    )}
                                    <th>Trạng thái</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((request) => {
                                    const canAction =
                                        (isTeamLead && request.status === 'PENDING_TEAM_LEAD') ||
                                        (isBranchManager && request.status === 'PENDING_BRANCH');

                                    // Tính tổng số ngày nghỉ
                                    let totalDays = '-';
                                    if (request.request_type === 'LEAVE' && request.start_date && request.end_date) {
                                        const start = new Date(request.start_date);
                                        const end = new Date(request.end_date);
                                        const diffTime = Math.abs(end - start);
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                        totalDays = `${diffDays} ngày`;
                                    } else if (request.duration) {
                                        totalDays = request.duration;
                                    } else if (request.request_type === 'OVERTIME' || request.request_type === 'ATTENDANCE') {
                                        totalDays = '1 ngày';
                                    }

                                    return (
                                        <tr key={request.id} className="leave-request-row">
                                            <td className="leave-request-id-cell">
                                                <span className="leave-request-id">ĐN{String(request.id).padStart(6, '0')}</span>
                                            </td>
                                            <td className="leave-request-employee-cell">
                                                <div className="leave-request-employee-info">
                                                    <strong>{request.employee_name || 'N/A'}</strong>
                                                    {request.ma_nhan_vien && (
                                                        <span className="employee-code"> ({request.ma_nhan_vien})</span>
                                                    )}
                                                </div>
                                            </td>
                                            {activeModule === 'leave' && (
                                                <>
                                                    <td className="leave-request-type-cell">
                                                        <span className="leave-request-type">{getRequestTypeLabel(request.request_type) || 'N/A'}</span>
                                                    </td>
                                                    <td className="leave-request-dates-cell">
                                                        <div className="leave-request-dates-info">
                                                            <span>{formatDateDisplay(request.start_date)}</span>
                                                            {request.end_date && (
                                                                <>
                                                                    <span className="date-separator"> → </span>
                                                                    <span>{formatDateDisplay(request.end_date)}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="leave-request-days-cell">
                                                        <span className="leave-request-days">{totalDays}</span>
                                                    </td>
                                                </>
                                            )}
                                            {activeModule === 'overtime' && (
                                                <>
                                                    <td className="leave-request-dates-cell">
                                                        <div className="leave-request-dates-info">
                                                            <span>{formatDateDisplay(request.request_date)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="leave-request-dates-cell">
                                                        <div className="leave-request-dates-info">
                                                            {request.start_time && request.end_time ? (
                                                                <span className="time-info">{request.start_time.slice(0, 5)} → {request.end_time.slice(0, 5)}</span>
                                                            ) : (
                                                                <span>-</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="leave-request-days-cell">
                                                        <span className="leave-request-days">{request.duration || '-'}</span>
                                                    </td>
                                                </>
                                            )}
                                            {activeModule === 'attendance' && (
                                                <>
                                                    <td className="leave-request-dates-cell">
                                                        <div className="leave-request-dates-info">
                                                            <span>{formatDateDisplay(request.adjustment_date || request.request_date)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="leave-request-type-cell">
                                                        <span className="leave-request-type">
                                                            {request.check_type === 'CHECK_IN' ? 'Quên giờ vào' :
                                                                request.check_type === 'CHECK_OUT' ? 'Quên giờ ra' :
                                                                    request.check_type === 'BOTH' ? 'Quên cả giờ vào và ra' :
                                                                        request.check_type || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="leave-request-dates-cell">
                                                        <div className="leave-request-dates-info">
                                                            {request.check_in_time && (
                                                                <span>Vào: {request.check_in_time.slice(0, 5)}</span>
                                                            )}
                                                            {request.check_in_time && request.check_out_time && (
                                                                <span className="date-separator"> / </span>
                                                            )}
                                                            {request.check_out_time && (
                                                                <span>Ra: {request.check_out_time.slice(0, 5)}</span>
                                                            )}
                                                            {!request.check_in_time && !request.check_out_time && (
                                                                <span>-</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                            <td className="leave-request-status-cell">
                                                <span className={`leave-status-tag ${request.status.toLowerCase().replace('_', '-')}`}>
                                                    {getStatusLabel(request.status)}
                                                </span>
                                            </td>
                                            <td className="leave-request-actions-cell">
                                                {canAction ? (
                                                    <div className="leave-request-fast-actions">
                                                        <button
                                                            type="button"
                                                            className="btn-fast-approve"
                                                            onClick={() => handleDecision(request, 'APPROVE')}
                                                            title="Duyệt đơn"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-fast-reject"
                                                            onClick={() => handleDecision(request, 'REJECT')}
                                                            title="Từ chối đơn"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ) : isHr && (request.status === 'REJECTED' || request.status === 'rejected') ? (
                                                    <button
                                                        type="button"
                                                        className="btn-fast-delete"
                                                        onClick={() => handleDelete(request)}
                                                        title="Xóa đơn đã từ chối"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                                        </svg>
                                                    </button>
                                                ) : (
                                                    <span className="no-action">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeaveApprovals;

