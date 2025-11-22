import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import { candidatesAPI, employeesAPI } from '../../services/api';
import { formatDateToISO, parseISODateString, today, formatDateDisplay } from '../../utils/dateUtils';
import { DATE_PICKER_LOCALE } from '../../utils/datepickerLocale';
import './CandidateManagement.css';

// Custom Date Input Component - Wrapper for native date picker with beautiful styling
const CustomDateInput = ({ id, value, onChange, min, error, className = '', placeholder = '' }) => {
    const inputRef = useRef(null);

    const handleClick = () => {
        if (inputRef.current) {
            inputRef.current.showPicker?.();
        }
    };

    return (
        <div className={`custom-date-input-wrapper ${error ? 'error' : ''} ${className}`} onClick={handleClick}>
            <input
                ref={inputRef}
                id={id}
                type="date"
                value={value}
                onChange={onChange}
                min={min}
                className="custom-date-input"
                placeholder={placeholder}
            />
            <svg className="custom-date-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
        </div>
    );
};

// Custom Time Input Component - Wrapper for native time picker with beautiful styling
const CustomTimeInput = ({ id, value, onChange, error, className = '', placeholder = '' }) => {
    const inputRef = useRef(null);

    const handleClick = () => {
        if (inputRef.current) {
            inputRef.current.showPicker?.();
        }
    };

    return (
        <div className={`custom-time-input-wrapper ${error ? 'error' : ''} ${className}`} onClick={handleClick}>
            <input
                ref={inputRef}
                id={id}
                type="time"
                value={value}
                onChange={onChange}
                className="custom-time-input"
                placeholder={placeholder}
            />
            <svg className="custom-time-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        </div>
    );
};

