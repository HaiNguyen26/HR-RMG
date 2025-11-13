import React, { useState, useEffect } from 'react';
import { requestsAPI, equipmentAPI, employeesAPI } from '../../services/api';
import './EmployeeDashboard.css';

const EmployeeDashboard = ({ currentUser, onNavigate }) => {
    const [equipment, setEquipment] = useState([]);
    const [loadingEquipment, setLoadingEquipment] = useState(true);
    const [employeeProfile, setEmployeeProfile] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(false);

    useEffect(() => {
        if (currentUser?.id) {
            fetchEquipment();
        }
    }, [currentUser]);

    useEffect(() => {
        let isMounted = true;
        const fetchProfile = async () => {
            if (!currentUser) {
                if (isMounted) {
                    setEmployeeProfile(null);
                }
                return;
            }

            setLoadingProfile(true);
            let profile = null;

            const trySetProfile = (candidate) => {
                if (!candidate) return;
                profile = candidate;
            };

            const candidateIds = [
                currentUser.employeeId,
                currentUser.employee_id,
                currentUser.employee?.id,
                currentUser.id
            ].filter(Boolean);

            try {
                for (const id of candidateIds) {
                    if (!id) continue;
                    try {
                        const response = await employeesAPI.getById(id);
                        if (response.data?.data) {
                            trySetProfile(response.data.data);
                            if (profile) break;
                        }
                    } catch (error) {
                        if (process.env.NODE_ENV === 'development') {
                            console.debug('employeesAPI.getById failed', id, error);
                        }
                    }
                }

                if (!profile) {
                    const allResponse = await employeesAPI.getAll();
                    const list = allResponse.data?.data || [];
                    const matches = list.find((item) => {
                        const normalized = {
                            id: item.id,
                            employeeId: item.employeeId || item.employee_id,
                            userId: item.userId || item.user_id,
                            maNhanVien: item.maNhanVien || item.ma_nhan_vien,
                        };
                        const targetIds = new Set(
                            [
                                currentUser.id,
                                currentUser.employeeId,
                                currentUser.employee_id,
                                currentUser.userId,
                                currentUser.user_id,
                                currentUser.employee?.id,
                            ].filter(Boolean)
                        );
                        const targetCodes = new Set(
                            [
                                currentUser.maNhanVien,
                                currentUser.ma_nhan_vien
                            ].filter(Boolean)
                        );
                        return (
                            targetIds.has(normalized.id) ||
                            targetIds.has(normalized.employeeId) ||
                            targetIds.has(normalized.userId) ||
                            targetCodes.has(normalized.maNhanVien)
                        );
                    });
                    if (matches) {
                        trySetProfile(matches);
                    }
                }
            } catch (error) {
                console.error('Error fetching employee profile:', error);
            } finally {
                if (isMounted) {
                    setEmployeeProfile(profile);
                    setLoadingProfile(false);
                }
            }
        };

        fetchProfile();

        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    const fetchEquipment = async () => {
        try {
            setLoadingEquipment(true);
            const equipmentList = [];

            // 1. Lấy equipment từ requests (completed items)
            try {
                const requestsResponse = await requestsAPI.getAll({ employeeId: currentUser.id });
                if (requestsResponse.data.success) {
                    const requests = requestsResponse.data.data || [];
                    requests.forEach(request => {
                        if (request.items_detail && Array.isArray(request.items_detail)) {
                            request.items_detail.forEach(item => {
                                if (item.status === 'COMPLETED' && item.quantity_provided > 0) {
                                    equipmentList.push({
                                        name: item.item_name,
                                        quantity: item.quantity_provided,
                                        department: request.target_department,
                                        providedAt: item.provided_at,
                                        providedBy: item.provided_by_name || 'HR'
                                    });
                                }
                            });
                        }
                    });
                }
            } catch (requestsError) {
                console.error('Error fetching requests:', requestsError);
            }

            // 2. Lấy equipment trực tiếp từ bảng equipment_assignments
            try {
                const equipmentResponse = await equipmentAPI.getByEmployeeId(currentUser.id);
                if (equipmentResponse.data.success) {
                    const directEquipment = equipmentResponse.data.data || [];
                    directEquipment.forEach(eq => {
                        equipmentList.push({
                            name: eq.ten_vat_dung,
                            quantity: eq.so_luong,
                            department: eq.phong_ban,
                            providedAt: eq.ngay_phan_cong || eq.created_at,
                            providedBy: 'HR'
                        });
                    });
                }
            } catch (equipmentError) {
                console.error('Error fetching direct equipment:', equipmentError);
            }

            // Sắp xếp theo ngày cấp (mới nhất trước)
            equipmentList.sort((a, b) => {
                const dateA = new Date(a.providedAt || 0);
                const dateB = new Date(b.providedAt || 0);
                return dateB - dateA;
            });

            setEquipment(equipmentList);
        } catch (error) {
            console.error('Error fetching equipment:', error);
        } finally {
            setLoadingEquipment(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';

        try {
            // Nếu dateString đã có format đầy đủ (có time), dùng trực tiếp
            // Nếu chỉ có date (YYYY-MM-DD), thêm time để tránh timezone issues
            let date;
            if (dateString.includes('T') || dateString.includes(' ')) {
                // Đã có time hoặc datetime format
                date = new Date(dateString);
            } else {
                // Chỉ có date, thêm time để tránh timezone issues
                date = new Date(dateString + 'T00:00:00');
            }

            // Kiểm tra date hợp lệ
            if (isNaN(date.getTime())) {
                return '-';
            }

            return date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error, dateString);
            return '-';
        }
    };

    const getDepartmentLabel = (dept) => {
        switch (dept) {
            case 'IT': return 'Phòng IT';
            case 'HR': return 'Hành chính nhân sự';
            case 'ACCOUNTING': return 'Kế toán';
            case 'OTHER': return 'Phòng ban khác';
            default: return dept;
        }
    };

    const pickUserValue = (...keys) => {
        const sources = [employeeProfile, currentUser];
        for (const source of sources) {
            if (!source) continue;
            for (const key of keys) {
                const value = source?.[key];
                if (value !== undefined && value !== null) {
                    if (typeof value === 'string') {
                        if (value.trim().length) {
                            return value;
                        }
                    } else {
                        return value;
                    }
                }
            }
        }
        return '';
    };

    const displayValue = (value) => {
        if (value === undefined || value === null) return '-';
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length ? trimmed : '-';
        }
        if (typeof value === 'number') {
            return String(value);
        }
        return value;
    };

    const departmentDisplay = displayValue(getDepartmentLabel(pickUserValue('phongBan', 'phong_ban')));
    const employeeDataSources = [employeeProfile, currentUser];

    const fieldDefinitions = {
        basic: [
            { label: 'Mã nhân viên', keys: ['maNhanVien', 'ma_nhan_vien'] },
            { label: 'Họ và tên', keys: ['hoTen', 'ho_ten'] },
            { label: 'Chức danh', keys: ['chucDanh', 'chuc_danh'] },
            { label: 'Chi nhánh', keys: ['chiNhanh', 'chi_nhanh'] },
            { label: 'Phòng ban', customValue: departmentDisplay, keys: ['phongBan', 'phong_ban'] },
            { label: 'Cấp bậc', keys: ['capBac', 'cap_bac'] }
        ],
        contact: [
            { label: 'Email', keys: ['email'] },
            { label: 'Số điện thoại', keys: ['soDienThoai', 'so_dien_thoai'] },
            { label: 'Địa chỉ', keys: ['diaChi', 'dia_chi'] }
        ],
        organization: [
            { label: 'Ngày nhận việc', formatter: formatDate, keys: ['ngayGiaNhap', 'ngay_gia_nhap'] },
            { label: 'Loại hợp đồng', keys: ['loaiHopDong', 'loai_hop_dong'] },
            { label: 'Trạng thái', keys: ['trangThai', 'trang_thai'] },
            { label: 'Ngày hết hạn hợp đồng', formatter: formatDate, keys: ['hetHanHopDong', 'het_han_hop_dong'] }
        ],
        management: [
            { label: 'Quản lý trực tiếp', keys: ['quanLyTrucTiep', 'quan_ly_truc_tiep'] },
            { label: 'Quản lý gián tiếp', keys: ['quanLyGianTiep', 'quan_ly_gian_tiep'] },
            { label: 'Ngày sinh', formatter: formatDate, keys: ['ngaySinh', 'ngay_sinh'] },
            { label: 'Giới tính', keys: ['gioiTinh', 'gioi_tinh'] },
            { label: 'Tình trạng hôn nhân', keys: ['honNhan', 'hon_nhan'] }
        ]
    };

    const resolveFieldValue = (definition) => {
        if (definition.customValue !== undefined) {
            return definition.customValue;
        }
        for (const source of employeeDataSources) {
            if (!source) continue;
            for (const key of definition.keys) {
                const value = source?.[key];
                if (value !== undefined && value !== null && String(value).trim() !== '') {
                    return definition.formatter ? definition.formatter(value) : value;
                }
            }
        }
        return '';
    };

    const definedSections = [
        { title: 'Thông tin cơ bản', key: 'basic' },
        { title: 'Liên hệ', key: 'contact' },
        { title: 'Công việc & Tổ chức', key: 'organization' },
        { title: 'Quản lý & Cá nhân', key: 'management' }
    ];

    const infoSections = definedSections
        .map((section) => {
            const fields = fieldDefinitions[section.key]
                .map((definition) => {
                    const rawValue = resolveFieldValue(definition);
                    const value = displayValue(rawValue);
                    return value === '-' ? null : { label: definition.label, value };
                })
                .filter(Boolean);
            return fields.length > 0 ? { ...section, fields } : null;
        })
        .filter(Boolean);

    const avatarName = pickUserValue('hoTen', 'ho_ten', 'username') || 'NV';
    const avatarInitials = avatarName
        .split(' ')
        .filter(Boolean)
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'NV';

    const statusText = displayValue(pickUserValue('trangThai', 'trang_thai'));

    const quickActions = [
        {
            key: 'leave-request',
            title: 'Xin nghỉ phép',
            description: 'Gửi đơn nghỉ phép và theo dõi trạng thái phê duyệt.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M8 7V3m8 4V3m-9 8h10m-12 8h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                </svg>
            )
        },
        {
            key: 'leave-request-resign',
            navigateTo: 'resignation-request',
            title: 'Xin nghỉ việc',
            description: 'Thông báo nghỉ việc và cập nhật quy trình bàn giao.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            )
        }
    ];

    const handleQuickAction = (actionKey, navigateOverride) => {
        if (!onNavigate) return;
        switch (navigateOverride || actionKey) {
            case 'leave-request':
                onNavigate('leave-request');
                break;
            case 'leave-request-resign':
            case 'resignation-request':
                onNavigate('resignation-request');
                break;
            default:
                onNavigate(actionKey);
                break;
        }
    };

    return (
        <div className="employee-dashboard">
            <div className="employee-dashboard-header">
                <div className="employee-dashboard-welcome">
                    <h1 className="employee-dashboard-title">
                        Chào mừng, <span className="employee-name">{currentUser?.hoTen || 'Nhân viên'}</span>
                    </h1>
                    <p className="employee-dashboard-subtitle">
                        Hệ thống quản lý nhân sự - Phiên làm việc của bạn
                    </p>
                </div>
            </div>

            <div className="employee-dashboard-content">
                <div className="employee-info-layout">
                    <div className="employee-info-card">
                        <header className="employee-info-card-header">
                            <div className="employee-info-card-title-group">
                                <div className="employee-info-card-avatar">
                                    <span>{avatarInitials}</span>
                                </div>
                                <div className="employee-info-card-text">
                                    <h2 className="employee-info-title">Thông tin nhân viên</h2>
                                    <p className="employee-info-subtitle">Chi tiết hồ sơ • cập nhật mới nhất</p>
                                </div>
                            </div>
                            <div className="employee-info-card-meta">
                                <span className="employee-info-meta-badge">ID: {displayValue(pickUserValue('maNhanVien', 'ma_nhan_vien'))}</span>
                                <span className={`employee-info-meta-badge status ${statusText === '-' ? 'status-neutral' : 'status-active'}`}>
                                    {statusText}
                                </span>
                            </div>
                        </header>

                        <div className="employee-info-card-body">
                            {loadingProfile ? (
                                <div className="employee-info-loading">
                                    <div className="employee-info-spinner" />
                                    <p>Đang tải dữ liệu nhân viên...</p>
                                </div>
                            ) : (
                                infoSections.map((section, index) => (
                                    <section className="employee-info-segment" key={section.title}>
                                        <div className="employee-info-segment-title">
                                            <h3>{section.title}</h3>
                                        </div>
                                        <div className="employee-info-fields">
                                            {section.fields.map((field) => (
                                                <div
                                                    key={field.label}
                                                    className="employee-info-field"
                                                    tabIndex={0}
                                                    data-empty={field.value === '-' ? 'true' : 'false'}
                                                >
                                                    <span className="employee-info-label">{field.label}</span>
                                                    <p className="employee-info-value">{field.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {index !== infoSections.length - 1 && <div className="employee-info-divider" />}
                                    </section>
                                ))
                            )}
                        </div>
                    </div>

                    <section className="employee-quick-actions">
                        <header className="employee-quick-actions-header">
                            <h2>Thao tác nhanh</h2>
                            <p>Truy cập nhanh các thao tác thường dùng của bạn.</p>
                        </header>
                        <div className="employee-quick-actions-grid">
                            {quickActions.map((action) => (
                                <button
                                    key={action.key}
                                    type="button"
                                    className="quick-action-card"
                                    onClick={() => handleQuickAction(action.key, action.navigateTo)}
                                >
                                    <div className="quick-action-icon">{action.icon}</div>
                                    <div className="quick-action-content">
                                        <span className="quick-action-title">{action.title}</span>
                                        <span className="quick-action-description">{action.description}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
};

export default EmployeeDashboard;

