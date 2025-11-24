import React, { useState, useEffect } from 'react';
import './TravelExpenseManagement.css';
import { travelExpensesAPI } from '../../services/api';

const TravelExpenseManagement = ({ currentUser, showToast, showConfirm }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [activeTab, setActiveTab] = useState('A'); // 'A' hoặc 'B'
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);

    // State cho Tab A: Cấp Ngân Sách Tối Đa
    const [tabAForm, setTabAForm] = useState({
        budgetAmount: '',
        currencyType: 'VND',
        exchangeRate: '1'
    });

    // State để lưu ngân sách đã được cấp (từ Tab A)
    const [approvedBudget, setApprovedBudget] = useState(null);

    // State cho Tab B: Form Xử Lý Chuyển Khoản
    const [tabBForm, setTabBForm] = useState({
        actualAmount: '',           // Số tiền Thực Tạm ứng
        advanceMethod: '',          // Hình thức Tạm ứng
        bankAccount: '',            // Tài khoản Ngân hàng nhận (readonly - từ hồ sơ nhân viên)
        transferNotes: ''           // Ghi chú (Nội dung Chuyển khoản)
    });

    // Tự động set tỷ giá khi chọn loại tiền
    const handleCurrencyChange = (currency) => {
        if (currency === 'VND') {
            setTabAForm({ ...tabAForm, currencyType: currency, exchangeRate: '1' });
        } else {
            setTabAForm({ ...tabAForm, currencyType: currency, exchangeRate: tabAForm.exchangeRate || '' });
        }
    };

    // Tính toán quy đổi tự động
    const getConvertedAmount = () => {
        if (!tabAForm.budgetAmount || !tabAForm.exchangeRate) return 0;
        const amount = parseFloat(tabAForm.budgetAmount);
        const rate = parseFloat(tabAForm.exchangeRate);
        if (isNaN(amount) || isNaN(rate)) return 0;
        return amount * rate;
    };

    // Fetch travel expense requests from API
    useEffect(() => {
        const fetchRequests = async () => {
            setLoading(true);
            try {
                // Fetch requests with status PENDING_LEVEL_1 or PENDING_LEVEL_2 (approved by manager/CEO, waiting for budget allocation)
                const response = await travelExpensesAPI.getAll({
                    status: 'PENDING_LEVEL_1,PENDING_LEVEL_2'
                });

                if (response.data && response.data.success) {
                    const formattedRequests = response.data.data.map(req => ({
                        id: req.id,
                        code: `CTX-${req.id}`,
                        employeeName: req.employee_name || 'N/A',
                        location: req.location || '',
                        isDomestic: req.location_type === 'DOMESTIC',
                        purpose: req.purpose || '',
                        startDate: req.start_time ? new Date(req.start_time).toLocaleDateString('vi-VN') : '',
                        endDate: req.end_time ? new Date(req.end_time).toLocaleDateString('vi-VN') : '',
                        status: req.status || '',
                        employee_id: req.employee_id
                    }));
                    setRequests(formattedRequests);
                }
            } catch (error) {
                console.error('Error fetching travel expense requests:', error);
                showToast?.('Lỗi khi tải danh sách yêu cầu', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, [showToast]);

    const filteredRequests = requests.filter(request =>
        request.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedRequest = requests.find(req => req.id === selectedRequestId) || null;

    // Thêm thông tin đầy đủ cho selectedRequest để hiển thị trong tab content
    const selectedRequestFull = selectedRequest ? {
        ...selectedRequest,
        locationFull: selectedRequest.isDomestic ? `${selectedRequest.location} (Trong nước)` : `${selectedRequest.location} (Nước ngoài)`,
        bankAccount: '' // TODO: Fetch from employee profile using employee_id
    } : null;

    // Fetch employee bank account when request is selected
    useEffect(() => {
        const fetchEmployeeBankAccount = async () => {
            if (selectedRequest?.employee_id) {
                try {
                    // TODO: Add API endpoint to fetch employee bank account
                    // For now, using placeholder
                    const bankAccount = `970422 - 1234567890 - ${selectedRequest.employeeName}`;
                    setTabBForm(prev => ({
                        ...prev,
                        bankAccount: bankAccount
                    }));
                } catch (error) {
                    console.error('Error fetching employee bank account:', error);
                }
            }
        };
        fetchEmployeeBankAccount();
    }, [selectedRequest]);


    // Format currency input
    const handleAmountChange = (e) => {
        let value = e.target.value.replace(/[^\d]/g, '');
        setTabBForm({ ...tabBForm, actualAmount: value });
    };

    // Get formatted amount for display
    const getFormattedAmount = () => {
        if (!tabBForm.actualAmount) return '';
        return parseInt(tabBForm.actualAmount).toLocaleString('vi-VN');
    };

    // Validate form
    const validateTabBForm = () => {
        if (!tabBForm.actualAmount) return 'Vui lòng nhập số tiền thực tạm ứng.';
        if (!tabBForm.advanceMethod) return 'Vui lòng chọn hình thức tạm ứng.';
        if (!tabBForm.transferNotes.trim()) return 'Vui lòng nhập ghi chú (nội dung chuyển khoản).';

        const amount = parseInt(tabBForm.actualAmount);
        if (isNaN(amount) || amount <= 0) return 'Số tiền phải lớn hơn 0.';

        if (approvedBudget && amount > approvedBudget.amount) {
            return `Số tiền không được vượt quá ngân sách tối đa đã được cấp (${approvedBudget.amount.toLocaleString('vi-VN')} VND).`;
        }

        return null;
    };

    return (
        <div className="travel-expense-management">
            {/* Header: Quản Lý Kinh Phí Công Tác với Calm Integrity Gradient */}
            <div className="travel-expense-management-header">
                <div className="travel-expense-management-header-content">
                    {/* Icon Banner Block - Glass Block */}
                    <div className="travel-expense-management-icon-wrapper">
                        <svg
                            className="travel-expense-management-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>

                    {/* Title & Subtitle */}
                    <div className="travel-expense-management-header-text">
                        <h2 className="travel-expense-management-title">
                            Quản Lý Kinh Phí Công Tác
                        </h2>
                        <p className="travel-expense-management-subtitle">
                            Xem và xử lý các yêu cầu kinh phí công tác, cấp ngân sách và quản lý tạm ứng
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Container: Glass Card - Thẻ chính chứa toàn bộ giao diện */}
            <div className="travel-expense-management-main-container">
                {/* Bố cục chính: 2 cột (Danh sách và Chi tiết) */}
                <div className="travel-expense-management-main-layout">
                    {/* II. CỘT TRÁI: DANH SÁCH CHỜ CẤP NGÂN SÁCH (35% Width) */}
                    <div className="travel-expense-management-list-column">
                        {/* Nền Cột: bg-white (Solid), rounded-xl, shadow-lg */}
                        <div className="travel-expense-list-column-container">
                            {/* Tiêu đề: text-xl font-bold text-indigo-600 */}
                            <h2 className="travel-expense-list-title">
                                Danh Sách Chờ Cấp Ngân Sách
                            </h2>

                            {/* Thanh Tìm kiếm */}
                            <div className="travel-expense-search-wrapper">
                                <input
                                    type="text"
                                    className="travel-expense-search-input"
                                    placeholder="Tìm kiếm theo mã, tên, địa điểm..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Danh sách Items */}
                            <div className="travel-expense-list-items">
                                {loading ? (
                                    <div className="travel-expense-loading">Đang tải...</div>
                                ) : filteredRequests.length === 0 ? (
                                    <div className="travel-expense-empty">Không có yêu cầu nào</div>
                                ) : (
                                    filteredRequests.map((request) => (
                                        <div
                                            key={request.id}
                                            className={`travel-expense-list-item ${selectedRequestId === request.id ? 'active' : ''}`}
                                            onClick={() => setSelectedRequestId(request.id)}
                                        >
                                            {/* Cột trái: ID và Tên */}
                                            <div className="travel-expense-item-left">
                                                {/* Mã Yêu cầu: text-sm font-bold text-blue-600 - Ở trên cùng bên trái */}
                                                <div className="travel-expense-request-code">
                                                    {request.code}
                                                </div>
                                                {/* Tên nhân viên: Ở dưới ID, bên trái */}
                                                <div className="travel-expense-request-employee">
                                                    {request.employeeName}
                                                </div>
                                            </div>

                                            {/* Cột phải: Địa điểm và Trạng thái */}
                                            <div className="travel-expense-item-right">
                                                {/* Địa điểm: Ở trên cùng bên phải */}
                                                <div className="travel-expense-request-location">
                                                    {request.location}
                                                </div>
                                                {/* Trạng thái: Ở dưới Location, bên phải */}
                                                <div className={`travel-expense-request-status ${request.isDomestic ? 'domestic' : 'foreign'}`}>
                                                    {request.isDomestic ? 'Trong nước' : 'Nước ngoài'}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* III. CỘT PHẢI: CHI TIẾT CẤP NGÂN SÁCH (65% Width) */}
                    <div className="travel-expense-management-detail-column">
                        {/* Nền Cột: bg-white (Solid), rounded-xl, shadow-lg - Nền trắng tinh khiết, sạch sẽ */}
                        <div className="travel-expense-detail-column-container">
                            {selectedRequestFull ? (
                                <>
                                    {/* A. Tóm Tắt & Tab Menu */}

                                    {/* A.1. Thông tin Tóm tắt: Light blue card với layout 2 cột */}
                                    <div className="travel-expense-summary-block">
                                        {/* Tiêu đề: Bold blue text */}
                                        <h3 className="travel-expense-summary-title">
                                            Thông tin Yêu Cầu - {selectedRequestFull.code}
                                        </h3>

                                        {/* Layout 2 cột */}
                                        <div className="travel-expense-summary-content">
                                            {/* Cột trái: Nhân viên, Địa điểm */}
                                            <div className="travel-expense-summary-left">
                                                <div className="travel-expense-summary-item">
                                                    <span className="travel-expense-summary-label">Nhân viên:</span>
                                                    <span className="travel-expense-summary-value">{selectedRequestFull.employeeName}</span>
                                                </div>
                                                <div className="travel-expense-summary-item">
                                                    <span className="travel-expense-summary-label">Địa điểm:</span>
                                                    <span className="travel-expense-summary-value">{selectedRequestFull.locationFull}</span>
                                                </div>
                                            </div>

                                            {/* Cột phải: Mục đích, Trạng thái */}
                                            <div className="travel-expense-summary-right">
                                                <div className="travel-expense-summary-item">
                                                    <span className="travel-expense-summary-label">Mục đích:</span>
                                                    <span className="travel-expense-summary-value">{selectedRequestFull.purpose}</span>
                                                </div>
                                                <div className="travel-expense-summary-item">
                                                    <span className="travel-expense-summary-label">Trạng thái:</span>
                                                    <span className="travel-expense-summary-value travel-expense-summary-status">ĐÃ DUYỆT CẤP 3</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* A.2. Tab Menu: flex border-b border-gray-200 - Chứa 2 nút chuyển đổi nội dung */}
                                    <div className="travel-expense-tab-menu">
                                        {/* Tab Active (A): Nút Solid Blue - bg-blue-600, text-white, font-semibold, shadow-lg */}
                                        <button
                                            className={`travel-expense-tab-button ${activeTab === 'A' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('A')}
                                        >
                                            A. Xác Định Ngân Sách
                                        </button>
                                        {/* Tab Inactive (B): Nút Grey - bg-gray-100, text-gray-600, hover:bg-gray-200 */}
                                        <button
                                            className={`travel-expense-tab-button ${activeTab === 'B' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('B')}
                                        >
                                            B. Xử Lý Tạm Ứng
                                        </button>
                                    </div>

                                    {/* B. Nội dung Tab */}
                                    <div className="travel-expense-tab-content">
                                        {/* Tab A: Cấp Ngân Sách Tối Đa */}
                                        {activeTab === 'A' && (
                                            <div className="travel-expense-tab-a">
                                                {/* Tiêu đề Form: text-xl font-bold text-blue-700 - Dùng màu Xanh Dương đậm để phân cấp cho Form */}
                                                <h3 className="travel-expense-form-title">
                                                    Cấp Ngân Sách Tối Đa
                                                </h3>

                                                <div className="travel-expense-form-group">
                                                    {/* Label: text-sm font-semibold text-gray-700 - Label rõ ràng */}
                                                    <label className="travel-expense-form-label">
                                                        Trợ cấp Cố định / Ngân sách Tối đa
                                                    </label>
                                                    {/* Input Fields: shadow-inner, focus:border-blue-500 - Input màu trắng, áp dụng hiệu ứng Fluent Focus */}
                                                    <input
                                                        type="number"
                                                        className="travel-expense-form-input"
                                                        value={tabAForm.budgetAmount}
                                                        onChange={(e) => setTabAForm({ ...tabAForm, budgetAmount: e.target.value })}
                                                        placeholder="Nhập số tiền tối đa được phép chi"
                                                        required
                                                    />
                                                </div>

                                                <div className="travel-expense-form-group">
                                                    <label className="travel-expense-form-label">
                                                        Loại Tiền
                                                    </label>
                                                    <select
                                                        className="travel-expense-form-select"
                                                        value={tabAForm.currencyType}
                                                        onChange={(e) => handleCurrencyChange(e.target.value)}
                                                    >
                                                        <option value="VND">VND</option>
                                                        <option value="USD">USD</option>
                                                        <option value="EUR">EUR</option>
                                                        <option value="JPY">JPY (Yên Nhật)</option>
                                                        <option value="CNY">CNY (Nhân dân tệ Trung Quốc)</option>
                                                    </select>
                                                </div>

                                                <div className="travel-expense-form-group">
                                                    <label className="travel-expense-form-label">
                                                        Tỷ Giá Áp Dụng (1 {tabAForm.currencyType} = VND)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        className="travel-expense-form-input"
                                                        value={tabAForm.exchangeRate}
                                                        onChange={(e) => setTabAForm({ ...tabAForm, exchangeRate: e.target.value })}
                                                        placeholder={tabAForm.currencyType === 'VND' ? 'Tự động = 1' : 'Nhập tỷ giá quy đổi'}
                                                        disabled={tabAForm.currencyType === 'VND'}
                                                        required
                                                    />
                                                </div>

                                                {/* TOTAL Ngân Sách: Khối Cảnh báo/Kết quả - bg-teal-50, border-l-4 border-teal-400 */}
                                                {/* Dùng màu Teal để nhấn mạnh đây là KẾT QUẢ TÀI CHÍNH (tính năng hoàn tất) */}
                                                <div className="travel-expense-total-budget-block">
                                                    <div className="travel-expense-total-budget-label">
                                                        {tabAForm.currencyType === 'VND'
                                                            ? 'Tổng Ngân Sách (VND)'
                                                            : `Tổng Ngân Sách Quy Đổi (VND) - Tự động tính từ ${tabAForm.budgetAmount || '0'} ${tabAForm.currencyType}`
                                                        }
                                                    </div>
                                                    {/* Số tiền: text-3xl font-extrabold text-teal-600 - Phải cực kỳ nổi bật */}
                                                    <div className="travel-expense-total-budget-amount">
                                                        {getConvertedAmount().toLocaleString('vi-VN')} VND
                                                    </div>
                                                </div>

                                                {/* Nút Hành động */}
                                                <div className="travel-expense-form-actions">
                                                    {/* Nút Chính (Xác Nhận): Fluent Lift Button - bg-blue-600 gradient, text-white */}
                                                    {/* hover:translate-y-[-2px], shadow-lg shadow-blue-400/50 */}
                                                    <button
                                                        className="travel-expense-primary-button"
                                                        onClick={() => {
                                                            if (!tabAForm.budgetAmount || !tabAForm.exchangeRate) {
                                                                showToast?.('Vui lòng nhập đầy đủ thông tin', 'warning');
                                                                return;
                                                            }
                                                            // Lưu thông tin ngân sách đã được cấp
                                                            setApprovedBudget({
                                                                amount: getConvertedAmount(),
                                                                originalAmount: tabAForm.budgetAmount,
                                                                currency: tabAForm.currencyType,
                                                                exchangeRate: tabAForm.exchangeRate
                                                            });
                                                            showToast?.('Đã lưu ngân sách', 'success');
                                                            // TODO: Logic lưu ngân sách
                                                        }}
                                                    >
                                                        💾 Xác Nhận Cấp Ngân Sách
                                                    </button>
                                                    {/* Nút Phụ (Hủy): bg-gray-200, text-gray-700 - Nút trung tính */}
                                                    <button
                                                        className="travel-expense-secondary-button"
                                                        onClick={() => {
                                                            setTabAForm({ budgetAmount: '', currencyType: 'VND', exchangeRate: '1' });
                                                        }}
                                                    >
                                                        Hủy
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {activeTab === 'B' && (
                                            <div className="travel-expense-tab-b">
                                                {/* Tiêu đề Tab B */}
                                                <h3 className="travel-expense-form-title">
                                                    Xử Lý Tạm Ứng
                                                </h3>

                                                {/* 1. Khối Thông Báo Xác Nhận (Indigo Alert Box) */}
                                                {approvedBudget && (
                                                    <div className="travel-expense-indigo-alert">
                                                        <div className="travel-expense-indigo-alert-header">
                                                            <svg className="travel-expense-indigo-alert-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                            </svg>
                                                            <span className="travel-expense-indigo-alert-title">Thông tin đã xác định (HR)</span>
                                                        </div>
                                                        <div className="travel-expense-indigo-alert-content">
                                                            <p className="travel-expense-indigo-alert-message">
                                                                Ngân sách tối đa đã được cấp cho yêu cầu này:
                                                            </p>
                                                            <div className="travel-expense-indigo-alert-amount">
                                                                <span className="travel-expense-indigo-alert-amount-value">
                                                                    {approvedBudget.amount.toLocaleString('vi-VN')} VND
                                                                </span>
                                                                {approvedBudget.currency !== 'VND' && (
                                                                    <span className="travel-expense-indigo-alert-amount-original">
                                                                        ({approvedBudget.originalAmount} {approvedBudget.currency} × {approvedBudget.exchangeRate})
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="travel-expense-indigo-alert-warning">
                                                                ⚠️ <strong>Lưu ý:</strong> Vui lòng không chuyển khoản vượt quá giới hạn ngân sách tối đa đã được phê duyệt.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {!approvedBudget && (
                                                    <div className="travel-expense-indigo-alert travel-expense-indigo-alert--info">
                                                        <div className="travel-expense-indigo-alert-header">
                                                            <svg className="travel-expense-indigo-alert-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                            </svg>
                                                            <span className="travel-expense-indigo-alert-title">Chưa có thông tin ngân sách</span>
                                                        </div>
                                                        <div className="travel-expense-indigo-alert-content">
                                                            <p className="travel-expense-indigo-alert-message">
                                                                Vui lòng chuyển sang tab <strong>"A. Xác Định Ngân Sách"</strong> để cấp ngân sách tối đa trước khi xử lý tạm ứng.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 2. Form Xử Lý Chuyển Khoản (Main Form) */}
                                                {approvedBudget && (
                                                    <div className="travel-expense-advance-form">
                                                        <h4 className="travel-expense-form-section-title">
                                                            2. Form Xử Lý Chuyển Khoản
                                                        </h4>
                                                        <p className="travel-expense-form-section-description">
                                                            Các trường dữ liệu Kế toán cần xác nhận hoặc nhập vào để hoàn tất việc chuyển tiền.
                                                        </p>

                                                        <div className="travel-expense-advance-form-content">
                                                            {/* 1. Số tiền Thực Tạm ứng */}
                                                            <div className="travel-expense-form-group">
                                                                <label htmlFor="actualAmount" className="travel-expense-form-label">
                                                                    1. Số tiền Thực Tạm ứng <span className="required">*</span>
                                                                </label>
                                                                <div className="travel-expense-currency-input-wrapper">
                                                                    <input
                                                                        type="text"
                                                                        id="actualAmount"
                                                                        className="travel-expense-form-input travel-expense-currency-input"
                                                                        value={getFormattedAmount()}
                                                                        onChange={handleAmountChange}
                                                                        placeholder="Nhập số tiền thực tế sẽ chuyển khoản"
                                                                        required
                                                                    />
                                                                    <span className="travel-expense-currency-suffix">VND</span>
                                                                </div>
                                                                <p className="travel-expense-input-hint">
                                                                    Mặc dù đã có ngân sách tối đa, Kế toán có thể chuyển một số tiền nhỏ hơn theo quy định.
                                                                </p>
                                                                {tabBForm.actualAmount && approvedBudget && parseInt(tabBForm.actualAmount) > approvedBudget.amount && (
                                                                    <p className="travel-expense-input-error">
                                                                        ⚠️ Số tiền vượt quá ngân sách tối đa ({approvedBudget.amount.toLocaleString('vi-VN')} VND)
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* 2. Hình thức Tạm ứng */}
                                                            <div className="travel-expense-form-group">
                                                                <label htmlFor="advanceMethod" className="travel-expense-form-label">
                                                                    2. Hình thức Tạm ứng <span className="required">*</span>
                                                                </label>
                                                                <select
                                                                    id="advanceMethod"
                                                                    className="travel-expense-form-select"
                                                                    value={tabBForm.advanceMethod}
                                                                    onChange={(e) => setTabBForm({ ...tabBForm, advanceMethod: e.target.value })}
                                                                    required
                                                                >
                                                                    <option value="">Chọn hình thức thanh toán</option>
                                                                    <option value="bank_transfer">Chuyển khoản Ngân hàng</option>
                                                                    <option value="cash">Tiền mặt</option>
                                                                    <option value="company_card">Thẻ công ty</option>
                                                                </select>
                                                                <p className="travel-expense-input-hint">
                                                                    Cho phép Kế toán chọn hình thức thanh toán.
                                                                </p>
                                                            </div>

                                                            {/* 3. Tài khoản Ngân hàng nhận */}
                                                            <div className="travel-expense-form-group">
                                                                <label htmlFor="bankAccount" className="travel-expense-form-label">
                                                                    3. Tài khoản Ngân hàng nhận
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    id="bankAccount"
                                                                    className="travel-expense-form-input travel-expense-form-input-readonly"
                                                                    value={tabBForm.bankAccount}
                                                                    readOnly
                                                                    disabled
                                                                    placeholder="Thông tin tài khoản từ hồ sơ nhân viên"
                                                                />
                                                                <p className="travel-expense-input-hint">
                                                                    Hiển thị thông tin tài khoản của nhân viên đã được trích xuất từ hồ sơ. Kế toán chỉ cần xác nhận mà không cần nhập lại.
                                                                </p>
                                                            </div>

                                                            {/* 4. Ghi chú (Nội dung Chuyển khoản) */}
                                                            <div className="travel-expense-form-group">
                                                                <label htmlFor="transferNotes" className="travel-expense-form-label">
                                                                    4. Ghi chú (Nội dung Chuyển khoản) <span className="required">*</span>
                                                                </label>
                                                                <textarea
                                                                    id="transferNotes"
                                                                    className="travel-expense-form-textarea"
                                                                    rows="4"
                                                                    value={tabBForm.transferNotes}
                                                                    onChange={(e) => setTabBForm({ ...tabBForm, transferNotes: e.target.value })}
                                                                    placeholder="Nhập nội dung chuyển khoản (ví dụ: Tạm ứng công tác CTX-20240901 - Lê Thanh Tùng)"
                                                                    required
                                                                />
                                                                <p className="travel-expense-input-hint">
                                                                    Trường bắt buộc để nhập nội dung chuyển khoản rõ ràng (Ví dụ: Tạm ứng công tác, Mã Yêu cầu, Tên nhân viên).
                                                                </p>
                                                            </div>

                                                            {/* Form Actions */}
                                                            <div className="travel-expense-form-actions">
                                                                <button
                                                                    type="button"
                                                                    className="travel-expense-primary-button"
                                                                    onClick={() => {
                                                                        const error = validateTabBForm();
                                                                        if (error) {
                                                                            showToast?.(error, 'warning');
                                                                            return;
                                                                        }
                                                                        showToast?.('Đã xác nhận xử lý chuyển khoản', 'success');
                                                                        // TODO: Logic xử lý chuyển khoản
                                                                        console.log('Advance form data:', tabBForm);
                                                                    }}
                                                                >
                                                                    💰 Xác Nhận Chuyển Khoản
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="travel-expense-secondary-button"
                                                                    onClick={() => {
                                                                        setTabBForm({
                                                                            actualAmount: '',
                                                                            advanceMethod: '',
                                                                            bankAccount: selectedRequestFull?.bankAccount || '',
                                                                            transferNotes: ''
                                                                        });
                                                                    }}
                                                                >
                                                                    Đặt lại
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="travel-expense-no-selection">
                                    Vui lòng chọn một yêu cầu từ danh sách để xem chi tiết
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TravelExpenseManagement;
