import React, { useState, useEffect } from 'react';
import './TravelExpenseApproval.css';

const TravelExpenseApproval = ({ currentUser, showToast, showConfirm }) => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // TODO: Fetch travel expense requests pending approval
    // fetchPendingRequests();

    // Mock data for now
    const mockRequests = [
      {
        id: 1,
        code: 'CTX-20240901',
        employeeName: 'Lê Thanh Tùng',
        branch: 'Hà Nội',
        scope: 'NN',
        purpose: 'Đàm phán hợp đồng đối tác chiến lược mở rộng thị trường Châu Á. Gặp gỡ đối tác tại Singapore để thảo luận hợp đồng xuất khẩu sản phẩm công nghệ cao.',
        destination: 'Singapore',
        startDate: '19/11/2025',
        startTime: '17:15',
        endDate: '31/11/2025',
        endTime: '16:15'
      },
      {
        id: 2,
        code: 'CTX-20240902',
        employeeName: 'Nguyễn Văn Hùng',
        branch: 'TP. HCM',
        scope: 'NĐ',
        purpose: 'Hội thảo công nghệ về trí tuệ nhân tạo và ứng dụng trong doanh nghiệp. Tham gia hội thảo tại TP.HCM để cập nhật kiến thức và kỹ năng mới.',
        destination: 'TP. Hồ Chí Minh',
        startDate: '20/11/2025',
        startTime: '08:00',
        endDate: '22/11/2025',
        endTime: '17:00'
      },
      {
        id: 3,
        code: 'CTX-20240903',
        employeeName: 'Phạm Thị Mai',
        branch: 'Đà Nẵng',
        scope: 'NĐ',
        purpose: 'Đào tạo chuyên môn về quản lý dự án và phương pháp làm việc nhóm hiệu quả. Tham gia khóa đào tạo tại Đà Nẵng để nâng cao năng lực quản lý.',
        destination: 'Đà Nẵng',
        startDate: '25/11/2025',
        startTime: '09:00',
        endDate: '27/11/2025',
        endTime: '16:00'
      },
      {
        id: 4,
        code: 'CTX-20240904',
        employeeName: 'Trần Văn Kiên',
        branch: 'Hà Nội',
        scope: 'NN',
        purpose: 'Triển lãm công nghệ quốc tế tại Mỹ. Tham gia triển lãm để giới thiệu sản phẩm mới và tìm kiếm đối tác tiềm năng.',
        destination: 'Mỹ',
        startDate: '01/12/2025',
        startTime: '10:00',
        endDate: '05/12/2025',
        endTime: '18:00'
      },
    ];
    setRequests(mockRequests);
  }, [currentUser]);

  const filteredRequests = requests.filter(request =>
    request.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.branch.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedRequest = requests.find(req => req.id === selectedRequestId) || null;

  return (
    <div className="travel-expense-approval">
      {/* Main Container: Glass Card lớn ở trung tâm */}
      <div className="travel-expense-approval-main-container">
        {/* Bố cục 2 cột */}
        <div className="travel-expense-approval-main-layout">
          {/* I. CỘT TRÁI: Danh sách Yêu cầu Chờ Duyệt (33%) */}
          <div className="travel-expense-approval-list-column">
            {/* Nền Cột */}
            <div className="travel-expense-approval-list-container">
              {/* Tiêu đề: YÊU CẦU CHỜ DUYỆT CẤP 1/2 (Teal đậm) */}
              <h2 className="travel-expense-approval-list-title">
                YÊU CẦU CHỜ DUYỆT CẤP 1/2
              </h2>

              {/* Thanh Tìm kiếm */}
              <div className="travel-expense-approval-search-wrapper">
                <input
                  type="text"
                  className="travel-expense-approval-search-input"
                  placeholder="Tìm kiếm theo mã, tên, chi nhánh..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Danh sách Items */}
              <div className="travel-expense-approval-list-items">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    className={`travel-expense-approval-list-item ${selectedRequestId === request.id ? 'active' : ''}`}
                    onClick={() => setSelectedRequestId(request.id)}
                  >
                    {/* Cột trái: Mã yêu cầu và Tên nhân viên */}
                    <div className="travel-expense-approval-item-left">
                      {/* Mã yêu cầu */}
                      <div className="travel-expense-approval-request-code">
                        {request.code}
                      </div>
                      {/* Tên nhân viên */}
                      <div className="travel-expense-approval-employee-name">
                        {request.employeeName}
                      </div>
                      {/* Chi nhánh */}
                      <div className="travel-expense-approval-branch">
                        {request.branch}
                      </div>
                    </div>

                    {/* Cột phải: Thẻ phân loại */}
                    <div className="travel-expense-approval-item-right">
                      {/* Thẻ phân loại: NĐ (Nội địa - Teal) hoặc NN (Nước ngoài - Amber) */}
                      <div className={`travel-expense-approval-scope-badge ${request.scope === 'NĐ' ? 'domestic' : 'foreign'}`}>
                        {request.scope}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* II. CỘT PHẢI: Chi tiết, Phân loại Luồng & Hành động (67%) */}
          <div className="travel-expense-approval-detail-column">
            {/* Nền Cột */}
            <div className="travel-expense-approval-detail-container">
              {selectedRequest ? (
                <div className="travel-expense-approval-detail-content">
                  {/* A. Thẻ Phân Loại Luồng */}
                  <div className={`travel-expense-approval-flow-card ${selectedRequest.scope === 'NN' ? 'foreign' : 'domestic'}`}>
                    <div className="travel-expense-approval-flow-icon">
                      {selectedRequest.scope === 'NN' ? (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      ) : (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      )}
                    </div>
                    <div className="travel-expense-approval-flow-content">
                      {selectedRequest.scope === 'NN' ? (
                        <>
                          <h3 className="travel-expense-approval-flow-title">Công tác Nước ngoài</h3>
                          <p className="travel-expense-approval-flow-description">
                            Yêu cầu này là <strong>Công tác Nước ngoài</strong>. Sau khi duyệt, sẽ chuyển thẳng đến <strong>TỔNG GIÁM ĐỐC (BƯỚC 3)</strong> để phê duyệt đặc biệt.
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 className="travel-expense-approval-flow-title">Công tác Nội địa</h3>
                          <p className="travel-expense-approval-flow-description">
                            Yêu cầu là <strong>Nội địa</strong>. Sau khi duyệt, sẽ chuyển đến <strong>CẤP NGÂN SÁCH (BƯỚC 4)</strong> để phân bổ kinh phí.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* B. Nội dung Chi tiết Yêu cầu */}
                  <div className="travel-expense-approval-detail-section">
                    <h3 className="travel-expense-approval-detail-section-title">Chi Tiết Yêu Cầu</h3>

                    <div className="travel-expense-approval-detail-grid">
                      {/* Thông tin cơ bản */}
                      <div className="travel-expense-approval-detail-item">
                        <label className="travel-expense-approval-detail-label">Mã Yêu Cầu</label>
                        <div className="travel-expense-approval-detail-value">{selectedRequest.code}</div>
                      </div>

                      <div className="travel-expense-approval-detail-item">
                        <label className="travel-expense-approval-detail-label">Tên Nhân Viên</label>
                        <div className="travel-expense-approval-detail-value">{selectedRequest.employeeName}</div>
                      </div>

                      <div className="travel-expense-approval-detail-item">
                        <label className="travel-expense-approval-detail-label">Chi Nhánh</label>
                        <div className="travel-expense-approval-detail-value">{selectedRequest.branch}</div>
                      </div>

                      <div className="travel-expense-approval-detail-item">
                        <label className="travel-expense-approval-detail-label">Địa Điểm</label>
                        <div className="travel-expense-approval-detail-value">{selectedRequest.destination}</div>
                      </div>

                      <div className="travel-expense-approval-detail-item">
                        <label className="travel-expense-approval-detail-label">Ngày Bắt Đầu</label>
                        <div className="travel-expense-approval-detail-value">{selectedRequest.startDate} - {selectedRequest.startTime}</div>
                      </div>

                      <div className="travel-expense-approval-detail-item">
                        <label className="travel-expense-approval-detail-label">Ngày Kết Thúc</label>
                        <div className="travel-expense-approval-detail-value">{selectedRequest.endDate} - {selectedRequest.endTime}</div>
                      </div>
                    </div>

                    {/* Mục Đích Chi Tiết & Căn Cứ - Làm nổi bật */}
                    <div className="travel-expense-approval-detail-item-full">
                      <label className="travel-expense-approval-detail-label">Mục Đích Chi Tiết & Căn Cứ</label>
                      <div className="travel-expense-approval-detail-purpose">
                        {selectedRequest.purpose || 'Chưa có thông tin mục đích.'}
                      </div>
                    </div>
                  </div>

                  {/* C. Khối Hành động Phê duyệt */}
                  <div className="travel-expense-approval-action-section">
                    <h3 className="travel-expense-approval-action-title">Quyết Định Phê Duyệt</h3>

                    {/* Ghi chú */}
                    <div className="travel-expense-approval-note-group">
                      <label htmlFor="approvalNote" className="travel-expense-approval-note-label">
                        Ghi chú <span className="travel-expense-approval-note-hint">(Xác nhận tính cần thiết/phù hợp của công việc)</span>
                      </label>
                      <textarea
                        id="approvalNote"
                        className="travel-expense-approval-note-input"
                        rows="4"
                        value={approvalNote}
                        onChange={(e) => setApprovalNote(e.target.value)}
                        placeholder="Nhập ghi chú xác nhận tính cần thiết và phù hợp của công việc..."
                      />
                    </div>

                    {/* Nút Hành động */}
                    <div className="travel-expense-approval-action-buttons">
                      <button
                        type="button"
                        className="travel-expense-approval-btn-approve"
                        onClick={() => {
                          if (!approvalNote.trim()) {
                            showToast && showToast('Vui lòng nhập ghi chú trước khi duyệt.', 'warning');
                            return;
                          }
                          setIsProcessing(true);
                          // TODO: API call
                          setTimeout(() => {
                            setIsProcessing(false);
                            showToast && showToast('Yêu cầu đã được duyệt thành công!', 'success');
                            setSelectedRequestId(null);
                            setApprovalNote('');
                          }, 800);
                        }}
                        disabled={isProcessing}
                      >
                        {isProcessing ? 'Đang xử lý...' : 'DUYỆT'}
                      </button>

                      <button
                        type="button"
                        className="travel-expense-approval-btn-reject"
                        onClick={() => {
                          if (!approvalNote.trim()) {
                            showToast && showToast('Vui lòng nhập ghi chú lý do từ chối.', 'warning');
                            return;
                          }
                          setIsProcessing(true);
                          // TODO: API call
                          setTimeout(() => {
                            setIsProcessing(false);
                            showToast && showToast('Yêu cầu đã bị từ chối.', 'info');
                            setSelectedRequestId(null);
                            setApprovalNote('');
                          }, 800);
                        }}
                        disabled={isProcessing}
                      >
                        {isProcessing ? 'Đang xử lý...' : 'TỪ CHỐI'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="travel-expense-approval-empty-state">
                  <p>Vui lòng chọn một yêu cầu từ danh sách để xem chi tiết.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TravelExpenseApproval;

