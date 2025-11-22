import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { formatDateToISO, parseISODateString, today } from '../../utils/dateUtils';
import { DATE_PICKER_LOCALE } from '../../utils/datepickerLocale';
import { candidatesAPI } from '../../services/api';
import './CandidateForm.css';

const CandidateForm = ({ currentUser, showToast, onNavigate }) => {
    const [formData, setFormData] = useState({
        hoTen: '',
        ngaySinh: '',
        viTriUngTuyen: '',
        phongBan: '',
        soDienThoai: '',
        cccd: '',
        ngayCapCCCD: '',
        noiCapCCCD: '',
        ngayGuiCV: '',
        cvFile: null
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const viTriOptions = [
        { value: '', label: 'Chọn vị trí ứng tuyển' },
        { value: 'MUAHANG', label: 'Mua hàng' },
        { value: 'TAPVU_NAUAN', label: 'Tạp vụ & nấu ăn' },
        { value: 'HAN_BOMACH', label: 'Hàn bo mạch' },
        { value: 'CHATLUONG', label: 'Chất lượng' },
        { value: 'KHAOSAT_THIETKE', label: 'Khảo sát thiết kế' },
        { value: 'ADMIN_DUAN', label: 'Admin dự án' },
        { value: 'LAPRAP', label: 'Lắp ráp' },
        { value: 'LAPRAP_JIG_PALLET', label: 'Lắp ráp JIG, Pallet' },
        { value: 'DIEN_LAPTRINH_PLC', label: 'Điện lập trình PLC' },
        { value: 'THIETKE_MAY_TUDONG', label: 'Thiết kế máy tự động' },
        { value: 'VANHANH_MAY_CNC', label: 'Vận hành máy CNC' },
        { value: 'DICHVU_KYTHUAT', label: 'Dịch vụ Kỹ thuật' },
        { value: 'KETOAN_NOIBO', label: 'Kế toán nội bộ' },
        { value: 'KETOAN_BANHANG', label: 'Kế toán bán hàng' }
    ];

    const phongBanOptions = [
        { value: '', label: 'Chọn phòng ban' },
        { value: 'MUAHANG', label: 'Mua hàng' },
        { value: 'HANHCHINH', label: 'Hành chính' },
        { value: 'DVDT', label: 'DVĐT' },
        { value: 'QA', label: 'QA' },
        { value: 'KHAOSAT_THIETKE', label: 'Khảo sát thiết kế' },
        { value: 'TUDONG', label: 'Tự động' },
        { value: 'CNC', label: 'CNC' },
        { value: 'DICHVU_KYTHUAT', label: 'Dịch vụ kỹ thuật' },
        { value: 'KETOAN', label: 'Kế toán' }
    ];

    const handleInputChange = (field, value) => {
        console.log('handleInputChange:', field, value); // Debug
        setFormData(prev => {
            const newData = {
                ...prev,
                [field]: value
            };
            console.log('New formData:', newData); // Debug
            return newData;
        });
        // Clear error when user types
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    const handleDateChange = (field, date) => {
        if (date) {
            const isoDate = formatDateToISO(date);
            handleInputChange(field, isoDate);
        } else {
            handleInputChange(field, '');
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type (PDF, DOC, DOCX)
            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!allowedTypes.includes(file.type)) {
                setErrors(prev => ({
                    ...prev,
                    cvFile: 'Chỉ chấp nhận file PDF, DOC hoặc DOCX'
                }));
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setErrors(prev => ({
                    ...prev,
                    cvFile: 'Kích thước file không được vượt quá 5MB'
                }));
                return;
            }
            setFormData(prev => ({
                ...prev,
                cvFile: file
            }));
            if (errors.cvFile) {
                setErrors(prev => ({
                    ...prev,
                    cvFile: ''
                }));
            }
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!allowedTypes.includes(file.type)) {
                setErrors(prev => ({
                    ...prev,
                    cvFile: 'Chỉ chấp nhận file PDF, DOC hoặc DOCX'
                }));
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setErrors(prev => ({
                    ...prev,
                    cvFile: 'Kích thước file không được vượt quá 5MB'
                }));
                return;
            }
            setFormData(prev => ({
                ...prev,
                cvFile: file
            }));
            if (errors.cvFile) {
                setErrors(prev => ({
                    ...prev,
                    cvFile: ''
                }));
            }
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.hoTen.trim()) {
            newErrors.hoTen = 'Vui lòng nhập họ tên';
        }

        if (!formData.ngaySinh) {
            newErrors.ngaySinh = 'Vui lòng chọn ngày sinh';
        }

        if (!formData.viTriUngTuyen) {
            newErrors.viTriUngTuyen = 'Vui lòng chọn vị trí ứng tuyển';
        }

        if (!formData.phongBan) {
            newErrors.phongBan = 'Vui lòng chọn phòng ban';
        }

        if (!formData.soDienThoai.trim()) {
            newErrors.soDienThoai = 'Vui lòng nhập số điện thoại';
        } else if (!/^[0-9]{10,11}$/.test(formData.soDienThoai.replace(/\s/g, ''))) {
            newErrors.soDienThoai = 'Số điện thoại không hợp lệ';
        }

        if (!formData.cccd.trim()) {
            newErrors.cccd = 'Vui lòng nhập số CCCD';
        } else if (!/^[0-9]{9,12}$/.test(formData.cccd.replace(/\s/g, ''))) {
            newErrors.cccd = 'Số CCCD không hợp lệ';
        }

        if (!formData.ngayCapCCCD) {
            newErrors.ngayCapCCCD = 'Vui lòng chọn ngày cấp CCCD';
        }

        if (!formData.noiCapCCCD.trim()) {
            newErrors.noiCapCCCD = 'Vui lòng nhập nơi cấp CCCD';
        }

        if (!formData.ngayGuiCV) {
            newErrors.ngayGuiCV = 'Vui lòng chọn ngày gửi CV';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            if (showToast) {
                showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
            }
            return;
        }

        setLoading(true);
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('hoTen', formData.hoTen);
            formDataToSend.append('ngaySinh', formData.ngaySinh);
            formDataToSend.append('viTriUngTuyen', formData.viTriUngTuyen);
            formDataToSend.append('phongBan', formData.phongBan);
            formDataToSend.append('soDienThoai', formData.soDienThoai);
            formDataToSend.append('cccd', formData.cccd);
            formDataToSend.append('ngayCapCCCD', formData.ngayCapCCCD);
            formDataToSend.append('noiCapCCCD', formData.noiCapCCCD);
            formDataToSend.append('ngayGuiCV', formData.ngayGuiCV);

            if (formData.cvFile) {
                formDataToSend.append('cvFile', formData.cvFile);
            }

            await candidatesAPI.create(formDataToSend);

            if (showToast) {
                showToast('Đã lưu thông tin ứng viên thành công!', 'success');
            }

            // Reset form
            setFormData({
                hoTen: '',
                ngaySinh: '',
                viTriUngTuyen: '',
                phongBan: '',
                soDienThoai: '',
                cccd: '',
                ngayCapCCCD: '',
                noiCapCCCD: '',
                ngayGuiCV: '',
                cvFile: null
            });
            setErrors({});

            // Chuyển sang bảng quản lý ứng viên
            if (onNavigate) {
                onNavigate('candidate-management');
            }
        } catch (error) {
            console.error('Error saving candidate:', error);
            if (showToast) {
                const message = error.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin ứng viên';
                showToast(message, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="candidate-form-container">
            <div className="candidate-form-card">
                <div className="candidate-form-header">
                    <h1 className="candidate-form-title">
                        <svg className="candidate-form-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                        </svg>
                        <span>Thêm Ứng viên mới</span>
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="candidate-form">
                    {/* Row 1: Họ tên, Ngày sinh */}
                    <div className="candidate-form-row">
                        <div className="candidate-form-group">
                            <label htmlFor="hoTen" className="candidate-form-label">
                                Họ tên <span className="required">*</span>
                            </label>
                            <input
                                id="hoTen"
                                type="text"
                                className={`candidate-form-input ${errors.hoTen ? 'error' : ''}`}
                                value={formData.hoTen}
                                onChange={(e) => handleInputChange('hoTen', e.target.value)}
                                placeholder="Nhập họ và tên ứng viên"
                            />
                            {errors.hoTen && (
                                <span className="candidate-form-error">{errors.hoTen}</span>
                            )}
                        </div>

                        <div className="candidate-form-group">
                            <label htmlFor="ngaySinh" className="candidate-form-label">
                                Ngày sinh <span className="required">*</span>
                            </label>
                            <DatePicker
                                id="ngaySinh"
                                selected={formData.ngaySinh ? parseISODateString(formData.ngaySinh) : null}
                                onChange={(date) => handleDateChange('ngaySinh', date)}
                                maxDate={today()}
                                dateFormat="dd/MM/yyyy"
                                locale={DATE_PICKER_LOCALE}
                                className={`candidate-form-input candidate-form-datepicker ${errors.ngaySinh ? 'error' : ''}`}
                                placeholderText="Chọn ngày sinh"
                                showYearDropdown
                                showMonthDropdown
                                dropdownMode="select"
                                yearDropdownItemNumber={100}
                                scrollableYearDropdown
                                minDate={new Date(1900, 0, 1)}
                            />
                            {errors.ngaySinh && (
                                <span className="candidate-form-error">{errors.ngaySinh}</span>
                            )}
                        </div>
                    </div>

                    {/* Row 2: Vị trí ứng tuyển, Phòng ban */}
                    <div className="candidate-form-row">
                        <div className="candidate-form-group">
                            <label htmlFor="viTriUngTuyen" className="candidate-form-label">
                                Vị trí ứng tuyển <span className="required">*</span>
                            </label>
                            <select
                                id="viTriUngTuyen"
                                className={`candidate-form-input candidate-form-select ${errors.viTriUngTuyen ? 'error' : ''}`}
                                value={formData.viTriUngTuyen}
                                onChange={(e) => {
                                    console.log('Select changed:', e.target.value);
                                    handleInputChange('viTriUngTuyen', e.target.value);
                                }}
                            >
                                {viTriOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {errors.viTriUngTuyen && (
                                <span className="candidate-form-error">{errors.viTriUngTuyen}</span>
                            )}
                        </div>

                        <div className="candidate-form-group">
                            <label htmlFor="phongBan" className="candidate-form-label">
                                Phòng ban/Bộ phận <span className="required">*</span>
                            </label>
                            <select
                                id="phongBan"
                                className={`candidate-form-input candidate-form-select ${errors.phongBan ? 'error' : ''}`}
                                value={formData.phongBan}
                                onChange={(e) => {
                                    console.log('Select changed:', e.target.value);
                                    handleInputChange('phongBan', e.target.value);
                                }}
                            >
                                {phongBanOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {errors.phongBan && (
                                <span className="candidate-form-error">{errors.phongBan}</span>
                            )}
                        </div>
                    </div>

                    {/* Row 3: Số ĐT, CCCD */}
                    <div className="candidate-form-row">
                        <div className="candidate-form-group">
                            <label htmlFor="soDienThoai" className="candidate-form-label">
                                Số điện thoại <span className="required">*</span>
                            </label>
                            <input
                                id="soDienThoai"
                                type="text"
                                className={`candidate-form-input ${errors.soDienThoai ? 'error' : ''}`}
                                value={formData.soDienThoai}
                                onChange={(e) => handleInputChange('soDienThoai', e.target.value.replace(/\D/g, ''))}
                                placeholder="Nhập số điện thoại"
                                maxLength={11}
                            />
                            {errors.soDienThoai && (
                                <span className="candidate-form-error">{errors.soDienThoai}</span>
                            )}
                        </div>

                        <div className="candidate-form-group">
                            <label htmlFor="cccd" className="candidate-form-label">
                                Số CCCD <span className="required">*</span>
                            </label>
                            <input
                                id="cccd"
                                type="text"
                                className={`candidate-form-input ${errors.cccd ? 'error' : ''}`}
                                value={formData.cccd}
                                onChange={(e) => handleInputChange('cccd', e.target.value.replace(/\D/g, ''))}
                                placeholder="Nhập số CCCD"
                                maxLength={12}
                            />
                            {errors.cccd && (
                                <span className="candidate-form-error">{errors.cccd}</span>
                            )}
                        </div>
                    </div>

                    {/* Row 4: Ngày cấp CCCD, Nơi cấp */}
                    <div className="candidate-form-row">
                        <div className="candidate-form-group">
                            <label htmlFor="ngayCapCCCD" className="candidate-form-label">
                                Ngày cấp CCCD <span className="required">*</span>
                            </label>
                            <DatePicker
                                id="ngayCapCCCD"
                                selected={formData.ngayCapCCCD ? parseISODateString(formData.ngayCapCCCD) : null}
                                onChange={(date) => handleDateChange('ngayCapCCCD', date)}
                                maxDate={today()}
                                dateFormat="dd/MM/yyyy"
                                locale={DATE_PICKER_LOCALE}
                                className={`candidate-form-input candidate-form-datepicker ${errors.ngayCapCCCD ? 'error' : ''}`}
                                placeholderText="Chọn ngày cấp CCCD"
                                showYearDropdown
                                showMonthDropdown
                                dropdownMode="select"
                                yearDropdownItemNumber={100}
                                scrollableYearDropdown
                                minDate={new Date(1900, 0, 1)}
                            />
                            {errors.ngayCapCCCD && (
                                <span className="candidate-form-error">{errors.ngayCapCCCD}</span>
                            )}
                        </div>

                        <div className="candidate-form-group">
                            <label htmlFor="noiCapCCCD" className="candidate-form-label">
                                Nơi cấp CCCD <span className="required">*</span>
                            </label>
                            <input
                                id="noiCapCCCD"
                                type="text"
                                className={`candidate-form-input ${errors.noiCapCCCD ? 'error' : ''}`}
                                value={formData.noiCapCCCD}
                                onChange={(e) => handleInputChange('noiCapCCCD', e.target.value)}
                                placeholder="Nhập nơi cấp CCCD (ví dụ: CA TP.HCM)"
                            />
                            {errors.noiCapCCCD && (
                                <span className="candidate-form-error">{errors.noiCapCCCD}</span>
                            )}
                        </div>
                    </div>

                    {/* Row 5: Ngày gửi CV */}
                    <div className="candidate-form-row">
                        <div className="candidate-form-group">
                            <label htmlFor="ngayGuiCV" className="candidate-form-label">
                                Ngày gửi CV <span className="required">*</span>
                            </label>
                            <DatePicker
                                id="ngayGuiCV"
                                selected={formData.ngayGuiCV ? parseISODateString(formData.ngayGuiCV) : null}
                                onChange={(date) => handleDateChange('ngayGuiCV', date)}
                                maxDate={today()}
                                dateFormat="dd/MM/yyyy"
                                locale={DATE_PICKER_LOCALE}
                                className={`candidate-form-input candidate-form-datepicker ${errors.ngayGuiCV ? 'error' : ''}`}
                                placeholderText="Chọn ngày gửi CV"
                                showYearDropdown
                                showMonthDropdown
                                dropdownMode="select"
                            />
                            {errors.ngayGuiCV && (
                                <span className="candidate-form-error">{errors.ngayGuiCV}</span>
                            )}
                        </div>

                        <div className="candidate-form-group">
                            {/* Empty space for alignment */}
                        </div>
                    </div>

                    {/* File Upload: CV */}
                    <div className="candidate-form-group candidate-form-group-full">
                        <label className="candidate-form-label">
                            CV Ứng viên
                        </label>
                        <div
                            className={`candidate-form-file-upload ${dragActive ? 'drag-active' : ''} ${formData.cvFile ? 'has-file' : ''}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                id="cvFile"
                                accept=".pdf,.doc,.docx"
                                onChange={handleFileChange}
                                className="candidate-form-file-input"
                            />
                            <div className="candidate-form-file-content">
                                {formData.cvFile ? (
                                    <>
                                        <svg className="candidate-form-file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                        </svg>
                                        <div className="candidate-form-file-info">
                                            <p className="candidate-form-file-name">{formData.cvFile.name}</p>
                                            <p className="candidate-form-file-size">
                                                {(formData.cvFile.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="candidate-form-file-remove"
                                            onClick={() => handleInputChange('cvFile', null)}
                                        >
                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                            </svg>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <svg className="candidate-form-file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                                        </svg>
                                        <div className="candidate-form-file-text">
                                            <p className="candidate-form-file-drag-text">
                                                Kéo thả file CV vào đây hoặc <span className="candidate-form-file-link">chọn file</span>
                                            </p>
                                            <p className="candidate-form-file-hint">
                                                Chấp nhận: PDF, DOC, DOCX (tối đa 5MB)
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        {errors.cvFile && (
                            <span className="candidate-form-error">{errors.cvFile}</span>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="candidate-form-actions">
                        <button
                            type="submit"
                            className="candidate-form-submit-btn"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <svg className="candidate-form-spinner" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75" />
                                    </svg>
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <span>Lưu lại</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CandidateForm;

