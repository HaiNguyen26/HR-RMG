import React, { useState, useEffect } from 'react';
import { requestsAPI, equipmentAPI } from '../../services/api';
import './EmployeeDashboard.css';

const EmployeeDashboard = ({ currentUser, onNavigate }) => {
    const [equipment, setEquipment] = useState([]);
    const [loadingEquipment, setLoadingEquipment] = useState(true);

    useEffect(() => {
        if (currentUser?.id) {
            fetchEquipment();
        }
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
                {/* Layout 2 cột: Thông tin cá nhân bên trái, Actions và Stats bên phải */}
                <div className="employee-dashboard-main-grid">
                    {/* Cột trái: Thông tin cá nhân và Vật dụng đã cấp */}
                    <div className="employee-info-section">
                        <div className="employee-info-card dark">
                            <div className="employee-info-header">
                                <svg className="employee-info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
                                    </path>
                                </svg>
                                <h2 className="employee-info-title">Thông tin cá nhân</h2>
                            </div>
                            <div className="employee-info-grid">
                                <div className="employee-info-item">
                                    <span className="employee-info-label">Mã nhân viên</span>
                                    <p className="employee-info-value">{currentUser?.maNhanVien || '-'}</p>
                                </div>
                                <div className="employee-info-item">
                                    <span className="employee-info-label">Họ và tên</span>
                                    <p className="employee-info-value">{currentUser?.hoTen || '-'}</p>
                                </div>
                                <div className="employee-info-item">
                                    <span className="employee-info-label">Email</span>
                                    <p className="employee-info-value">{currentUser?.email || '-'}</p>
                                </div>
                                <div className="employee-info-item">
                                    <span className="employee-info-label">Chức danh</span>
                                    <p className="employee-info-value">{currentUser?.chucDanh || '-'}</p>
                                </div>
                                <div className="employee-info-item">
                                    <span className="employee-info-label">Chi nhánh</span>
                                    <p className="employee-info-value">{currentUser?.chiNhanh || '-'}</p>
                                </div>
                                <div className="employee-info-item">
                                    <span className="employee-info-label">Phòng ban</span>
                                    <p className="employee-info-value">
                                        {currentUser?.phongBan === 'IT' ? 'Phòng IT' :
                                            currentUser?.phongBan === 'HR' ? 'Hành chính nhân sự' :
                                                currentUser?.phongBan === 'ACCOUNTING' ? 'Kế toán' :
                                                    currentUser?.phongBan === 'OTHER' ? 'Phòng ban khác' :
                                                        currentUser?.phongBan || '-'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Bảng vật dụng đã cấp */}
                        <div className="employee-equipment-card">
                            <div className="employee-equipment-header">
                                <svg className="employee-equipment-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4">
                                    </path>
                                </svg>
                                <h2 className="employee-equipment-title">Vật dụng đã cấp</h2>
                            </div>
                            {loadingEquipment ? (
                                <div className="employee-equipment-loading">
                                    <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Đang tải...</span>
                                </div>
                            ) : equipment.length > 0 ? (
                                <div className="employee-equipment-table-container">
                                    <table className="employee-equipment-table">
                                        <thead>
                                            <tr>
                                                <th>Vật dụng</th>
                                                <th>Số lượng</th>
                                                <th>Phòng ban</th>
                                                <th>Ngày cấp</th>
                                                <th>Người cấp</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {equipment.map((item, index) => (
                                                <tr key={index}>
                                                    <td>{item.name}</td>
                                                    <td>{item.quantity}</td>
                                                    <td>{getDepartmentLabel(item.department)}</td>
                                                    <td>{formatDate(item.providedAt)}</td>
                                                    <td>{item.providedBy || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="employee-equipment-empty">
                                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4">
                                        </path>
                                    </svg>
                                    <p>Chưa có vật dụng nào được cấp</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cột phải: Quick Actions và Stats */}
                    <div className="employee-actions-stats-section">
                        {/* Quick Actions */}
                        <div className="employee-quick-actions">
                            <h2 className="employee-section-title">Thao tác nhanh</h2>
                            <div className="employee-actions-grid">
                                <div
                                    className="employee-action-card"
                                    onClick={() => onNavigate && onNavigate('leave-request')}
                                >
                                    <div className="employee-action-icon leave">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
                                            </path>
                                        </svg>
                                    </div>
                                    <h3 className="employee-action-title">Xin nghỉ phép</h3>
                                </div>
                                <div
                                    className="employee-action-card"
                                    onClick={() => onNavigate && onNavigate('leave-request')}
                                >
                                    <div className="employee-action-icon resign">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1">
                                            </path>
                                        </svg>
                                    </div>
                                    <h3 className="employee-action-title">Xin nghỉ việc</h3>
                                </div>
                            </div>
                        </div>

                        {/* Thống kê cá nhân */}
                        <div className="employee-stats">
                            <h2 className="employee-section-title">Thống kê của tôi</h2>
                            <div className="employee-stats-grid">
                                <div className="employee-stat-card">
                                    <div className="employee-stat-icon">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
                                            </path>
                                        </svg>
                                    </div>
                                    <div className="employee-stat-content">
                                        <p className="employee-stat-label">Đơn đã gửi</p>
                                        <p className="employee-stat-value">0</p>
                                    </div>
                                </div>
                                <div className="employee-stat-card">
                                    <div className="employee-stat-icon">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z">
                                            </path>
                                        </svg>
                                    </div>
                                    <div className="employee-stat-content">
                                        <p className="employee-stat-label">Đã duyệt</p>
                                        <p className="employee-stat-value">0</p>
                                    </div>
                                </div>
                                <div className="employee-stat-card">
                                    <div className="employee-stat-icon">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z">
                                            </path>
                                        </svg>
                                    </div>
                                    <div className="employee-stat-content">
                                        <p className="employee-stat-label">Chờ duyệt</p>
                                        <p className="employee-stat-value">0</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDashboard;

