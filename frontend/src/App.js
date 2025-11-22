import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import EmployeeDashboard from './components/EmployeeDashboard/EmployeeDashboard';
import EmployeeForm from './components/EmployeeForm/EmployeeForm';
import EquipmentAssignment from './components/EquipmentAssignment/EquipmentAssignment';
import RequestsManagement from './components/RequestsManagement/RequestsManagement';
import LeaveRequest from './components/LeaveRequest/LeaveRequest';
import LeaveApprovals from './components/LeaveApprovals/LeaveApprovals';
import InterviewApprovals from './components/InterviewApprovals/InterviewApprovals';
import OvertimeRequest from './components/OvertimeRequest/OvertimeRequest';
import AttendanceRequest from './components/AttendanceRequest/AttendanceRequest';
import RequestHistory from './components/RequestHistory/RequestHistory';
import CandidateForm from './components/CandidateForm/CandidateForm';
import CandidateManagement from './components/CandidateManagement/CandidateManagement';
import TravelExpense from './components/TravelExpense/TravelExpense';
import TravelExpenseManagement from './components/TravelExpense/TravelExpenseManagement';
import TravelExpenseApproval from './components/TravelExpenseApproval/TravelExpenseApproval';
import Login from './components/Login/Login';
import ToastContainer from './components/Common/ToastContainer';
import ConfirmModal from './components/Common/ConfirmModal';
import IntroOverlay from './components/Common/IntroOverlay';
import FloatingNotificationBell from './components/Common/FloatingNotificationBell';
import { employeesAPI } from './services/api';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false); // Start with false, only show loading when actually fetching
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });
  const [showIntroOverlay, setShowIntroOverlay] = useState(false);
  const [introUser, setIntroUser] = useState(null);

  // Toast management
  const showToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
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

  // Define fetchEmployees first, before useEffects that use it
  const fetchEmployees = useCallback(async () => {
    try {
      // Only set loading if we don't have employees yet
      if (employees.length === 0) {
        setLoading(true);
      }
      const response = await employeesAPI.getAll();
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  }, [employees.length]);

  // Kiểm tra authentication khi component mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('isAuthenticated');
    const savedUser = localStorage.getItem('user');

    if (savedAuth === 'true' && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setCurrentUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Fetch employees when authenticated and view is dashboard
  useEffect(() => {
    if (isAuthenticated && currentView === 'dashboard' && currentUser?.role !== 'EMPLOYEE') {
      // Only fetch if we don't have employees yet
      if (employees.length === 0) {
        fetchEmployees();
      }
    }
  }, [isAuthenticated, currentView, currentUser?.role, employees.length, fetchEmployees]);


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

  const handleNavigate = (view) => {
    setCurrentView(view);
    if (view === 'dashboard') {
      setSelectedEmployee(null);
      // Chỉ fetch employees nếu không phải EMPLOYEE và chưa có employees
      if (currentUser?.role !== 'EMPLOYEE' && employees.length === 0) {
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

  const handleLoginSuccess = async (userData) => {
    setCurrentUser(userData);
    setIsAuthenticated(true);
    setIntroUser(userData);
    setShowIntroOverlay(true);

    // Fetch employees after login (don't wait)
    fetchEmployees();
  };

  const handleEquipmentComplete = () => {
    setCurrentView('dashboard');
    setSelectedEmployee(null);
    fetchEmployees(); // Refresh employee list (sẽ trigger useEffect trong EmployeeTable để fetch lại equipment)
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
            />
          );
        case 'leave-approvals':
          return (
            <LeaveApprovals
              currentUser={currentUser}
              showToast={showToast}
              showConfirm={showConfirm}
            />
          );
        case 'interview-approvals':
          return (
            <InterviewApprovals
              currentUser={currentUser}
              showConfirm={showConfirm}
            />
          );
        case 'overtime-request':
          return (
            <OvertimeRequest
              currentUser={currentUser}
              showToast={showToast}
            />
          );
        case 'attendance-request':
          return (
            <AttendanceRequest
              currentUser={currentUser}
              showToast={showToast}
            />
          );
        case 'request-history':
          return (
            <RequestHistory
              currentUser={currentUser}
            />
          );
        case 'travel-expense':
          return (
            <TravelExpense
              currentUser={currentUser}
              showToast={showToast}
              showConfirm={showConfirm}
            />
          );
        case 'travel-expense-approval':
          return (
            <TravelExpenseApproval
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
          />
        );
      case 'requests':
        return (
          <RequestsManagement
            currentUser={currentUser}
            showConfirm={showConfirm}
          />
        );
      case 'leave-approvals':
        return (
          <LeaveApprovals
            currentUser={currentUser}
            showToast={showToast}
            showConfirm={showConfirm}
          />
        );
      case 'interview-approvals':
        return (
          <InterviewApprovals
            currentUser={currentUser}
            showConfirm={showConfirm}
          />
        );
      case 'candidate-management':
        return (
          <CandidateManagement
            currentUser={currentUser}
            showToast={showToast}
            showConfirm={showConfirm}
            onNavigate={handleNavigate}
          />
        );
      case 'travel-expense-management':
        return (
          <TravelExpenseManagement
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
            showConfirm={showConfirm}
            onUpdateEquipment={handleUpdateEquipment}
          />
        );
    }
  };

  return (
    <div className="app">
      {showIntroOverlay && <IntroOverlay user={introUser || currentUser} />}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        onAddEmployee={handleAddEmployee}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main
        className={`main-content ${currentUser?.role === 'EMPLOYEE' ? 'main-content--employee' : ''}`}
        style={{ position: 'relative' }}
      >
        {loading && currentView === 'dashboard' && !employees.length ? (
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

      {/* Floating Notification Bell for HR */}
      {currentUser?.role === 'HR' && (
        <FloatingNotificationBell
          currentUser={currentUser}
          showToast={showToast}
        />
      )}

    </div>
  );
}

export default App;
