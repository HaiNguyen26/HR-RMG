import React, { useEffect, useState } from 'react';
import { leaveRequestsAPI } from '../../services/api';
import './LeaveRequest.css';

const LeaveRequest = ({ currentUser, showToast, showConfirm }) => {
  const [requestType, setRequestType] = useState('leave'); // 'leave' or 'resign'
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    notes: '',
  });
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [managers, setManagers] = useState([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchManagers = async () => {
      setLoadingManagers(true);
      try {
        const response = await leaveRequestsAPI.getManagers();
        if (response.data.success) {
          const data = response.data.data || [];
          setManagers(data);
          if (data.length > 0) {
            setSelectedManagerId(String(data[0].id));
          } else {
            setSelectedManagerId('');
          }
        }
      } catch (err) {
        console.error('Error fetching managers:', err);
        if (showToast) {
          showToast('Không thể tải danh sách trưởng phòng. Vui lòng thử lại sau.', 'error');
        }
      } finally {
        setLoadingManagers(false);
      }
    };

    fetchManagers();
  }, [showToast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate form
      if (requestType === 'leave') {
        if (!formData.startDate || !formData.endDate || !formData.reason) {
          setError('Vui lòng điền đầy đủ thông tin');
          setLoading(false);
          return;
        }

        if (new Date(formData.startDate) > new Date(formData.endDate)) {
          setError('Ngày kết thúc phải sau ngày bắt đầu');
          setLoading(false);
          return;
        }
      } else if (requestType === 'resign') {
        if (!formData.startDate || !formData.reason) {
          setError('Vui lòng điền đầy đủ thông tin');
          setLoading(false);
          return;
        }
      }

      if (!selectedManagerId) {
        setError('Vui lòng chọn trưởng phòng phụ trách duyệt đơn.');
        setLoading(false);
        return;
      }

      const managerIdNumber = Number(selectedManagerId);
      if (!Number.isInteger(managerIdNumber) || managerIdNumber <= 0) {
        setError('Trưởng phòng không hợp lệ. Vui lòng chọn lại.');
        setLoading(false);
        return;
      }

      if (!currentUser?.id) {
        setError('Không xác định được thông tin nhân viên. Vui lòng đăng nhập lại.');
        setLoading(false);
        return;
      }

      const payload = {
        employeeId: currentUser.id,
        managerId: managerIdNumber,
        requestType: requestType === 'leave' ? 'LEAVE' : 'RESIGN',
        startDate: formData.startDate,
        endDate: requestType === 'leave' ? formData.endDate : null,
        reason: formData.reason,
        notes: formData.notes,
      };

      const response = await leaveRequestsAPI.create(payload);

      if (response.data.success) {
        if (showToast) {
          showToast(
            requestType === 'leave'
              ? 'Đơn xin nghỉ phép đã được gửi đến trưởng phòng phụ trách.'
              : 'Đơn xin nghỉ việc đã được gửi đến trưởng phòng phụ trách.',
            'success'
          );
        }

        setFormData({
          startDate: '',
          endDate: '',
          reason: '',
          notes: '',
        });
        if (managers.length > 0) {
          setSelectedManagerId(String(managers[0].id));
        } else {
          setSelectedManagerId('');
        }
      } else {
        const message = response.data.message || 'Không thể gửi đơn xin nghỉ. Vui lòng thử lại.';
        setError(message);
        if (showToast) {
          showToast(message, 'error');
        }
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
      if (showToast) {
        showToast(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="leave-request">
      <div className="leave-request-header">
        <h1 className="leave-request-title">
          {requestType === 'leave' ? 'Xin nghỉ phép' : 'Xin nghỉ việc'}
        </h1>
        <p className="leave-request-subtitle">
          {requestType === 'leave'
            ? 'Điền thông tin để gửi đơn xin nghỉ phép'
            : 'Điền thông tin để gửi đơn xin nghỉ việc'}
        </p>
      </div>

      {/* Request Type Tabs */}
      <div className="leave-request-tabs">
        <button
          className={`leave-tab ${requestType === 'leave' ? 'active' : ''}`}
          onClick={() => {
            setRequestType('leave');
            setError('');
            setFormData({
              startDate: '',
              endDate: '',
              reason: '',
              notes: '',
            });
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
            </path>
          </svg>
          <span>Xin nghỉ phép</span>
        </button>
        <button
          className={`leave-tab ${requestType === 'resign' ? 'active' : ''}`}
          onClick={() => {
            setRequestType('resign');
            setError('');
            setFormData({
              startDate: '',
              endDate: '',
              reason: '',
              notes: '',
            });
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1">
            </path>
          </svg>
          <span>Xin nghỉ việc</span>
        </button>
      </div>

      {/* Form */}
      <div className="leave-request-form-container">
        <form onSubmit={handleSubmit} className="leave-request-form">
          {error && (
            <div className="leave-request-error">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="leave-form-grid">
            {/* Start Date */}
            <div className="leave-form-group">
              <label htmlFor="startDate" className="leave-form-label">
                {requestType === 'leave' ? 'Ngày bắt đầu nghỉ *' : 'Ngày nghỉ việc *'}
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="leave-form-input"
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* End Date (only for leave request) */}
            {requestType === 'leave' && (
              <div className="leave-form-group">
                <label htmlFor="endDate" className="leave-form-label">
                  Ngày kết thúc nghỉ *
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className="leave-form-input"
                  required
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="leave-form-group">
            <label htmlFor="reason" className="leave-form-label">
              Lý do * {requestType === 'leave' ? '(Xin nghỉ phép)' : '(Xin nghỉ việc)'}
            </label>
            <textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              className="leave-form-textarea"
              rows="3"
              placeholder={requestType === 'leave'
                ? 'Vui lòng nhập lý do xin nghỉ phép...'
                : 'Vui lòng nhập lý do xin nghỉ việc...'}
              required
            />
          </div>

          <div className="leave-form-group">
            <label htmlFor="manager" className="leave-form-label">
              Trưởng phòng duyệt đơn *
            </label>
            <select
              id="manager"
              name="manager"
              className="leave-form-select"
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              disabled={loadingManagers || managers.length === 0}
              required
            >
              {loadingManagers && (
                <option value="" disabled>
                  Đang tải danh sách trưởng phòng...
                </option>
              )}
              {!loadingManagers && managers.length === 0 && (
                <option value="" disabled>
                  Chưa có trưởng phòng nào trong hệ thống
                </option>
              )}
              {!loadingManagers &&
                managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.ho_ten || manager.email || `Trưởng phòng #${manager.id}`} ({manager.chuc_danh || 'Chức danh chưa cập nhật'})
                  </option>
                ))}
            </select>
          </div>

          {/* Notes (optional) */}
          <div className="leave-form-group">
            <label htmlFor="notes" className="leave-form-label">
              Ghi chú (tùy chọn)
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="leave-form-textarea"
              rows="2"
              placeholder="Thêm ghi chú nếu cần..."
            />
          </div>

          {/* Submit Button */}
          <div className="leave-form-actions">
            <button
              type="submit"
              className="leave-submit-btn"
              disabled={loading || managers.length === 0}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang gửi...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8">
                    </path>
                  </svg>
                  Gửi đơn
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="leave-request-info">
          <div className="info-box">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z">
              </path>
            </svg>
            <div>
              <h3 className="info-box-title">Lưu ý</h3>
              <p className="info-box-text">
                {requestType === 'leave'
                  ? 'Đơn xin nghỉ phép của bạn sẽ được gửi đến bộ phận HR để xem xét. Vui lòng điền đầy đủ và chính xác thông tin.'
                  : 'Đơn xin nghỉ việc của bạn sẽ được gửi đến bộ phận HR để xem xét. Vui lòng điền đầy đủ và chính xác thông tin.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequest;

