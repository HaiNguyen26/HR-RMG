import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import EmployeeDashboard from './components/EmployeeDashboard/EmployeeDashboard';
import EmployeeForm from './components/EmployeeForm/EmployeeForm';
import EquipmentAssignment from './components/EquipmentAssignment/EquipmentAssignment';
import RequestsManagement from './components/RequestsManagement/RequestsManagement';
import LeaveRequest from './components/LeaveRequest/LeaveRequest';
import Notifications from './components/Notifications/Notifications';
import Login from './components/Login/Login';
import ToastContainer from './components/Common/ToastContainer';
import ConfirmModal from './components/Common/ConfirmModal';
import IntroOverlay from './components/Common/IntroOverlay';
import { employeesAPI, notificationsAPI } from './services/api';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showIntroOverlay, setShowIntroOverlay] = useState(false);
  const [introUser, setIntroUser] = useState(null);

  // Toast management
  const showToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Confirm modal
  const showConfirm = (options) => {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        ...options,
        onConfirm: (data) => {
          resolve(data || true);
          setConfirmModal({ isOpen: false });
        },
        onClose: () => {
          resolve(false);
          setConfirmModal({ isOpen: false });
        },
      });
    });
  };

  // Kiểm tra authentication khi component mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('isAuthenticated');
    const savedUser = localStorage.getItem('user');

    if (savedAuth === 'true' && savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEmployees();
      fetchUnreadNotificationCount();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(() => {
        fetchUnreadNotificationCount();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, currentUser]);

  useEffect(() => {
    let timer;
    if (showIntroOverlay) {
      timer = setTimeout(() => {
        setShowIntroOverlay(false);
        setIntroUser(null);
      }, 2000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [showIntroOverlay]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeesAPI.getAll();
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadNotificationCount = async () => {
    if (!currentUser?.id) return;
    try {
      const response = await notificationsAPI.getUnreadCount(currentUser.id);
      if (response.data.success) {
        setUnreadNotificationCount(response.data.count);
      }
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
    }
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
    if (view === 'dashboard') {
      setSelectedEmployee(null);
      // Chỉ fetch employees nếu không phải EMPLOYEE
      if (currentUser?.role !== 'EMPLOYEE') {
        fetchEmployees();
      }
    }
  };

  const handleAddEmployee = () => {
    setCurrentView('form');
    setSelectedEmployee(null);
  };

  const handleUpdateEquipment = (employee) => {
    // Employee đã tồn tại trong database, có trạng thái PENDING
    setSelectedEmployee(employee);
    setCurrentView('equipment');
  };

  const handleEmployeeFormSuccess = (formData) => {
    // formData là dữ liệu từ EmployeeForm, chưa có id (chưa tạo trong database)
    setSelectedEmployee(formData);
    setCurrentView('equipment');
    // Không fetchEmployees ở đây vì nhân viên chưa được tạo
  };

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    setIsAuthenticated(true);
    fetchEmployees(); // Fetch employees after login
    setIntroUser(userData);
    setShowIntroOverlay(true);
  };

  const handleEquipmentComplete = () => {
    setCurrentView('dashboard');
    setSelectedEmployee(null);
    fetchEmployees(); // Refresh employee list (sẽ trigger useEffect trong EmployeeTable để fetch lại equipment)
    fetchUnreadNotificationCount(); // Refresh notification count
  };

  const handleCancel = () => {
    setCurrentView('dashboard');
    setSelectedEmployee(null);
  };

  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: 'Đăng xuất',
      message: 'Bạn có chắc chắn muốn đăng xuất?',
      confirmText: 'Đăng xuất',
      cancelText: 'Hủy',
      type: 'warning',
    });

    if (confirmed) {
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user');
      setCurrentUser(null);
      setIsAuthenticated(false);
      setCurrentView('dashboard');
      setEmployees([]);
      setShowIntroOverlay(false);
      setIntroUser(null);
    }
  };

  // Hiển thị Login nếu chưa authenticated
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const renderView = () => {
    // Employee view - giao diện riêng cho nhân viên
    if (currentUser?.role === 'EMPLOYEE') {
      switch (currentView) {
        case 'leave-request':
          return (
            <LeaveRequest
              currentUser={currentUser}
              showToast={showToast}
              showConfirm={showConfirm}
            />
          );
        case 'dashboard':
        default:
          return (
            <EmployeeDashboard
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          );
      }
    }

    // Admin/HR view - giao diện quản trị
    switch (currentView) {
      case 'form':
        return (
          <EmployeeForm
            onSuccess={handleEmployeeFormSuccess}
            onCancel={handleCancel}
          />
        );
      case 'equipment':
        if (!selectedEmployee) {
          return <div>Không tìm thấy thông tin nhân viên</div>;
        }
        return (
          <EquipmentAssignment
            employee={selectedEmployee}
            onComplete={handleEquipmentComplete}
            onCancel={handleCancel}
            currentUser={currentUser}
            showToast={showToast}
          />
        );
      case 'requests':
        return (
          <RequestsManagement
            currentUser={currentUser}
            showToast={showToast}
            showConfirm={showConfirm}
          />
        );
      case 'dashboard':
      default:
        return (
          <Dashboard
            onAddEmployee={handleAddEmployee}
            employees={employees}
            onRefreshEmployees={fetchEmployees}
            currentUser={currentUser}
            showToast={showToast}
            showConfirm={showConfirm}
            onUpdateEquipment={handleUpdateEquipment}
          />
        );
    }
  };

  return (
    <div className={`app ${showNotifications ? 'notifications-open' : ''}`}>
      {showIntroOverlay && <IntroOverlay user={introUser || currentUser} />}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        onAddEmployee={handleAddEmployee}
        currentUser={currentUser}
        onLogout={handleLogout}
        onShowNotifications={() => {
          setShowNotifications(true);
          fetchUnreadNotificationCount();
        }}
        unreadNotificationCount={unreadNotificationCount}
      />
      <main className="main-content">
        {loading && currentView === 'dashboard' ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : (
          renderView()
        )}
      </main>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={confirmModal.onClose || (() => setConfirmModal({ isOpen: false }))}
        onConfirm={confirmModal.onConfirm || (() => { })}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
        input={confirmModal.input}
        notesInput={confirmModal.notesInput}
      />

      {/* Notifications Modal */}
      {showNotifications && (
        <Notifications
          currentUser={currentUser}
          onClose={() => {
            setShowNotifications(false);
            fetchUnreadNotificationCount();
          }}
        />
      )}
    </div>
  );
}

export default App;
