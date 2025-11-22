import React, { useEffect, useMemo, useState } from 'react';
import './TravelExpense.css';

const TravelExpense = ({ currentUser, showToast, showConfirm }) => {
    // State cho form
    const [formData, setFormData] = useState({
        purpose: '',             // Mục đích công tác
        partnerCompany: '',      // Tên công ty/đối tác
        companyAddress: '',      // Địa chỉ công ty
        destination: '',         // Địa điểm công tác
        startDateTime: '',       // Ngày giờ bắt đầu
        endDateTime: ''          // Ngày giờ kết thúc
    });
    const [notification, setNotification] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const domesticLocations = useMemo(() => ['Hà Nội', 'TP.HCM'], []);
    const internationalLocations = useMemo(() => ['Singapore', 'New York'], []);

    const travelScope = useMemo(() => {
        if (!formData.destination) return null;
        if (internationalLocations.includes(formData.destination)) return 'international';
        if (domesticLocations.includes(formData.destination)) return 'domestic';
        return null;
    }, [formData.destination, domesticLocations, internationalLocations]);

    const travelTiming = useMemo(() => {
        if (!formData.startDateTime || !formData.endDateTime) {
            return { ready: false };
        }

        const start = new Date(formData.startDateTime);
        const end = new Date(formData.endDateTime);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return { ready: false };
        }

        if (end < start) {
            return {
                ready: true,
                isValid: false,
                error: 'Ngày & giờ kết thúc phải bằng hoặc sau thời điểm bắt đầu.'
            };
        }

        const diffHours = (end - start) / (1000 * 60 * 60);
        const overnightThreshold = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        const isOvernight = end > overnightThreshold;

        return {
            ready: true,
            isValid: true,
            diffHours,
            isOvernight
        };
    }, [formData.startDateTime, formData.endDateTime]);

    const travelTimeInsight = useMemo(() => {
        if (!travelTiming.ready) return null;

        if (!travelTiming.isValid) {
            return {
                type: 'error',
                title: 'Khoảng thời gian chưa hợp lệ',
                detail: travelTiming.error || 'Ngày & giờ kết thúc phải bằng hoặc sau thời điểm bắt đầu.'
            };
        }

        return {
            type: 'info',
            title: travelTiming.isOvernight ? 'Chuyến đi qua đêm' : 'Chuyến đi trong ngày',
            detail: `Tổng thời gian dự kiến ~ ${travelTiming.diffHours.toFixed(1)} giờ.`
        };
    }, [travelTiming]);

    const autoStatusItems = useMemo(() => [
        {
            id: 'overnight',
            icon: travelTiming.ready && travelTiming.isOvernight ? '✓' : '—',
            label: 'Qua Đêm',
            value: travelTiming.ready
                ? travelTiming.isOvernight
                    ? 'CÓ (Áp dụng phụ cấp lưu trú)'
                    : 'KHÔNG'
                : 'Chưa xác định',
            tone: !travelTiming.ready ? 'muted' : travelTiming.isOvernight ? 'indigo' : 'default',
            note: null
        },
        {
            id: 'scope',
            icon: travelScope === 'international' ? 'dot' : travelScope === 'domestic' ? 'dot' : '—',
            label: 'Phạm vi',
            value: travelScope === 'international'
                ? 'NƯỚC NGOÀI'
                : travelScope === 'domestic'
                    ? 'Trong Nước'
                    : 'Chưa chọn địa điểm',
            tone: travelScope === 'international' ? 'indigo' : travelScope ? 'default' : 'muted',
            note: null
        },
        {
            id: 'duration',
            icon: '🕒',
            label: 'Tổng thời gian',
            value: travelTiming.ready
                ? travelTiming.isValid
                    ? `${travelTiming.diffHours.toFixed(1)} giờ.`
                    : 'Thời gian chưa hợp lệ'
                : 'Chưa xác định',
            tone: !travelTiming.ready ? 'muted' : travelTiming.isValid ? 'info' : 'error',
            note: null
        }
    ], [travelScope, travelTiming]);

    const isFormReady = Boolean(
        formData.purpose.trim() &&
        formData.destination &&
        formData.startDateTime &&
        formData.endDateTime
    );

    const validateForm = () => {
        const errors = [];

        if (!formData.purpose.trim()) {
            errors.push('Vui lòng nhập mục đích công tác.');
        }

        if (!formData.destination) {
            errors.push('Vui lòng chọn địa điểm công tác.');
        }

        if (!formData.startDateTime || !formData.endDateTime) {
            errors.push('Vui lòng nhập đầy đủ ngày & giờ công tác.');
        }

        if (travelTiming.ready && !travelTiming.isValid) {
            errors.push(travelTiming.error || 'Khoảng thời gian chưa hợp lệ.');
        }

        return errors;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (isSubmitting) return;

        const errors = validateForm();

        if (errors.length > 0) {
            setNotification({ type: 'error', message: errors[0] });
            return;
        }

        setIsSubmitting(true);

        // Placeholder submit logic
        setTimeout(() => {
            setIsSubmitting(false);
            setNotification({ type: 'success', message: '✅ Yêu cầu công tác đã được gửi thành công!' });
        }, 600);
    };

    useEffect(() => {
        if (!notification) return;

        const timer = setTimeout(() => {
            setNotification(null);
        }, 3000);

        return () => clearTimeout(timer);
    }, [notification]);

    return (
        <div className="travel-expense-module">
            {/* I. KHU VỰC TIÊU ĐỀ (HEADER) */}
            <div className="travel-expense-header">
                <div className="travel-expense-header-content">
                    <div className="travel-expense-icon-wrapper">
                        <svg className="travel-expense-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <div>
                        <h1 className="travel-expense-title">Đăng Ký Kinh Phí Công Tác</h1>
                        <p className="travel-expense-subtitle">
                            Điền đầy đủ thông tin để gửi yêu cầu kinh phí công tác đến quản lý duyệt.
                        </p>
                    </div>
                </div>
            </div>

            {/* II. KHU VỰC FORM NHẬP LIỆU CHÍNH (MAIN INPUT) */}
            <form className="travel-expense-form" onSubmit={handleSubmit}>
                <div className="travel-expense-form-container">
                    {/* 1. Mục Đích & Đối Tác */}
                    <div className="travel-expense-form-section">
                        <h2 className="travel-expense-section-title">1. Mục Đích & Đối Tác</h2>

                        <div className="travel-expense-form-group">
                            <label htmlFor="purpose" className="travel-expense-label">
                                1. Mục Đích Công Tác <span className="required">*</span>
                            </label>
                            <textarea
                                id="purpose"
                                name="purpose"
                                className="travel-expense-textarea"
                                rows="5"
                                value={formData.purpose}
                                onChange={handleInputChange}
                                placeholder="Ví dụ: Đàm phán Hợp đồng Mở rộng Thị trường Châu Á..."
                                required
                            />
                        </div>

                        <div className="travel-expense-form-group">
                            <label htmlFor="partnerCompany" className="travel-expense-label">
                                2. Tên Công ty / Đối tác
                            </label>
                            <input
                                id="partnerCompany"
                                name="partnerCompany"
                                type="text"
                                className="travel-expense-input"
                                value={formData.partnerCompany}
                                onChange={handleInputChange}
                                placeholder="Tên đối tác hoặc công ty bạn sẽ làm việc."
                            />
                        </div>

                        <div className="travel-expense-form-group">
                            <label htmlFor="companyAddress" className="travel-expense-label">
                                Địa Chỉ Công ty
                            </label>
                            <input
                                id="companyAddress"
                                name="companyAddress"
                                type="text"
                                className="travel-expense-input"
                                value={formData.companyAddress}
                                onChange={handleInputChange}
                                placeholder="Địa chỉ văn phòng làm việc."
                            />
                        </div>
                    </div>

                    {/* 2. Thời Gian & Địa Điểm */}
                    <div className="travel-expense-form-section">
                        <div className="travel-expense-section-header">
                            <h2 className="travel-expense-section-title">2. Thời Gian & Địa Điểm</h2>
                            <p className="travel-expense-section-description">
                                Phân tích rõ giữa thông tin đối tác và hành trình công tác để hệ thống tự động kiểm tra phạm vi & thời lượng.
                            </p>
                        </div>

                        <div className="travel-expense-grid">
                            <div className="travel-expense-form-group">
                                <label htmlFor="destination" className="travel-expense-label">
                                    Địa Điểm Công Tác <span className="required">*</span>
                                </label>
                                <select
                                    id="destination"
                                    name="destination"
                                    className="travel-expense-select"
                                    value={formData.destination}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">Chọn địa điểm công tác</option>
                                    <optgroup label="Trong nước">
                                        {domesticLocations.map((city) => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Nước ngoài">
                                        {internationalLocations.map((city) => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </optgroup>
                                </select>
                                {travelScope && (
                                    <div className={`travel-expense-scope-banner ${travelScope}`}>
                                        {travelScope === 'international'
                                            ? 'Phạm vi: Quốc tế • Kích hoạt kiểm tra ngân sách ngoại tệ'
                                            : 'Phạm vi: Trong nước • Áp dụng hạn mức tiêu chuẩn'}
                                    </div>
                                )}
                            </div>

                            <div className="travel-expense-form-group">
                                <label htmlFor="startDateTime" className="travel-expense-label">
                                    Ngày & Giờ Bắt Đầu <span className="required">*</span>
                                </label>
                                <input
                                    id="startDateTime"
                                    name="startDateTime"
                                    type="datetime-local"
                                    className="travel-expense-input"
                                    value={formData.startDateTime}
                                    onChange={handleInputChange}
                                    required
                                />
                                <p className="travel-expense-input-hint">
                                    Dùng định dạng 24h để hệ thống tính toán chính xác.
                                </p>
                            </div>

                            <div className="travel-expense-form-group">
                                <label htmlFor="endDateTime" className="travel-expense-label">
                                    Ngày & Giờ Kết Thúc <span className="required">*</span>
                                </label>
                                <input
                                    id="endDateTime"
                                    name="endDateTime"
                                    type="datetime-local"
                                    className="travel-expense-input"
                                    value={formData.endDateTime}
                                    onChange={handleInputChange}
                                    required
                                />
                                <p className="travel-expense-input-hint">
                                    Hệ thống sẽ kiểm tra qua đêm & tổng thời gian tự động.
                                </p>
                            </div>
                        </div>

                        {travelTimeInsight && travelTimeInsight.type === 'info' && travelTiming.isOvernight && (
                            <div className="travel-expense-overnight-banner">
                                <strong>{travelTimeInsight.title}</strong>
                                <span>{travelTimeInsight.detail}</span>
                            </div>
                        )}
                        {travelTimeInsight && travelTimeInsight.type === 'error' && (
                            <div className="travel-expense-alert error">
                                <strong>{travelTimeInsight.title}</strong>
                                <span>{travelTimeInsight.detail}</span>
                            </div>
                        )}
                    </div>

                    {/* III. KHU VỰC LOGIC & HÀNH ĐỘNG */}
                    <div className="travel-expense-logic-grid">
                        <div className="travel-expense-form-section travel-expense-logic-section">
                            <div className="travel-expense-section-header">
                                <h2 className="travel-expense-section-title">3.1. Logic Xử Lý Tự Động</h2>
                                <p className="travel-expense-section-description">
                                    Các trạng thái được hệ thống tự động cập nhật dựa trên thông tin bạn đã nhập.
                                </p>
                            </div>

                            <div className="travel-expense-auto-statuses">
                                {autoStatusItems.map((status) => (
                                    <div key={status.id} className={`travel-expense-status-card ${status.tone}`}>
                                        <div className="travel-expense-status-icon-circle">
                                            {status.id === 'duration' && (
                                                <svg className="travel-expense-status-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                </svg>
                                            )}
                                            {(status.id === 'overnight' || status.id === 'scope') && status.icon !== '—' && (
                                                <div className="travel-expense-status-icon-dot"></div>
                                            )}
                                        </div>
                                        <div className="travel-expense-status-body">
                                            <div className="travel-expense-status-content">
                                                <span className="travel-expense-status-label">{status.label}:</span>
                                                <span className="travel-expense-status-value">{status.value}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="travel-expense-action-panel">
                            <div>
                                <p className="travel-expense-action-eyebrow">3.2. HÀNH ĐỘNG</p>
                                <h3 className="travel-expense-action-title">GỬI YÊU CẦU DUYỆT CÔNG TÁC</h3>
                                <p className="travel-expense-action-description">
                                    Nút indigo với hiệu ứng Fluent. Hệ thống sẽ kiểm tra Validation trước khi gửi.
                                </p>
                            </div>
                            <button
                                type="submit"
                                className="travel-expense-submit-btn"
                                disabled={!isFormReady || isSubmitting}
                            >
                                {isSubmitting ? 'Đang gửi...' : 'GỬI YÊU CẦU DUYỆT CÔNG TÁC'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {notification && (
                <div className={`travel-expense-notification ${notification.type}`}>
                    <span className="travel-expense-notification-icon">
                        {notification.type === 'success' ? '✅' : '⚠️'}
                    </span>
                    <p className="travel-expense-notification-message">{notification.message}</p>
                </div>
            )}
        </div>
    );
};

export default TravelExpense;
