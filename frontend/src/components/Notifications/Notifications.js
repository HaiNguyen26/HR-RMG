import React, { useState, useEffect } from 'react';
import { notificationsAPI } from '../../services/api';
import './Notifications.css';

const Notifications = ({ currentUser, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread'

  useEffect(() => {
    if (currentUser?.id) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [currentUser, filter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = {
        userId: currentUser.id,
        limit: 50,
      };
      if (filter === 'unread') {
        params.isRead = 'false';
      }
      const response = await notificationsAPI.getAll(params);
      if (response.data.success) {
        setNotifications(response.data.data);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!currentUser?.id) return;
    try {
      const response = await notificationsAPI.getUnreadCount(currentUser.id);
      if (response.data.success) {
        setUnreadCount(response.data.count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === id ? { ...notif, is_read: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser?.id) return;
    try {
      await notificationsAPI.markAllAsRead(currentUser.id);
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationsAPI.delete(id);
      setNotifications(prev => prev.filter(notif => notif.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'NEW_REQUEST':
        return '🔔';
      case 'REQUEST_UPDATED':
        return '📝';
      case 'REQUEST_COMPLETED':
        return '✅';
      default:
        return '📢';
    }
  };

  return (
    <div className="notifications-overlay" onClick={onClose}>
      <div className="notifications-container" onClick={(e) => e.stopPropagation()}>
        <div className="notifications-header">
          <h2 className="notifications-title">
            <span>🔔</span>
            Thông báo
            {unreadCount > 0 && (
              <span className="notifications-badge">{unreadCount}</span>
            )}
          </h2>
          <div className="notifications-actions">
            {unreadCount > 0 && (
              <button
                className="btn-mark-all-read"
                onClick={handleMarkAllAsRead}
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
            <button className="btn-close-notifications" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="notifications-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Tất cả
          </button>
          <button
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Chưa đọc ({unreadCount})
          </button>
        </div>

        <div className="notifications-list">
          {loading ? (
            <div className="notifications-loading">Đang tải...</div>
          ) : notifications.length === 0 ? (
            <div className="notifications-empty">
              <p>Không có thông báo nào</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
              >
                <div className="notification-icon">
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="notification-content">
                  <div className="notification-header">
                    <h4 className="notification-title">{notif.title}</h4>
                    <span className="notification-time">
                      {formatDate(notif.created_at)}
                    </span>
                  </div>
                  <p className="notification-message">{notif.message}</p>
                  {notif.request_title && (
                    <div className="notification-meta">
                      <span className="notification-department">
                        {notif.request_department}
                      </span>
                      {notif.request_status && (
                        <span className={`notification-status ${notif.request_status.toLowerCase()}`}>
                          {notif.request_status}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="notification-actions">
                  {!notif.is_read && (
                    <button
                      className="btn-mark-read"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notif.id);
                      }}
                      title="Đánh dấu đã đọc"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    className="btn-delete-notification"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(notif.id);
                    }}
                    title="Xóa"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;

