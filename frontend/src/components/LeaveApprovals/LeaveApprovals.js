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

    const viewerMode = useMemo(() => deriveViewerMode(currentUser), [currentUser]);
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
        if (isBranchManager) {
            setSelectedStatus('PENDING_BRANCH');
        } else {
            setSelectedStatus('PENDING');
        }
    }, [viewerMode, isBranchManager, activeModule]);

    useEffect(() => {
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
                showToast(decision === 'APPROVE' ? 'Đã phê duyệt đơn' : 'Đã từ chối đơn', 'success');
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

    const handleEscalate = async (request) => {
        try {
            const result = await askForComment({
                title: 'Chuyển đơn cho quản lý gián tiếp',
                message: 'Nhập ghi chú gửi kèm (tùy chọn).',
                required: false
            });
            if (result === false) {
                return;
            }

            await moduleApiMap[activeModule].escalate(request.id, {
                hrUserId: currentUser.id,
                comment: result || null
            });

            if (showToast) {
                showToast('Đã chuyển đơn cho quản lý gián tiếp.', 'success');
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
                    Chuyển cho quản lý gián tiếp
                </button>
            )}
        </div>
    );

    return (
        <div className="leave-approvals">
            {renderModuleTabs()}
            <div className="leave-approvals-header">
                <div>
                    <h1>
                        {isTeamLead && currentModuleConfig.header.teamLead}
                        {isBranchManager && currentModuleConfig.header.branch}
                        {isHr && currentModuleConfig.header.hr}
                    </h1>
                    <p>
                        {isTeamLead && currentModuleConfig.description.teamLead}
                        {isBranchManager && currentModuleConfig.description.branch}
                        {isHr && currentModuleConfig.description.hr}
                    </p>
                </div>
                <div className="leave-approvals-actions">
                    {isHr && (
                        <button type="button" className="btn-process-overdue" onClick={handleProcessOverdue}>
                            Gửi cảnh báo đơn quá hạn
                        </button>
                    )}
                    <div className="leave-approvals-stats">
                        <span>
                            Tổng: <strong>{stats.total}</strong>
                        </span>
                        <span>
                            Quá hạn: <strong>{stats.overdueCount}</strong>
                        </span>
                    </div>
                </div>
            </div>

            <div className="leave-approvals-filters">
                <div className="filter-group">
                    {statusFilters.map((filter) => (
                        <button
                            key={filter.key}
                            type="button"
                            className={`filter-chip ${selectedStatus === filter.key ? 'active' : ''}`}
                            onClick={() => setSelectedStatus(filter.key)}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="leave-approvals-list">
                {loading ? (
                    <div className="leave-approvals-loading">Đang tải dữ liệu...</div>
                ) : requests.length === 0 ? (
                    <div className="leave-approvals-empty-state">
                        <h3>Không có đơn nào phù hợp bộ lọc</h3>
                        <p>Hệ thống sẽ cập nhật khi có đơn mới.</p>
                    </div>
                ) : (
                    requests.map((request) => (
                        <div key={request.id} className={`leave-approvals-card ${request.status.toLowerCase()}`}>
                            <div className="leave-approvals-card-header">
                                <div>{renderCardHeader(request)}</div>
                                <div className="leave-approvals-statuses">
                                    {request.isOverdue && request.status === 'PENDING_TEAM_LEAD' && (
                                        <span className="status-chip overdue">Quá hạn 24h</span>
                                    )}
                                    <span className={`status-chip ${request.status.toLowerCase()}`}>
                                        {getStatusLabel(request.status)}
                                    </span>
                                </div>
                            </div>

                            <div className="leave-approvals-body">
                                <div className="leave-approvals-info-grid">
                                    <div className="info-block">
                                        <span className="info-label">Nhân viên</span>
                                        <p className="info-value">
                                            {request.employee_name || request.employee_email || `#${request.employee_id}`}
                                        </p>
                                    </div>
                                    <div className="info-block">
                                        <span className="info-label">Phòng ban</span>
                                        <p className="info-value">{request.employee_department || 'Chưa cập nhật'}</p>
                                    </div>
                                    <div className="info-block">
                                        <span className="info-label">Quản lý trực tiếp</span>
                                        <p className="info-value">{request.team_lead_name || 'Chưa cập nhật'}</p>
                                    </div>
                                    <div className="info-block">
                                        <span className="info-label">Quản lý gián tiếp</span>
                                        <p className="info-value">{request.branch_manager_name || 'Chưa cập nhật'}</p>
                                    </div>
                                </div>

                                {renderReasonSection(request)}

                                {request.team_lead_comment && (
                                    <div className="leave-approvals-timeline">
                                        <div>
                                            <span className="info-label">Ghi chú quản lý trực tiếp</span>
                                            <p>{request.team_lead_comment}</p>
                                            <span className="info-sub">
                                                {formatDateDisplay(request.team_lead_action_at, true)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {request.branch_comment && (
                                    <div className="leave-approvals-timeline">
                                        <div>
                                            <span className="info-label">Ghi chú quản lý gián tiếp</span>
                                            <p>{request.branch_comment}</p>
                                            <span className="info-sub">
                                                {formatDateDisplay(request.branch_action_at, true)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {request.escalated_at && (
                                    <div className="leave-approvals-timeline escalation">
                                        <div>
                                            <span className="info-label">Đã chuyển cho quản lý gián tiếp</span>
                                            <p>{formatDateDisplay(request.escalated_at, true)}</p>
                                        </div>
                                    </div>
                                )}

                                {renderDecisionTrace(request)}

                                {renderActionButtons(request)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default LeaveApprovals;