// Custom Dropdown Component - Simplified with smooth animations
const CustomDropdown = ({ id, value, onChange, options, placeholder, error, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const menuRef = useRef(null);

    const selectedOption = options.find(opt => String(opt.value) === String(value)) || null;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            // Use capture phase to catch events before they bubble
            document.addEventListener('mousedown', handleClickOutside, true);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [isOpen]);

    const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const handleSelect = (option, e) => {
        e.preventDefault();
        e.stopPropagation();

        if (option.value === '' || option.value === null || option.value === undefined) {
            return; // Prevent selecting placeholder
        }

        // Call onChange directly with the value
        if (onChange) {
            onChange({ target: { value: option.value } });
        }

        setIsOpen(false);
    };

    // Filter out placeholder option (empty value) from display
    const displayOptions = options.filter(opt => opt.value !== '');

    return (
        <div className={`custom-dropdown-wrapper ${className} ${error ? 'error' : ''} ${isOpen ? 'open' : ''}`} ref={dropdownRef}>
            <button
                id={id}
                type="button"
                className={`custom-dropdown-trigger ${isOpen ? 'open' : ''} ${error ? 'error' : ''}`}
                onClick={handleToggle}
                aria-labelledby={id ? `${id}-label` : undefined}
                aria-expanded={isOpen}
            >
                <span className="custom-dropdown-value">
                    {selectedOption && String(selectedOption.value) !== '' ? selectedOption.label : placeholder}
                </span>
                <svg
                    className={`custom-dropdown-arrow ${isOpen ? 'open' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>
            {isOpen && (
                <div
                    ref={menuRef}
                    className="custom-dropdown-menu"
                    onMouseDown={(e) => e.preventDefault()} // Prevent blur
                >
                    {displayOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`custom-dropdown-option ${String(value) === String(option.value) ? 'selected' : ''}`}
                            onClick={(e) => handleSelect(option, e)}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelect(option, e);
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// Mock data has been removed - using real API data only
const MOCK_CANDIDATES = [];

const CandidateManagement = ({ currentUser, showToast, showConfirm, onNavigate }) => {
    const [candidates, setCandidates] = useState([]);
    const [allCandidates, setAllCandidates] = useState([]); // Store all candidates for counting
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [isManagerSelectModalOpen, setIsManagerSelectModalOpen] = useState(false);
    const [managers, setManagers] = useState([]);
    const [selectedManagerId, setSelectedManagerId] = useState('');
    const [indirectManagers, setIndirectManagers] = useState([]);
    const [selectedIndirectManagerId, setSelectedIndirectManagerId] = useState('');
    const [interviewDate, setInterviewDate] = useState('');
    const [interviewTime, setInterviewTime] = useState('');
    const [interviewFormErrors, setInterviewFormErrors] = useState({});
    const [useMockData, setUseMockData] = useState(false); // Flag to use mock data for preview - DISABLED
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [candidateNotes, setCandidateNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [interviewRequest, setInterviewRequest] = useState(null);
    const [loadingInterviewRequest, setLoadingInterviewRequest] = useState(false);
    const [isEvaluationDetailModalOpen, setIsEvaluationDetailModalOpen] = useState(false);
    const [evaluationDetails, setEvaluationDetails] = useState(null);
    const [loadingEvaluationDetails, setLoadingEvaluationDetails] = useState(false);
    const [isJobOfferModalOpen, setIsJobOfferModalOpen] = useState(false);
    const [jobOfferFormData, setJobOfferFormData] = useState({
        // Section 1: Thông tin Ứng viên & Vị trí
        applicantName: '',
        dateOfBirth: '',
        position: '',
        department: '',
        directReportTo: '',
        indirectReportTo: '',
        workLocation: '',
        ngayCapCCCD: '',
        noiCapCCCD: '',
        diaChiTamTru: '',
        // Section 2: Thời gian & Mức Lương (Gross)
        startDate: '',
        probationDays: '60',
        workingHours: '08:30 - 17:30 (T2-T6)',
        probationGrossSalary: '',
        officialGrossSalary: '',
        // Section 3: Chính sách Phụ cấp & Ngày nghỉ
        phoneAllowance: '',
        annualLeaveDays: '12',
        // Section 4: Mô tả Công việc Chính
        jobDuties: ['', '']
    });
    const [showPreview, setShowPreview] = useState(false);
    const [formattedLetter, setFormattedLetter] = useState('');
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [jobOfferFormErrors, setJobOfferFormErrors] = useState({});
    const [formData, setFormData] = useState({
        hoTen: '',
        gioiTinh: '',
        ngaySinh: '',
        noiSinh: '',
        tinhTrangHonNhan: '',
        danToc: '',
        quocTich: '',
        tonGiao: '',
        viTriUngTuyen: '',
        phongBan: '',
        soDienThoai: '',
        soDienThoaiKhac: '',
        email: '',
        cccd: '',
        ngayCapCCCD: '',
        noiCapCCCD: '',
        nguyenQuan: '',
        diaChiTamTru: '',
        trinhDoVanHoa: '',
        trinhDoChuyenMon: '',
        chuyenNganh: '',
        ngayGuiCV: '',
        cvFile: null
    });
    const [kinhNghiemLamViec, setKinhNghiemLamViec] = useState([
        { ngayBatDau: '', ngayKetThuc: '', congTy: '', chucDanh: '' }
    ]);
    const [quaTrinhDaoTao, setQuaTrinhDaoTao] = useState([
        { ngayBatDau: '', ngayKetThuc: '', truongDaoTao: '', chuyenNganhDaoTao: '', vanBangChungChi: '' }
    ]);
    const [trinhDoNgoaiNgu, setTrinhDoNgoaiNgu] = useState([
        { ngoaiNgu: '', chungChi: '', diem: '', khaNangSuDung: '' }
    ]);

    // Handle kinh nghiệm làm việc
    const handleKinhNghiemChange = (index, field, value) => {
        setKinhNghiemLamViec(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleAddKinhNghiem = () => {
        setKinhNghiemLamViec(prev => [
            ...prev,
            { ngayBatDau: '', ngayKetThuc: '', congTy: '', chucDanh: '' }
        ]);
    };

    const handleRemoveKinhNghiem = (index) => {
        if (kinhNghiemLamViec.length > 1) {
            setKinhNghiemLamViec(prev => prev.filter((_, i) => i !== index));
        }
    };

    // Handle quá trình đào tạo
    const handleQuaTrinhDaoTaoChange = (index, field, value) => {
        setQuaTrinhDaoTao(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleAddQuaTrinhDaoTao = () => {
        setQuaTrinhDaoTao(prev => [
            ...prev,
            { ngayBatDau: '', ngayKetThuc: '', truongDaoTao: '', chuyenNganhDaoTao: '', vanBangChungChi: '' }
        ]);
    };

    // Handle trình độ ngoại ngữ
    const handleTrinhDoNgoaiNguChange = (index, field, value) => {
        setTrinhDoNgoaiNgu(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleAddTrinhDoNgoaiNgu = () => {
        setTrinhDoNgoaiNgu(prev => [
            ...prev,
            { ngoaiNgu: '', chungChi: '', diem: '', khaNangSuDung: '' }
        ]);
    };
    const [formErrors, setFormErrors] = useState({});
    const [formLoading, setFormLoading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [isCandidatePreviewModalOpen, setIsCandidatePreviewModalOpen] = useState(false);
    const [isRecruitmentRequestsModalOpen, setIsRecruitmentRequestsModalOpen] = useState(false);
    const [recruitmentRequests, setRecruitmentRequests] = useState([]);
    const [loadingRecruitmentRequests, setLoadingRecruitmentRequests] = useState(false);
    const [selectedRecruitmentRequest, setSelectedRecruitmentRequest] = useState(null);
    const [isRecruitmentRequestDetailModalOpen, setIsRecruitmentRequestDetailModalOpen] = useState(false);
    const [previousCandidateStatuses, setPreviousCandidateStatuses] = useState(new Map()); // Track previous statuses
    const pollingIntervalRef = useRef(null);
    const isInitialMount = useRef(true); // Track if this is the first mount

    const fetchCandidates = async (silent = false) => {
        // Only show loading spinner on initial mount or when explicitly needed
        // This prevents UI jumping when navigating back to the module
        if (!silent && isInitialMount.current) {
            setLoading(true);
            isInitialMount.current = false;
        }

        try {
            // Use mock data for preview
            if (useMockData) {
                // Filter mock data based on status and search
                let filtered = [...MOCK_CANDIDATES];

                if (selectedStatus !== 'all') {
                    filtered = filtered.filter(c => c.status === selectedStatus);
                }

                if (searchQuery && searchQuery.trim()) {
                    const query = searchQuery.toLowerCase();
                    filtered = filtered.filter(c =>
                        c.ho_ten.toLowerCase().includes(query) ||
                        c.so_dien_thoai.includes(query) ||
                        c.cccd.includes(query) ||
                        c.vi_tri_ung_tuyen.toLowerCase().includes(query)
                    );
                }

                setCandidates(filtered);
                setAllCandidates(MOCK_CANDIDATES);
                setLoading(false);
                return;
            }

            // Fetch filtered candidates and all candidates in parallel for better performance
            const [response, allResponse] = await Promise.all([
                candidatesAPI.getAll({
                    status: selectedStatus,
                    search: searchQuery
                }),
                candidatesAPI.getAll({
                    status: 'all',
                    search: ''
                })
            ]);

            if (response.data.success) {
                setCandidates(response.data.data || []);
            } else {
                throw new Error(response.data.message || 'Lỗi khi tải danh sách ứng viên');
            }

            if (allResponse.data.success) {
                const allCandidatesData = allResponse.data.data || [];

                // Status change tracking removed - notifications now handled by FloatingNotificationBell
                // No toast notifications needed as they appear in the notification bell

                // Update allCandidates AFTER checking for changes
                setAllCandidates(allCandidatesData);

                // Update previous statuses map AFTER checking for changes
                const newStatusMap = new Map();
                allCandidatesData.forEach(candidate => {
                    newStatusMap.set(candidate.id, candidate.status);
                });
                setPreviousCandidateStatuses(newStatusMap);
            }
        } catch (error) {
            console.error('Error fetching candidates:', error);
            if (showToast) {
                const message = error.response?.data?.message || 'Không thể tải danh sách ứng viên';
                showToast(message, 'error');
            }
            setCandidates([]);
            setAllCandidates([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch recruitment requests
    const fetchRecruitmentRequests = async () => {
        setLoadingRecruitmentRequests(true);
        try {
            const response = await candidatesAPI.getAllRecruitmentRequests({});
            if (response.data?.success) {
                setRecruitmentRequests(response.data.data || []);
            } else {
                throw new Error(response.data?.message || 'Lỗi khi tải danh sách yêu cầu tuyển dụng');
            }
        } catch (error) {
            console.error('Error fetching recruitment requests:', error);
            if (showToast) {
                const message = error.response?.data?.message || 'Không thể tải danh sách yêu cầu tuyển dụng';
                showToast(message, 'error');
            }
            setRecruitmentRequests([]);
        } finally {
            setLoadingRecruitmentRequests(false);
        }
    };

    // Fetch recruitment request details
    const handleViewRecruitmentRequestDetails = async (requestId) => {
        try {
            const response = await candidatesAPI.getRecruitmentRequestById(requestId);
            if (response.data?.success) {
                setSelectedRecruitmentRequest(response.data.data);
                setIsRecruitmentRequestDetailModalOpen(true);
            } else {
                throw new Error(response.data?.message || 'Không thể tải chi tiết yêu cầu');
            }
        } catch (error) {
            console.error('Error fetching recruitment request details:', error);
            if (showToast) {
                showToast(error.response?.data?.message || 'Không thể tải chi tiết yêu cầu', 'error');
            }
        }
    };

    // Initial fetch on mount
    useEffect(() => {
        fetchCandidates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch recruitment requests count on mount
    useEffect(() => {
        fetchRecruitmentRequests();
    }, []);

    // Fetch khi status filter thay đổi (silent if has data)
    useEffect(() => {
        if (!isInitialMount.current) {
            const hasData = candidates.length > 0 || allCandidates.length > 0;
            fetchCandidates(hasData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStatus]);

    // Fetch lại khi search query thay đổi (với debounce, silent if has data)
    useEffect(() => {
        if (!isInitialMount.current) {
            const timer = setTimeout(() => {
                const hasData = candidates.length > 0 || allCandidates.length > 0;
                fetchCandidates(hasData);
            }, 300);

            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    // Fetch managers and employees when manager select modal opens
    useEffect(() => {
        if (isManagerSelectModalOpen) {
            fetchManagers();
            fetchIndirectManagers();
            // Reset form when modal opens
            setSelectedManagerId('');
            setSelectedIndirectManagerId('');
            setInterviewDate('');
            setInterviewTime('');
            setInterviewFormErrors({});
        }
    }, [isManagerSelectModalOpen]);

    // Poll for candidate status updates (only for HR users)
    useEffect(() => {
        if (currentUser?.role !== 'HR') {
            return;
        }

        // Set up polling every 10 seconds for faster notifications (silent refresh)
        pollingIntervalRef.current = setInterval(() => {
            fetchCandidates(true); // Silent refresh to avoid UI jumping
        }, 10000); // Poll every 10 seconds

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.role]);

    // Calculate counts for each status
    const getStatusCount = (statusKey) => {
        // Always use allCandidates for accurate counts (not filtered by search or status)
        if (statusKey === 'all') {
            return allCandidates.length;
        }
        return allCandidates.filter(c => c.status === statusKey).length;
    };

    const statusFilters = [
        { key: 'all', label: 'Tất cả', color: '#64748b', rgb: '100, 116, 139' },
        { key: 'PENDING_INTERVIEW', label: 'Chờ Phỏng vấn', color: '#FF6B35', rgb: '255, 107, 53' },
        { key: 'PENDING_MANAGER', label: 'Đang chờ quản lý phỏng vấn', color: '#F59E0B', rgb: '245, 158, 11' },
        { key: 'PASSED', label: 'Đã Đậu', color: '#10B981', rgb: '16, 185, 129' },
        { key: 'FAILED', label: 'Đã Rớt', color: '#EF4444', rgb: '239, 68, 68' }
    ];

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

    /* I. MÀU ACCENT VÀ PHÂN CẤP (Color Hierarchy) */
    const statusConfig = {
        /* Đang Active/Chờ Duyệt: Amber (bg-amber-100 / text-amber-700) - Thu hút sự chú ý, báo hiệu công việc đang cần xử lý */
        PENDING_INTERVIEW: {
            label: 'Chờ PV',
            bgColor: '#fef3c7', // bg-amber-100
            textColor: '#b45309', // text-amber-700
            borderColor: '#fbbf24' // amber-400
        },
        PENDING_MANAGER: {
            label: 'Đang chờ',
            bgColor: '#fef3c7', // bg-amber-100
            textColor: '#b45309', // text-amber-700
            borderColor: '#fbbf24' // amber-400
        },
        /* Active/Primary: Blue (bg-blue-600 / text-white) - Thẻ Hành động chính, trạng thái thành công */
        PASSED: {
            label: 'Đã Đậu',
            bgColor: '#2563eb', // bg-blue-600
            textColor: '#ffffff', // text-white
            borderColor: '#1e40af' // blue-700
        },
        /* Inactive/Neutral: Gray (bg-gray-200 / text-gray-500) - Các trạng thái đã qua, đã xử lý, hoặc không cần ưu tiên ngay lập tức */
        FAILED: {
            label: 'Rớt PV',
            bgColor: '#e5e7eb', // bg-gray-200
            textColor: '#6b7280', // text-gray-500
            borderColor: '#d1d5db' // gray-300
        }
    };

    const formatDateDisplay = (value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Helper functions to get label from value
    const getViTriLabel = (value) => {
        if (!value) return '';
        const option = viTriOptions.find(opt => opt.value === value);
        return option ? option.label : value;
    };

    const getPhongBanLabel = (value) => {
        if (!value) return '';
        const option = phongBanOptions.find(opt => opt.value === value);
        return option ? option.label : value;
    };

    // Filtering is now done on the backend

    const handleStatusChange = async (candidateId, newStatus) => {
        try {
            // If using mock data, just update local state
            if (useMockData) {
                setCandidates(prev => prev.map(c =>
                    c.id === candidateId ? { ...c, status: newStatus } : c
                ));
                setAllCandidates(prev => prev.map(c =>
                    c.id === candidateId ? { ...c, status: newStatus } : c
                ));
                if (showToast) {
                    showToast('Đã cập nhật trạng thái ứng viên (Mock)', 'success');
                }
                return;
            }

            const response = await candidatesAPI.updateStatus(candidateId, { status: newStatus });

            if (response.data.success) {
                setCandidates(prev => prev.map(c =>
                    c.id === candidateId ? { ...c, status: newStatus } : c
                ));
                // Update allCandidates to keep counts accurate
                setAllCandidates(prev => prev.map(c =>
                    c.id === candidateId ? { ...c, status: newStatus } : c
                ));

                if (showToast) {
                    showToast('Đã cập nhật trạng thái ứng viên', 'success');
                }
            } else {
                throw new Error(response.data.message || 'Lỗi khi cập nhật trạng thái');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            if (showToast) {
                const message = error.response?.data?.message || 'Không thể cập nhật trạng thái';
                showToast(message, 'error');
            }
        }
    };

    const handleDelete = async (candidateId, skipConfirmation = false) => {
        if (!skipConfirmation) {
            if (!showConfirm) {
                // Fallback to browser confirm if showConfirm is not available
                if (!window.confirm('Bạn có chắc chắn muốn xóa ứng viên này?')) {
                    return;
                }
            } else {
                const confirmed = await showConfirm({
                    title: 'Xác nhận xóa ứng viên',
                    message: 'Bạn có chắc chắn muốn xóa ứng viên này? Hành động này không thể hoàn tác.',
                    confirmText: 'Xóa',
                    cancelText: 'Hủy',
                    type: 'danger'
                });

                if (!confirmed) {
                    return;
                }
            }
        }

        try {
            // If using mock data, just update local state
            if (useMockData) {
                setCandidates(prev => prev.filter(c => c.id !== candidateId));
                setAllCandidates(prev => prev.filter(c => c.id !== candidateId));
                if (showToast) {
                    showToast('Đã xóa ứng viên (Mock)', 'success');
                }
                return;
            }

            const response = await candidatesAPI.delete(candidateId);

            if (response.data.success) {
                setCandidates(prev => prev.filter(c => c.id !== candidateId));
                // Update allCandidates to keep counts accurate
                setAllCandidates(prev => prev.filter(c => c.id !== candidateId));

                if (showToast) {
                    showToast('Đã xóa ứng viên', 'success');
                }
            } else {
                throw new Error(response.data.message || 'Lỗi khi xóa ứng viên');
            }
        } catch (error) {
            console.error('Error deleting candidate:', error);
            if (showToast) {
                const message = error.response?.data?.message || 'Không thể xóa ứng viên';
                showToast(message, 'error');
            }
        }
    };

    // Modal form handlers
    const handleModalOpen = () => {
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setFormData({
            hoTen: '',
            gioiTinh: '',
            ngaySinh: '',
            noiSinh: '',
            tinhTrangHonNhan: '',
            danToc: '',
            quocTich: '',
            tonGiao: '',
            viTriUngTuyen: '',
            phongBan: '',
            soDienThoai: '',
            soDienThoaiKhac: '',
            email: '',
            cccd: '',
            ngayCapCCCD: '',
            noiCapCCCD: '',
            nguyenQuan: '',
            diaChiTamTru: '',
            trinhDoVanHoa: '',
            trinhDoChuyenMon: '',
            chuyenNganh: '',
            ngayGuiCV: '',
            cvFile: null
        });
        setKinhNghiemLamViec([
            { ngayBatDau: '', ngayKetThuc: '', congTy: '', chucDanh: '' }
        ]);
        setQuaTrinhDaoTao([
            { ngayBatDau: '', ngayKetThuc: '', truongDaoTao: '', chuyenNganhDaoTao: '', vanBangChungChi: '' }
        ]);
        setTrinhDoNgoaiNgu([
            { ngoaiNgu: '', chungChi: '', diem: '', khaNangSuDung: '' }
        ]);
        setFormErrors({});
        setDragActive(false);
    };

    const handleActionModalClose = () => {
        setIsActionModalOpen(false);
        setSelectedCandidate(null);
        setIsEditingNotes(false);
        setCandidateNotes('');
        setInterviewRequest(null);
    };

    // Fetch interview request when candidate modal opens
    useEffect(() => {
        const fetchInterviewRequest = async () => {
            if (selectedCandidate && isActionModalOpen && (selectedCandidate.status === 'PENDING_MANAGER' || selectedCandidate.status === 'PASSED')) {
                setLoadingInterviewRequest(true);
                try {
                    const response = await candidatesAPI.getInterviewRequests({});
                    if (response.data?.success && Array.isArray(response.data.data)) {
                        // Find the most recent interview request for this candidate
                        const requests = response.data.data.filter(
                            r => r.candidate_id === selectedCandidate.id
                        );
                        // Sort by created_at descending to get the most recent
                        requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                        const request = requests[0] || null;
                        setInterviewRequest(request);
                    } else {
                        setInterviewRequest(null);
                    }
                } catch (error) {
                    console.error('Error fetching interview request:', error);
                    setInterviewRequest(null);
                } finally {
                    setLoadingInterviewRequest(false);
                }
            } else {
                setInterviewRequest(null);
            }
        };

        fetchInterviewRequest();
    }, [selectedCandidate, isActionModalOpen]);

    // Load evaluation details
    const loadEvaluationDetails = (request) => {
        if (!request) return;

        let directEvaluation = null;
        let indirectEvaluation = null;

        // Parse direct manager evaluation
        if (request.direct_manager_evaluated && request.direct_manager_evaluation_data) {
            try {
                directEvaluation = typeof request.direct_manager_evaluation_data === 'string'
                    ? JSON.parse(request.direct_manager_evaluation_data)
                    : request.direct_manager_evaluation_data;
            } catch (e) {
                console.error('Error parsing direct manager evaluation:', e);
            }
        }

        // Parse indirect manager evaluation
        if (request.indirect_manager_id && request.indirect_manager_evaluated && request.indirect_manager_evaluation_data) {
            try {
                indirectEvaluation = typeof request.indirect_manager_evaluation_data === 'string'
                    ? JSON.parse(request.indirect_manager_evaluation_data)
                    : request.indirect_manager_evaluation_data;
            } catch (e) {
                console.error('Error parsing indirect manager evaluation:', e);
            }
        }

        setEvaluationDetails({
            directManager: {
                name: request.manager_name,
                evaluation: directEvaluation
            },
            indirectManager: request.indirect_manager_id ? {
                name: request.indirect_manager_name,
                evaluation: indirectEvaluation
            } : null
        });

        setIsEvaluationDetailModalOpen(true);
    };

    // Calculate average scores
    const calculateAverageScores = () => {
        if (!evaluationDetails) return null;

        const directCriteria = evaluationDetails.directManager?.evaluation?.criteria || [];
        const indirectCriteria = evaluationDetails.indirectManager?.evaluation?.criteria || [];

        if (directCriteria.length === 0 && indirectCriteria.length === 0) return null;

        const averages = [];
        const criterionNames = [
            'Kỹ năng Giao tiếp',
            'Thái độ Làm việc',
            'Kỹ năng Chuyên môn',
            'Khả năng Hợp tác',
            'Tiềm năng Phát triển'
        ];

        for (let i = 0; i < 5; i++) {
            const directScore = directCriteria[i]?.score ? parseFloat(directCriteria[i].score) : null;
            const indirectScore = indirectCriteria[i]?.score ? parseFloat(indirectCriteria[i].score) : null;

            let average = null;
            if (directScore !== null && indirectScore !== null) {
                average = ((directScore + indirectScore) / 2).toFixed(1);
            } else if (directScore !== null) {
                average = directScore.toFixed(1);
            } else if (indirectScore !== null) {
                average = indirectScore.toFixed(1);
            }

            averages.push({
                name: criterionNames[i],
                directScore,
                indirectScore,
                average: average ? parseFloat(average) : null,
                directComment: directCriteria[i]?.comment || '',
                indirectComment: indirectCriteria[i]?.comment || ''
            });
        }

        return averages;
    };

    const handleEditNotes = () => {
        if (selectedCandidate) {
            setCandidateNotes(selectedCandidate.notes || '');
            setIsEditingNotes(true);
        }
    };

    const handleCancelEditNotes = () => {
        setIsEditingNotes(false);
        setCandidateNotes(selectedCandidate?.notes || '');
    };

    const handleSaveNotes = async () => {
        if (!selectedCandidate) return;

        setIsSavingNotes(true);
        try {
            const response = await candidatesAPI.updateNotes(selectedCandidate.id, {
                notes: candidateNotes.trim() || null
            });

            if (response.data.success) {
                if (showToast) {
                    showToast('Đã cập nhật ghi chú', 'success');
                }
                setIsEditingNotes(false);
                // Update selected candidate with new notes
                setSelectedCandidate({
                    ...selectedCandidate,
                    notes: response.data.data.notes
                });
                // Refresh candidates list to update notes
                fetchCandidates();
            } else {
                throw new Error(response.data.message || 'Lỗi khi cập nhật ghi chú');
            }
        } catch (error) {
            console.error('Error updating notes:', error);
            if (showToast) {
                const message = error.response?.data?.message || 'Không thể cập nhật ghi chú';
                showToast(message, 'error');
            }
        } finally {
            setIsSavingNotes(false);
        }
    };

    const handleActionStatusChange = async (newStatus) => {
        if (!selectedCandidate) return;

        // If moving to interview, open manager selection modal
        if (newStatus === 'PASSED' && selectedCandidate.status === 'PENDING_INTERVIEW') {
            setIsManagerSelectModalOpen(true);
            return;
        }

        // Otherwise, directly update status
        await handleStatusChange(selectedCandidate.id, newStatus);
        handleActionModalClose();
    };

    const fetchManagers = async () => {
        try {
            const response = await candidatesAPI.getManagers();
            if (response.data.success) {
                setManagers(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching managers:', error);
            if (showToast) {
                showToast('Không thể tải danh sách quản lý', 'error');
            }
        }
    };

    const fetchIndirectManagers = async () => {
        try {
            const response = await employeesAPI.getAll();
            if (response.data.success) {
                // Lấy danh sách nhân viên có quan_ly_gian_tiep (quản lý gián tiếp)
                // Filter để chỉ lấy những người là quản lý gián tiếp của ai đó
                const employees = response.data.data || [];
                // Lấy unique danh sách quản lý gián tiếp từ quan_ly_gian_tiep
                const indirectManagerNames = [...new Set(employees
                    .map(emp => emp.quan_ly_gian_tiep || emp.quanLyGianTiep)
                    .filter(name => name && name.trim()))];

                // Tìm các nhân viên có tên trong danh sách quản lý gián tiếp
                const indirectManagerList = employees.filter(emp =>
                    indirectManagerNames.includes(emp.ho_ten || emp.hoTen)
                );

                setIndirectManagers(indirectManagerList);
            }
        } catch (error) {
            console.error('Error fetching indirect managers:', error);
            // Don't show toast for indirect managers - it's optional
        }
    };

    const validateInterviewForm = () => {
        const errors = {};

        if (!selectedManagerId) {
            errors.selectedManagerId = 'Vui lòng chọn quản lý trực tiếp';
        }

        if (!interviewDate) {
            errors.interviewDate = 'Vui lòng chọn ngày phỏng vấn';
        }

        if (!interviewTime) {
            errors.interviewTime = 'Vui lòng chọn giờ phỏng vấn';
        }

        setInterviewFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateInterviewRequest = async () => {
        if (!selectedCandidate) {
            if (showToast) {
                showToast('Không tìm thấy ứng viên', 'error');
            }
            return;
        }

        if (!validateInterviewForm()) {
            if (showToast) {
                showToast('Vui lòng điền đầy đủ thông tin phỏng vấn', 'error');
            }
            return;
        }

        const selectedManager = managers.find(m => m.id === parseInt(selectedManagerId));
        if (!selectedManager) {
            if (showToast) {
                showToast('Quản lý trực tiếp không hợp lệ', 'error');
            }
            return;
        }

        let indirectManagerName = null;
        if (selectedIndirectManagerId) {
            const selectedIndirectManager = indirectManagers.find(m =>
                m.id === parseInt(selectedIndirectManagerId) ||
                String(m.id) === String(selectedIndirectManagerId)
            );
            if (selectedIndirectManager) {
                indirectManagerName = selectedIndirectManager.ho_ten || selectedIndirectManager.hoTen;
            }
        }

        // Format date and time
        const interviewDateTime = interviewDate && interviewTime
            ? `${interviewDate}T${interviewTime}:00`
            : null;

        try {
            const response = await candidatesAPI.createInterviewRequest(selectedCandidate.id, {
                managerId: selectedManager.id,
                managerName: selectedManager.ho_ten,
                indirectManagerId: selectedIndirectManagerId ? parseInt(selectedIndirectManagerId) : null,
                indirectManagerName: indirectManagerName,
                interviewDate: interviewDate,
                interviewTime: interviewTime,
                interviewDateTime: interviewDateTime,
                notes: ''
            });

            if (response.data.success) {
                if (showToast) {
                    showToast('Đã gửi yêu cầu phỏng vấn thành công!', 'success');
                }
                setIsManagerSelectModalOpen(false);
                setSelectedManagerId('');
                setSelectedIndirectManagerId('');
                setInterviewDate('');
                setInterviewTime('');
                setInterviewFormErrors({});
                handleActionModalClose();
                fetchCandidates(); // Refresh candidates list
            } else {
                throw new Error(response.data.message || 'Lỗi khi tạo yêu cầu phỏng vấn');
            }
        } catch (error) {
            console.error('Error creating interview request:', error);
            if (showToast) {
                showToast(error.response?.data?.message || 'Lỗi khi tạo yêu cầu phỏng vấn', 'error');
            }
        }
    };

    const handleActionDelete = async () => {
        if (!selectedCandidate) return;

        const candidateName = selectedCandidate.hoTen || selectedCandidate.ho_ten || 'Ứng viên này';

        if (!showConfirm) {
            // Fallback to browser confirm if showConfirm is not available
            if (window.confirm(`Bạn có chắc chắn muốn xóa ứng viên "${candidateName}"?`)) {
                await handleDelete(selectedCandidate.id, true);
                handleActionModalClose();
            }
        } else {
            const confirmed = await showConfirm({
                title: 'Xác nhận xóa ứng viên',
                message: `Bạn có chắc chắn muốn xóa ứng viên "${candidateName}"? Hành động này không thể hoàn tác.`,
                confirmText: 'Xóa',
                cancelText: 'Hủy',
                type: 'danger'
            });

            if (confirmed) {
                await handleDelete(selectedCandidate.id, true);
                handleActionModalClose();
            }
        }
    };

    const handleViewCV = () => {
        if (!selectedCandidate) return;
        const cvPath = selectedCandidate.cvFilePath || selectedCandidate.cv_file_path;
        if (cvPath) {
            // Open CV in new tab
            window.open(`/api/candidates/cv/${cvPath}`, '_blank');
        } else {
            if (showToast) {
                showToast('Không tìm thấy file CV', 'error');
            }
        }
    };

    const handleFormInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        if (formErrors[field]) {
            setFormErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    const handleFormDateChange = (field, date) => {
        if (date) {
            const isoDate = formatDateToISO(date);
            handleFormInputChange(field, isoDate);
        } else {
            handleFormInputChange(field, '');
        }
    };

    const handleFormFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!allowedTypes.includes(file.type)) {
                setFormErrors(prev => ({
                    ...prev,
                    cvFile: 'Chỉ chấp nhận file PDF, DOC hoặc DOCX'
                }));
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setFormErrors(prev => ({
                    ...prev,
                    cvFile: 'Kích thước file không được vượt quá 5MB'
                }));
                return;
            }
            setFormData(prev => ({
                ...prev,
                cvFile: file
            }));
            if (formErrors.cvFile) {
                setFormErrors(prev => ({
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
                setFormErrors(prev => ({
                    ...prev,
                    cvFile: 'Chỉ chấp nhận file PDF, DOC hoặc DOCX'
                }));
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setFormErrors(prev => ({
                    ...prev,
                    cvFile: 'Kích thước file không được vượt quá 5MB'
                }));
                return;
            }
            setFormData(prev => ({
                ...prev,
                cvFile: file
            }));
            if (formErrors.cvFile) {
                setFormErrors(prev => ({
                    ...prev,
                    cvFile: ''
                }));
            }
        }
    };

    const validateModalForm = () => {
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

        setFormErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleModalSubmit = async (e) => {
        e.preventDefault();

        if (!validateModalForm()) {
            if (showToast) {
                showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
            }
            return;
        }

        setFormLoading(true);
        try {
            // If using mock data, just add to local state
            if (useMockData) {
                const newCandidate = {
                    id: Date.now(), // Temporary ID
                    ho_ten: formData.hoTen,
                    ngay_sinh: formData.ngaySinh,
                    vi_tri_ung_tuyen: formData.viTriUngTuyen,
                    phong_ban: formData.phongBan,
                    so_dien_thoai: formData.soDienThoai,
                    cccd: formData.cccd,
                    ngay_cap_cccd: formData.ngayCapCCCD,
                    noi_cap_cccd: formData.noiCapCCCD,
                    ngay_gui_cv: formData.ngayGuiCV,
                    status: 'PENDING_INTERVIEW',
                    created_at: new Date().toISOString()
                };

                setCandidates(prev => [newCandidate, ...prev]);
                setAllCandidates(prev => [newCandidate, ...prev]);

                if (showToast) {
                    showToast('Đã lưu thông tin ứng viên thành công! (Mock)', 'success');
                }

                handleModalClose();
                setFormLoading(false);
                return;
            }

            const formDataToSend = new FormData();
            formDataToSend.append('hoTen', formData.hoTen);
            formDataToSend.append('gioiTinh', formData.gioiTinh || '');
            formDataToSend.append('ngaySinh', formData.ngaySinh);
            formDataToSend.append('noiSinh', formData.noiSinh || '');
            formDataToSend.append('tinhTrangHonNhan', formData.tinhTrangHonNhan || '');
            formDataToSend.append('danToc', formData.danToc || '');
            formDataToSend.append('quocTich', formData.quocTich || '');
            formDataToSend.append('tonGiao', formData.tonGiao || '');
            formDataToSend.append('viTriUngTuyen', formData.viTriUngTuyen);
            formDataToSend.append('phongBan', formData.phongBan);
            formDataToSend.append('soDienThoai', formData.soDienThoai);
            formDataToSend.append('soDienThoaiKhac', formData.soDienThoaiKhac || '');
            formDataToSend.append('email', formData.email || '');
            formDataToSend.append('cccd', formData.cccd);
            formDataToSend.append('ngayCapCCCD', formData.ngayCapCCCD);
            formDataToSend.append('noiCapCCCD', formData.noiCapCCCD);
            formDataToSend.append('nguyenQuan', formData.nguyenQuan || '');
            formDataToSend.append('diaChiTamTru', formData.diaChiTamTru || '');
            formDataToSend.append('trinhDoVanHoa', formData.trinhDoVanHoa || '');
            formDataToSend.append('trinhDoChuyenMon', formData.trinhDoChuyenMon || '');
            formDataToSend.append('chuyenNganh', formData.chuyenNganh || '');
            formDataToSend.append('ngayGuiCV', formData.ngayGuiCV);
            formDataToSend.append('kinhNghiemLamViec', JSON.stringify(kinhNghiemLamViec));
            formDataToSend.append('quaTrinhDaoTao', JSON.stringify(quaTrinhDaoTao));
            formDataToSend.append('trinhDoNgoaiNgu', JSON.stringify(trinhDoNgoaiNgu));

            if (formData.cvFile) {
                formDataToSend.append('cvFile', formData.cvFile);
            }

            await candidatesAPI.create(formDataToSend);

            if (showToast) {
                showToast('Đã lưu thông tin ứng viên thành công!', 'success');
            }

            // Reset form and close modal
            handleModalClose();

            // Refresh candidates list (will update both filtered and all candidates)
            await fetchCandidates();
        } catch (error) {
            console.error('Error saving candidate:', error);
            if (showToast) {
                const message = error.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin ứng viên';
                showToast(message, 'error');
            }
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <div className="candidate-management">
            {/* Header */}
            <div className="candidate-management-header">
                <div className="candidate-management-header-top">
                    <div className="candidate-management-header-content">
                        <div className="candidate-management-icon-wrapper">
                            <svg className="candidate-management-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {/* Icon Giấy tờ/Hồ sơ */}
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </div>
                        <div>
                            <h1 className="candidate-management-title">Quản lý Ứng viên</h1>
                            <p className="candidate-management-subtitle">
                                Xem, phân loại, tìm kiếm và cập nhật trạng thái hồ sơ ứng viên.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className={`candidate-management-add-btn ${isModalOpen ? 'modal-open' : ''}`}
                        onClick={isModalOpen ? handleModalClose : handleModalOpen}
                    >
                        <svg className="candidate-add-icon" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
                            <path className="icon-plus" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" stroke="#ffffff" d="M12 4v16m8-8H4"></path>
                            <path className="icon-x" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" stroke="#ffffff" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                        <span>{isModalOpen ? 'Đóng' : 'Thêm ứng viên'}</span>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="candidate-management-search">
                    <svg className="candidate-management-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <input
                        type="text"
                        className="candidate-management-search-input"
                        placeholder="Tìm kiếm theo tên, SĐT, CCCD, vị trí..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Filter Tabs */}
                <div className="candidate-management-filters">
                    {statusFilters.map(filter => {
                        const count = getStatusCount(filter.key);
                        return (
                            <button
                                key={filter.key}
                                type="button"
                                className={`candidate-management-filter-tab ${selectedStatus === filter.key ? 'active' : ''}`}
                                onClick={() => setSelectedStatus(filter.key)}
                                style={selectedStatus === filter.key ? {
                                    '--filter-color': filter.color,
                                    '--filter-color-rgb': filter.rgb
                                } : {}}
                            >
                                <span>{filter.label}</span>
                                <span className="candidate-management-filter-count">
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                    
                    {/* Recruitment Requests Tag - Separate but on same row */}
                    <div className="candidate-management-filters-separator"></div>
                    <button
                        type="button"
                        className="candidate-management-recruitment-requests-btn"
                        onClick={() => {
                            setIsRecruitmentRequestsModalOpen(true);
                            fetchRecruitmentRequests();
                        }}
                    >
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        <span>Yêu cầu tuyển nhân viên</span>
                        {recruitmentRequests.length > 0 && (
                            <span className="candidate-management-recruitment-requests-count">
                                {recruitmentRequests.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="candidate-management-table-container">
                {loading ? (
                    <div className="candidate-management-loading">
                        <div className="candidate-management-spinner"></div>
                        <p>Đang tải dữ liệu...</p>
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="candidate-management-empty">
                        <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <p>Không tìm thấy ứng viên nào</p>
                    </div>
                ) : (
                    <table className="candidate-management-table">
                        <thead>
                            <tr>
                                <th>
                                    Họ tên
                                    <svg className="candidate-table-sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                                    </svg>
                                </th>
                                <th>
                                    Ngày sinh
                                    <svg className="candidate-table-sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                                    </svg>
                                </th>
                                <th>
                                    Vị trí ứng tuyển
                                    <svg className="candidate-table-sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                                    </svg>
                                </th>
                                <th>
                                    Phòng ban
                                    <svg className="candidate-table-sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                                    </svg>
                                </th>
                                <th>
                                    Số ĐT
                                    <svg className="candidate-table-sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                                    </svg>
                                </th>
                                <th>
                                    CCCD
                                    <svg className="candidate-table-sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                                    </svg>
                                </th>
                                <th>
                                    Ngày gửi CV
                                    <svg className="candidate-table-sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                                    </svg>
                                </th>
                                <th>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {candidates.map(candidate => {
                                const statusInfo = statusConfig[candidate.status] || statusConfig.PENDING_INTERVIEW;
                                // Normalize data - handle both snake_case (from API) and camelCase (from mock)
                                const normalized = {
                                    id: candidate.id,
                                    hoTen: candidate.hoTen || candidate.ho_ten || '',
                                    gioiTinh: candidate.gioiTinh || candidate.gioi_tinh || '',
                                    ngaySinh: candidate.ngaySinh || candidate.ngay_sinh || '',
                                    noiSinh: candidate.noiSinh || candidate.noi_sinh || '',
                                    tinhTrangHonNhan: candidate.tinhTrangHonNhan || candidate.tinh_trang_hon_nhan || '',
                                    danToc: candidate.danToc || candidate.dan_toc || '',
                                    quocTich: candidate.quocTich || candidate.quoc_tich || '',
                                    tonGiao: candidate.tonGiao || candidate.ton_giao || '',
                                    viTriUngTuyen: candidate.viTriUngTuyen || candidate.vi_tri_ung_tuyen || '',
                                    phongBan: candidate.phongBan || candidate.phong_ban || '',
                                    soDienThoai: candidate.soDienThoai || candidate.so_dien_thoai || '',
                                    soDienThoaiKhac: candidate.soDienThoaiKhac || candidate.so_dien_thoai_khac || '',
                                    email: candidate.email || '',
                                    cccd: candidate.cccd || '',
                                    ngayCapCCCD: candidate.ngayCapCCCD || candidate.ngay_cap_cccd || '',
                                    noiCapCCCD: candidate.noiCapCCCD || candidate.noi_cap_cccd || '',
                                    nguyenQuan: candidate.nguyenQuan || candidate.nguyen_quan || '',
                                    diaChiTamTru: candidate.diaChiTamTru || candidate.dia_chi_tam_tru || '',
                                    trinhDoVanHoa: candidate.trinhDoVanHoa || candidate.trinh_do_van_hoa || '',
                                    trinhDoChuyenMon: candidate.trinhDoChuyenMon || candidate.trinh_do_chuyen_mon || '',
                                    chuyenNganh: candidate.chuyenNganh || candidate.chuyen_nganh || '',
                                    kinhNghiemLamViec: candidate.kinhNghiemLamViec || candidate.kinh_nghiem_lam_viec || null,
                                    quaTrinhDaoTao: candidate.quaTrinhDaoTao || candidate.qua_trinh_dao_tao || null,
                                    trinhDoNgoaiNgu: candidate.trinhDoNgoaiNgu || candidate.trinh_do_ngoai_ngu || null,
                                    ngayGuiCV: candidate.ngayGuiCV || candidate.ngay_gui_cv || '',
                                    status: candidate.status,
                                    cvFilePath: candidate.cvFilePath || candidate.cv_file_path || '',
                                    cvFileName: candidate.cvFileName || candidate.cv_file_name || '',
                                    notes: candidate.notes || ''
                                };
                                return (
                                    <tr
                                        key={normalized.id}
                                        className="candidate-table-row"
                                        onClick={() => {
                                            setSelectedCandidate(normalized);
                                            setIsActionModalOpen(true);
                                        }}
                                    >
                                        <td className="candidate-name-cell">
                                            <strong>{normalized.hoTen}</strong>
                                        </td>
                                        <td>{formatDateDisplay(normalized.ngaySinh)}</td>
                                        <td>{getViTriLabel(normalized.viTriUngTuyen)}</td>
                                        <td>{getPhongBanLabel(normalized.phongBan)}</td>
                                        <td>{normalized.soDienThoai}</td>
                                        <td>{normalized.cccd || '-'}</td>
                                        <td>{formatDateDisplay(normalized.ngayGuiCV)}</td>
                                        <td className="candidate-status-cell">
                                            <span
                                                className="candidate-status-tag"
                                                style={{
                                                    backgroundColor: statusInfo.bgColor,
                                                    color: statusInfo.textColor,
                                                    borderColor: statusInfo.borderColor
                                                }}
                                            >
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Action Modal */}
            {isActionModalOpen && selectedCandidate && (
                <div className="candidate-action-modal-overlay" onClick={handleActionModalClose}>
                    <div className="candidate-action-modal-box" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="candidate-action-modal-header">
                            <div className="candidate-action-modal-title-wrapper">
                                <h2 className="candidate-action-modal-title">
                                    {selectedCandidate.hoTen}
                                </h2>
                                <span className="candidate-code-tag">
                                    UV{String(selectedCandidate.id).padStart(6, '0')}
                                </span>
                            </div>
                            <button
                                type="button"
                                className="candidate-action-modal-close"
                                onClick={handleActionModalClose}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="candidate-action-modal-content">
                            {/* Left Column - Candidate Info */}
                            <div className="candidate-action-modal-info">
                                <div className="candidate-info-cards">
                                    <div className="candidate-info-card">
                                        <div className="candidate-info-label">Họ tên</div>
                                        <div className="candidate-info-value candidate-info-value--highlight">{selectedCandidate.hoTen}</div>
                                    </div>
                                    <div className="candidate-info-card">
                                        <div className="candidate-info-label">Ngày sinh</div>
                                        <div className="candidate-info-value">{formatDateDisplay(selectedCandidate.ngaySinh)}</div>
                                    </div>
                                    <div className="candidate-info-card">
                                        <div className="candidate-info-label">Vị trí ứng tuyển</div>
                                        <div className="candidate-info-value candidate-info-value--highlight">{getViTriLabel(selectedCandidate.viTriUngTuyen)}</div>
                                    </div>
                                    <div className="candidate-info-card">
                                        <div className="candidate-info-label">Phòng ban</div>
                                        <div className="candidate-info-value">{getPhongBanLabel(selectedCandidate.phongBan)}</div>
                                    </div>
                                    <div className="candidate-info-card">
                                        <div className="candidate-info-label">Số điện thoại</div>
                                        <div className="candidate-info-value">{selectedCandidate.soDienThoai}</div>
                                    </div>
                                    <div className="candidate-info-card">
                                        <div className="candidate-info-label">CCCD</div>
                                        <div className="candidate-info-value">{selectedCandidate.cccd || '-'}</div>
                                    </div>
                                    <div className="candidate-info-card">
                                        <div className="candidate-info-label">Ngày cấp CCCD</div>
                                        <div className="candidate-info-value">{formatDateDisplay(selectedCandidate.ngayCapCCCD || selectedCandidate.ngay_cap_cccd)}</div>
                                    </div>
                                    <div className="candidate-info-card">
                                        <div className="candidate-info-label">Nơi cấp CCCD</div>
                                        <div className="candidate-info-value">{selectedCandidate.noiCapCCCD || selectedCandidate.noi_cap_cccd || '-'}</div>
                                    </div>
                                    <div className="candidate-info-card">
                                        <div className="candidate-info-label">Ngày gửi CV</div>
                                        <div className="candidate-info-value">{formatDateDisplay(selectedCandidate.ngayGuiCV)}</div>
                                    </div>
                                    <div className="candidate-info-card">
                                        <div className="candidate-info-label">Trạng thái</div>
                                        <div className="candidate-info-value">
                                            <span
                                                className="candidate-status-tag"
                                                style={{
                                                    backgroundColor: statusConfig[selectedCandidate.status]?.bgColor || 'rgba(255, 107, 53, 0.15)',
                                                    color: statusConfig[selectedCandidate.status]?.textColor || '#FF6B35',
                                                    borderColor: statusConfig[selectedCandidate.status]?.borderColor || 'rgba(255, 107, 53, 0.3)'
                                                }}
                                            >
                                                {statusConfig[selectedCandidate.status]?.label || 'Chờ PV'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="candidate-info-card">
                                        <div className="candidate-info-label">Địa chỉ tạm trú</div>
                                        <div className="candidate-info-value">{selectedCandidate.diaChiTamTru || selectedCandidate.dia_chi_tam_tru || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Vertical Divider */}
                            <div className="candidate-action-modal-divider"></div>

                            {/* Right Column - Actions */}
                            <div className="candidate-action-modal-actions">
                                <h3 className="candidate-action-modal-section-title">Thao tác</h3>
                                <div className="candidate-action-buttons">
                                    {/* Nút Chi tiết nhân viên - Hiển thị cho tất cả trạng thái */}
                                    <button
                                        type="button"
                                        className="candidate-action-modal-btn candidate-action-modal-primary"
                                        onClick={async () => {
                                            // Fetch full candidate data before opening preview
                                            try {
                                                const response = await candidatesAPI.getAll({});
                                                if (response.data?.success && Array.isArray(response.data.data)) {
                                                    const fullCandidate = response.data.data.find(c => {
                                                        const candidateId = parseInt(c.id, 10);
                                                        const targetId = parseInt(selectedCandidate.id, 10);
                                                        return candidateId === targetId;
                                                    });
                                                    if (fullCandidate) {
                                                        // Normalize full candidate data
                                                        const normalizedFullCandidate = {
                                                            ...selectedCandidate,
                                                            // Personal info
                                                            gioiTinh: fullCandidate.gioiTinh || fullCandidate.gioi_tinh || selectedCandidate.gioiTinh || '',
                                                            noiSinh: fullCandidate.noiSinh || fullCandidate.noi_sinh || selectedCandidate.noiSinh || '',
                                                            tinhTrangHonNhan: fullCandidate.tinhTrangHonNhan || fullCandidate.tinh_trang_hon_nhan || selectedCandidate.tinhTrangHonNhan || '',
                                                            danToc: fullCandidate.danToc || fullCandidate.dan_toc || selectedCandidate.danToc || '',
                                                            quocTich: fullCandidate.quocTich || fullCandidate.quoc_tich || selectedCandidate.quocTich || '',
                                                            tonGiao: fullCandidate.tonGiao || fullCandidate.ton_giao || selectedCandidate.tonGiao || '',
                                                            // Contact info
                                                            soDienThoaiKhac: fullCandidate.soDienThoaiKhac || fullCandidate.so_dien_thoai_khac || selectedCandidate.soDienThoaiKhac || '',
                                                            email: fullCandidate.email || selectedCandidate.email || '',
                                                            // CCCD info
                                                            nguyenQuan: fullCandidate.nguyenQuan || fullCandidate.nguyen_quan || selectedCandidate.nguyenQuan || '',
                                                            // Education
                                                            trinhDoVanHoa: fullCandidate.trinhDoVanHoa || fullCandidate.trinh_do_van_hoa || selectedCandidate.trinhDoVanHoa || '',
                                                            trinhDoChuyenMon: fullCandidate.trinhDoChuyenMon || fullCandidate.trinh_do_chuyen_mon || selectedCandidate.trinhDoChuyenMon || '',
                                                            chuyenNganh: fullCandidate.chuyenNganh || fullCandidate.chuyen_nganh || selectedCandidate.chuyenNganh || '',
                                                            // JSONB arrays
                                                            kinhNghiemLamViec: fullCandidate.kinhNghiemLamViec || fullCandidate.kinh_nghiem_lam_viec || selectedCandidate.kinhNghiemLamViec || null,
                                                            quaTrinhDaoTao: fullCandidate.quaTrinhDaoTao || fullCandidate.qua_trinh_dao_tao || selectedCandidate.quaTrinhDaoTao || null,
                                                            trinhDoNgoaiNgu: fullCandidate.trinhDoNgoaiNgu || fullCandidate.trinh_do_ngoai_ngu || selectedCandidate.trinhDoNgoaiNgu || null,
                                                        };
                                                        setSelectedCandidate(normalizedFullCandidate);
                                                    }
                                                }
                                            } catch (error) {
                                                console.error('Error fetching full candidate data:', error);
                                            }
                                            setIsCandidatePreviewModalOpen(true);
                                        }}
                                    >
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                        </svg>
                                        <span>Chi tiết nhân viên</span>
                                    </button>
                                    {/* Trạng thái: Đang chờ quản lý phỏng vấn - Hiển thị status card */}
                                    {selectedCandidate.status === 'PENDING_MANAGER' && interviewRequest && (
                                        <div className="candidate-evaluation-status-cards">
                                            <div className={`candidate-evaluation-status-card ${interviewRequest.direct_manager_evaluated ? 'evaluated' : 'pending'}`}>
                                                <div className="candidate-evaluation-status-icon">
                                                    {interviewRequest.direct_manager_evaluated ? (
                                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                        </svg>
                                                    ) : (
                                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="candidate-evaluation-status-text">
                                                    <span className="candidate-evaluation-status-label">
                                                        Quản lý trực tiếp: {interviewRequest.manager_name || 'Chưa xác định'}
                                                    </span>
                                                    <span className="candidate-evaluation-status-value">
                                                        {interviewRequest.direct_manager_evaluated ? 'Đã đánh giá' : 'Chờ đánh giá'}
                                                    </span>
                                                </div>
                                            </div>
                                            {interviewRequest.indirect_manager_id && (
                                                <div className={`candidate-evaluation-status-card ${interviewRequest.indirect_manager_evaluated ? 'evaluated' : 'pending'}`}>
                                                    <div className="candidate-evaluation-status-icon">
                                                        {interviewRequest.indirect_manager_evaluated ? (
                                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                            </svg>
                                                        ) : (
                                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div className="candidate-evaluation-status-text">
                                                        <span className="candidate-evaluation-status-label">
                                                            Quản lý gián tiếp: {interviewRequest.indirect_manager_name || 'Chưa xác định'}
                                                        </span>
                                                        <span className="candidate-evaluation-status-value">
                                                            {interviewRequest.indirect_manager_evaluated ? 'Đã đánh giá' : 'Chờ đánh giá'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            {interviewRequest.direct_manager_evaluated &&
                                                (!interviewRequest.indirect_manager_id || interviewRequest.indirect_manager_evaluated) && (
                                                    <div className="candidate-evaluation-status-card evaluated completed">
                                                        <div className="candidate-evaluation-status-icon">
                                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                            </svg>
                                                        </div>
                                                        <div className="candidate-evaluation-status-text">
                                                            <span className="candidate-evaluation-status-label">Trạng thái</span>
                                                            <span className="candidate-evaluation-status-value">Đã xong</span>
                                                        </div>
                                                    </div>
                                                )}
                                        </div>
                                    )}
                                    {/* Fallback: Nếu chưa có interview request */}
                                    {selectedCandidate.status === 'PENDING_MANAGER' && !interviewRequest && !loadingInterviewRequest && (
                                        <div className="candidate-waiting-notification">
                                            <svg className="candidate-warning-icon blinking" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                            </svg>
                                            <span className="candidate-waiting-message">Đang chờ quản lý phỏng vấn</span>
                                        </div>
                                    )}

                                    {/* Trạng thái: Chờ PV */}
                                    {selectedCandidate.status === 'PENDING_INTERVIEW' && (
                                        <>
                                            <button
                                                type="button"
                                                className="candidate-action-modal-btn candidate-action-modal-primary"
                                                onClick={() => handleActionStatusChange('PASSED')}
                                            >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                </svg>
                                                <span>Chuyển Phỏng vấn</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="candidate-action-modal-btn candidate-action-modal-reject"
                                                onClick={() => handleActionStatusChange('FAILED')}
                                            >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                                </svg>
                                                <span>Từ chối (Rớt)</span>
                                            </button>
                                        </>
                                    )}

                                    {/* Trạng thái: Đã Đậu */}
                                    {selectedCandidate.status === 'PASSED' && (
                                        <>
                                            <button
                                                type="button"
                                                className="candidate-action-modal-btn candidate-action-modal-primary"
                                                onClick={() => {
                                                    // Pre-fill form with candidate data
                                                    setJobOfferFormData({
                                                        applicantName: selectedCandidate.hoTen || '',
                                                        dateOfBirth: selectedCandidate.ngaySinh || selectedCandidate.ngay_sinh || '',
                                                        position: selectedCandidate.viTriUngTuyen || '',
                                                        department: selectedCandidate.phongBan || '',
                                                        directReportTo: interviewRequest?.manager_name || '',
                                                        indirectReportTo: interviewRequest?.indirect_manager_name || '',
                                                        workLocation: '',
                                                        ngayCapCCCD: selectedCandidate.ngayCapCCCD || selectedCandidate.ngay_cap_cccd || '',
                                                        noiCapCCCD: selectedCandidate.noiCapCCCD || selectedCandidate.noi_cap_cccd || '',
                                                        diaChiTamTru: selectedCandidate.diaChiTamTru || selectedCandidate.dia_chi_tam_tru || '',
                                                        startDate: '',
                                                        probationDays: '60',
                                                        workingHours: '08:30 - 17:30 (T2-T6)',
                                                        probationGrossSalary: '',
                                                        officialGrossSalary: '',
                                                        phoneAllowance: '',
                                                        annualLeaveDays: '12',
                                                        jobDuties: ['', '']
                                                    });
                                                    setShowPreview(false);
                                                    setFormattedLetter('');
                                                    setIsJobOfferModalOpen(true);
                                                }}
                                            >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                                </svg>
                                                <span>Thư tuyển dụng</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="candidate-action-modal-btn candidate-action-modal-view-cv"
                                                onClick={handleViewCV}
                                            >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                                </svg>
                                                <span>Xem chi tiết CV</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="candidate-action-modal-btn candidate-action-modal-view-evaluation"
                                                onClick={async () => {
                                                    if (!interviewRequest) {
                                                        // Fetch interview request first
                                                        setLoadingEvaluationDetails(true);
                                                        try {
                                                            const response = await candidatesAPI.getInterviewRequests({});
                                                            if (response.data?.success && Array.isArray(response.data.data)) {
                                                                const requests = response.data.data.filter(
                                                                    r => r.candidate_id === selectedCandidate.id
                                                                );
                                                                requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                                                                const request = requests[0] || null;
                                                                if (request) {
                                                                    setInterviewRequest(request);
                                                                    loadEvaluationDetails(request);
                                                                } else {
                                                                    if (showToast) {
                                                                        showToast('Không tìm thấy đánh giá phỏng vấn', 'warning');
                                                                    }
                                                                }
                                                            }
                                                        } catch (error) {
                                                            console.error('Error fetching interview request:', error);
                                                            if (showToast) {
                                                                showToast('Lỗi khi tải đánh giá phỏng vấn', 'error');
                                                            }
                                                        } finally {
                                                            setLoadingEvaluationDetails(false);
                                                        }
                                                    } else {
                                                        loadEvaluationDetails(interviewRequest);
                                                    }
                                                }}
                                            >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                                </svg>
                                                <span>Chi tiết đánh giá</span>
                                            </button>
                                        </>
                                    )}

                                    {/* Trạng thái: Rớt PV */}
                                    {selectedCandidate.status === 'FAILED' && (
                                        <>
                                            <button
                                                type="button"
                                                className="candidate-action-modal-btn candidate-action-modal-view-cv"
                                                onClick={handleViewCV}
                                            >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                                </svg>
                                                <span>Xem chi tiết CV</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="candidate-action-modal-btn candidate-action-modal-edit"
                                                onClick={() => {
                                                    // TODO: Implement edit functionality
                                                    if (showToast) {
                                                        showToast('Tính năng chỉnh sửa đang được phát triển', 'info');
                                                    }
                                                }}
                                            >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                                </svg>
                                                <span>Chỉnh sửa hồ sơ</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="candidate-action-modal-btn candidate-action-modal-delete"
                                                onClick={handleActionDelete}
                                            >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                                </svg>
                                                <span>Xóa Hồ sơ</span>
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Notes Section - Moved below Actions */}
                                <div className="candidate-notes-section">
                                    <div className="candidate-notes-header">
                                        <h4 className="candidate-notes-title">Ghi chú</h4>
                                        {!isEditingNotes && (
                                            <button
                                                type="button"
                                                className="candidate-notes-edit-btn"
                                                onClick={handleEditNotes}
                                            >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                                </svg>
                                                <span>{selectedCandidate.notes ? 'Chỉnh sửa' : 'Thêm ghi chú'}</span>
                                            </button>
                                        )}
                                    </div>
                                    {isEditingNotes ? (
                                        <div className="candidate-notes-editor">
                                            <textarea
                                                className="candidate-notes-textarea"
                                                value={candidateNotes}
                                                onChange={(e) => setCandidateNotes(e.target.value)}
                                                placeholder="Nhập ghi chú (ví dụ: Tại sao rớt, chờ phỏng vấn sau, v.v...)"
                                                rows={4}
                                            />
                                            <div className="candidate-notes-actions">
                                                <button
                                                    type="button"
                                                    className="candidate-notes-save-btn"
                                                    onClick={handleSaveNotes}
                                                    disabled={isSavingNotes}
                                                >
                                                    {isSavingNotes ? 'Đang lưu...' : 'Lưu'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="candidate-notes-cancel-btn"
                                                    onClick={handleCancelEditNotes}
                                                    disabled={isSavingNotes}
                                                >
                                                    Hủy
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="candidate-notes-display">
                                            {selectedCandidate.notes ? (
                                                <p className="candidate-notes-text">{selectedCandidate.notes}</p>
                                            ) : (
                                                <p className="candidate-notes-empty">Chưa có ghi chú</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Chi tiết Đánh giá */}
            {isEvaluationDetailModalOpen && evaluationDetails && (
                <div className="candidate-modal-overlay" onClick={() => setIsEvaluationDetailModalOpen(false)}>
                    <div className="candidate-modal-box candidate-evaluation-detail-modal" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="candidate-modal-header">
                            <h2 className="candidate-modal-title">
                                <svg className="candidate-modal-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span>Chi tiết Đánh giá Phỏng vấn</span>
                            </h2>
                            <button
                                type="button"
                                className="candidate-modal-close"
                                onClick={() => setIsEvaluationDetailModalOpen(false)}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="candidate-evaluation-detail-content">
                            {/* Managers Info */}
                            <div className="candidate-evaluation-detail-managers">
                                <div className="candidate-evaluation-detail-manager-info">
                                    <span className="candidate-evaluation-detail-manager-label">Quản lý trực tiếp:</span>
                                    <span className="candidate-evaluation-detail-manager-name">{evaluationDetails.directManager?.name || 'Chưa xác định'}</span>
                                </div>
                                {evaluationDetails.indirectManager && (
                                    <div className="candidate-evaluation-detail-manager-info">
                                        <span className="candidate-evaluation-detail-manager-label">Quản lý gián tiếp:</span>
                                        <span className="candidate-evaluation-detail-manager-name">{evaluationDetails.indirectManager.name}</span>
                                    </div>
                                )}
                            </div>

                            {/* Criteria Table */}
                            <div className="candidate-evaluation-detail-table-wrapper">
                                <table className="candidate-evaluation-detail-table">
                                    <thead>
                                        <tr>
                                            <th>Tiêu chí</th>
                                            <th>Điểm QL Trực tiếp</th>
                                            {evaluationDetails.indirectManager && <th>Điểm QL Gián tiếp</th>}
                                            <th>Điểm Trung bình</th>
                                            <th>Nhận xét QL Trực tiếp</th>
                                            {evaluationDetails.indirectManager && <th>Nhận xét QL Gián tiếp</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {calculateAverageScores()?.map((criterion, index) => (
                                            <tr key={index}>
                                                <td className="candidate-evaluation-detail-criterion-name">{criterion.name}</td>
                                                <td className="candidate-evaluation-detail-score">
                                                    {criterion.directScore !== null ? criterion.directScore : '-'}
                                                </td>
                                                {evaluationDetails.indirectManager && (
                                                    <td className="candidate-evaluation-detail-score">
                                                        {criterion.indirectScore !== null ? criterion.indirectScore : '-'}
                                                    </td>
                                                )}
                                                <td className="candidate-evaluation-detail-score candidate-evaluation-detail-score--average">
                                                    {criterion.average !== null ? criterion.average : '-'}
                                                </td>
                                                <td className="candidate-evaluation-detail-comment">
                                                    {criterion.directComment || '-'}
                                                </td>
                                                {evaluationDetails.indirectManager && (
                                                    <td className="candidate-evaluation-detail-comment">
                                                        {criterion.indirectComment || '-'}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Comments Section */}
                            <div className="candidate-evaluation-detail-comments-section">
                                <h3 className="candidate-evaluation-detail-comments-title">Nhận xét Chi tiết</h3>

                                {/* Direct Manager Comments */}
                                <div className="candidate-evaluation-detail-comments-group">
                                    <h4 className="candidate-evaluation-detail-comments-group-title">
                                        Quản lý trực tiếp: {evaluationDetails.directManager?.name || 'Chưa xác định'}
                                    </h4>
                                    {evaluationDetails.directManager?.evaluation && (
                                        <div className="candidate-evaluation-detail-comments-list">
                                            <div className="candidate-evaluation-detail-comment-item">
                                                <strong>Điểm mạnh:</strong>
                                                <p>{evaluationDetails.directManager.evaluation.strengths || '-'}</p>
                                            </div>
                                            <div className="candidate-evaluation-detail-comment-item">
                                                <strong>Điểm cần cải thiện:</strong>
                                                <p>{evaluationDetails.directManager.evaluation.improvements || '-'}</p>
                                            </div>
                                            <div className="candidate-evaluation-detail-comment-item">
                                                <strong>Nhận xét chung / Đề xuất Mức lương:</strong>
                                                <p>{evaluationDetails.directManager.evaluation.generalComments || '-'}</p>
                                            </div>
                                            <div className="candidate-evaluation-detail-comment-item">
                                                <strong>Kết luận:</strong>
                                                <p className={`candidate-evaluation-detail-conclusion ${evaluationDetails.directManager.evaluation.finalConclusion === 'PASS' ? 'candidate-evaluation-detail-conclusion--pass' :
                                                    evaluationDetails.directManager.evaluation.finalConclusion === 'FAIL' ? 'candidate-evaluation-detail-conclusion--fail' :
                                                        evaluationDetails.directManager.evaluation.finalConclusion === 'HOLD' ? 'candidate-evaluation-detail-conclusion--hold' : ''
                                                    }`}>
                                                    {evaluationDetails.directManager.evaluation.finalConclusion === 'PASS' && 'ĐẠT (PASS)'}
                                                    {evaluationDetails.directManager.evaluation.finalConclusion === 'FAIL' && 'KHÔNG ĐẠT (FAIL)'}
                                                    {evaluationDetails.directManager.evaluation.finalConclusion === 'HOLD' && 'LƯU HỒ SƠ (HOLD)'}
                                                    {!evaluationDetails.directManager.evaluation.finalConclusion && '-'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Indirect Manager Comments */}
                                {evaluationDetails.indirectManager?.evaluation && (
                                    <div className="candidate-evaluation-detail-comments-group">
                                        <h4 className="candidate-evaluation-detail-comments-group-title">
                                            Quản lý gián tiếp: {evaluationDetails.indirectManager.name}
                                        </h4>
                                        <div className="candidate-evaluation-detail-comments-list">
                                            <div className="candidate-evaluation-detail-comment-item">
                                                <strong>Điểm mạnh:</strong>
                                                <p>{evaluationDetails.indirectManager.evaluation.strengths || '-'}</p>
                                            </div>
                                            <div className="candidate-evaluation-detail-comment-item">
                                                <strong>Điểm cần cải thiện:</strong>
                                                <p>{evaluationDetails.indirectManager.evaluation.improvements || '-'}</p>
                                            </div>
                                            <div className="candidate-evaluation-detail-comment-item">
                                                <strong>Nhận xét chung / Đề xuất Mức lương:</strong>
                                                <p>{evaluationDetails.indirectManager.evaluation.generalComments || '-'}</p>
                                            </div>
                                            <div className="candidate-evaluation-detail-comment-item">
                                                <strong>Kết luận:</strong>
                                                <p className={`candidate-evaluation-detail-conclusion ${evaluationDetails.indirectManager.evaluation.finalConclusion === 'PASS' ? 'candidate-evaluation-detail-conclusion--pass' :
                                                    evaluationDetails.indirectManager.evaluation.finalConclusion === 'FAIL' ? 'candidate-evaluation-detail-conclusion--fail' :
                                                        evaluationDetails.indirectManager.evaluation.finalConclusion === 'HOLD' ? 'candidate-evaluation-detail-conclusion--hold' : ''
                                                    }`}>
                                                    {evaluationDetails.indirectManager.evaluation.finalConclusion === 'PASS' && 'ĐẠT (PASS)'}
                                                    {evaluationDetails.indirectManager.evaluation.finalConclusion === 'FAIL' && 'KHÔNG ĐẠT (FAIL)'}
                                                    {evaluationDetails.indirectManager.evaluation.finalConclusion === 'HOLD' && 'LƯU HỒ SƠ (HOLD)'}
                                                    {!evaluationDetails.indirectManager.evaluation.finalConclusion && '-'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Thư Tuyển Dụng */}
            {isJobOfferModalOpen && selectedCandidate && (
                <div className="job-offer-modal-overlay" onClick={() => {
                    setIsJobOfferModalOpen(false);
                    setShowPreview(false);
                    setFormattedLetter('');
                }}>
                    <div className="job-offer-modal-container" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="job-offer-modal-header">
                            <div className="job-offer-modal-header-content">
                                <svg className="job-offer-modal-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <h2 className="job-offer-modal-title">
                                    Tạo Thư Mời Nhận Việc (Offer Letter)
                                </h2>
                            </div>
                            <button
                                type="button"
                                className="job-offer-modal-close"
                                onClick={() => {
                                    setIsJobOfferModalOpen(false);
                                    setShowPreview(false);
                                    setFormattedLetter('');
                                }}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content - Form */}
                        <div className="job-offer-modal-content">
                            <form className="job-offer-form" onSubmit={(e) => e.preventDefault()}>
                                {/* Section 1: Thông tin Ứng viên & Vị trí */}
                                <div className="job-offer-form-section">
                                    <h3 className="job-offer-section-title">1. Thông tin Ứng viên & Vị trí</h3>
                                    <div className="job-offer-form-grid job-offer-form-grid--2-cols">
                                        <div className="job-offer-form-group">
                                            <label htmlFor="applicant-name" className="job-offer-form-label">
                                                Tên Ứng viên <span className="required">*</span>
                                            </label>
                                            <input
                                                id="applicant-name"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.applicantName}
                                                readOnly
                                                placeholder="Ví dụ: Nguyễn Văn A"
                                                required
                                            />
                                        </div>
                                        <div className="job-offer-form-group">
                                            <label htmlFor="date-of-birth" className="job-offer-form-label">
                                                Ngày sinh
                                            </label>
                                            <input
                                                id="date-of-birth"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.dateOfBirth ? formatDateDisplay(jobOfferFormData.dateOfBirth) : ''}
                                                readOnly
                                                placeholder="Tự động điền từ hệ thống"
                                            />
                                        </div>
                                        <div className="job-offer-form-group">
                                            <label htmlFor="position" className="job-offer-form-label">
                                                Chức danh / Vị trí <span className="required">*</span>
                                            </label>
                                            <input
                                                id="position"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={getViTriLabel(jobOfferFormData.position)}
                                                readOnly
                                                placeholder="Ví dụ: Giám đốc Marketing"
                                                required
                                            />
                                        </div>
                                        <div className="job-offer-form-group">
                                            <label htmlFor="department" className="job-offer-form-label">
                                                Phòng ban <span className="required">*</span>
                                            </label>
                                            <input
                                                id="department"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={getPhongBanLabel(jobOfferFormData.department)}
                                                readOnly
                                                placeholder="Nhập phòng ban"
                                                required
                                            />
                                        </div>
                                        <div className="job-offer-form-group">
                                            <label htmlFor="direct-report-to" className="job-offer-form-label">
                                                Báo cáo trực tiếp cho (Quản lý trực tiếp)
                                            </label>
                                            <input
                                                id="direct-report-to"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.directReportTo}
                                                readOnly
                                                placeholder="Ví dụ: Tổng Giám đốc (Ông Trần Văn B)"
                                            />
                                        </div>
                                        <div className="job-offer-form-group">
                                            <label htmlFor="indirect-report-to" className="job-offer-form-label">
                                                Báo cáo gián tiếp cho (Quản lý gián tiếp) (Tùy chọn)
                                            </label>
                                            <input
                                                id="indirect-report-to"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.indirectReportTo}
                                                readOnly
                                                placeholder="Ví dụ: Trưởng phòng Tài chính"
                                            />
                                        </div>
                                        <div className="job-offer-form-group">
                                            <label htmlFor="ngay-cap-cccd" className="job-offer-form-label">
                                                Ngày cấp CCCD
                                            </label>
                                            <input
                                                id="ngay-cap-cccd"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.ngayCapCCCD ? formatDateDisplay(jobOfferFormData.ngayCapCCCD) : ''}
                                                readOnly
                                                placeholder="Tự động điền từ hệ thống"
                                            />
                                        </div>
                                        <div className="job-offer-form-group">
                                            <label htmlFor="noi-cap-cccd" className="job-offer-form-label">
                                                Nơi cấp CCCD
                                            </label>
                                            <input
                                                id="noi-cap-cccd"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.noiCapCCCD}
                                                readOnly
                                                placeholder="Tự động điền từ hệ thống"
                                            />
                                        </div>
                                        <div className="job-offer-form-group job-offer-form-group--full-width">
                                            <label htmlFor="work-location" className="job-offer-form-label">
                                                Địa điểm làm việc <span className="required">*</span>
                                            </label>
                                            <input
                                                id="work-location"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.workLocation}
                                                onChange={(e) => setJobOfferFormData({ ...jobOfferFormData, workLocation: e.target.value })}
                                                placeholder="Ví dụ: Văn phòng Hà Nội, Tầng 5 Tòa nhà ABC"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Thời gian & Mức Lương (Gross) */}
                                <div className="job-offer-form-section">
                                    <h3 className="job-offer-section-title">2. Thời gian & Mức Lương (Gross)</h3>
                                    <div className="job-offer-form-grid job-offer-form-grid--3-cols">
                                        <div className="job-offer-form-group">
                                            <label htmlFor="start-date" className="job-offer-form-label">
                                                Ngày bắt đầu làm việc <span className="required">*</span>
                                            </label>
                                            <div className="job-offer-date-input-wrapper">
                                                <input
                                                    id="start-date"
                                                    type="date"
                                                    className="job-offer-form-input"
                                                    value={jobOfferFormData.startDate}
                                                    onChange={(e) => setJobOfferFormData({ ...jobOfferFormData, startDate: e.target.value })}
                                                    required
                                                />
                                                <svg className="job-offer-date-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="job-offer-form-group">
                                            <label htmlFor="probation-days" className="job-offer-form-label">
                                                Thời gian thử việc (Ngày) <span className="required">*</span>
                                            </label>
                                            <input
                                                id="probation-days"
                                                type="number"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.probationDays}
                                                onChange={(e) => setJobOfferFormData({ ...jobOfferFormData, probationDays: e.target.value })}
                                                placeholder="VD: 60"
                                                required
                                            />
                                        </div>
                                        <div className="job-offer-form-group">
                                            <label htmlFor="working-hours" className="job-offer-form-label">
                                                Thời gian làm việc (Tóm tắt)
                                            </label>
                                            <input
                                                id="working-hours"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.workingHours}
                                                onChange={(e) => setJobOfferFormData({ ...jobOfferFormData, workingHours: e.target.value })}
                                                placeholder="VD: 08:30 - 17:30 (T2-T6)"
                                            />
                                        </div>
                                    </div>
                                    <div className="job-offer-form-grid job-offer-form-grid--2-cols">
                                        <div className="job-offer-form-group">
                                            <label htmlFor="probation-gross-salary" className="job-offer-form-label">
                                                Mức lương Gộp (Gross) trong thời gian thử việc (VNĐ/tháng) <span className="required">*</span>
                                            </label>
                                            <input
                                                id="probation-gross-salary"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.probationGrossSalary}
                                                onChange={(e) => setJobOfferFormData({ ...jobOfferFormData, probationGrossSalary: e.target.value })}
                                                placeholder="Ví dụ: 20000000"
                                                required
                                            />
                                        </div>
                                        <div className="job-offer-form-group">
                                            <label htmlFor="official-gross-salary" className="job-offer-form-label">
                                                Mức lương Gộp (Gross) sau thời gian thử việc (VNĐ/tháng) <span className="required">*</span>
                                            </label>
                                            <input
                                                id="official-gross-salary"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.officialGrossSalary}
                                                onChange={(e) => setJobOfferFormData({ ...jobOfferFormData, officialGrossSalary: e.target.value })}
                                                placeholder="Ví dụ: 25000000"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Chính sách Phụ cấp & Ngày nghỉ */}
                                <div className="job-offer-form-section">
                                    <h3 className="job-offer-section-title">3. Chính sách Phụ cấp & Ngày nghỉ</h3>
                                    <div className="job-offer-form-grid job-offer-form-grid--2-cols">
                                        <div className="job-offer-form-group">
                                            <label htmlFor="phone-allowance" className="job-offer-form-label">
                                                Phụ cấp điện thoại (VNĐ/tháng)
                                            </label>
                                            <input
                                                id="phone-allowance"
                                                type="text"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.phoneAllowance}
                                                onChange={(e) => setJobOfferFormData({ ...jobOfferFormData, phoneAllowance: e.target.value })}
                                                placeholder="Ví dụ: 200000"
                                            />
                                        </div>
                                        <div className="job-offer-form-group">
                                            <label htmlFor="annual-leave-days" className="job-offer-form-label">
                                                Số ngày nghỉ phép năm (ngày)
                                            </label>
                                            <input
                                                id="annual-leave-days"
                                                type="number"
                                                className="job-offer-form-input"
                                                value={jobOfferFormData.annualLeaveDays}
                                                onChange={(e) => setJobOfferFormData({ ...jobOfferFormData, annualLeaveDays: e.target.value })}
                                                placeholder="Ví dụ: 12"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 4: Mô tả Công việc Chính */}
                                <div className="job-offer-form-section">
                                    <h3 className="job-offer-section-title">4. Mô tả Công việc Chính</h3>
                                    <div className="job-offer-job-duties-note">
                                        <p>Mỗi dòng nhập liệu sẽ tương ứng với một mục gạch đầu dòng (a, b, c...) trong Thư mời.</p>
                                    </div>
                                    <div className="job-offer-job-duties">
                                        {jobOfferFormData.jobDuties.map((duty, index) => {
                                            const labelLetter = String.fromCharCode(97 + index); // a, b, c, ...
                                            return (
                                                <div key={index} className="job-offer-job-duty-item">
                                                    <label className="job-offer-form-label">
                                                        Mục {labelLetter}
                                                    </label>
                                                    <textarea
                                                        className="job-offer-form-textarea"
                                                        rows="3"
                                                        value={duty}
                                                        onChange={(e) => {
                                                            const newDuties = [...jobOfferFormData.jobDuties];
                                                            newDuties[index] = e.target.value;
                                                            setJobOfferFormData({ ...jobOfferFormData, jobDuties: newDuties });
                                                        }}
                                                        placeholder={`Nhiệm vụ chính ${index + 1}... Ví dụ: ${index === 0 ? 'Lập kế hoạch và thực hiện các chiến dịch Marketing' : 'Quản lý ngân sách và hiệu suất đội ngũ Marketing'}`}
                                                    />
                                                </div>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            className="job-offer-add-duty-btn"
                                            onClick={() => {
                                                setJobOfferFormData({
                                                    ...jobOfferFormData,
                                                    jobDuties: [...jobOfferFormData.jobDuties, '']
                                                });
                                            }}
                                        >
                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                            </svg>
                                            <span>+ Thêm Nhiệm vụ khác</span>
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {/* IV. Vùng Hành Động & Xem Trước */}
                            <div className="job-offer-action-area">
                                {/* Action Button */}
                                <button
                                    type="button"
                                    className="job-offer-primary-btn"
                                    disabled={generatingPDF}
                                    onClick={async () => {
                                        // Validate form
                                        if (!jobOfferFormData.applicantName || !jobOfferFormData.position ||
                                            !jobOfferFormData.department || !jobOfferFormData.workLocation || !jobOfferFormData.startDate ||
                                            !jobOfferFormData.probationDays ||
                                            !jobOfferFormData.probationGrossSalary || !jobOfferFormData.officialGrossSalary) {
                                            alert('Vui lòng điền đầy đủ các trường bắt buộc.');
                                            return;
                                        }

                                        try {
                                            setGeneratingPDF(true);

                                            // Call API to generate PDF
                                            const response = await candidatesAPI.generateJobOfferPDFFromForm({
                                                applicantName: jobOfferFormData.applicantName,
                                                dateOfBirth: jobOfferFormData.dateOfBirth,
                                                position: jobOfferFormData.position,
                                                department: jobOfferFormData.department,
                                                directReportTo: jobOfferFormData.directReportTo,
                                                indirectReportTo: jobOfferFormData.indirectReportTo,
                                                workLocation: jobOfferFormData.workLocation,
                                                ngayCapCCCD: jobOfferFormData.ngayCapCCCD,
                                                noiCapCCCD: jobOfferFormData.noiCapCCCD,
                                                diaChiTamTru: jobOfferFormData.diaChiTamTru,
                                                startDate: jobOfferFormData.startDate,
                                                probationDays: jobOfferFormData.probationDays,
                                                workingHours: jobOfferFormData.workingHours,
                                                probationGrossSalary: jobOfferFormData.probationGrossSalary,
                                                officialGrossSalary: jobOfferFormData.officialGrossSalary,
                                                phoneAllowance: jobOfferFormData.phoneAllowance,
                                                annualLeaveDays: jobOfferFormData.annualLeaveDays,
                                                jobDuties: jobOfferFormData.jobDuties
                                            });

                                            // Create blob and download
                                            const blob = new Blob([response.data], { type: 'application/pdf' });
                                            const url = window.URL.createObjectURL(blob);
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.download = `Thu-Tuyen-Dung-${jobOfferFormData.applicantName.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                            window.URL.revokeObjectURL(url);

                                            // Also show preview for reference
                                            const formatDate = (dateString) => {
                                                if (!dateString) return '';
                                                const date = new Date(dateString);
                                                return date.toLocaleDateString('vi-VN', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric'
                                                });
                                            };

                                            const formatCurrency = (amount) => {
                                                if (!amount) return '';
                                                const num = amount.toString().replace(/\D/g, '');
                                                return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                                            };

                                            let letterContent = `THƯ MỜI NHẬN VIỆC\n\n`;
                                            letterContent += `Kính gửi: ${jobOfferFormData.applicantName}\n\n`;
                                            letterContent += `Chúng tôi rất vui mừng thông báo rằng bạn đã được chọn cho vị trí ${getViTriLabel(jobOfferFormData.position)}.\n\n`;
                                            letterContent += `1. Thông tin vị trí:\n`;
                                            letterContent += `   - Chức danh/Vị trí: ${getViTriLabel(jobOfferFormData.position)}\n`;
                                            letterContent += `   - Phòng ban: ${getPhongBanLabel(jobOfferFormData.department)}\n`;
                                            if (jobOfferFormData.directReportTo) {
                                                letterContent += `   - Báo cáo trực tiếp cho: ${jobOfferFormData.directReportTo}\n`;
                                            }
                                            if (jobOfferFormData.indirectReportTo) {
                                                letterContent += `   - Báo cáo gián tiếp cho: ${jobOfferFormData.indirectReportTo}\n`;
                                            }
                                            letterContent += `   - Địa điểm làm việc: ${jobOfferFormData.workLocation}\n`;
                                            if (jobOfferFormData.diaChiTamTru) {
                                                letterContent += `   - Địa chỉ tạm trú: ${jobOfferFormData.diaChiTamTru}\n`;
                                            }
                                            letterContent += `\n`;
                                            letterContent += `2. Thời gian làm việc:\n`;
                                            letterContent += `   - Ngày bắt đầu làm việc: ${formatDate(jobOfferFormData.startDate)}\n`;
                                            letterContent += `   - Thời gian thử việc: ${jobOfferFormData.probationDays} ngày\n`;
                                            if (jobOfferFormData.workingHours) {
                                                letterContent += `   - Thời gian làm việc: ${jobOfferFormData.workingHours}\n`;
                                            }
                                            letterContent += `\n`;
                                            letterContent += `3. Mức lương Gộp (Gross):\n`;
                                            letterContent += `   - Trong thời gian thử việc: <span class="currency-value">${formatCurrency(jobOfferFormData.probationGrossSalary)} VNĐ/tháng</span>\n`;
                                            letterContent += `   - Sau thời gian thử việc: <span class="currency-value">${formatCurrency(jobOfferFormData.officialGrossSalary)} VNĐ/tháng</span>\n\n`;

                                            const phoneAllowanceValue = jobOfferFormData.phoneAllowance || '200000';
                                            letterContent += `4. Chính sách Phụ cấp:\n`;
                                            letterContent += `   - Hỗ trợ cơm trưa: Theo chính sách công ty\n`;
                                            letterContent += `   - Phụ cấp điện thoại: <span class="currency-value">${formatCurrency(phoneAllowanceValue)} VNĐ/tháng</span>\n\n`;

                                            if (jobOfferFormData.annualLeaveDays) {
                                                letterContent += `5. Ngày nghỉ phép năm: ${jobOfferFormData.annualLeaveDays} ngày\n\n`;
                                            }

                                            if (jobOfferFormData.jobDuties && jobOfferFormData.jobDuties.some(d => d.trim())) {
                                                letterContent += `6. Mô tả công việc chính:\n`;
                                                jobOfferFormData.jobDuties.forEach((duty, index) => {
                                                    if (duty.trim()) {
                                                        const labelLetter = String.fromCharCode(97 + index);
                                                        letterContent += `   ${labelLetter}. ${duty}\n`;
                                                    }
                                                });
                                                letterContent += `\n`;
                                            }

                                            letterContent += `Chúng tôi mong muốn được chào đón bạn gia nhập đội ngũ của chúng tôi.\n\n`;
                                            letterContent += `Trân trọng,\nPhòng Nhân Sự`;

                                            setFormattedLetter(letterContent);
                                            setShowPreview(true);
                                        } catch (error) {
                                            console.error('Error generating PDF:', error);
                                            alert('Lỗi khi tạo file PDF. Vui lòng thử lại.');
                                        } finally {
                                            setGeneratingPDF(false);
                                        }
                                    }}
                                >
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    <span>{generatingPDF ? 'Đang tạo PDF...' : 'Xuất PDF'}</span>
                                </button>

                                {/* Preview Area - Initially Hidden */}
                                {showPreview && formattedLetter && (
                                    <div className="job-offer-preview-area">
                                        <div className="job-offer-preview-header">
                                            <h3 className="job-offer-preview-title">Xem trước Thư Mời Nhận Việc</h3>
                                        </div>
                                        <div className="job-offer-preview-content">
                                            <div className="job-offer-letter-content">
                                                {formattedLetter.split('\n').map((line, index) => {
                                                    // Check if line contains currency value
                                                    if (line.includes('<span class="currency-value">')) {
                                                        const parts = line.split(/<span class="currency-value">|<\/span>/);
                                                        return (
                                                            <div key={index} className="job-offer-letter-line">
                                                                {parts[0]}
                                                                <span className="currency-value">{parts[1]}</span>
                                                                {parts[2]}
                                                            </div>
                                                        );
                                                    }
                                                    // Check if line starts with number (numbered list)
                                                    const numberedMatch = line.match(/^(\s*)(\d+)\.\s*(.+)$/);
                                                    if (numberedMatch) {
                                                        return (
                                                            <div key={index} className="job-offer-letter-line job-offer-letter-numbered">
                                                                {numberedMatch[1]}
                                                                <strong>{numberedMatch[2]}. </strong>
                                                                {numberedMatch[3]}
                                                            </div>
                                                        );
                                                    }
                                                    // Check if line contains bold markers
                                                    if (line.includes('**')) {
                                                        const parts = line.split('**');
                                                        return (
                                                            <div key={index} className="job-offer-letter-line">
                                                                {parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
                                                            </div>
                                                        );
                                                    }
                                                    // Regular line
                                                    const isBold = line.trim() === line.toUpperCase() && line.trim().length > 0;
                                                    return (
                                                        <div key={index} className={`job-offer-letter-line ${isBold ? 'job-offer-letter-bold' : ''}`}>
                                                            {line || '\u00A0'}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="job-offer-preview-actions">
                                            <button
                                                type="button"
                                                className="job-offer-copy-btn"
                                                onClick={() => {
                                                    const textToCopy = formattedLetter.replace(/<span class="currency-value">|<\/span>/g, '');
                                                    navigator.clipboard.writeText(textToCopy).then(() => {
                                                        alert('Đã sao chép nội dung vào clipboard!');
                                                    }).catch(err => {
                                                        console.error('Failed to copy:', err);
                                                    });
                                                }}
                                            >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                                </svg>
                                                <span>Sao chép nội dung</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Add Candidate */}
            {isModalOpen && (
                <div className="candidate-modal-overlay" onClick={handleModalClose}>
                    <div className="candidate-modal-box" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="candidate-modal-header">
                            <h2 className="candidate-modal-title">
                                <svg className="candidate-modal-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                                </svg>
                                <span>Thêm Ứng viên mới</span>
                            </h2>
                            <button
                                type="button"
                                className="candidate-modal-close"
                                onClick={handleModalClose}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content Wrapper */}
                        <div className="candidate-modal-content-wrapper">
                            {/* Modal Form */}
                            <form onSubmit={handleModalSubmit} className="candidate-modal-form" autoComplete="off">
                                {/* Section I: THÔNG TIN CÁ NHÂN */}
                                <div className="candidate-modal-form-section">
                                    <h3 className="candidate-modal-form-section-title">I. THÔNG TIN CÁ NHÂN</h3>

                                    {/* Row 1: Họ tên, Giới tính, Ngày sinh */}
                                    <div className="candidate-modal-form-row">
                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-hoTen" className="candidate-modal-form-label">
                                                Họ tên <span className="required">*</span>
                                            </label>
                                            <input
                                                id="modal-hoTen"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.hoTen ? 'error' : ''}`}
                                                value={formData.hoTen}
                                                onChange={(e) => handleFormInputChange('hoTen', e.target.value)}
                                                placeholder="Nhập họ và tên ứng viên"
                                                autoComplete="off"
                                            />
                                            {formErrors.hoTen && (
                                                <span className="candidate-modal-form-error">{formErrors.hoTen}</span>
                                            )}
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-gioiTinh" className="candidate-modal-form-label">
                                                Giới tính
                                            </label>
                                            <CustomDropdown
                                                id="modal-gioiTinh"
                                                value={formData.gioiTinh}
                                                onChange={(e) => handleFormInputChange('gioiTinh', e.target.value)}
                                                options={[
                                                    { value: '', label: 'Chọn giới tính' },
                                                    { value: 'Nam', label: 'Nam' },
                                                    { value: 'Nữ', label: 'Nữ' },
                                                    { value: 'Khác', label: 'Khác' }
                                                ]}
                                                placeholder="Chọn giới tính"
                                                className="candidate-modal-form-input"
                                            />
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-ngaySinh" className="candidate-modal-form-label">
                                                Ngày sinh <span className="required">*</span>
                                            </label>
                                            <DatePicker
                                                id="modal-ngaySinh"
                                                selected={formData.ngaySinh ? parseISODateString(formData.ngaySinh) : null}
                                                onChange={(date) => handleFormDateChange('ngaySinh', date)}
                                                onFocus={() => {
                                                    document.querySelectorAll('.custom-dropdown-wrapper.open').forEach(wrapper => {
                                                        const trigger = wrapper.querySelector('.custom-dropdown-trigger');
                                                        if (trigger) {
                                                            trigger.click();
                                                        }
                                                    });
                                                }}
                                                maxDate={today()}
                                                dateFormat="dd/MM/yyyy"
                                                locale={DATE_PICKER_LOCALE}
                                                className={`candidate-modal-form-input candidate-modal-datepicker ${formErrors.ngaySinh ? 'error' : ''}`}
                                                placeholderText="Chọn ngày sinh"
                                                withPortal
                                                autoComplete="off"
                                                showYearDropdown
                                                showMonthDropdown
                                                dropdownMode="select"
                                                yearDropdownItemNumber={100}
                                                scrollableYearDropdown
                                                minDate={new Date(1900, 0, 1)}
                                            />
                                            {formErrors.ngaySinh && (
                                                <span className="candidate-modal-form-error">{formErrors.ngaySinh}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 2: Nơi sinh, Tình trạng hôn nhân, Dân tộc */}
                                    <div className="candidate-modal-form-row">
                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-noiSinh" className="candidate-modal-form-label">
                                                Nơi sinh
                                            </label>
                                            <input
                                                id="modal-noiSinh"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.noiSinh ? 'error' : ''}`}
                                                value={formData.noiSinh}
                                                onChange={(e) => handleFormInputChange('noiSinh', e.target.value)}
                                                placeholder="Nhập nơi sinh"
                                                autoComplete="off"
                                            />
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-tinhTrangHonNhan" className="candidate-modal-form-label">
                                                Tình trạng hôn nhân
                                            </label>
                                            <CustomDropdown
                                                id="modal-tinhTrangHonNhan"
                                                value={formData.tinhTrangHonNhan}
                                                onChange={(e) => handleFormInputChange('tinhTrangHonNhan', e.target.value)}
                                                options={[
                                                    { value: '', label: 'Chọn tình trạng hôn nhân' },
                                                    { value: 'Độc thân', label: 'Độc thân' },
                                                    { value: 'Đã kết hôn', label: 'Đã kết hôn' },
                                                    { value: 'Ly dị', label: 'Ly dị' },
                                                    { value: 'Góa', label: 'Góa' }
                                                ]}
                                                placeholder="Chọn tình trạng hôn nhân"
                                                className="candidate-modal-form-input"
                                            />
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-danToc" className="candidate-modal-form-label">
                                                Dân tộc
                                            </label>
                                            <input
                                                id="modal-danToc"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.danToc ? 'error' : ''}`}
                                                value={formData.danToc}
                                                onChange={(e) => handleFormInputChange('danToc', e.target.value)}
                                                placeholder="Nhập dân tộc"
                                                autoComplete="off"
                                            />
                                        </div>
                                    </div>

                                    {/* Row 3: Quốc tịch, Tôn giáo, Vị trí ứng tuyển */}
                                    <div className="candidate-modal-form-row">
                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-quocTich" className="candidate-modal-form-label">
                                                Quốc tịch
                                            </label>
                                            <input
                                                id="modal-quocTich"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.quocTich ? 'error' : ''}`}
                                                value={formData.quocTich}
                                                onChange={(e) => handleFormInputChange('quocTich', e.target.value)}
                                                placeholder="Nhập quốc tịch"
                                                autoComplete="off"
                                            />
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-tonGiao" className="candidate-modal-form-label">
                                                Tôn giáo
                                            </label>
                                            <input
                                                id="modal-tonGiao"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.tonGiao ? 'error' : ''}`}
                                                value={formData.tonGiao}
                                                onChange={(e) => handleFormInputChange('tonGiao', e.target.value)}
                                                placeholder="Nhập tôn giáo"
                                                autoComplete="off"
                                            />
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label id="modal-viTriUngTuyen-label" htmlFor="modal-viTriUngTuyen" className="candidate-modal-form-label">
                                                Vị trí ứng tuyển <span className="required">*</span>
                                            </label>
                                            <CustomDropdown
                                                id="modal-viTriUngTuyen"
                                                value={formData.viTriUngTuyen}
                                                onChange={(e) => handleFormInputChange('viTriUngTuyen', e.target.value)}
                                                options={viTriOptions}
                                                placeholder="Chọn vị trí ứng tuyển"
                                                error={formErrors.viTriUngTuyen}
                                                className="candidate-modal-form-input"
                                            />
                                            {formErrors.viTriUngTuyen && (
                                                <span className="candidate-modal-form-error">{formErrors.viTriUngTuyen}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 4: Phòng ban, Điện thoại di động, Điện thoại khác */}
                                    <div className="candidate-modal-form-row">
                                        <div className="candidate-modal-form-group">
                                            <label id="modal-phongBan-label" htmlFor="modal-phongBan" className="candidate-modal-form-label">
                                                Phòng ban <span className="required">*</span>
                                            </label>
                                            <CustomDropdown
                                                id="modal-phongBan"
                                                value={formData.phongBan}
                                                onChange={(e) => handleFormInputChange('phongBan', e.target.value)}
                                                options={phongBanOptions}
                                                placeholder="Chọn phòng ban"
                                                error={formErrors.phongBan}
                                                className="candidate-modal-form-input"
                                            />
                                            {formErrors.phongBan && (
                                                <span className="candidate-modal-form-error">{formErrors.phongBan}</span>
                                            )}
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-soDienThoai" className="candidate-modal-form-label">
                                                Điện thoại di động <span className="required">*</span>
                                            </label>
                                            <input
                                                id="modal-soDienThoai"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.soDienThoai ? 'error' : ''}`}
                                                value={formData.soDienThoai}
                                                onChange={(e) => handleFormInputChange('soDienThoai', e.target.value)}
                                                placeholder="Nhập số điện thoại"
                                                autoComplete="off"
                                            />
                                            {formErrors.soDienThoai && (
                                                <span className="candidate-modal-form-error">{formErrors.soDienThoai}</span>
                                            )}
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-soDienThoaiKhac" className="candidate-modal-form-label">
                                                Điện thoại khác
                                            </label>
                                            <input
                                                id="modal-soDienThoaiKhac"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.soDienThoaiKhac ? 'error' : ''}`}
                                                value={formData.soDienThoaiKhac}
                                                onChange={(e) => handleFormInputChange('soDienThoaiKhac', e.target.value)}
                                                placeholder="Nhập số điện thoại khác"
                                                autoComplete="off"
                                            />
                                        </div>
                                    </div>

                                    {/* Row 5: Email, Số CCCD, Ngày cấp */}
                                    <div className="candidate-modal-form-row">
                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-email" className="candidate-modal-form-label">
                                                Email
                                            </label>
                                            <input
                                                id="modal-email"
                                                type="email"
                                                className={`candidate-modal-form-input ${formErrors.email ? 'error' : ''}`}
                                                value={formData.email}
                                                onChange={(e) => handleFormInputChange('email', e.target.value)}
                                                placeholder="Nhập email"
                                                autoComplete="off"
                                            />
                                            {formErrors.email && (
                                                <span className="candidate-modal-form-error">{formErrors.email}</span>
                                            )}
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-cccd" className="candidate-modal-form-label">
                                                Số CCCD <span className="required">*</span>
                                            </label>
                                            <input
                                                id="modal-cccd"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.cccd ? 'error' : ''}`}
                                                value={formData.cccd}
                                                onChange={(e) => handleFormInputChange('cccd', e.target.value.replace(/\D/g, ''))}
                                                placeholder="Nhập số CCCD"
                                                autoComplete="off"
                                                maxLength={12}
                                            />
                                            {formErrors.cccd && (
                                                <span className="candidate-modal-form-error">{formErrors.cccd}</span>
                                            )}
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-ngayCapCCCD" className="candidate-modal-form-label">
                                                Ngày cấp <span className="required">*</span>
                                            </label>
                                            <DatePicker
                                                id="modal-ngayCapCCCD"
                                                selected={formData.ngayCapCCCD ? parseISODateString(formData.ngayCapCCCD) : null}
                                                onChange={(date) => handleFormDateChange('ngayCapCCCD', date)}
                                                onFocus={() => {
                                                    document.querySelectorAll('.custom-dropdown-wrapper.open').forEach(wrapper => {
                                                        const trigger = wrapper.querySelector('.custom-dropdown-trigger');
                                                        if (trigger) {
                                                            trigger.click();
                                                        }
                                                    });
                                                }}
                                                maxDate={today()}
                                                dateFormat="dd/MM/yyyy"
                                                locale={DATE_PICKER_LOCALE}
                                                className={`candidate-modal-form-input candidate-modal-datepicker ${formErrors.ngayCapCCCD ? 'error' : ''}`}
                                                placeholderText="Chọn ngày cấp"
                                                withPortal
                                                autoComplete="off"
                                                showYearDropdown
                                                showMonthDropdown
                                                dropdownMode="select"
                                                yearDropdownItemNumber={100}
                                                scrollableYearDropdown
                                                minDate={new Date(1900, 0, 1)}
                                            />
                                            {formErrors.ngayCapCCCD && (
                                                <span className="candidate-modal-form-error">{formErrors.ngayCapCCCD}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 6: Nơi cấp, Nguyên quán, Trình độ văn hóa */}
                                    <div className="candidate-modal-form-row">
                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-noiCapCCCD" className="candidate-modal-form-label">
                                                Nơi cấp <span className="required">*</span>
                                            </label>
                                            <input
                                                id="modal-noiCapCCCD"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.noiCapCCCD ? 'error' : ''}`}
                                                value={formData.noiCapCCCD}
                                                onChange={(e) => handleFormInputChange('noiCapCCCD', e.target.value)}
                                                placeholder="Nhập nơi cấp"
                                                autoComplete="off"
                                            />
                                            {formErrors.noiCapCCCD && (
                                                <span className="candidate-modal-form-error">{formErrors.noiCapCCCD}</span>
                                            )}
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-nguyenQuan" className="candidate-modal-form-label">
                                                Nguyên quán
                                            </label>
                                            <input
                                                id="modal-nguyenQuan"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.nguyenQuan ? 'error' : ''}`}
                                                value={formData.nguyenQuan}
                                                onChange={(e) => handleFormInputChange('nguyenQuan', e.target.value)}
                                                placeholder="Nhập nguyên quán"
                                                autoComplete="off"
                                            />
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-trinhDoVanHoa" className="candidate-modal-form-label">
                                                Trình độ văn hóa
                                            </label>
                                            <input
                                                id="modal-trinhDoVanHoa"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.trinhDoVanHoa ? 'error' : ''}`}
                                                value={formData.trinhDoVanHoa}
                                                onChange={(e) => handleFormInputChange('trinhDoVanHoa', e.target.value)}
                                                placeholder="Nhập trình độ văn hóa"
                                                autoComplete="off"
                                            />
                                        </div>
                                    </div>

                                    {/* Row 7: Trình độ chuyên môn, Chuyên ngành, Ngày gửi CV */}
                                    <div className="candidate-modal-form-row">
                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-trinhDoChuyenMon" className="candidate-modal-form-label">
                                                Trình độ chuyên môn
                                            </label>
                                            <input
                                                id="modal-trinhDoChuyenMon"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.trinhDoChuyenMon ? 'error' : ''}`}
                                                value={formData.trinhDoChuyenMon}
                                                onChange={(e) => handleFormInputChange('trinhDoChuyenMon', e.target.value)}
                                                placeholder="Nhập trình độ chuyên môn"
                                                autoComplete="off"
                                            />
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-chuyenNganh" className="candidate-modal-form-label">
                                                Chuyên ngành
                                            </label>
                                            <input
                                                id="modal-chuyenNganh"
                                                type="text"
                                                className={`candidate-modal-form-input ${formErrors.chuyenNganh ? 'error' : ''}`}
                                                value={formData.chuyenNganh}
                                                onChange={(e) => handleFormInputChange('chuyenNganh', e.target.value)}
                                                placeholder="Nhập chuyên ngành"
                                                autoComplete="off"
                                            />
                                        </div>

                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-ngayGuiCV" className="candidate-modal-form-label">
                                                Ngày gửi CV <span className="required">*</span>
                                            </label>
                                            <DatePicker
                                                id="modal-ngayGuiCV"
                                                selected={formData.ngayGuiCV ? parseISODateString(formData.ngayGuiCV) : null}
                                                onChange={(date) => handleFormDateChange('ngayGuiCV', date)}
                                                onFocus={() => {
                                                    document.querySelectorAll('.custom-dropdown-wrapper.open').forEach(wrapper => {
                                                        const trigger = wrapper.querySelector('.custom-dropdown-trigger');
                                                        if (trigger) {
                                                            trigger.click();
                                                        }
                                                    });
                                                }}
                                                maxDate={today()}
                                                dateFormat="dd/MM/yyyy"
                                                locale={DATE_PICKER_LOCALE}
                                                className={`candidate-modal-form-input candidate-modal-datepicker ${formErrors.ngayGuiCV ? 'error' : ''}`}
                                                placeholderText="Chọn ngày gửi CV"
                                                withPortal
                                                autoComplete="off"
                                            />
                                            {formErrors.ngayGuiCV && (
                                                <span className="candidate-modal-form-error">{formErrors.ngayGuiCV}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 8: Địa chỉ tạm trú */}
                                    <div className="candidate-modal-form-row candidate-modal-form-row--full">
                                        <div className="candidate-modal-form-group">
                                            <label htmlFor="modal-diaChiTamTru" className="candidate-modal-form-label">
                                                Địa chỉ tạm trú
                                            </label>
                                            <textarea
                                                id="modal-diaChiTamTru"
                                                className={`candidate-modal-form-input candidate-modal-form-textarea ${formErrors.diaChiTamTru ? 'error' : ''}`}
                                                value={formData.diaChiTamTru}
                                                onChange={(e) => handleFormInputChange('diaChiTamTru', e.target.value)}
                                                placeholder="Nhập địa chỉ tạm trú"
                                                autoComplete="off"
                                                rows="2"
                                            />
                                            {formErrors.diaChiTamTru && (
                                                <span className="candidate-modal-form-error">{formErrors.diaChiTamTru}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* File Upload */}
                                    <div className="candidate-modal-form-group candidate-modal-file-upload-group">
                                        <label className="candidate-modal-form-label">
                                            CV (PDF, DOC, DOCX)
                                        </label>
                                        <div
                                            className={`candidate-modal-file-upload ${dragActive ? 'drag-active' : ''} ${formData.cvFile ? 'has-file' : ''}`}
                                            onDragEnter={handleDrag}
                                            onDragLeave={handleDrag}
                                            onDragOver={handleDrag}
                                            onDrop={handleDrop}
                                        >
                                            <input
                                                type="file"
                                                id="modal-cvFile"
                                                accept=".pdf,.doc,.docx"
                                                onChange={handleFormFileChange}
                                                className="candidate-modal-file-input"
                                            />
                                            <div className="candidate-modal-file-content">
                                                <svg className="candidate-modal-file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a2 2 0 00-2.828-2.828L9 10.172 13.172 6l2 2zM4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                </svg>
                                                {formData.cvFile ? (
                                                    <div className="candidate-modal-file-info">
                                                        <span className="candidate-modal-file-name">{formData.cvFile.name}</span>
                                                        <span className="candidate-modal-file-size">
                                                            {(formData.cvFile.size / 1024 / 1024).toFixed(2)} MB
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="candidate-modal-file-info">
                                                        <span className="candidate-modal-file-text">Kéo thả file CV vào đây hoặc</span>
                                                        <span className="candidate-modal-file-link">chọn file</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {formErrors.cvFile && (
                                            <span className="candidate-modal-form-error">{formErrors.cvFile}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Section II: KINH NGHIỆM LÀM VIỆC */}
                                <div className="candidate-modal-form-section">
                                    <h3 className="candidate-modal-form-section-title">II. KINH NGHIỆM LÀM VIỆC</h3>

                                    <div className="candidate-experience-table-container">
                                        <table className="candidate-experience-table">
                                            <thead>
                                                <tr>
                                                    <th>Ngày bắt đầu</th>
                                                    <th>Ngày kết thúc</th>
                                                    <th>Công ty</th>
                                                    <th>Chức danh</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {kinhNghiemLamViec.map((kinhNghiem, index) => (
                                                    <tr key={index}>
                                                        <td>
                                                            <DatePicker
                                                                selected={kinhNghiem.ngayBatDau ? parseISODateString(kinhNghiem.ngayBatDau) : null}
                                                                onChange={(date) => handleKinhNghiemChange(index, 'ngayBatDau', date ? formatDateToISO(date) : '')}
                                                                maxDate={today()}
                                                                dateFormat="dd/MM/yyyy"
                                                                locale={DATE_PICKER_LOCALE}
                                                                className="candidate-experience-table-input candidate-modal-datepicker"
                                                                placeholderText="Chọn ngày"
                                                                withPortal
                                                                showYearDropdown
                                                                showMonthDropdown
                                                                dropdownMode="select"
                                                                yearDropdownItemNumber={100}
                                                                scrollableYearDropdown
                                                            />
                                                        </td>
                                                        <td>
                                                            <DatePicker
                                                                selected={kinhNghiem.ngayKetThuc ? parseISODateString(kinhNghiem.ngayKetThuc) : null}
                                                                onChange={(date) => handleKinhNghiemChange(index, 'ngayKetThuc', date ? formatDateToISO(date) : '')}
                                                                maxDate={today()}
                                                                dateFormat="dd/MM/yyyy"
                                                                locale={DATE_PICKER_LOCALE}
                                                                className="candidate-experience-table-input candidate-modal-datepicker"
                                                                placeholderText="Chọn ngày"
                                                                withPortal
                                                                showYearDropdown
                                                                showMonthDropdown
                                                                dropdownMode="select"
                                                                yearDropdownItemNumber={100}
                                                                scrollableYearDropdown
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="candidate-experience-table-input"
                                                                value={kinhNghiem.congTy}
                                                                onChange={(e) => handleKinhNghiemChange(index, 'congTy', e.target.value)}
                                                                placeholder="Nhập tên công ty"
                                                                autoComplete="off"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="candidate-experience-table-input"
                                                                value={kinhNghiem.chucDanh}
                                                                onChange={(e) => handleKinhNghiemChange(index, 'chucDanh', e.target.value)}
                                                                placeholder="Nhập chức danh"
                                                                autoComplete="off"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <button
                                            type="button"
                                            className="candidate-experience-add-btn"
                                            onClick={handleAddKinhNghiem}
                                        >
                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                            </svg>
                                            <span>Thêm kinh nghiệm</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Section III: QUÁ TRÌNH ĐÀO TẠO */}
                                <div className="candidate-modal-form-section">
                                    <h3 className="candidate-modal-form-section-title">III. QUÁ TRÌNH ĐÀO TẠO</h3>

                                    <div className="candidate-experience-table-container">
                                        <table className="candidate-experience-table">
                                            <thead>
                                                <tr>
                                                    <th>Ngày bắt đầu</th>
                                                    <th>Ngày kết thúc</th>
                                                    <th>Trường đào tạo</th>
                                                    <th>Chuyên ngành đào tạo</th>
                                                    <th>Văn bằng/ Chứng chỉ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {quaTrinhDaoTao.map((daoTao, index) => (
                                                    <tr key={index}>
                                                        <td>
                                                            <DatePicker
                                                                selected={daoTao.ngayBatDau ? parseISODateString(daoTao.ngayBatDau) : null}
                                                                onChange={(date) => handleQuaTrinhDaoTaoChange(index, 'ngayBatDau', date ? formatDateToISO(date) : '')}
                                                                maxDate={today()}
                                                                dateFormat="dd/MM/yyyy"
                                                                locale={DATE_PICKER_LOCALE}
                                                                className="candidate-experience-table-input candidate-modal-datepicker"
                                                                placeholderText="Chọn ngày"
                                                                withPortal
                                                                showYearDropdown
                                                                showMonthDropdown
                                                                dropdownMode="select"
                                                                yearDropdownItemNumber={100}
                                                                scrollableYearDropdown
                                                            />
                                                        </td>
                                                        <td>
                                                            <DatePicker
                                                                selected={daoTao.ngayKetThuc ? parseISODateString(daoTao.ngayKetThuc) : null}
                                                                onChange={(date) => handleQuaTrinhDaoTaoChange(index, 'ngayKetThuc', date ? formatDateToISO(date) : '')}
                                                                maxDate={today()}
                                                                dateFormat="dd/MM/yyyy"
                                                                locale={DATE_PICKER_LOCALE}
                                                                className="candidate-experience-table-input candidate-modal-datepicker"
                                                                placeholderText="Chọn ngày"
                                                                withPortal
                                                                showYearDropdown
                                                                showMonthDropdown
                                                                dropdownMode="select"
                                                                yearDropdownItemNumber={100}
                                                                scrollableYearDropdown
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="candidate-experience-table-input"
                                                                value={daoTao.truongDaoTao}
                                                                onChange={(e) => handleQuaTrinhDaoTaoChange(index, 'truongDaoTao', e.target.value)}
                                                                placeholder="Nhập tên trường đào tạo"
                                                                autoComplete="off"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="candidate-experience-table-input"
                                                                value={daoTao.chuyenNganhDaoTao}
                                                                onChange={(e) => handleQuaTrinhDaoTaoChange(index, 'chuyenNganhDaoTao', e.target.value)}
                                                                placeholder="Nhập chuyên ngành đào tạo"
                                                                autoComplete="off"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="candidate-experience-table-input"
                                                                value={daoTao.vanBangChungChi}
                                                                onChange={(e) => handleQuaTrinhDaoTaoChange(index, 'vanBangChungChi', e.target.value)}
                                                                placeholder="Nhập văn bằng/ chứng chỉ"
                                                                autoComplete="off"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <button
                                            type="button"
                                            className="candidate-experience-add-btn"
                                            onClick={handleAddQuaTrinhDaoTao}
                                        >
                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                            </svg>
                                            <span>Thêm quá trình đào tạo</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Section IV: TRÌNH ĐỘ NGOẠI NGỮ */}
                                <div className="candidate-modal-form-section">
                                    <h3 className="candidate-modal-form-section-title">IV. TRÌNH ĐỘ NGOẠI NGỮ</h3>

                                    <div className="candidate-experience-table-container">
                                        <table className="candidate-experience-table">
                                            <thead>
                                                <tr>
                                                    <th>Ngoại ngữ</th>
                                                    <th>Chứng chỉ</th>
                                                    <th>Điểm</th>
                                                    <th>Khả năng sử dụng</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trinhDoNgoaiNgu.map((ngoaiNgu, index) => (
                                                    <tr key={index}>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="candidate-experience-table-input"
                                                                value={ngoaiNgu.ngoaiNgu}
                                                                onChange={(e) => handleTrinhDoNgoaiNguChange(index, 'ngoaiNgu', e.target.value)}
                                                                placeholder="Nhập ngoại ngữ (ví dụ: Tiếng Anh)"
                                                                autoComplete="off"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="candidate-experience-table-input"
                                                                value={ngoaiNgu.chungChi}
                                                                onChange={(e) => handleTrinhDoNgoaiNguChange(index, 'chungChi', e.target.value)}
                                                                placeholder="Nhập chứng chỉ (ví dụ: TOEIC 750)"
                                                                autoComplete="off"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="candidate-experience-table-input"
                                                                value={ngoaiNgu.diem}
                                                                onChange={(e) => handleTrinhDoNgoaiNguChange(index, 'diem', e.target.value)}
                                                                placeholder="Nhập điểm"
                                                                autoComplete="off"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="candidate-experience-table-input"
                                                                value={ngoaiNgu.khaNangSuDung}
                                                                onChange={(e) => handleTrinhDoNgoaiNguChange(index, 'khaNangSuDung', e.target.value)}
                                                                placeholder="Nhập khả năng sử dụng"
                                                                autoComplete="off"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <button
                                            type="button"
                                            className="candidate-experience-add-btn"
                                            onClick={handleAddTrinhDoNgoaiNgu}
                                        >
                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                            </svg>
                                            <span>Thêm ngoại ngữ</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Form Actions */}
                                <div className="candidate-modal-form-actions">
                                    <button
                                        type="button"
                                        className="candidate-modal-btn candidate-modal-btn-preview"
                                        onClick={() => setIsPreviewModalOpen(true)}
                                        disabled={formLoading}
                                    >
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                        </svg>
                                        <span>Xem trước</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="candidate-modal-btn candidate-modal-btn-cancel"
                                        onClick={handleModalClose}
                                        disabled={formLoading}
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        className="candidate-modal-btn candidate-modal-btn-submit"
                                        disabled={formLoading}
                                    >
                                        {formLoading ? 'Đang lưu...' : 'Lưu lại'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {isPreviewModalOpen && (
                <div className="candidate-modal-overlay" onClick={() => setIsPreviewModalOpen(false)}>
                    <div className="candidate-preview-modal-box" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="candidate-modal-header">
                            <h2 className="candidate-modal-title">
                                <svg className="candidate-modal-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                </svg>
                                <span>Xem trước thông tin ứng viên</span>
                            </h2>
                            <button
                                type="button"
                                className="candidate-modal-close"
                                onClick={() => setIsPreviewModalOpen(false)}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Preview Content */}
                        <div className="candidate-preview-content-wrapper">
                            <div className="candidate-preview-content">
                                {/* Section I: THÔNG TIN CÁ NHÂN */}
                                <div className="candidate-preview-section">
                                    <h3 className="candidate-preview-section-title">I. THÔNG TIN CÁ NHÂN</h3>

                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-info-table">
                                            <tbody>
                                                <tr>
                                                    <td className="candidate-preview-label">Họ và tên</td>
                                                    <td className="candidate-preview-value">{formData.hoTen || '-'}</td>
                                                    <td className="candidate-preview-label">Giới tính</td>
                                                    <td className="candidate-preview-value">{formData.gioiTinh || '-'}</td>
                                                    <td className="candidate-preview-label">Ngày sinh</td>
                                                    <td className="candidate-preview-value">{formData.ngaySinh ? formatDateDisplay(formData.ngaySinh) : '-'}</td>
                                                    <td className="candidate-preview-label">Nơi sinh</td>
                                                    <td className="candidate-preview-value">{formData.noiSinh || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="candidate-preview-label">Tình trạng hôn nhân</td>
                                                    <td className="candidate-preview-value">{formData.tinhTrangHonNhan || '-'}</td>
                                                    <td className="candidate-preview-label">Dân tộc</td>
                                                    <td className="candidate-preview-value">{formData.danToc || '-'}</td>
                                                    <td className="candidate-preview-label">Quốc tịch</td>
                                                    <td className="candidate-preview-value">{formData.quocTich || '-'}</td>
                                                    <td className="candidate-preview-label">Tôn giáo</td>
                                                    <td className="candidate-preview-value">{formData.tonGiao || '-'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-info-table">
                                            <tbody>
                                                <tr>
                                                    <td className="candidate-preview-label">Số CCCD</td>
                                                    <td className="candidate-preview-value">{formData.cccd || '-'}</td>
                                                    <td className="candidate-preview-label">Ngày cấp</td>
                                                    <td className="candidate-preview-value">{formData.ngayCapCCCD ? formatDateDisplay(formData.ngayCapCCCD) : '-'}</td>
                                                    <td className="candidate-preview-label">Nơi cấp</td>
                                                    <td className="candidate-preview-value">{formData.noiCapCCCD || '-'}</td>
                                                    <td className="candidate-preview-label">Nguyên quán</td>
                                                    <td className="candidate-preview-value">{formData.nguyenQuan || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="candidate-preview-label">Điện thoại di động</td>
                                                    <td className="candidate-preview-value">{formData.soDienThoai || '-'}</td>
                                                    <td className="candidate-preview-label">Điện thoại khác</td>
                                                    <td className="candidate-preview-value">{formData.soDienThoaiKhac || '-'}</td>
                                                    <td className="candidate-preview-label" colSpan="2">Email</td>
                                                    <td className="candidate-preview-value" colSpan="2">{formData.email || '-'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-info-table">
                                            <tbody>
                                                <tr>
                                                    <td className="candidate-preview-label" rowSpan="2">Địa chỉ</td>
                                                    <td className="candidate-preview-sub-label">Địa chỉ thường trú</td>
                                                    <td className="candidate-preview-value" colSpan="4">{formData.diaChiTamTru || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="candidate-preview-sub-label">Địa chỉ liên lạc</td>
                                                    <td className="candidate-preview-value" colSpan="4">{formData.diaChiTamTru || '-'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-info-table">
                                            <tbody>
                                                <tr>
                                                    <td className="candidate-preview-label">Trình độ văn hóa</td>
                                                    <td className="candidate-preview-value">{formData.trinhDoVanHoa || '-'}</td>
                                                    <td className="candidate-preview-label">Trình độ chuyên môn</td>
                                                    <td className="candidate-preview-value">{formData.trinhDoChuyenMon || '-'}</td>
                                                    <td className="candidate-preview-label">Chuyên ngành</td>
                                                    <td className="candidate-preview-value">{formData.chuyenNganh || '-'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Section II: KINH NGHIỆM LÀM VIỆC */}
                                <div className="candidate-preview-section">
                                    <h3 className="candidate-preview-section-title">
                                        II. KINH NGHIỆM LÀM VIỆC
                                        <span className="candidate-preview-section-subtitle">
                                            (Nhập thông tin 05 kinh nghiệm gần nhất từ mới đến cũ)
                                        </span>
                                    </h3>

                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-data-table">
                                            <thead>
                                                <tr>
                                                    <th>Ngày bắt đầu</th>
                                                    <th>Ngày kết thúc</th>
                                                    <th>Công ty</th>
                                                    <th>Chức danh</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {kinhNghiemLamViec.map((kinhNghiem, index) => (
                                                    <tr key={index}>
                                                        <td>{kinhNghiem.ngayBatDau ? formatDateDisplay(kinhNghiem.ngayBatDau) : '-'}</td>
                                                        <td>{kinhNghiem.ngayKetThuc ? formatDateDisplay(kinhNghiem.ngayKetThuc) : '-'}</td>
                                                        <td>{kinhNghiem.congTy || '-'}</td>
                                                        <td>{kinhNghiem.chucDanh || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Section III: QUÁ TRÌNH ĐÀO TẠO */}
                                <div className="candidate-preview-section">
                                    <h3 className="candidate-preview-section-title">
                                        III. QUÁ TRÌNH ĐÀO TẠO
                                        <span className="candidate-preview-section-subtitle">
                                            (Nhập thông tin 05 văn bằng/ chứng chỉ chính từ mới đến cũ)
                                        </span>
                                    </h3>

                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-data-table">
                                            <thead>
                                                <tr>
                                                    <th>Ngày bắt đầu</th>
                                                    <th>Ngày kết thúc</th>
                                                    <th>Trường đào tạo</th>
                                                    <th>Chuyên ngành đào tạo</th>
                                                    <th>Văn bằng/ Chứng chỉ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {quaTrinhDaoTao.map((daoTao, index) => (
                                                    <tr key={index}>
                                                        <td>{daoTao.ngayBatDau ? formatDateDisplay(daoTao.ngayBatDau) : '-'}</td>
                                                        <td>{daoTao.ngayKetThuc ? formatDateDisplay(daoTao.ngayKetThuc) : '-'}</td>
                                                        <td>{daoTao.truongDaoTao || '-'}</td>
                                                        <td>{daoTao.chuyenNganhDaoTao || '-'}</td>
                                                        <td>{daoTao.vanBangChungChi || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Section IV: TRÌNH ĐỘ NGOẠI NGỮ */}
                                <div className="candidate-preview-section">
                                    <h3 className="candidate-preview-section-title">
                                        IV. TRÌNH ĐỘ NGOẠI NGỮ
                                        <span className="candidate-preview-section-subtitle">
                                            (Đánh giá Khả năng sử dụng theo mức độ: A: Giỏi, B: Khá, C: Trung bình, D: Kém)
                                        </span>
                                    </h3>

                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-data-table">
                                            <thead>
                                                <tr>
                                                    <th>Ngoại ngữ</th>
                                                    <th>Chứng chỉ</th>
                                                    <th>Điểm</th>
                                                    <th>Khả năng sử dụng</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trinhDoNgoaiNgu.map((ngoaiNgu, index) => (
                                                    <tr key={index}>
                                                        <td>{ngoaiNgu.ngoaiNgu || '-'}</td>
                                                        <td>{ngoaiNgu.chungChi || '-'}</td>
                                                        <td>{ngoaiNgu.diem || '-'}</td>
                                                        <td>{ngoaiNgu.khaNangSuDung || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview Actions */}
                        <div className="candidate-preview-actions">
                            <button
                                type="button"
                                className="candidate-modal-btn candidate-modal-btn-cancel"
                                onClick={() => setIsPreviewModalOpen(false)}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Interview Information Modal */}
            {isManagerSelectModalOpen && selectedCandidate && (
                <div className="candidate-action-modal-overlay" onClick={() => setIsManagerSelectModalOpen(false)}>
                    <div className="candidate-manager-select-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="candidate-action-modal-header">
                            <h2 className="candidate-action-modal-title">
                                Thông tin phỏng vấn
                            </h2>
                            <button
                                type="button"
                                className="candidate-action-modal-close"
                                onClick={() => setIsManagerSelectModalOpen(false)}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        <div className="candidate-manager-select-modal-content">
                            <div className="candidate-manager-select-inner">
                                <p className="candidate-manager-select-description">
                                    Điền thông tin phỏng vấn cho ứng viên <strong>{selectedCandidate.hoTen}</strong>
                                </p>

                                <div className="candidate-interview-form-fields">
                                    {/* Quản lý trực tiếp */}
                                    <div className="candidate-manager-select-field">
                                        <label className="candidate-manager-select-label">
                                            Quản lý trực tiếp <span className="required">*</span>
                                        </label>
                                        <CustomDropdown
                                            id="manager-select"
                                            value={selectedManagerId}
                                            onChange={(e) => {
                                                setSelectedManagerId(e.target.value);
                                                if (interviewFormErrors.selectedManagerId) {
                                                    setInterviewFormErrors(prev => ({
                                                        ...prev,
                                                        selectedManagerId: ''
                                                    }));
                                                }
                                            }}
                                            options={[
                                                { value: '', label: 'Chọn quản lý trực tiếp' },
                                                ...managers.map(manager => ({
                                                    value: String(manager.id),
                                                    label: `${manager.ho_ten}${manager.chuc_danh ? ` - ${manager.chuc_danh}` : ''}${manager.phong_ban ? ` (${manager.phong_ban})` : ''}`
                                                }))
                                            ]}
                                            placeholder="Chọn quản lý trực tiếp"
                                            className={`candidate-modal-form-input ${interviewFormErrors.selectedManagerId ? 'error' : ''}`}
                                            error={interviewFormErrors.selectedManagerId}
                                        />
                                        {interviewFormErrors.selectedManagerId && (
                                            <span className="candidate-modal-form-error">{interviewFormErrors.selectedManagerId}</span>
                                        )}
                                    </div>

                                    {/* Quản lý gián tiếp */}
                                    <div className="candidate-manager-select-field">
                                        <label className="candidate-manager-select-label">
                                            Quản lý gián tiếp
                                        </label>
                                        <CustomDropdown
                                            id="indirect-manager-select"
                                            value={selectedIndirectManagerId}
                                            onChange={(e) => {
                                                setSelectedIndirectManagerId(e.target.value);
                                            }}
                                            options={[
                                                { value: '', label: 'Chọn quản lý gián tiếp (Tùy chọn)' },
                                                ...indirectManagers.map(manager => ({
                                                    value: String(manager.id),
                                                    label: `${manager.ho_ten || manager.hoTen}${manager.chuc_danh || manager.chucDanh ? ` - ${manager.chuc_danh || manager.chucDanh}` : ''}${manager.phong_ban || manager.phongBan ? ` (${manager.phong_ban || manager.phongBan})` : ''}`
                                                }))
                                            ]}
                                            placeholder="Chọn quản lý gián tiếp (Tùy chọn)"
                                            className="candidate-modal-form-input"
                                        />
                                    </div>

                                    {/* Ngày phỏng vấn */}
                                    <div className="candidate-manager-select-field">
                                        <label htmlFor="interview-date" className="candidate-manager-select-label">
                                            Ngày phỏng vấn <span className="required">*</span>
                                        </label>
                                        <CustomDateInput
                                            id="interview-date"
                                            value={interviewDate}
                                            onChange={(e) => {
                                                setInterviewDate(e.target.value);
                                                if (interviewFormErrors.interviewDate) {
                                                    setInterviewFormErrors(prev => ({
                                                        ...prev,
                                                        interviewDate: ''
                                                    }));
                                                }
                                            }}
                                            min={new Date().toISOString().split('T')[0]}
                                            error={interviewFormErrors.interviewDate}
                                        />
                                        {interviewFormErrors.interviewDate && (
                                            <span className="candidate-modal-form-error">{interviewFormErrors.interviewDate}</span>
                                        )}
                                    </div>

                                    {/* Giờ phỏng vấn */}
                                    <div className="candidate-manager-select-field">
                                        <label htmlFor="interview-time" className="candidate-manager-select-label">
                                            Giờ phỏng vấn <span className="required">*</span>
                                        </label>
                                        <CustomTimeInput
                                            id="interview-time"
                                            value={interviewTime}
                                            onChange={(e) => {
                                                setInterviewTime(e.target.value);
                                                if (interviewFormErrors.interviewTime) {
                                                    setInterviewFormErrors(prev => ({
                                                        ...prev,
                                                        interviewTime: ''
                                                    }));
                                                }
                                            }}
                                            error={interviewFormErrors.interviewTime}
                                        />
                                        {interviewFormErrors.interviewTime && (
                                            <span className="candidate-modal-form-error">{interviewFormErrors.interviewTime}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="candidate-manager-select-actions">
                                    <button
                                        type="button"
                                        className="candidate-action-modal-btn candidate-action-modal-reject"
                                        onClick={() => {
                                            setIsManagerSelectModalOpen(false);
                                            setSelectedManagerId('');
                                            setSelectedIndirectManagerId('');
                                            setInterviewDate('');
                                            setInterviewTime('');
                                            setInterviewFormErrors({});
                                        }}
                                    >
                                        <span>Hủy</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="candidate-action-modal-btn candidate-action-modal-primary"
                                        onClick={handleCreateInterviewRequest}
                                        disabled={!selectedManagerId || !interviewDate || !interviewTime}
                                    >
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        <span>Gửi yêu cầu</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Candidate Detail Preview Modal - From selectedCandidate */}
            {isCandidatePreviewModalOpen && selectedCandidate && (
                <div className="candidate-modal-overlay" onClick={() => setIsCandidatePreviewModalOpen(false)}>
                    <div className="candidate-preview-modal-box" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="candidate-modal-header">
                            <h2 className="candidate-modal-title">
                                <svg className="candidate-modal-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                </svg>
                                <span>Chi tiết nhân viên</span>
                            </h2>
                            <button
                                type="button"
                                className="candidate-modal-close"
                                onClick={() => setIsCandidatePreviewModalOpen(false)}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Preview Content */}
                        <div className="candidate-preview-content-wrapper">
                            <div className="candidate-preview-content">
                                {/* Section I: THÔNG TIN CÁ NHÂN */}
                                <div className="candidate-preview-section">
                                    <h3 className="candidate-preview-section-title">I. THÔNG TIN CÁ NHÂN</h3>
                                    
                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-info-table">
                                            <tbody>
                                                <tr>
                                                    <td className="candidate-preview-label">Họ và tên</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.hoTen || selectedCandidate.ho_ten || '-'}</td>
                                                    <td className="candidate-preview-label">Giới tính</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.gioiTinh || selectedCandidate.gioi_tinh || '-'}</td>
                                                    <td className="candidate-preview-label">Ngày sinh</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.ngaySinh ? formatDateDisplay(selectedCandidate.ngaySinh) : '-'}</td>
                                                    <td className="candidate-preview-label">Nơi sinh</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.noiSinh || selectedCandidate.noi_sinh || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="candidate-preview-label">Tình trạng hôn nhân</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.tinhTrangHonNhan || selectedCandidate.tinh_trang_hon_nhan || '-'}</td>
                                                    <td className="candidate-preview-label">Dân tộc</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.danToc || selectedCandidate.dan_toc || '-'}</td>
                                                    <td className="candidate-preview-label">Quốc tịch</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.quocTich || selectedCandidate.quoc_tich || '-'}</td>
                                                    <td className="candidate-preview-label">Tôn giáo</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.tonGiao || selectedCandidate.ton_giao || '-'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-info-table">
                                            <tbody>
                                                <tr>
                                                    <td className="candidate-preview-label">Số CCCD</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.cccd || '-'}</td>
                                                    <td className="candidate-preview-label">Ngày cấp</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.ngayCapCCCD || selectedCandidate.ngay_cap_cccd ? formatDateDisplay(selectedCandidate.ngayCapCCCD || selectedCandidate.ngay_cap_cccd) : '-'}</td>
                                                    <td className="candidate-preview-label">Nơi cấp</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.noiCapCCCD || selectedCandidate.noi_cap_cccd || '-'}</td>
                                                    <td className="candidate-preview-label">Nguyên quán</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.nguyenQuan || selectedCandidate.nguyen_quan || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="candidate-preview-label">Điện thoại di động</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.soDienThoai || selectedCandidate.so_dien_thoai || '-'}</td>
                                                    <td className="candidate-preview-label">Điện thoại khác</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.soDienThoaiKhac || selectedCandidate.so_dien_thoai_khac || '-'}</td>
                                                    <td className="candidate-preview-label" colSpan="2">Email</td>
                                                    <td className="candidate-preview-value" colSpan="2">{selectedCandidate.email || '-'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-info-table">
                                            <tbody>
                                                <tr>
                                                    <td className="candidate-preview-label" rowSpan="2">Địa chỉ</td>
                                                    <td className="candidate-preview-sub-label">Địa chỉ thường trú</td>
                                                    <td className="candidate-preview-value" colSpan="4">{selectedCandidate.diaChiTamTru || selectedCandidate.dia_chi_tam_tru || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="candidate-preview-sub-label">Địa chỉ liên lạc</td>
                                                    <td className="candidate-preview-value" colSpan="4">{selectedCandidate.diaChiTamTru || selectedCandidate.dia_chi_tam_tru || '-'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-info-table">
                                            <tbody>
                                                <tr>
                                                    <td className="candidate-preview-label">Trình độ văn hóa</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.trinhDoVanHoa || selectedCandidate.trinh_do_van_hoa || '-'}</td>
                                                    <td className="candidate-preview-label">Trình độ chuyên môn</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.trinhDoChuyenMon || selectedCandidate.trinh_do_chuyen_mon || '-'}</td>
                                                    <td className="candidate-preview-label">Chuyên ngành</td>
                                                    <td className="candidate-preview-value">{selectedCandidate.chuyenNganh || selectedCandidate.chuyen_nganh || '-'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Section II: KINH NGHIỆM LÀM VIỆC */}
                                <div className="candidate-preview-section">
                                    <h3 className="candidate-preview-section-title">
                                        II. KINH NGHIỆM LÀM VIỆC
                                        <span className="candidate-preview-section-subtitle">
                                            (Nhập thông tin 05 kinh nghiệm gần nhất từ mới đến cũ)
                                        </span>
                                    </h3>
                                    
                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-data-table">
                                            <thead>
                                                <tr>
                                                    <th>Ngày bắt đầu</th>
                                                    <th>Ngày kết thúc</th>
                                                    <th>Công ty</th>
                                                    <th>Chức danh</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    try {
                                                        let kinhNghiem = selectedCandidate.kinhNghiemLamViec || selectedCandidate.kinh_nghiem_lam_viec;
                                                        if (typeof kinhNghiem === 'string') {
                                                            kinhNghiem = JSON.parse(kinhNghiem);
                                                        }
                                                        if (!kinhNghiem || !Array.isArray(kinhNghiem) || kinhNghiem.length === 0) {
                                                            return <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8' }}>Chưa có thông tin</td></tr>;
                                                        }
                                                        return kinhNghiem.map((kn, index) => (
                                                            <tr key={index}>
                                                                <td>{kn.ngayBatDau || kn.ngay_bat_dau ? formatDateDisplay(kn.ngayBatDau || kn.ngay_bat_dau) : '-'}</td>
                                                                <td>{kn.ngayKetThuc || kn.ngay_ket_thuc ? formatDateDisplay(kn.ngayKetThuc || kn.ngay_ket_thuc) : '-'}</td>
                                                                <td>{kn.congTy || kn.cong_ty || '-'}</td>
                                                                <td>{kn.chucDanh || kn.chuc_danh || '-'}</td>
                                                            </tr>
                                                        ));
                                                    } catch (e) {
                                                        console.error('Error parsing kinhNghiemLamViec:', e);
                                                        return <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8' }}>Chưa có thông tin</td></tr>;
                                                    }
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Section III: QUÁ TRÌNH ĐÀO TẠO */}
                                <div className="candidate-preview-section">
                                    <h3 className="candidate-preview-section-title">
                                        III. QUÁ TRÌNH ĐÀO TẠO
                                        <span className="candidate-preview-section-subtitle">
                                            (Nhập thông tin 05 văn bằng/ chứng chỉ chính từ mới đến cũ)
                                        </span>
                                    </h3>
                                    
                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-data-table">
                                            <thead>
                                                <tr>
                                                    <th>Ngày bắt đầu</th>
                                                    <th>Ngày kết thúc</th>
                                                    <th>Trường đào tạo</th>
                                                    <th>Chuyên ngành đào tạo</th>
                                                    <th>Văn bằng/ Chứng chỉ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    try {
                                                        let daoTao = selectedCandidate.quaTrinhDaoTao || selectedCandidate.qua_trinh_dao_tao;
                                                        if (typeof daoTao === 'string') {
                                                            daoTao = JSON.parse(daoTao);
                                                        }
                                                        if (!daoTao || !Array.isArray(daoTao) || daoTao.length === 0) {
                                                            return <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>Chưa có thông tin</td></tr>;
                                                        }
                                                        return daoTao.map((dt, index) => (
                                                            <tr key={index}>
                                                                <td>{dt.ngayBatDau || dt.ngay_bat_dau ? formatDateDisplay(dt.ngayBatDau || dt.ngay_bat_dau) : '-'}</td>
                                                                <td>{dt.ngayKetThuc || dt.ngay_ket_thuc ? formatDateDisplay(dt.ngayKetThuc || dt.ngay_ket_thuc) : '-'}</td>
                                                                <td>{dt.truongDaoTao || dt.truong_dao_tao || '-'}</td>
                                                                <td>{dt.chuyenNganhDaoTao || dt.chuyen_nganh_dao_tao || '-'}</td>
                                                                <td>{dt.vanBangChungChi || dt.van_bang_chung_chi || '-'}</td>
                                                            </tr>
                                                        ));
                                                    } catch (e) {
                                                        console.error('Error parsing quaTrinhDaoTao:', e);
                                                        return <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>Chưa có thông tin</td></tr>;
                                                    }
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Section IV: TRÌNH ĐỘ NGOẠI NGỮ */}
                                <div className="candidate-preview-section">
                                    <h3 className="candidate-preview-section-title">
                                        IV. TRÌNH ĐỘ NGOẠI NGỮ
                                        <span className="candidate-preview-section-subtitle">
                                            (Đánh giá Khả năng sử dụng theo mức độ: A: Giỏi, B: Khá, C: Trung bình, D: Kém)
                                        </span>
                                    </h3>
                                    
                                    <div className="candidate-preview-table">
                                        <table className="candidate-preview-data-table">
                                            <thead>
                                                <tr>
                                                    <th>Ngoại ngữ</th>
                                                    <th>Chứng chỉ</th>
                                                    <th>Điểm</th>
                                                    <th>Khả năng sử dụng</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    try {
                                                        let ngoaiNgu = selectedCandidate.trinhDoNgoaiNgu || selectedCandidate.trinh_do_ngoai_ngu;
                                                        if (typeof ngoaiNgu === 'string') {
                                                            ngoaiNgu = JSON.parse(ngoaiNgu);
                                                        }
                                                        if (!ngoaiNgu || !Array.isArray(ngoaiNgu) || ngoaiNgu.length === 0) {
                                                            return <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8' }}>Chưa có thông tin</td></tr>;
                                                        }
                                                        return ngoaiNgu.map((nn, index) => (
                                                            <tr key={index}>
                                                                <td>{nn.ngoaiNgu || nn.ngoai_ngu || '-'}</td>
                                                                <td>{nn.chungChi || nn.chung_chi || '-'}</td>
                                                                <td>{nn.diem || '-'}</td>
                                                                <td>{nn.khaNangSuDung || nn.kha_nang_su_dung || '-'}</td>
                                                            </tr>
                                                        ));
                                                    } catch (e) {
                                                        console.error('Error parsing trinhDoNgoaiNgu:', e);
                                                        return <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8' }}>Chưa có thông tin</td></tr>;
                                                    }
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview Actions */}
                        <div className="candidate-preview-actions">
                            <button
                                type="button"
                                className="candidate-modal-btn candidate-modal-btn-cancel"
                                onClick={() => setIsCandidatePreviewModalOpen(false)}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recruitment Requests List Modal */}
            {isRecruitmentRequestsModalOpen && (
                <div className="candidate-modal-overlay" onClick={() => setIsRecruitmentRequestsModalOpen(false)}>
                    <div className="recruitment-requests-list-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="recruitment-requests-list-modal-header">
                            <h2 className="recruitment-requests-list-modal-title">Yêu cầu tuyển nhân viên từ phòng ban</h2>
                            <button
                                type="button"
                                className="recruitment-requests-list-modal-close-btn"
                                onClick={() => setIsRecruitmentRequestsModalOpen(false)}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        <div className="recruitment-requests-list-modal-content">
                            {loadingRecruitmentRequests ? (
                                <div className="recruitment-requests-list-loading">
                                    <div className="candidate-management-spinner"></div>
                                    <p>Đang tải danh sách...</p>
                                </div>
                            ) : recruitmentRequests.length === 0 ? (
                                <div className="recruitment-requests-list-empty">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    <p>Chưa có yêu cầu tuyển dụng nào</p>
                                </div>
                            ) : (
                                <div className="recruitment-requests-list">
                                    {recruitmentRequests.map((request) => {
                                        const statusConfig = {
                                            'PENDING': { label: 'Chờ duyệt', color: '#f59e0b', bg: '#fef3c7' },
                                            'APPROVED': { label: 'Đã duyệt', color: '#10b981', bg: '#d1fae5' },
                                            'REJECTED': { label: 'Từ chối', color: '#ef4444', bg: '#fee2e2' },
                                            'IN_PROGRESS': { label: 'Đang xử lý', color: '#3b82f6', bg: '#dbeafe' },
                                            'COMPLETED': { label: 'Hoàn thành', color: '#8b5cf6', bg: '#ede9fe' }
                                        };
                                        const status = statusConfig[request.status] || statusConfig.PENDING;
                                        const createdDate = request.created_at ? formatDateDisplay(request.created_at) : '-';

                                        return (
                                            <div
                                                key={request.id}
                                                className="recruitment-request-card"
                                                onClick={() => handleViewRecruitmentRequestDetails(request.id)}
                                            >
                                                <div className="recruitment-request-card-header">
                                                    <div className="recruitment-request-card-title">
                                                        <h4>{request.chuc_danh_can_tuyen || request.chucDanhCanTuyen || 'Chức danh chưa xác định'}</h4>
                                                        <span className="recruitment-request-status-badge" style={{ color: status.color, background: status.bg }}>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    <div className="recruitment-request-card-meta">
                                                        <span>Phòng ban: <strong>{request.phong_ban || request.phongBan || '-'}</strong></span>
                                                        <span>Số lượng: <strong>{request.so_luong_yeu_cau || request.soLuongYeuCau || '-'}</strong></span>
                                                    </div>
                                                </div>
                                                <div className="recruitment-request-card-body">
                                                    <div className="recruitment-request-card-info">
                                                        <span>Người gửi: <strong>{request.manager_name || request.managerName || '-'}</strong></span>
                                                        <span>Ngày gửi: <strong>{createdDate}</strong></span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Recruitment Request Detail Modal */}
            {isRecruitmentRequestDetailModalOpen && selectedRecruitmentRequest && (
                <div className="candidate-modal-overlay" onClick={() => setIsRecruitmentRequestDetailModalOpen(false)}>
                    <div className="recruitment-request-detail-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="recruitment-request-detail-modal-header">
                            <h2 className="recruitment-request-detail-modal-title">Chi tiết yêu cầu tuyển dụng</h2>
                            <button
                                type="button"
                                className="recruitment-request-detail-modal-close-btn"
                                onClick={() => setIsRecruitmentRequestDetailModalOpen(false)}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        <div className="recruitment-request-detail-modal-content">
                            {/* Render form details - PHẦN I and PHẦN II */}
                            {/* This will reuse the same form structure from InterviewApprovals but in read-only mode */}
                            <RecruitmentRequestDetailView request={selectedRecruitmentRequest} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Component to display recruitment request details
const RecruitmentRequestDetailView = ({ request }) => {
    // Parse JSONB fields if needed
    const lyDoTuyen = request.ly_do_tuyen || request.lyDoTuyen || {};
    const tieuChuanTuyenChon = request.tieu_chuan_tuyen_chon || request.tieuChuanTuyenChon || {};

    return (
        <div className="recruitment-request-detail-view">
            {/* PHẦN I: VỊ TRÍ TUYỂN DỤNG */}
            <div className="recruitment-request-section">
                <div className="recruitment-request-section-header">
                    <h3 className="recruitment-request-section-title">PHẦN I: VỊ TRÍ TUYỂN DỤNG</h3>
                    <div className="recruitment-request-section-divider"></div>
                </div>

                <div className="recruitment-request-form-content">
                    {/* Display all fields from PHẦN I */}
                    <div className="recruitment-request-form-row recruitment-request-form-row-2cols">
                        <div className="recruitment-request-form-field">
                            <label className="recruitment-request-form-label">Chức danh cần tuyển</label>
                            <div className="recruitment-request-form-value">{request.chuc_danh_can_tuyen || request.chucDanhCanTuyen || '-'}</div>
                        </div>
                        <div className="recruitment-request-form-field">
                            <label className="recruitment-request-form-label">Số lượng yêu cầu</label>
                            <div className="recruitment-request-form-value">{request.so_luong_yeu_cau || request.soLuongYeuCau || '-'}</div>
                        </div>
                    </div>

                    <div className="recruitment-request-form-field">
                        <label className="recruitment-request-form-label">Phòng ban</label>
                        <div className="recruitment-request-form-value">{request.phong_ban || request.phongBan || '-'}</div>
                    </div>

                    <div className="recruitment-request-form-field">
                        <label className="recruitment-request-form-label">Người quản lý trực tiếp</label>
                        <div className="recruitment-request-form-value">{request.nguoi_quan_ly_truc_tiep || request.nguoiQuanLyTrucTiep || '-'}</div>
                    </div>

                    <div className="recruitment-request-form-field">
                        <label className="recruitment-request-form-label">Mô tả công việc</label>
                        <div className="recruitment-request-form-value">{request.mo_ta_cong_viec === 'co' || request.moTaCongViec === 'co' ? 'Có' : request.mo_ta_cong_viec === 'chua_co' || request.moTaCongViec === 'chua_co' ? 'Chưa có' : '-'}</div>
                    </div>

                    <div className="recruitment-request-form-field">
                        <label className="recruitment-request-form-label">Loại lao động</label>
                        <div className="recruitment-request-form-value">
                            {request.loai_lao_dong === 'thoi_vu' || request.loaiLaoDong === 'thoi_vu' ? 'Thời vụ' : 
                             request.loai_lao_dong === 'toan_thoi_gian' || request.loaiLaoDong === 'toan_thoi_gian' ? 'Toàn thời gian' : '-'}
                        </div>
                    </div>

                    <div className="recruitment-request-form-field">
                        <label className="recruitment-request-form-label">Lý do tuyển</label>
                        <div className="recruitment-request-form-value">
                            {lyDoTuyen.tuyenThayThe || lyDoTuyen.tuyen_thay_the ? `Tuyển thay thế: ${lyDoTuyen.tenNguoiThayThe || lyDoTuyen.ten_nguoi_thay_the || ''}` : ''}
                            {lyDoTuyen.nhuCauTang || lyDoTuyen.nhu_cau_tang ? 'Nhu cầu tăng' : ''}
                            {lyDoTuyen.viTriCongViecMoi || lyDoTuyen.vi_tri_cong_viec_moi ? 'Vị trí công việc mới' : ''}
                            {!lyDoTuyen.tuyenThayThe && !lyDoTuyen.nhuCauTang && !lyDoTuyen.viTriCongViecMoi && '-'}
                        </div>
                    </div>

                    {request.ly_do_khac_ghi_chu || request.lyDoKhacGhiChu ? (
                        <div className="recruitment-request-form-field">
                            <label className="recruitment-request-form-label">Lý do khác / ghi chú</label>
                            <div className="recruitment-request-form-value">{request.ly_do_khac_ghi_chu || request.lyDoKhacGhiChu}</div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* PHẦN II: TIÊU CHUẨN TUYỂN CHỌN */}
            {tieuChuanTuyenChon && Object.keys(tieuChuanTuyenChon).length > 0 && (
                <div className="recruitment-request-section">
                    <div className="recruitment-request-section-header">
                        <h3 className="recruitment-request-section-title">PHẦN II: TIÊU CHUẨN TUYỂN CHỌN</h3>
                        <div className="recruitment-request-section-divider"></div>
                    </div>

                    <div className="recruitment-request-form-content">
                        {/* Display all fields from PHẦN II */}
                        {/* Giới tính */}
                        {tieuChuanTuyenChon.gioiTinh && (
                            <div className="recruitment-request-form-row recruitment-request-form-row-2cols">
                                <div className="recruitment-request-form-field">
                                    <label className="recruitment-request-form-label">Giới tính</label>
                                    <div className="recruitment-request-form-value">
                                        {tieuChuanTuyenChon.gioiTinh.nam ? 'Nam' : ''}
                                        {tieuChuanTuyenChon.gioiTinh.nam && tieuChuanTuyenChon.gioiTinh.nu ? ', ' : ''}
                                        {tieuChuanTuyenChon.gioiTinh.nu ? 'Nữ' : ''}
                                        {!tieuChuanTuyenChon.gioiTinh.nam && !tieuChuanTuyenChon.gioiTinh.nu ? '-' : ''}
                                    </div>
                                </div>
                                <div className="recruitment-request-form-field">
                                    <label className="recruitment-request-form-label">Độ tuổi</label>
                                    <div className="recruitment-request-form-value">{tieuChuanTuyenChon.doTuoi || '-'}</div>
                                </div>
                            </div>
                        )}

                        {/* Trình độ học vấn */}
                        {tieuChuanTuyenChon.trinhDoHocVan && (
                            <div className="recruitment-request-form-row recruitment-request-form-row-2cols">
                                <div className="recruitment-request-form-field">
                                    <label className="recruitment-request-form-label">Trình độ học vấn</label>
                                    <div className="recruitment-request-form-value">
                                        {[
                                            tieuChuanTuyenChon.trinhDoHocVan.ptth && 'PTTH',
                                            tieuChuanTuyenChon.trinhDoHocVan.daiHoc && 'Đại học',
                                            tieuChuanTuyenChon.trinhDoHocVan.trungCapNghe && 'Trung cấp nghề',
                                            tieuChuanTuyenChon.trinhDoHocVan.caoHocTroLen && 'Cao học trở lên'
                                        ].filter(Boolean).join(', ') || '-'}
                                    </div>
                                </div>
                                <div className="recruitment-request-form-field">
                                    <label className="recruitment-request-form-label">Yêu cầu khác</label>
                                    <div className="recruitment-request-form-value">{tieuChuanTuyenChon.yeuCauKhacHocVan || '-'}</div>
                                </div>
                            </div>
                        )}

                        {/* Kinh nghiệm */}
                        {tieuChuanTuyenChon.kinhNghiem && (
                            <div className="recruitment-request-form-field">
                                <label className="recruitment-request-form-label">Kinh nghiệm</label>
                                <div className="recruitment-request-form-value">
                                    {tieuChuanTuyenChon.kinhNghiem.khong ? 'Không' :
                                     tieuChuanTuyenChon.kinhNghiem.soNamKinhNghiem && tieuChuanTuyenChon.kinhNghiem.soNam ? 
                                     `Số năm kinh nghiệm: ${tieuChuanTuyenChon.kinhNghiem.soNam}` : '-'}
                                </div>
                            </div>
                        )}

                        {/* Kiến thức */}
                        {tieuChuanTuyenChon.kienThuc && (
                            <div className="recruitment-request-form-field">
                                <label className="recruitment-request-form-label">Kiến thức</label>
                                <div className="recruitment-request-form-value">
                                    {tieuChuanTuyenChon.kienThuc.khong ? 'Không' :
                                     tieuChuanTuyenChon.kienThuc.nganhNghe && tieuChuanTuyenChon.kienThuc.nganhNgheValue ? 
                                     `Ngành nghề: ${tieuChuanTuyenChon.kienThuc.nganhNgheValue}` : '-'}
                                </div>
                            </div>
                        )}

                        {/* Ngoại ngữ */}
                        {tieuChuanTuyenChon.ngoaiNgu && (
                            <div className="recruitment-request-form-field">
                                <label className="recruitment-request-form-label">Ngoại ngữ</label>
                                <div className="recruitment-request-form-value">
                                    {[
                                        tieuChuanTuyenChon.ngoaiNgu.tiengAnh && `Tiếng Anh${tieuChuanTuyenChon.ngoaiNgu.trinhDoTiengAnh ? ` (${tieuChuanTuyenChon.ngoaiNgu.trinhDoTiengAnh})` : ''}`,
                                        tieuChuanTuyenChon.ngoaiNgu.ngoaiNguKhac && tieuChuanTuyenChon.ngoaiNgu.tenNgoaiNguKhac && 
                                        `${tieuChuanTuyenChon.ngoaiNgu.tenNgoaiNguKhac}${tieuChuanTuyenChon.ngoaiNgu.trinhDoNgoaiNguKhac ? ` (${tieuChuanTuyenChon.ngoaiNgu.trinhDoNgoaiNguKhac})` : ''}`
                                    ].filter(Boolean).join(', ') || '-'}
                                </div>
                            </div>
                        )}

                        {/* Vi tính */}
                        {tieuChuanTuyenChon.viTinh && (
                            <div className="recruitment-request-form-field">
                                <label className="recruitment-request-form-label">Vi tính</label>
                                <div className="recruitment-request-form-value">
                                    {tieuChuanTuyenChon.viTinh.khong ? 'Không' :
                                     [
                                         tieuChuanTuyenChon.viTinh.msOffice && 'MS Office (Word / Excel / Access)',
                                         tieuChuanTuyenChon.viTinh.khac && tieuChuanTuyenChon.viTinh.khacValue && 
                                         `Khác: ${tieuChuanTuyenChon.viTinh.khacValue}`
                                     ].filter(Boolean).join(', ') || '-'}
                                </div>
                            </div>
                        )}

                        {/* Kỹ năng */}
                        {tieuChuanTuyenChon.kyNang && (
                            <div className="recruitment-request-form-field">
                                <label className="recruitment-request-form-label">Kỹ năng</label>
                                <div className="recruitment-request-form-value">{tieuChuanTuyenChon.kyNang || '-'}</div>
                            </div>
                        )}

                        {/* Khả năng */}
                        {tieuChuanTuyenChon.khaNang && (
                            <div className="recruitment-request-form-field">
                                <label className="recruitment-request-form-label">Khả năng</label>
                                <div className="recruitment-request-form-value">{tieuChuanTuyenChon.khaNang || '-'}</div>
                            </div>
                        )}

                        {/* Ngoại hình */}
                        {tieuChuanTuyenChon.ngoaiHinh && (
                            <div className="recruitment-request-form-field">
                                <label className="recruitment-request-form-label">Ngoại hình</label>
                                <div className="recruitment-request-form-value">{tieuChuanTuyenChon.ngoaiHinh || '-'}</div>
                            </div>
                        )}

                        {/* Tính cách */}
                        {tieuChuanTuyenChon.tinhCach && (
                            <div className="recruitment-request-form-field">
                                <label className="recruitment-request-form-label">Tính cách</label>
                                <div className="recruitment-request-form-value">{tieuChuanTuyenChon.tinhCach || '-'}</div>
                            </div>
                        )}

                        {/* Ưu tiên */}
                        {tieuChuanTuyenChon.uuTien && (
                            <div className="recruitment-request-form-field">
                                <label className="recruitment-request-form-label">Ưu tiên</label>
                                <div className="recruitment-request-form-value">{tieuChuanTuyenChon.uuTien || '-'}</div>
                            </div>
                        )}

                        {/* Yêu cầu khác */}
                        {tieuChuanTuyenChon.yeuCauKhac && (
                            <div className="recruitment-request-form-field">
                                <label className="recruitment-request-form-label">Yêu cầu khác</label>
                                <div className="recruitment-request-form-value">{tieuChuanTuyenChon.yeuCauKhac || '-'}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CandidateManagement;

