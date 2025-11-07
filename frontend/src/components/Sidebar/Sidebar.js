import React from 'react';
import './Sidebar.css';

const Sidebar = ({ currentView, onNavigate, onAddEmployee, currentUser, onLogout, onShowNotifications, unreadNotificationCount = 0 }) => {
    return (
        <div className="sidebar">
            {/* Decorative background elements */}
            <div className="sidebar-bg-decoration-top"></div>
            <div className="sidebar-bg-decoration-bottom"></div>

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
                            <div className="nav-item-bg"></div>
                            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6">
                                </path>
                            </svg>
                            <span className="nav-label">Dashboard</span>
                        </button>
                    </li>
                    {/* Chỉ hiển thị cho HR, ADMIN - không hiển thị cho EMPLOYEE */}
                    {(currentUser?.role !== 'EMPLOYEE') && (
                        <li>
                            <button
                                onClick={() => onAddEmployee()}
                                className={`nav-item ${currentView === 'form' ? 'active' : ''}`}
                            >
                                <div className="nav-item-bg"></div>
                                <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z">
                                    </path>
                                </svg>
                                <span className="nav-label">Thêm nhân viên</span>
                            </button>
                        </li>
                    )}
                    {/* Show Requests Management for IT, HR, ACCOUNTING, ADMIN */}
                    {(currentUser?.role === 'IT' || currentUser?.role === 'HR' || currentUser?.role === 'ACCOUNTING' || currentUser?.role === 'ADMIN') && (
                        <li>
                            <button
                                onClick={() => onNavigate('requests')}
                                className={`nav-item ${currentView === 'requests' ? 'active' : ''}`}
                            >
                                <div className="nav-item-bg"></div>
                                <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                    </path>
                                </svg>
                                <span className="nav-label">
                                    {(currentUser?.role === 'HR' && currentUser?.username !== 'hr_admin') || currentUser?.role === 'ADMIN' 
                                        ? 'Theo dõi yêu cầu' 
                                        : 'Quản lý yêu cầu'}
                                </span>
                            </button>
                        </li>
                    )}
                    {/* Placeholder for future modules */}
                    <li className="nav-section-label">
                        <p>Modules</p>
                    </li>
                    {/* Module cho nhân viên: Xin nghỉ phép, nghỉ việc */}
                    {currentUser?.role === 'EMPLOYEE' && (
                        <li>
                            <button
                                onClick={() => onNavigate('leave-request')}
                                className={`nav-item ${currentView === 'leave-request' ? 'active' : ''}`}
                            >
                                <div className="nav-item-bg"></div>
                                <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                    </path>
                                </svg>
                                <span className="nav-label">Xin nghỉ phép / Nghỉ việc</span>
                            </button>
                        </li>
                    )}
                    {/* Module quản lý đơn từ cho HR/Admin */}
                    {(currentUser?.role !== 'EMPLOYEE') && (
                        <li>
                            <button disabled className="nav-item disabled">
                                <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                    </path>
                                </svg>
                                <span className="nav-label">Quản lý đơn từ</span>
                            </button>
                        </li>
                    )}
                    <li>
                        <button disabled className="nav-item disabled">
                            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z">
                                </path>
                            </svg>
                            <span className="nav-label">Báo cáo & Thống kê</span>
                        </button>
                    </li>
                    <li>
                        <button disabled className="nav-item disabled">
                            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z">
                                </path>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                            <span className="nav-label">Cài đặt</span>
                        </button>
                    </li>
                </ul>
            </nav>

            {/* Notifications Button */}
            {onShowNotifications && (
                <div className="sidebar-notifications-section">
                    <button
                        onClick={onShowNotifications}
                        className="sidebar-notifications-btn"
                        title="Thông báo"
                    >
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9">
                            </path>
                        </svg>
                        {unreadNotificationCount > 0 && (
                            <span className="sidebar-notifications-badge">
                                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* User Account Section */}
            <div className="sidebar-user-section">
                <div className="sidebar-user-info">
                    <div className="sidebar-user-avatar">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
                            </path>
                        </svg>
                    </div>
                    <div className="sidebar-user-details">
                        <p className="sidebar-user-name">{currentUser?.hoTen || currentUser?.username || 'User'}</p>
                        <p className="sidebar-user-role">{currentUser?.role || 'N/A'}</p>
                    </div>
                </div>
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
