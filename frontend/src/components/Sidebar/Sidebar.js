import React, { useEffect, useState } from 'react';
import { leaveRequestsAPI } from '../../services/api';
import './Sidebar.css';

const Sidebar = ({ currentView, onNavigate, onAddEmployee, currentUser, onLogout }) => {
    const [managerAccessResolved, setManagerAccessResolved] = useState(false);
    const [canApproveFromManagerLookup, setCanApproveFromManagerLookup] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const resolveManagerAccess = async () => {
            if (!currentUser?.id || currentUser?.role !== 'EMPLOYEE') {
                if (isMounted) {
                    setCanApproveFromManagerLookup(false);
                    setManagerAccessResolved(true);
                }
                return;
            }

            try {
                const response = await leaveRequestsAPI.getManagers();
                const managers = response.data?.data || {};
                const normalizedName = (currentUser.hoTen || currentUser.username || '').trim().toLowerCase();

                const isInList = (list) => Array.isArray(list) && list.some((item) => {
                    if (!item) return false;
                    if (item.id && item.id === currentUser.id) return true;
                    const itemName = (item.ho_ten || '').trim().toLowerCase();
                    return itemName && itemName === normalizedName;
                });

                const canApprove = isInList(managers.teamLeads) || isInList(managers.branchManagers);

                if (isMounted) {
                    setCanApproveFromManagerLookup(Boolean(canApprove));
                    setManagerAccessResolved(true);
                }
            } catch (error) {
                console.error('Error checking manager access:', error);
                if (isMounted) {
                    setCanApproveFromManagerLookup(false);
                    setManagerAccessResolved(true);
                }
            }
        };

        setManagerAccessResolved(false);
        resolveManagerAccess();

        return () => {
            isMounted = false;
        };
    }, [currentUser?.id, currentUser?.role, currentUser?.hoTen, currentUser?.username]);

    const isEmployee = currentUser?.role === 'EMPLOYEE';
    const normalizedTitle = (currentUser?.chucDanh || '').toLowerCase();
    const canApproveAsEmployee = isEmployee && (
        normalizedTitle.includes('quản lý gián tiếp') ||
        normalizedTitle.includes('quản lý') ||
        normalizedTitle.includes('giám đốc') ||
        normalizedTitle.includes('ban lãnh đạo') ||
        normalizedTitle.includes('trưởng phòng')
    );

    const showEmployeeApprovalModule = canApproveAsEmployee || (managerAccessResolved && canApproveFromManagerLookup);

    return (
        <div className="sidebar">
            {/* Logo & HR System Section - White Background */}
            <div className="sidebar-logo-section">
                <div className="logo-content">
                    {/* Logo */}
                    <img src="/LogoRMG.png" alt="RMG Logo" className="logo-img" />

                    {/* HR System Text - Styled */}
                    <div className="sidebar-header-text">
                        <h1 className="sidebar-title">
                            <span className="sidebar-title-gradient">HR System</span>
                            <span className="sidebar-title-dot"></span>
                        </h1>
                        <p className="sidebar-subtitle">Hệ thống quản lý nhân sự</p>
                    </div>
                </div>
            </div>

            {/* Navigation Menu */}
            <nav className="sidebar-nav">
                <ul className="nav-list">
                    <li>
                        <button
                            onClick={() => onNavigate('dashboard')}
                            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                        >
                            <span className="nav-icon-wrapper">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6">
                                    </path>
                                </svg>
                            </span>
                            <span className="nav-label">Dashboard</span>
                        </button>
                    </li>
                    {/* Show Requests Management for IT, HR, ACCOUNTING, ADMIN */}
                    {(currentUser?.role === 'IT' || currentUser?.role === 'HR' || currentUser?.role === 'ACCOUNTING' || currentUser?.role === 'ADMIN') && (
                        <li>
                            <button
                                onClick={() => onNavigate('requests')}
                                className={`nav-item ${currentView === 'requests' ? 'active' : ''}`}
                            >
                                <span className="nav-icon-wrapper">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                        </path>
                                    </svg>
                                </span>
                                <span className="nav-label">
                                    {(currentUser?.role === 'HR' && currentUser?.username !== 'hr_admin') || currentUser?.role === 'ADMIN'
                                        ? 'Theo dõi yêu cầu'
                                        : 'Quản lý yêu cầu'}
                                </span>
                            </button>
                        </li>
                    )}
                    {(currentUser?.role === 'HR' || currentUser?.role === 'ADMIN') && (
                        <li>
                            <button
                                onClick={() => onNavigate('leave-approvals')}
                                className={`nav-item ${currentView === 'leave-approvals' ? 'active' : ''}`}
                            >
                                <span className="nav-icon-wrapper">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
                                        </path>
                                    </svg>
                                </span>
                                <span className="nav-label">Quản lý đơn nghỉ</span>
                            </button>
                        </li>
                    )}
                    {currentUser?.role === 'HR' && (
                        <li>
                            <button
                                onClick={() => onNavigate('candidate-management')}
                                className={`nav-item ${currentView === 'candidate-management' ? 'active' : ''}`}
                            >
                                <span className="nav-icon-wrapper">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                        </path>
                                    </svg>
                                </span>
                                <span className="nav-label">Quản lý Ứng viên</span>
                            </button>
                        </li>
                    )}
                    {(currentUser?.role === 'HR' || currentUser?.role === 'ADMIN') && (
                        <li>
                            <button
                                onClick={() => onNavigate('travel-expense-management')}
                                className={`nav-item ${currentView === 'travel-expense-management' ? 'active' : ''}`}
                            >
                                <span className="nav-icon-wrapper">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z">
                                        </path>
                                    </svg>
                                </span>
                                <span className="nav-label">Quản lý kinh phí công tác</span>
                            </button>
                        </li>
                    )}
                    {/* Placeholder for future modules */}
                    <li className="nav-section-label">
                        <p>Modules</p>
                    </li>
                    {/* Module cho nhân viên: Xin nghỉ phép, nghỉ việc */}
                    {currentUser?.role === 'EMPLOYEE' && (
                        <>
                            <li>
                                <button
                                    onClick={() => onNavigate('leave-request')}
                                    className={`nav-item ${currentView === 'leave-request' ? 'active' : ''}`}
                                >
                                    <span className="nav-icon-wrapper">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                            </path>
                                        </svg>
                                    </span>
                                    <span className="nav-label">Xin nghỉ phép / Nghỉ việc</span>
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => onNavigate('overtime-request')}
                                    className={`nav-item ${currentView === 'overtime-request' ? 'active' : ''}`}
                                >
                                    <span className="nav-icon-wrapper">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                d="M13 10V3L4 14h7v7l9-11h-7z">
                                            </path>
                                        </svg>
                                    </span>
                                    <span className="nav-label">Xin tăng ca</span>
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => onNavigate('attendance-request')}
                                    className={`nav-item ${currentView === 'attendance-request' ? 'active' : ''}`}
                                >
                                    <span className="nav-icon-wrapper">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z">
                                            </path>
                                        </svg>
                                    </span>
                                    <span className="nav-label">Bổ sung chấm công</span>
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => onNavigate('travel-expense')}
                                    className={`nav-item ${currentView === 'travel-expense' ? 'active' : ''}`}
                                >
                                    <span className="nav-icon-wrapper">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z">
                                            </path>
                                        </svg>
                                    </span>
                                    <span className="nav-label">Đăng ký kinh phí công tác</span>
                                </button>
                            </li>
                        </>
                    )}
                    {/* Divider trước nhóm module duyệt và lịch sử đơn từ */}
                    {currentUser?.role === 'EMPLOYEE' && (
                        <li className="nav-divider">
                            <div className="nav-divider-line"></div>
                        </li>
                    )}
                    {/* Nhóm module duyệt và lịch sử đơn từ - Cùng màu chủ đạo */}
                    {currentUser?.role === 'EMPLOYEE' && (
                        <>
                            {showEmployeeApprovalModule && (
                                <>
                                    <li>
                                        <button
                                            onClick={() => onNavigate('leave-approvals')}
                                            className={`nav-item nav-item-approval ${currentView === 'leave-approvals' ? 'active' : ''}`}
                                        >
                                            <span className="nav-icon-wrapper">
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
                                                    </path>
                                                </svg>
                                            </span>
                                            <span className="nav-label">Duyệt đơn nghỉ</span>
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => onNavigate('interview-approvals')}
                                            className={`nav-item nav-item-approval ${currentView === 'interview-approvals' ? 'active' : ''}`}
                                        >
                                            <span className="nav-icon-wrapper">
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z">
                                                    </path>
                                                </svg>
                                            </span>
                                            <span className="nav-label">Duyệt phỏng vấn</span>
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => onNavigate('travel-expense-approval')}
                                            className={`nav-item nav-item-approval ${currentView === 'travel-expense-approval' ? 'active' : ''}`}
                                        >
                                            <span className="nav-icon-wrapper">
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z">
                                                    </path>
                                                </svg>
                                            </span>
                                            <span className="nav-label">Phê duyệt yêu cầu công tác</span>
                                        </button>
                                    </li>
                                </>
                            )}
                            <li>
                                <button
                                    onClick={() => onNavigate('request-history')}
                                    className={`nav-item nav-item-approval ${currentView === 'request-history' ? 'active' : ''}`}
                                >
                                    <span className="nav-icon-wrapper">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                            </path>
                                        </svg>
                                    </span>
                                    <span className="nav-label">Lịch sử đơn từ</span>
                                </button>
                            </li>
                        </>
                    )}
                    {/* Divider sau nhóm module duyệt và lịch sử đơn từ */}
                    {currentUser?.role === 'EMPLOYEE' && (
                        <li className="nav-divider">
                            <div className="nav-divider-line"></div>
                        </li>
                    )}
                    {/* Module quản lý đơn từ cho HR/Admin */}
                    {(currentUser?.role !== 'EMPLOYEE') && (
                        <li>
                            <button disabled className="nav-item disabled">
                                <span className="nav-icon-wrapper">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                        </path>
                                    </svg>
                                </span>
                                <span className="nav-label">Quản lý đơn từ</span>
                            </button>
                        </li>
                    )}
                    <li>
                        <button disabled className="nav-item disabled">
                            <span className="nav-icon-wrapper">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z">
                                    </path>
                                </svg>
                            </span>
                            <span className="nav-label">Báo cáo & Thống kê</span>
                        </button>
                    </li>
                    <li>
                        <button disabled className="nav-item disabled">
                            <span className="nav-icon-wrapper">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z">
                                    </path>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                </svg>
                            </span>
                            <span className="nav-label">Cài đặt</span>
                        </button>
                    </li>
                </ul>
            </nav>

            {/* User Account Section */}
            <div className="sidebar-logout">
                <button onClick={onLogout} className="sidebar-logout-btn">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1">
                        </path>
                    </svg>
                    <span>Đăng xuất</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
