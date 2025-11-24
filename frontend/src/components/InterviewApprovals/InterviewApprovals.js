import React, { useState, useEffect } from 'react';
import { candidatesAPI } from '../../services/api';
import { formatDateDisplay } from '../../utils/dateUtils';
import './InterviewApprovals.css';

const InterviewApprovals = ({ currentUser, showToast, showConfirm }) => {
    const [statistics, setStatistics] = useState({
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0
    });
    const [loadingStats, setLoadingStats] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState('PENDING'); // Default: "Chờ tôi duyệt"
    const [requests, setRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [rejectionNotes, setRejectionNotes] = useState('');
    const [showRejectionNotes, setShowRejectionNotes] = useState(false);
    const [processingAction, setProcessingAction] = useState(false);
    const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
    const [evaluationData, setEvaluationData] = useState({
        criteria: [
            { id: 1, name: 'Kỹ năng Giao tiếp', score: '', comment: '' },
            { id: 2, name: 'Thái độ Làm việc', score: '', comment: '' },
            { id: 3, name: 'Kỹ năng Chuyên môn', score: '', comment: '' },
            { id: 4, name: 'Khả năng Hợp tác', score: '', comment: '' },
            { id: 5, name: 'Tiềm năng Phát triển', score: '', comment: '' }
        ],
        strengths: '',
        areasForImprovement: '',
        generalComments: '',
        finalConclusion: '' // 'PASS', 'FAIL', 'HOLD'
    });
    const [submittingEvaluation, setSubmittingEvaluation] = useState(false);
    const [hasEvaluated, setHasEvaluated] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [previewCandidate, setPreviewCandidate] = useState(null);
    const [loadingCandidate, setLoadingCandidate] = useState(false);
    const [isRecruitmentRequestModalOpen, setIsRecruitmentRequestModalOpen] = useState(false);
    const [recruitmentRequestForm, setRecruitmentRequestForm] = useState({
        chucDanhCanTuyen: '',
        soLuongYeuCau: '',
        phongBan: '',
        moTaCongViec: '', // 'co' or 'chua_co'
        loaiLaoDong: '', // 'thoi_vu' or 'toan_thoi_gian'
        lyDoTuyen: {
            tuyenThayThe: false,
            tenNguoiThayThe: '',
            nhuCauTang: false,
            viTriCongViecMoi: false
        },
        lyDoKhacGhiChu: '',
        // PHẦN II: TIÊU CHUẨN TUYỂN CHỌN
        tieuChuanTuyenChon: {
            gioiTinh: {
                nam: false,
                nu: false
            },
            doTuoi: '',
            trinhDoHocVan: {
                ptth: false,
                daiHoc: false,
                trungCapNghe: false,
                caoHocTroLen: false
            },
            yeuCauKhacHocVan: '',
            kinhNghiem: {
                khong: false,
                soNamKinhNghiem: false,
                soNam: ''
            },
            kienThuc: {
                khong: false,
                nganhNghe: false,
                nganhNgheValue: ''
            },
            ngoaiNgu: {
                tiengAnh: false,
                trinhDoTiengAnh: '',
                ngoaiNguKhac: false,
                tenNgoaiNguKhac: '',
                trinhDoNgoaiNguKhac: ''
            },
            viTinh: {
                khong: false,
                msOffice: false,
                khac: false,
                khacValue: ''
            },
            kyNang: '',
            khaNang: '',
            ngoaiHinh: '',
            tinhCach: '',
            uuTien: '',
            yeuCauKhac: ''
        }
    });
    const [recruitmentRequestErrors, setRecruitmentRequestErrors] = useState({});
    const [submittingRecruitmentRequest, setSubmittingRecruitmentRequest] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [jobTitles, setJobTitles] = useState([]);
    const [loadingFormData, setLoadingFormData] = useState(false);
    const [showCustomPhongBan, setShowCustomPhongBan] = useState(false);
    const [showCustomViTri, setShowCustomViTri] = useState(false);
    const [customPhongBan, setCustomPhongBan] = useState('');
    const [customViTri, setCustomViTri] = useState('');

    // Mapping vị trí ứng tuyển từ code sang tên đầy đủ
    const viTriMap = {
        'MUAHANG': 'Mua hàng',
        'TAPVU_NAUAN': 'Tạp vụ & nấu ăn',
        'HAN_BOMACH': 'Hàn bo mạch',
        'CHATLUONG': 'Chất lượng',
        'KHAOSAT_THIETKE': 'Khảo sát thiết kế',
        'ADMIN_DUAN': 'Admin dự án',
        'LAPRAP': 'Lắp ráp',
        'LAPRAP_JIG_PALLET': 'Lắp ráp JIG, Pallet',
        'DIEN_LAPTRINH_PLC': 'Điện lập trình PLC',
        'THIETKE_MAY_TUDONG': 'Thiết kế máy tự động',
        'VANHANH_MAY_CNC': 'Vận hành máy CNC',
        'DICHVU_KYTHUAT': 'Dịch vụ Kỹ thuật',
        'KETOAN_NOIBO': 'Kế toán nội bộ',
        'KETOAN_BANHANG': 'Kế toán bán hàng'
    };

    // Mapping phòng ban từ code sang tên đầy đủ
    const phongBanMap = {
        'MUAHANG': 'Mua hàng',
        'HANHCHINH': 'Hành chính',
        'DVDT': 'DVĐT',
        'DTVT': 'DVĐT', // Alias
        'QA': 'QA',
        'KHAOSAT_THIETKE': 'Khảo sát thiết kế',
        'TUDONG': 'Tự động',
        'CNC': 'CNC',
        'DICHVU_KYTHUAT': 'Dịch vụ kỹ thuật',
        'KETOAN': 'Kế toán'
    };

    // Helper function để lấy tên đầy đủ từ code
    const getViTriName = (code) => {
        if (!code) return 'Chưa cập nhật';
        return viTriMap[code] || code;
    };

    const getPhongBanName = (code) => {
        if (!code) return 'Chưa cập nhật';
        return phongBanMap[code] || code;
    };

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Format time for display
    const formatTime = (timeString) => {
        if (!timeString) return '-';
        // timeString format: HH:mm or HH:mm:ss
        const timeParts = timeString.split(':');
        if (timeParts.length >= 2) {
            return `${timeParts[0]}:${timeParts[1]}`;
        }
        return timeString;
    };

    // Format date and time for interview display
    const formatInterviewDateTime = (dateString, timeString) => {
        if (!dateString) return 'Chưa có thông tin';

        // Handle date string (could be YYYY-MM-DD format)
        let date;
        if (typeof dateString === 'string' && dateString.includes('T')) {
            // ISO format with time
            date = new Date(dateString);
        } else if (typeof dateString === 'string' && dateString.includes('-')) {
            // YYYY-MM-DD format
            date = new Date(dateString + 'T00:00:00');
        } else {
            date = new Date(dateString);
        }

        if (isNaN(date.getTime())) return 'Chưa có thông tin';

        const formattedDate = date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            weekday: 'long'
        });

        const formattedTime = formatTime(timeString);
        return formattedTime !== '-' ? `${formattedDate}, ${formattedTime}` : formattedDate;
    };

    // Fetch interview requests based on selected status
    const fetchRequests = async () => {
        if (!currentUser?.id) return;

        setLoadingRequests(true);
        try {
            const params = {};
            // Backend will automatically filter by current user (direct or indirect manager)

            // Add status filter if not 'ALL'
            if (selectedStatus !== 'ALL') {
                params.status = selectedStatus;
            }

            const response = await candidatesAPI.getInterviewRequests(params);

            if (response.data?.success && Array.isArray(response.data.data)) {
                setRequests(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching interview requests:', error);
            if (showToast) {
                showToast('Không thể tải danh sách yêu cầu phỏng vấn.', 'error');
            }
        } finally {
            setLoadingRequests(false);
        }
    };

    // Fetch interview request statistics
    useEffect(() => {
        const fetchStatistics = async () => {
            if (!currentUser?.id) return;

            setLoadingStats(true);
            try {
                const params = {
                    managerId: currentUser.id
                };

                const response = await candidatesAPI.getInterviewRequests(params);

                if (response.data?.success && Array.isArray(response.data.data)) {
                    const allRequests = response.data.data;
                    const stats = {
                        pending: allRequests.filter(r => r.status === 'PENDING').length,
                        approved: allRequests.filter(r => r.status === 'APPROVED').length,
                        rejected: allRequests.filter(r => r.status === 'REJECTED').length,
                        total: allRequests.length
                    };
                    setStatistics(stats);
                }
            } catch (error) {
                console.error('Error fetching interview request statistics:', error);
            } finally {
                setLoadingStats(false);
            }
        };

        fetchStatistics();
    }, [currentUser]);

    // Fetch requests when status changes
    useEffect(() => {
        fetchRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStatus, currentUser]);

    // Handle status filter change
    const handleStatusChange = (status) => {
        setSelectedStatus(status);
    };

    // Handle view candidate details
    const handleViewCandidateDetails = async (e, request) => {
        e.stopPropagation(); // Prevent card click
        if (!request.candidate_id) {
            showToast?.('Không tìm thấy thông tin ứng viên', 'error');
            return;
        }

        setLoadingCandidate(true);
        setIsPreviewModalOpen(true);
        try {
            // Fetch candidate details
            const response = await candidatesAPI.getAll({});

            if (response.data?.success && Array.isArray(response.data.data)) {
                // Convert both IDs to numbers for comparison
                const targetId = parseInt(request.candidate_id, 10);

                const candidate = response.data.data.find(c => {
                    const candidateId = parseInt(c.id, 10);
                    return candidateId === targetId;
                });

                if (candidate) {
                    // Normalize candidate data - ensure all fields are available
                    const normalizedCandidate = {
                        ...candidate,
                        // Personal info
                        hoTen: candidate.hoTen || candidate.ho_ten || '',
                        gioiTinh: candidate.gioiTinh || candidate.gioi_tinh || '',
                        ngaySinh: candidate.ngaySinh || candidate.ngay_sinh || '',
                        noiSinh: candidate.noiSinh || candidate.noi_sinh || '',
                        tinhTrangHonNhan: candidate.tinhTrangHonNhan || candidate.tinh_trang_hon_nhan || '',
                        danToc: candidate.danToc || candidate.dan_toc || '',
                        quocTich: candidate.quocTich || candidate.quoc_tich || '',
                        tonGiao: candidate.tonGiao || candidate.ton_giao || '',
                        // Contact info
                        soDienThoai: candidate.soDienThoai || candidate.so_dien_thoai || '',
                        soDienThoaiKhac: candidate.soDienThoaiKhac || candidate.so_dien_thoai_khac || '',
                        email: candidate.email || '',
                        // CCCD info
                        cccd: candidate.cccd || '',
                        ngayCapCCCD: candidate.ngayCapCCCD || candidate.ngay_cap_cccd || '',
                        noiCapCCCD: candidate.noiCapCCCD || candidate.noi_cap_cccd || '',
                        nguyenQuan: candidate.nguyenQuan || candidate.nguyen_quan || '',
                        // Address
                        diaChiTamTru: candidate.diaChiTamTru || candidate.dia_chi_tam_tru || '',
                        // Education
                        trinhDoVanHoa: candidate.trinhDoVanHoa || candidate.trinh_do_van_hoa || '',
                        trinhDoChuyenMon: candidate.trinhDoChuyenMon || candidate.trinh_do_chuyen_mon || '',
                        chuyenNganh: candidate.chuyenNganh || candidate.chuyen_nganh || '',
                        // Work experience, education, languages (already objects or strings from JSONB)
                        kinhNghiemLamViec: candidate.kinhNghiemLamViec || candidate.kinh_nghiem_lam_viec || null,
                        quaTrinhDaoTao: candidate.quaTrinhDaoTao || candidate.qua_trinh_dao_tao || null,
                        trinhDoNgoaiNgu: candidate.trinhDoNgoaiNgu || candidate.trinh_do_ngoai_ngu || null,
                    };

                    setPreviewCandidate(normalizedCandidate);
                } else {
                    showToast?.('Không tìm thấy thông tin ứng viên', 'error');
                    setIsPreviewModalOpen(false);
                }
            } else {
                showToast?.('Không thể tải thông tin ứng viên', 'error');
                setIsPreviewModalOpen(false);
            }
        } catch (error) {
            console.error('Error fetching candidate details:', error);
            showToast?.('Không thể tải thông tin ứng viên', 'error');
            setIsPreviewModalOpen(false);
        } finally {
            setLoadingCandidate(false);
        }
    };

    // Handle row click to open detail modal
    const handleRequestClick = (request) => {
        setSelectedRequest(request);
        // If status is PENDING_EVALUATION, open evaluation modal instead
        if (request.status === 'PENDING_EVALUATION') {
            // Check if current user has already evaluated
            const isDirectManager = request.manager_id === currentUser?.id;
            const isIndirectManager = request.indirect_manager_id === currentUser?.id;

            let existingEvaluation = null;
            let userHasEvaluated = false;

            if (isDirectManager && request.direct_manager_evaluated && request.direct_manager_evaluation_data) {
                userHasEvaluated = true;
                try {
                    existingEvaluation = typeof request.direct_manager_evaluation_data === 'string'
                        ? JSON.parse(request.direct_manager_evaluation_data)
                        : request.direct_manager_evaluation_data;
                } catch (e) {
                    console.error('Error parsing direct manager evaluation:', e);
                }
            } else if (isIndirectManager && request.indirect_manager_evaluated && request.indirect_manager_evaluation_data) {
                userHasEvaluated = true;
                try {
                    existingEvaluation = typeof request.indirect_manager_evaluation_data === 'string'
                        ? JSON.parse(request.indirect_manager_evaluation_data)
                        : request.indirect_manager_evaluation_data;
                } catch (e) {
                    console.error('Error parsing indirect manager evaluation:', e);
                }
            }

            setHasEvaluated(userHasEvaluated);
            setIsEvaluationModalOpen(true);
            // Initialize with existing data if available, otherwise default
            if (existingEvaluation) {
                setEvaluationData({
                    criteria: existingEvaluation.criteria?.map((c, idx) => ({
                        id: idx + 1,
                        name: [
                            'Kỹ năng Giao tiếp',
                            'Thái độ Làm việc',
                            'Kỹ năng Chuyên môn',
                            'Khả năng Hợp tác',
                            'Tiềm năng Phát triển'
                        ][idx],
                        score: c.score || '',
                        comment: c.comment || ''
                    })) || [
                            { id: 1, name: 'Kỹ năng Giao tiếp', score: '', comment: '' },
                            { id: 2, name: 'Thái độ Làm việc', score: '', comment: '' },
                            { id: 3, name: 'Kỹ năng Chuyên môn', score: '', comment: '' },
                            { id: 4, name: 'Khả năng Hợp tác', score: '', comment: '' },
                            { id: 5, name: 'Tiềm năng Phát triển', score: '', comment: '' }
                        ],
                    strengths: existingEvaluation.strengths || '',
                    areasForImprovement: existingEvaluation.improvements || '',
                    generalComments: existingEvaluation.generalComments || '',
                    finalConclusion: existingEvaluation.finalConclusion || ''
                });
            } else {
                setEvaluationData({
                    criteria: [
                        { id: 1, name: 'Kỹ năng Giao tiếp', score: '', comment: '' },
                        { id: 2, name: 'Thái độ Làm việc', score: '', comment: '' },
                        { id: 3, name: 'Kỹ năng Chuyên môn', score: '', comment: '' },
                        { id: 4, name: 'Khả năng Hợp tác', score: '', comment: '' },
                        { id: 5, name: 'Tiềm năng Phát triển', score: '', comment: '' }
                    ],
                    strengths: '',
                    areasForImprovement: '',
                    generalComments: '',
                    finalConclusion: ''
                });
            }
        } else {
            setIsModalOpen(true);
            setShowRejectionNotes(false);
            setRejectionNotes('');
        }
    };

    // Handle close modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedRequest(null);
        setShowRejectionNotes(false);
        setRejectionNotes('');
        setProcessingAction(false);
    };

    // Handle close evaluation modal
    const handleCloseEvaluationModal = () => {
        setIsEvaluationModalOpen(false);
        setSelectedRequest(null);
        setEvaluationData({
            criteria: [
                { id: 1, name: 'Kỹ năng Giao tiếp', score: '', comment: '' },
                { id: 2, name: 'Thái độ Làm việc', score: '', comment: '' },
                { id: 3, name: 'Kỹ năng Chuyên môn', score: '', comment: '' },
                { id: 4, name: 'Khả năng Hợp tác', score: '', comment: '' },
                { id: 5, name: 'Tiềm năng Phát triển', score: '', comment: '' }
            ],
            strengths: '',
            areasForImprovement: '',
            generalComments: '',
            finalConclusion: ''
        });
        setSubmittingEvaluation(false);
    };

    // Handle criteria score change
    const handleCriteriaScoreChange = (criteriaId, value) => {
        const numValue = parseInt(value);
        if ((value === '' || (numValue >= 1 && numValue <= 5)) && !isNaN(numValue)) {
            setEvaluationData({
                ...evaluationData,
                criteria: evaluationData.criteria.map(c =>
                    c.id === criteriaId ? { ...c, score: value === '' ? '' : String(numValue) } : c
                )
            });
        }
    };

    // Handle criteria comment change
    const handleCriteriaCommentChange = (criteriaId, value) => {
        setEvaluationData({
            ...evaluationData,
            criteria: evaluationData.criteria.map(c =>
                c.id === criteriaId ? { ...c, comment: value } : c
            )
        });
    };

    // Handle submit evaluation
    const handleSubmitEvaluation = async () => {
        if (!selectedRequest) return;

        // Validate: Check if all criteria have scores
        const missingScores = evaluationData.criteria.filter(c => !c.score || c.score === '');
        if (missingScores.length > 0) {
            showToast?.('Vui lòng nhập điểm cho tất cả các tiêu chí', 'warning');
            return;
        }

        // Validate: Check if final conclusion is selected
        if (!evaluationData.finalConclusion) {
            showToast?.('Vui lòng chọn kết luận cuối cùng', 'warning');
            return;
        }

        setSubmittingEvaluation(true);
        try {
            const response = await candidatesAPI.submitInterviewEvaluation(selectedRequest.id, {
                userId: currentUser?.id, // Include current user ID
                criteria1: {
                    score: evaluationData.criteria[0]?.score || null,
                    comment: evaluationData.criteria[0]?.comment || ''
                },
                criteria2: {
                    score: evaluationData.criteria[1]?.score || null,
                    comment: evaluationData.criteria[1]?.comment || ''
                },
                criteria3: {
                    score: evaluationData.criteria[2]?.score || null,
                    comment: evaluationData.criteria[2]?.comment || ''
                },
                criteria4: {
                    score: evaluationData.criteria[3]?.score || null,
                    comment: evaluationData.criteria[3]?.comment || ''
                },
                criteria5: {
                    score: evaluationData.criteria[4]?.score || null,
                    comment: evaluationData.criteria[4]?.comment || ''
                },
                strengths: evaluationData.strengths,
                improvements: evaluationData.areasForImprovement,
                generalComments: evaluationData.generalComments,
                finalConclusion: evaluationData.finalConclusion
            });

            if (response.data?.success) {
                if (showToast) {
                    showToast('Đã gửi đánh giá phỏng vấn về HR thành công!', 'success');
                }
                handleCloseEvaluationModal();
                // Refresh requests and statistics
                fetchRequests();
                // Refetch statistics
                const statsResponse = await candidatesAPI.getInterviewRequests({ managerId: currentUser.id });
                if (statsResponse.data?.success && Array.isArray(statsResponse.data.data)) {
                    const allRequests = statsResponse.data.data;
                    setStatistics({
                        pending: allRequests.filter(r => r.status === 'PENDING').length,
                        approved: allRequests.filter(r => r.status === 'APPROVED').length,
                        rejected: allRequests.filter(r => r.status === 'REJECTED').length,
                        total: allRequests.length
                    });
                }
            } else {
                throw new Error(response.data?.message || 'Không thể gửi đánh giá');
            }
        } catch (error) {
            console.error('Error submitting evaluation:', error);
            if (showToast) {
                showToast(error.response?.data?.message || 'Không thể gửi đánh giá. Vui lòng thử lại.', 'error');
            }
        } finally {
            setSubmittingEvaluation(false);
        }
    };

    // Handle start interview (change status to PENDING_EVALUATION)
    const handleStartInterview = async () => {
        if (!selectedRequest) {
            console.error('No selected request');
            return;
        }

        console.log('Starting interview for request:', selectedRequest.id, 'Current status:', selectedRequest.status);
        setProcessingAction(true);
        try {
            const response = await candidatesAPI.updateInterviewRequestStatus(selectedRequest.id, {
                status: 'PENDING_EVALUATION',
                notes: ''
            });

            console.log('Response:', response);

            if (response && response.data && response.data.success) {
                if (showToast) {
                    showToast('Đã chuyển sang chờ đánh giá tiêu chí!', 'success');
                }
                handleCloseModal();
                // Refresh requests and statistics
                await fetchRequests();
                // Refetch statistics
                const statsResponse = await candidatesAPI.getInterviewRequests({ managerId: currentUser.id });
                if (statsResponse.data?.success && Array.isArray(statsResponse.data.data)) {
                    const allRequests = statsResponse.data.data;
                    setStatistics({
                        pending: allRequests.filter(r => r.status === 'PENDING').length,
                        approved: allRequests.filter(r => r.status === 'APPROVED').length,
                        rejected: allRequests.filter(r => r.status === 'REJECTED').length,
                        total: allRequests.length
                    });
                }
            } else {
                throw new Error(response.data?.message || 'Không thể chuyển trạng thái');
            }
        } catch (error) {
            console.error('Error starting interview:', error);
            console.error('Error response:', error.response);
            if (showToast) {
                showToast(error.response?.data?.message || error.message || 'Không thể chuyển trạng thái. Vui lòng thử lại.', 'error');
            }
        } finally {
            setProcessingAction(false);
        }
    };

    // Handle approve (after evaluation)
    const handleApprove = async () => {
        if (!selectedRequest) return;

        setProcessingAction(true);
        try {
            const response = await candidatesAPI.updateInterviewRequestStatus(selectedRequest.id, {
                status: 'APPROVED',
                notes: rejectionNotes || null
            });

            if (response.data?.success) {
                if (showToast) {
                    showToast('Đã duyệt yêu cầu phỏng vấn thành công!', 'success');
                }
                handleCloseModal();
                // Refresh requests and statistics
                fetchRequests();
                // Refetch statistics
                const statsResponse = await candidatesAPI.getInterviewRequests({ managerId: currentUser.id });
                if (statsResponse.data?.success && Array.isArray(statsResponse.data.data)) {
                    const allRequests = statsResponse.data.data;
                    setStatistics({
                        pending: allRequests.filter(r => r.status === 'PENDING').length,
                        approved: allRequests.filter(r => r.status === 'APPROVED').length,
                        rejected: allRequests.filter(r => r.status === 'REJECTED').length,
                        total: allRequests.length
                    });
                }
            } else {
                throw new Error(response.data?.message || 'Không thể duyệt yêu cầu');
            }
        } catch (error) {
            console.error('Error approving interview request:', error);
            if (showToast) {
                showToast(error.response?.data?.message || 'Không thể duyệt yêu cầu. Vui lòng thử lại.', 'error');
            }
        } finally {
            setProcessingAction(false);
        }
    };

    // Handle reject
    const handleReject = async () => {
        if (!selectedRequest) return;

        // Show rejection notes textarea if not shown
        if (!showRejectionNotes) {
            setShowRejectionNotes(true);
            return;
        }

        // Require rejection notes
        if (!rejectionNotes.trim()) {
            if (showToast) {
                showToast('Vui lòng nhập lý do từ chối.', 'error');
            }
            return;
        }

        setProcessingAction(true);
        try {
            const response = await candidatesAPI.updateInterviewRequestStatus(selectedRequest.id, {
                status: 'REJECTED',
                notes: rejectionNotes
            });

            if (response.data?.success) {
                if (showToast) {
                    showToast('Đã từ chối yêu cầu phỏng vấn.', 'success');
                }
                handleCloseModal();
                // Refresh requests and statistics
                fetchRequests();
                // Refetch statistics
                const statsResponse = await candidatesAPI.getInterviewRequests({ managerId: currentUser.id });
                if (statsResponse.data?.success && Array.isArray(statsResponse.data.data)) {
                    const allRequests = statsResponse.data.data;
                    setStatistics({
                        pending: allRequests.filter(r => r.status === 'PENDING').length,
                        approved: allRequests.filter(r => r.status === 'APPROVED').length,
                        rejected: allRequests.filter(r => r.status === 'REJECTED').length,
                        total: allRequests.length
                    });
                }
            } else {
                throw new Error(response.data?.message || 'Không thể từ chối yêu cầu');
            }
        } catch (error) {
            console.error('Error rejecting interview request:', error);
            if (showToast) {
                showToast(error.response?.data?.message || 'Không thể từ chối yêu cầu. Vui lòng thử lại.', 'error');
            }
        } finally {
            setProcessingAction(false);
        }
    };

    // Handle recruitment request form changes
    const handleRecruitmentRequestChange = (field, value) => {
        setRecruitmentRequestForm(prev => ({
            ...prev,
            [field]: value
        }));
        // Clear error for this field
        if (recruitmentRequestErrors[field]) {
            setRecruitmentRequestErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    const handleRecruitmentRequestLyDoChange = (field, value) => {
        setRecruitmentRequestForm(prev => ({
            ...prev,
            lyDoTuyen: {
                ...prev.lyDoTuyen,
                [field]: value
            }
        }));
    };

    const handleRecruitmentRequestTieuChuanChange = (field, value) => {
        setRecruitmentRequestForm(prev => ({
            ...prev,
            tieuChuan: {
                ...prev.tieuChuan,
                [field]: value
            }
        }));
    };

    const handleRecruitmentRequestTieuChuanNestedChange = (parentField, field, value) => {
        setRecruitmentRequestForm(prev => ({
            ...prev,
            tieuChuan: {
                ...prev.tieuChuan,
                [parentField]: {
                    ...prev.tieuChuan[parentField],
                    [field]: value
                }
            }
        }));
    };

    const handleTieuChuanTuyenChonChange = (field, value) => {
        setRecruitmentRequestForm(prev => ({
            ...prev,
            tieuChuanTuyenChon: {
                ...prev.tieuChuanTuyenChon,
                [field]: value
            }
        }));
    };

    const handleTieuChuanTuyenChonNestedChange = (section, field, value) => {
        setRecruitmentRequestForm(prev => ({
            ...prev,
            tieuChuanTuyenChon: {
                ...prev.tieuChuanTuyenChon,
                [section]: {
                    ...prev.tieuChuanTuyenChon[section],
                    [field]: value
                }
            }
        }));
    };

    // Fetch form data (departments from candidates, positions from candidates) when recruitment request modal opens
    useEffect(() => {
        const fetchFormData = async () => {
            if (!isRecruitmentRequestModalOpen) return;
            
            setLoadingFormData(true);
            try {
                // Fetch từng API riêng để tránh một API fail làm ảnh hưởng đến các API khác
                const fetchPromises = [
                    candidatesAPI.getDepartments().catch(err => {
                        console.error('❌ Error fetching departments:', err);
                        return { data: { success: false, data: [] } };
                    }),
                    candidatesAPI.getPositions().catch(err => {
                        console.error('❌ Error fetching positions:', err);
                        return { data: { success: false, data: [] } };
                    })
                ];

                const [departmentsRes, positionsRes] = await Promise.all(fetchPromises);

                // Xử lý departments
                if (departmentsRes.data?.success) {
                    const deptList = departmentsRes.data.data || [];
                    setDepartments(deptList);
                    console.log('✅ Departments loaded:', deptList);
                } else {
                    console.error('❌ Failed to load departments:', departmentsRes.data);
                    setDepartments([]);
                }

                // Xử lý positions
                if (positionsRes.data?.success) {
                    const positionList = positionsRes.data.data || [];
                    setJobTitles(positionList);
                    console.log('✅ Positions loaded:', positionList);
                } else {
                    console.error('❌ Failed to load positions:', positionsRes.data);
                    setJobTitles([]);
                }
            } catch (error) {
                console.error('Error fetching form data:', error);
                if (showToast) {
                    showToast('Lỗi khi tải dữ liệu form', 'error');
                }
            } finally {
                setLoadingFormData(false);
            }
        };

        fetchFormData();
    }, [isRecruitmentRequestModalOpen, showToast]);

    const handleCloseRecruitmentRequestModal = () => {
        setIsRecruitmentRequestModalOpen(false);
        setShowCustomPhongBan(false);
        setShowCustomViTri(false);
        setCustomPhongBan('');
        setCustomViTri('');
        setRecruitmentRequestForm({
            chucDanhCanTuyen: '',
            soLuongYeuCau: '',
            phongBan: '',
            moTaCongViec: '',
            loaiLaoDong: '',
            lyDoTuyen: {
                tuyenThayThe: false,
                tenNguoiThayThe: '',
                nhuCauTang: false,
                viTriCongViecMoi: false
            },
            lyDoKhacGhiChu: '',
            tieuChuanTuyenChon: {
                gioiTinh: {
                    nam: false,
                    nu: false
                },
                doTuoi: '',
                trinhDoHocVan: {
                    ptth: false,
                    daiHoc: false,
                    trungCapNghe: false,
                    caoHocTroLen: false
                },
                yeuCauKhacHocVan: '',
                kinhNghiem: {
                    khong: false,
                    soNamKinhNghiem: false,
                    soNam: ''
                },
                kienThuc: {
                    khong: false,
                    nganhNghe: false,
                    nganhNgheValue: ''
                },
                ngoaiNgu: {
                    tiengAnh: false,
                    trinhDoTiengAnh: '',
                    ngoaiNguKhac: false,
                    tenNgoaiNguKhac: '',
                    trinhDoNgoaiNguKhac: ''
                },
                viTinh: {
                    khong: false,
                    msOffice: false,
                    khac: false,
                    khacValue: ''
                },
                kyNang: '',
                khaNang: '',
                ngoaiHinh: '',
                tinhCach: '',
                uuTien: '',
                yeuCauKhac: ''
            }
        });
        setRecruitmentRequestErrors({});
    };

    const handleSubmitRecruitmentRequest = async (e) => {
        e.preventDefault();

        // Validation
        const errors = {};
        if (!recruitmentRequestForm.chucDanhCanTuyen.trim()) {
            errors.chucDanhCanTuyen = 'Vui lòng nhập chức danh cần tuyển';
        }
        if (!recruitmentRequestForm.soLuongYeuCau.trim()) {
            errors.soLuongYeuCau = 'Vui lòng nhập số lượng yêu cầu';
        }
        if (!recruitmentRequestForm.phongBan.trim()) {
            errors.phongBan = 'Vui lòng nhập phòng ban';
        }
        if (!recruitmentRequestForm.moTaCongViec) {
            errors.moTaCongViec = 'Vui lòng chọn trạng thái mô tả công việc';
        }
        if (!recruitmentRequestForm.loaiLaoDong) {
            errors.loaiLaoDong = 'Vui lòng chọn loại lao động';
        }
        const hasLyDo = recruitmentRequestForm.lyDoTuyen.tuyenThayThe ||
            recruitmentRequestForm.lyDoTuyen.nhuCauTang ||
            recruitmentRequestForm.lyDoTuyen.viTriCongViecMoi ||
            recruitmentRequestForm.lyDoKhacGhiChu.trim();
        if (!hasLyDo) {
            errors.lyDoTuyen = 'Vui lòng chọn ít nhất một lý do tuyển hoặc điền lý do khác';
        }
        if (recruitmentRequestForm.lyDoTuyen.tuyenThayThe && !recruitmentRequestForm.lyDoTuyen.tenNguoiThayThe.trim()) {
            errors.tenNguoiThayThe = 'Vui lòng nhập họ tên người được thay thế';
        }

        if (Object.keys(errors).length > 0) {
            setRecruitmentRequestErrors(errors);
            if (showToast) {
                showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'warning');
            }
            return;
        }

        setSubmittingRecruitmentRequest(true);
        try {
            // Determine manager type (DIRECT or INDIRECT)
            // For now, we'll determine based on current user role or use a default
            const managerType = 'DIRECT'; // TODO: Determine based on user role

            const requestData = {
                managerId: currentUser?.id || currentUser?.employeeId || currentUser?.employee_id,
                managerType: managerType,
                chucDanhCanTuyen: recruitmentRequestForm.chucDanhCanTuyen,
                soLuongYeuCau: recruitmentRequestForm.soLuongYeuCau,
                phongBan: recruitmentRequestForm.phongBan,
                moTaCongViec: recruitmentRequestForm.moTaCongViec,
                loaiLaoDong: recruitmentRequestForm.loaiLaoDong,
                lyDoTuyen: recruitmentRequestForm.lyDoTuyen,
                lyDoKhacGhiChu: recruitmentRequestForm.lyDoKhacGhiChu,
                tieuChuanTuyenChon: recruitmentRequestForm.tieuChuanTuyenChon
            };

            const response = await candidatesAPI.createRecruitmentRequest(requestData);

            if (response.data?.success) {
                if (showToast) {
                    showToast('Yêu cầu tuyển dụng đã được gửi thành công!', 'success');
                }
                handleCloseRecruitmentRequestModal();
            } else {
                throw new Error(response.data?.message || 'Không thể gửi yêu cầu');
            }
        } catch (error) {
            console.error('Error submitting recruitment request:', error);
            if (showToast) {
                showToast(error.response?.data?.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.', 'error');
            }
        } finally {
            setSubmittingRecruitmentRequest(false);
        }
    };

    return (
        <div className="interview-approvals-container">
            {/* Header Section */}
            <div className="interview-approvals-header">
                <div className="interview-approvals-header-content">
                    <div className="interview-approvals-icon-wrapper">
                        <svg className="interview-approvals-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h1 className="interview-approvals-title">Duyệt Yêu cầu Phỏng vấn</h1>
                        <p className="interview-approvals-subtitle">
                            Xem và xử lý các yêu cầu phỏng vấn ứng viên được HR gửi đến bạn.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="interview-approvals-recruitment-request-btn"
                        onClick={() => setIsRecruitmentRequestModalOpen(true)}
                    >
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        <span>Yêu cầu tuyển dụng</span>
                    </button>
                </div>
            </div>

            {/* Statistics Cards Section */}
            <div className="interview-approvals-statistics">
                {/* Chờ duyệt Card */}
                <div className="interview-stat-card interview-stat-card--pending">
                    <div className="interview-stat-card-content">
                        <div className="interview-stat-card-label">Chờ duyệt</div>
                        <div className="interview-stat-card-value">
                            {loadingStats ? '...' : statistics.pending}
                        </div>
                    </div>
                </div>

                {/* Đã duyệt Card */}
                <div className="interview-stat-card interview-stat-card--approved">
                    <div className="interview-stat-card-content">
                        <div className="interview-stat-card-label">Đã duyệt</div>
                        <div className="interview-stat-card-value">
                            {loadingStats ? '...' : statistics.approved}
                        </div>
                    </div>
                </div>

                {/* Đã từ chối Card */}
                <div className="interview-stat-card interview-stat-card--rejected">
                    <div className="interview-stat-card-content">
                        <div className="interview-stat-card-label">Đã từ chối</div>
                        <div className="interview-stat-card-value">
                            {loadingStats ? '...' : statistics.rejected}
                        </div>
                    </div>
                </div>

                {/* Tổng cộng Card */}
                <div className="interview-stat-card interview-stat-card--total">
                    <div className="interview-stat-card-content">
                        <div className="interview-stat-card-label">Tổng cộng</div>
                        <div className="interview-stat-card-value">
                            {loadingStats ? '...' : statistics.total}
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Filter Mini-Tabs */}
            <div className="interview-approvals-filter-tabs">
                <button
                    type="button"
                    className={`interview-filter-tab ${selectedStatus === 'PENDING' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('PENDING')}
                >
                    Chờ tôi duyệt
                </button>
                <button
                    type="button"
                    className={`interview-filter-tab ${selectedStatus === 'PENDING_EVALUATION' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('PENDING_EVALUATION')}
                >
                    Chờ đánh giá
                </button>
                <button
                    type="button"
                    className={`interview-filter-tab ${selectedStatus === 'APPROVED' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('APPROVED')}
                >
                    Đã duyệt
                </button>
                <button
                    type="button"
                    className={`interview-filter-tab ${selectedStatus === 'REJECTED' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('REJECTED')}
                >
                    Đã từ chối
                </button>
                <button
                    type="button"
                    className={`interview-filter-tab ${selectedStatus === 'ALL' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('ALL')}
                >
                    Tất cả
                </button>
            </div>

            {/* Requests List View */}
            <div className="interview-approvals-list">
                {loadingRequests ? (
                    <div className="interview-approvals-loading">
                        <div className="interview-approvals-spinner"></div>
                        <span>Đang tải danh sách yêu cầu...</span>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="interview-approvals-empty">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <p>Chưa có yêu cầu phỏng vấn nào</p>
                    </div>
                ) : (
                    <div className="interview-approvals-list-content">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className="interview-request-card"
                                onClick={() => handleRequestClick(request)}
                            >
                                <div className="interview-request-card-content">
                                    {/* Vị trí Ứng tuyển - Electric Blue Đậm (nổi bật nhất) */}
                                    <div className="interview-request-position">
                                        {getViTriName(request.vi_tri_ung_tuyen)}
                                    </div>

                                    {/* Phòng ban - Xám Trung tính */}
                                    <div className="interview-request-department">
                                        {getPhongBanName(request.phong_ban)}
                                    </div>

                                    {/* Ngày gửi - Xám Nhạt */}
                                    <div className="interview-request-date">
                                        Ngày gửi: {formatDate(request.created_at)}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="interview-request-actions" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        className="interview-request-view-details-btn"
                                        onClick={(e) => handleViewCandidateDetails(e, request)}
                                        title="Xem chi tiết thông tin ứng viên"
                                    >
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                        </svg>
                                        <span>Xem chi tiết</span>
                                    </button>
                                </div>

                                {/* Trạng thái Tag - Vàng/Cam Pastel */}
                                <div className="interview-request-status">
                                    <span className={`interview-request-status-badge interview-request-status-badge--${request.status?.toLowerCase().replace('_', '-')}`}>
                                        {request.status === 'PENDING' && 'Chờ duyệt'}
                                        {request.status === 'PENDING_EVALUATION' && 'Chờ đánh giá tiêu chí'}
                                        {request.status === 'APPROVED' && 'Đã duyệt'}
                                        {request.status === 'REJECTED' && 'Đã từ chối'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {isModalOpen && selectedRequest && (
                <div className="interview-detail-modal-overlay" onClick={handleCloseModal}>
                    <div className="interview-detail-modal-container" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="interview-detail-modal-header">
                            <h2 className="interview-detail-modal-title">Chi tiết Yêu cầu Phỏng vấn</h2>
                            <button
                                type="button"
                                className="interview-detail-modal-close"
                                onClick={handleCloseModal}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content - Read-only Information */}
                        <div className="interview-detail-modal-content">
                            <div className="interview-detail-section">
                                <div className="interview-detail-field">
                                    <label className="interview-detail-label">Tên ứng viên</label>
                                    <div className="interview-detail-value interview-detail-value--candidate-name">
                                        {selectedRequest.candidate_name || '-'}
                                    </div>
                                </div>

                                <div className="interview-detail-field">
                                    <label className="interview-detail-label">Ngày giờ phỏng vấn</label>
                                    <div className="interview-detail-value interview-detail-value--highlight">
                                        {formatInterviewDateTime(
                                            selectedRequest.interview_date || selectedRequest.interviewDate,
                                            selectedRequest.interview_time || selectedRequest.interviewTime
                                        )}
                                    </div>
                                </div>

                                <div className="interview-detail-field">
                                    <label className="interview-detail-label">Vị trí ứng tuyển</label>
                                    <div className="interview-detail-value interview-detail-value--highlight">
                                        {getViTriName(selectedRequest.vi_tri_ung_tuyen)}
                                    </div>
                                </div>

                                <div className="interview-detail-field">
                                    <label className="interview-detail-label">Phòng ban</label>
                                    <div className="interview-detail-value">{getPhongBanName(selectedRequest.phong_ban)}</div>
                                </div>

                                <div className="interview-detail-field">
                                    <label className="interview-detail-label">Số điện thoại</label>
                                    <div className="interview-detail-value">{selectedRequest.so_dien_thoai || '-'}</div>
                                </div>

                                <div className="interview-detail-field">
                                    <label className="interview-detail-label">Ngày gửi yêu cầu</label>
                                    <div className="interview-detail-value">{formatDate(selectedRequest.created_at)}</div>
                                </div>

                                {selectedRequest.notes && (
                                    <div className="interview-detail-field">
                                        <label className="interview-detail-label">Ghi chú từ HR</label>
                                        <div className="interview-detail-value">{selectedRequest.notes}</div>
                                    </div>
                                )}

                                {/* Rejection Notes Textarea (shown when clicking reject) */}
                                {showRejectionNotes && (
                                    <div className="interview-detail-field">
                                        <label className="interview-detail-label">
                                            Lý do từ chối <span className="interview-detail-required">*</span>
                                        </label>
                                        <textarea
                                            className="interview-detail-textarea"
                                            value={rejectionNotes}
                                            onChange={(e) => setRejectionNotes(e.target.value)}
                                            placeholder="Nhập lý do từ chối yêu cầu phỏng vấn..."
                                            rows={4}
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Bar */}
                        <div className="interview-detail-modal-actions">
                            <button
                                type="button"
                                className="interview-detail-action-btn interview-detail-action-btn--preview"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleViewCandidateDetails(e, selectedRequest);
                                }}
                                disabled={processingAction}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                </svg>
                                <span>Xem chi tiết ứng viên</span>
                            </button>
                            <button
                                type="button"
                                className="interview-detail-action-btn interview-detail-action-btn--cancel"
                                onClick={handleCloseModal}
                                disabled={processingAction}
                            >
                                Hủy
                            </button>
                            {selectedRequest.status === 'PENDING' && (
                                <>
                                    <button
                                        type="button"
                                        className="interview-detail-action-btn interview-detail-action-btn--reject"
                                        onClick={handleReject}
                                        disabled={processingAction}
                                    >
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                        </svg>
                                        <span>Từ chối</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="interview-detail-action-btn interview-detail-action-btn--approve"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('Phỏng vấn button clicked');
                                            handleStartInterview();
                                        }}
                                        disabled={processingAction}
                                    >
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                        </svg>
                                        <span>Phỏng vấn</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Evaluation Modal */}
            {isEvaluationModalOpen && selectedRequest && (
                <div className="interview-detail-modal-overlay" onClick={handleCloseEvaluationModal}>
                    <div className="interview-detail-modal-container" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="interview-evaluation-modal-header">
                            <h2 className="interview-evaluation-modal-title">
                                Đánh giá Ứng viên: {selectedRequest.candidate_name || 'N/A'}
                            </h2>
                            <button
                                type="button"
                                className="interview-evaluation-modal-close"
                                onClick={handleCloseEvaluationModal}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content - Evaluation Form */}
                        <div className="interview-evaluation-modal-content">
                            {/* 2.1. Phần 1: Đánh giá Theo Tiêu chí Cụ thể (Bảng) */}
                            <div className="interview-evaluation-section">
                                <h3 className="interview-evaluation-section-title">
                                    2.1. Đánh giá Theo Tiêu chí Cụ thể
                                </h3>
                                <div className="interview-evaluation-table-wrapper">
                                    <table className="interview-evaluation-table">
                                        <thead>
                                            <tr>
                                                <th>Tiêu chí</th>
                                                <th>Điểm (1-5)</th>
                                                <th>Bình luận</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {evaluationData.criteria.map((criterion, index) => (
                                                <tr key={criterion.id}>
                                                    <td className="interview-evaluation-criterion-name">
                                                        {criterion.name}
                                                    </td>
                                                    <td className="interview-evaluation-score-cell">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="5"
                                                            className="interview-evaluation-score-input"
                                                            value={criterion.score}
                                                            onChange={(e) => handleCriteriaScoreChange(criterion.id, e.target.value)}
                                                            placeholder="1-5"
                                                            required
                                                            disabled={hasEvaluated}
                                                            readOnly={hasEvaluated}
                                                        />
                                                    </td>
                                                    <td className="interview-evaluation-comment-cell">
                                                        <input
                                                            type="text"
                                                            className="interview-evaluation-comment-input"
                                                            value={criterion.comment}
                                                            onChange={(e) => handleCriteriaCommentChange(criterion.id, e.target.value)}
                                                            placeholder="Nhập bình luận chi tiết..."
                                                            disabled={hasEvaluated}
                                                            readOnly={hasEvaluated}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* 2.2. Phần 2: Nhận xét Chi tiết (Form Tự do) */}
                            <div className="interview-evaluation-section">
                                <h3 className="interview-evaluation-section-title">
                                    2.2. Nhận xét Chi tiết
                                </h3>
                                <div className="interview-evaluation-comments">
                                    <div className="interview-evaluation-form-group">
                                        <label className="interview-evaluation-form-label">
                                            Điểm mạnh (Strengths)
                                        </label>
                                        <textarea
                                            className="interview-evaluation-textarea"
                                            rows="4"
                                            value={evaluationData.strengths}
                                            onChange={(e) => setEvaluationData({ ...evaluationData, strengths: e.target.value })}
                                            placeholder="Nhập các điểm mạnh của ứng viên..."
                                            disabled={hasEvaluated}
                                            readOnly={hasEvaluated}
                                        />
                                    </div>

                                    <div className="interview-evaluation-form-group">
                                        <label className="interview-evaluation-form-label">
                                            Điểm cần cải thiện (Areas for Improvement)
                                        </label>
                                        <textarea
                                            className="interview-evaluation-textarea"
                                            rows="4"
                                            value={evaluationData.areasForImprovement}
                                            onChange={(e) => setEvaluationData({ ...evaluationData, areasForImprovement: e.target.value })}
                                            placeholder="Nhập các điểm cần cải thiện..."
                                            disabled={hasEvaluated}
                                            readOnly={hasEvaluated}
                                        />
                                    </div>

                                    <div className="interview-evaluation-form-group">
                                        <label className="interview-evaluation-form-label">
                                            Nhận xét chung / Đề xuất Mức lương
                                        </label>
                                        <textarea
                                            className="interview-evaluation-textarea"
                                            rows="4"
                                            value={evaluationData.generalComments}
                                            onChange={(e) => setEvaluationData({ ...evaluationData, generalComments: e.target.value })}
                                            placeholder="Nhập nhận xét chung và đề xuất mức lương nếu có..."
                                            disabled={hasEvaluated}
                                            readOnly={hasEvaluated}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 2.3. Phần 3: Kết luận Cuối cùng (Radio Buttons) */}
                            <div className="interview-evaluation-section">
                                <h3 className="interview-evaluation-section-title">
                                    2.3. Kết luận Cuối cùng <span className="required">*</span>
                                </h3>
                                <div className="interview-evaluation-conclusion">
                                    <label className={`interview-evaluation-radio-label ${evaluationData.finalConclusion === 'PASS' ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="finalConclusion"
                                            value="PASS"
                                            checked={evaluationData.finalConclusion === 'PASS'}
                                            onChange={(e) => setEvaluationData({ ...evaluationData, finalConclusion: e.target.value })}
                                            className="interview-evaluation-radio"
                                            disabled={hasEvaluated}
                                        />
                                        <span className="interview-evaluation-radio-text interview-evaluation-radio-text--pass">
                                            ĐẠT (PASS)
                                        </span>
                                    </label>

                                    <label className={`interview-evaluation-radio-label ${evaluationData.finalConclusion === 'FAIL' ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="finalConclusion"
                                            value="FAIL"
                                            checked={evaluationData.finalConclusion === 'FAIL'}
                                            onChange={(e) => setEvaluationData({ ...evaluationData, finalConclusion: e.target.value })}
                                            className="interview-evaluation-radio"
                                            disabled={hasEvaluated}
                                        />
                                        <span className="interview-evaluation-radio-text interview-evaluation-radio-text--fail">
                                            KHÔNG ĐẠT (FAIL)
                                        </span>
                                    </label>

                                    <label className={`interview-evaluation-radio-label ${evaluationData.finalConclusion === 'HOLD' ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="finalConclusion"
                                            value="HOLD"
                                            checked={evaluationData.finalConclusion === 'HOLD'}
                                            onChange={(e) => setEvaluationData({ ...evaluationData, finalConclusion: e.target.value })}
                                            className="interview-evaluation-radio"
                                            disabled={hasEvaluated}
                                        />
                                        <span className="interview-evaluation-radio-text interview-evaluation-radio-text--hold">
                                            LƯU HỒ SƠ (HOLD)
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Footer (Chân Modal) */}
                        <div className="interview-evaluation-modal-footer">
                            {hasEvaluated ? (
                                <>
                                    <div className="interview-evaluation-readonly-notice">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        <span>Bạn đã hoàn thành đánh giá. Đây là chế độ xem chỉ đọc.</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="interview-evaluation-footer-btn interview-evaluation-footer-btn--cancel"
                                        onClick={handleCloseEvaluationModal}
                                    >
                                        Đóng
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="interview-evaluation-footer-btn interview-evaluation-footer-btn--cancel"
                                        onClick={handleCloseEvaluationModal}
                                        disabled={submittingEvaluation}
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="button"
                                        className="interview-evaluation-footer-btn interview-evaluation-footer-btn--submit"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('Submit evaluation button clicked');
                                            handleSubmitEvaluation();
                                        }}
                                        disabled={submittingEvaluation || !evaluationData.finalConclusion}
                                    >
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                        </svg>
                                        <span>Lưu & Gửi Đánh giá</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Candidate Preview Modal */}
            {isPreviewModalOpen && (
                <div className="interview-detail-modal-overlay" onClick={() => setIsPreviewModalOpen(false)}>
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
                        {loadingCandidate ? (
                            <div className="interview-approvals-loading" style={{ padding: '3rem' }}>
                                <div className="interview-approvals-spinner"></div>
                                <span>Đang tải thông tin ứng viên...</span>
                            </div>
                        ) : previewCandidate ? (
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
                                                        <td className="candidate-preview-value">{previewCandidate.hoTen || previewCandidate.ho_ten || '-'}</td>
                                                        <td className="candidate-preview-label">Giới tính</td>
                                                        <td className="candidate-preview-value">{previewCandidate.gioiTinh || previewCandidate.gioi_tinh || '-'}</td>
                                                        <td className="candidate-preview-label">Ngày sinh</td>
                                                        <td className="candidate-preview-value">{previewCandidate.ngaySinh ? formatDateDisplay(previewCandidate.ngaySinh) : '-'}</td>
                                                        <td className="candidate-preview-label">Nơi sinh</td>
                                                        <td className="candidate-preview-value">{previewCandidate.noiSinh || previewCandidate.noi_sinh || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="candidate-preview-label">Tình trạng hôn nhân</td>
                                                        <td className="candidate-preview-value">{previewCandidate.tinhTrangHonNhan || previewCandidate.tinh_trang_hon_nhan || '-'}</td>
                                                        <td className="candidate-preview-label">Dân tộc</td>
                                                        <td className="candidate-preview-value">{previewCandidate.danToc || previewCandidate.dan_toc || '-'}</td>
                                                        <td className="candidate-preview-label">Quốc tịch</td>
                                                        <td className="candidate-preview-value">{previewCandidate.quocTich || previewCandidate.quoc_tich || '-'}</td>
                                                        <td className="candidate-preview-label">Tôn giáo</td>
                                                        <td className="candidate-preview-value">{previewCandidate.tonGiao || previewCandidate.ton_giao || '-'}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="candidate-preview-table">
                                            <table className="candidate-preview-info-table">
                                                <tbody>
                                                    <tr>
                                                        <td className="candidate-preview-label">Số CCCD</td>
                                                        <td className="candidate-preview-value">{previewCandidate.cccd || '-'}</td>
                                                        <td className="candidate-preview-label">Ngày cấp</td>
                                                        <td className="candidate-preview-value">{previewCandidate.ngayCapCCCD ? formatDateDisplay(previewCandidate.ngayCapCCCD) : '-'}</td>
                                                        <td className="candidate-preview-label">Nơi cấp</td>
                                                        <td className="candidate-preview-value">{previewCandidate.noiCapCCCD || previewCandidate.noi_cap_cccd || '-'}</td>
                                                        <td className="candidate-preview-label">Nguyên quán</td>
                                                        <td className="candidate-preview-value">{previewCandidate.nguyenQuan || previewCandidate.nguyen_quan || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="candidate-preview-label">Điện thoại di động</td>
                                                        <td className="candidate-preview-value">{previewCandidate.soDienThoai || previewCandidate.so_dien_thoai || '-'}</td>
                                                        <td className="candidate-preview-label">Điện thoại khác</td>
                                                        <td className="candidate-preview-value">{previewCandidate.soDienThoaiKhac || previewCandidate.so_dien_thoai_khac || '-'}</td>
                                                        <td className="candidate-preview-label" colSpan="2">Email</td>
                                                        <td className="candidate-preview-value" colSpan="2">{previewCandidate.email || '-'}</td>
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
                                                        <td className="candidate-preview-value" colSpan="4">{previewCandidate.diaChiTamTru || previewCandidate.dia_chi_tam_tru || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="candidate-preview-sub-label">Địa chỉ liên lạc</td>
                                                        <td className="candidate-preview-value" colSpan="4">{previewCandidate.diaChiTamTru || previewCandidate.dia_chi_tam_tru || '-'}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="candidate-preview-table">
                                            <table className="candidate-preview-info-table">
                                                <tbody>
                                                    <tr>
                                                        <td className="candidate-preview-label">Trình độ văn hóa</td>
                                                        <td className="candidate-preview-value">{previewCandidate.trinhDoVanHoa || previewCandidate.trinh_do_van_hoa || '-'}</td>
                                                        <td className="candidate-preview-label">Trình độ chuyên môn</td>
                                                        <td className="candidate-preview-value">{previewCandidate.trinhDoChuyenMon || previewCandidate.trinh_do_chuyen_mon || '-'}</td>
                                                        <td className="candidate-preview-label">Chuyên ngành</td>
                                                        <td className="candidate-preview-value">{previewCandidate.chuyenNganh || previewCandidate.chuyen_nganh || '-'}</td>
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
                                                            let kinhNghiem = previewCandidate.kinhNghiemLamViec || previewCandidate.kinh_nghiem_lam_viec;
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
                                                            let daoTao = previewCandidate.quaTrinhDaoTao || previewCandidate.qua_trinh_dao_tao;
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
                                                            let ngoaiNgu = previewCandidate.trinhDoNgoaiNgu || previewCandidate.trinh_do_ngoai_ngu;
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
                        ) : null}

                        {/* Preview Actions */}
                        <div className="candidate-preview-actions">
                            <button
                                type="button"
                                className="interview-detail-action-btn interview-detail-action-btn--cancel"
                                onClick={() => setIsPreviewModalOpen(false)}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recruitment Request Modal */}
            {isRecruitmentRequestModalOpen && (
                <div className="interview-approvals-modal-overlay" onClick={handleCloseRecruitmentRequestModal}>
                    <div className="recruitment-request-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="recruitment-request-modal-header">
                            <h2 className="recruitment-request-modal-title">Yêu cầu tuyển dụng</h2>
                            <button
                                type="button"
                                className="recruitment-request-modal-close-btn"
                                onClick={handleCloseRecruitmentRequestModal}
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmitRecruitmentRequest} className="recruitment-request-modal-form">
                            {/* PHẦN I: VỊ TRÍ TUYỂN DỤNG */}
                            <div className="recruitment-request-section">
                                <div className="recruitment-request-section-header">
                                    <h3 className="recruitment-request-section-title">PHẦN I: VỊ TRÍ TUYỂN DỤNG</h3>
                                    <div className="recruitment-request-section-divider"></div>
                                </div>

                                <div className="recruitment-request-form-content">
                                    {/* Chức danh cần tuyển và Số lượng yêu cầu - Cùng dòng */}
                                    <div className="recruitment-request-form-row recruitment-request-form-row-2cols">
                                        <div className="recruitment-request-form-field">
                                            <label className="recruitment-request-form-label">
                                                Vị trí ứng tuyển <span className="required">*</span>
                                            </label>
                                            <select
                                                className={`recruitment-request-form-input recruitment-request-form-select ${recruitmentRequestErrors.chucDanhCanTuyen ? 'error' : ''}`}
                                                value={recruitmentRequestForm.chucDanhCanTuyen}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    if (value === 'OTHER') {
                                                        setShowCustomViTri(true);
                                                        handleRecruitmentRequestChange('chucDanhCanTuyen', '');
                                                    } else {
                                                        setShowCustomViTri(false);
                                                        setCustomViTri('');
                                                        handleRecruitmentRequestChange('chucDanhCanTuyen', value);
                                                    }
                                                }}
                                                disabled={loadingFormData}
                                            >
                                                <option value="">-- Chọn vị trí ứng tuyển --</option>
                                                {jobTitles.map((position, index) => (
                                                    <option key={index} value={position}>{position}</option>
                                                ))}
                                                <option value="OTHER">-- Khác (Nhập mới) --</option>
                                            </select>
                                            {showCustomViTri && (
                                                <input
                                                    type="text"
                                                    className={`recruitment-request-form-input ${recruitmentRequestErrors.chucDanhCanTuyen ? 'error' : ''}`}
                                                    value={customViTri}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        setCustomViTri(value);
                                                        handleRecruitmentRequestChange('chucDanhCanTuyen', value);
                                                    }}
                                                    placeholder="Nhập vị trí ứng tuyển mới"
                                                    style={{ marginTop: '8px' }}
                                                />
                                            )}
                                            {recruitmentRequestErrors.chucDanhCanTuyen && (
                                                <span className="recruitment-request-error-text">{recruitmentRequestErrors.chucDanhCanTuyen}</span>
                                            )}
                                        </div>
                                        <div className="recruitment-request-form-field">
                                            <label className="recruitment-request-form-label">
                                                Số lượng yêu cầu <span className="required">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                className={`recruitment-request-form-input ${recruitmentRequestErrors.soLuongYeuCau ? 'error' : ''}`}
                                                value={recruitmentRequestForm.soLuongYeuCau}
                                                onChange={(e) => handleRecruitmentRequestChange('soLuongYeuCau', e.target.value)}
                                                placeholder="Nhập số lượng"
                                            />
                                            {recruitmentRequestErrors.soLuongYeuCau && (
                                                <span className="recruitment-request-error-text">{recruitmentRequestErrors.soLuongYeuCau}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ghi chú 1 */}
                                    <div className="recruitment-request-note">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '16px', height: '16px', color: '#6b7280', flexShrink: 0 }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        <span>Trường hợp tuyển nhiều vị trí khác nhau (hơn 5 vị trí): sử dụng biểu mẫu Kế hoạch nhân sự.</span>
                                    </div>

                                    {/* Ghi chú 2 */}
                                    <div className="recruitment-request-note">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '16px', height: '16px', color: '#6b7280', flexShrink: 0 }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        <span>Trường hợp tuyển dụng vị trí mới (chưa có Mô tả công việc trước đó): phải đính kèm Mô tả công việc.</span>
                                    </div>

                                    {/* Phòng ban */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">
                                            Phòng ban <span className="required">*</span>
                                        </label>
                                        <select
                                            className={`recruitment-request-form-input recruitment-request-form-select ${recruitmentRequestErrors.phongBan ? 'error' : ''}`}
                                            value={recruitmentRequestForm.phongBan}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value === 'OTHER') {
                                                    setShowCustomPhongBan(true);
                                                    handleRecruitmentRequestChange('phongBan', '');
                                                } else {
                                                    setShowCustomPhongBan(false);
                                                    setCustomPhongBan('');
                                                    handleRecruitmentRequestChange('phongBan', value);
                                                }
                                            }}
                                            disabled={loadingFormData}
                                        >
                                            <option value="">-- Chọn phòng ban --</option>
                                            {departments.map((dept, index) => (
                                                <option key={index} value={dept}>{dept}</option>
                                            ))}
                                            <option value="OTHER">-- Khác (Nhập mới) --</option>
                                        </select>
                                        {showCustomPhongBan && (
                                            <input
                                                type="text"
                                                className={`recruitment-request-form-input ${recruitmentRequestErrors.phongBan ? 'error' : ''}`}
                                                value={customPhongBan}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setCustomPhongBan(value);
                                                    handleRecruitmentRequestChange('phongBan', value);
                                                }}
                                                placeholder="Nhập phòng ban mới"
                                                style={{ marginTop: '8px' }}
                                            />
                                        )}
                                        {recruitmentRequestErrors.phongBan && (
                                            <span className="recruitment-request-error-text">{recruitmentRequestErrors.phongBan}</span>
                                        )}
                                    </div>

                                    {/* Mô tả công việc */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">
                                            Mô tả công việc <span className="required">*</span>
                                        </label>
                                        <div className="recruitment-request-checkbox-group">
                                            <label className="recruitment-request-checkbox-label">
                                                <input
                                                    type="radio"
                                                    name="moTaCongViec"
                                                    value="co"
                                                    checked={recruitmentRequestForm.moTaCongViec === 'co'}
                                                    onChange={(e) => handleRecruitmentRequestChange('moTaCongViec', e.target.value)}
                                                />
                                                <span>Có</span>
                                            </label>
                                            <label className="recruitment-request-checkbox-label">
                                                <input
                                                    type="radio"
                                                    name="moTaCongViec"
                                                    value="chua_co"
                                                    checked={recruitmentRequestForm.moTaCongViec === 'chua_co'}
                                                    onChange={(e) => handleRecruitmentRequestChange('moTaCongViec', e.target.value)}
                                                />
                                                <span>Chưa có</span>
                                            </label>
                                        </div>
                                        {recruitmentRequestErrors.moTaCongViec && (
                                            <span className="recruitment-request-error-text">{recruitmentRequestErrors.moTaCongViec}</span>
                                        )}
                                    </div>

                                    {/* Loại lao động */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">
                                            Loại lao động <span className="required">*</span>
                                        </label>
                                        <div className="recruitment-request-checkbox-group">
                                            <label className="recruitment-request-checkbox-label">
                                                <input
                                                    type="radio"
                                                    name="loaiLaoDong"
                                                    value="thoi_vu"
                                                    checked={recruitmentRequestForm.loaiLaoDong === 'thoi_vu'}
                                                    onChange={(e) => handleRecruitmentRequestChange('loaiLaoDong', e.target.value)}
                                                />
                                                <span>Thời vụ</span>
                                            </label>
                                            <label className="recruitment-request-checkbox-label">
                                                <input
                                                    type="radio"
                                                    name="loaiLaoDong"
                                                    value="toan_thoi_gian"
                                                    checked={recruitmentRequestForm.loaiLaoDong === 'toan_thoi_gian'}
                                                    onChange={(e) => handleRecruitmentRequestChange('loaiLaoDong', e.target.value)}
                                                />
                                                <span>Toàn thời gian</span>
                                            </label>
                                        </div>
                                        {recruitmentRequestErrors.loaiLaoDong && (
                                            <span className="recruitment-request-error-text">{recruitmentRequestErrors.loaiLaoDong}</span>
                                        )}
                                    </div>

                                    {/* Lý do tuyển */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">
                                            Lý do tuyển <span className="required">*</span>
                                        </label>
                                        <div className="recruitment-request-lydo-group">
                                            <label className="recruitment-request-checkbox-label recruitment-request-checkbox-label-with-input">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.lyDoTuyen.tuyenThayThe}
                                                    onChange={(e) => handleRecruitmentRequestLyDoChange('tuyenThayThe', e.target.checked)}
                                                />
                                                <span>Tuyển thay thế (họ tên) :</span>
                                                <input
                                                    type="text"
                                                    className={`recruitment-request-form-input recruitment-request-form-input-inline ${recruitmentRequestErrors.tenNguoiThayThe ? 'error' : ''}`}
                                                    value={recruitmentRequestForm.lyDoTuyen.tenNguoiThayThe}
                                                    onChange={(e) => handleRecruitmentRequestLyDoChange('tenNguoiThayThe', e.target.value)}
                                                    placeholder="Nhập họ tên"
                                                    disabled={!recruitmentRequestForm.lyDoTuyen.tuyenThayThe}
                                                />
                                            </label>
                                            {recruitmentRequestForm.lyDoTuyen.tuyenThayThe && recruitmentRequestErrors.tenNguoiThayThe && (
                                                <span className="recruitment-request-error-text" style={{ marginLeft: '2rem' }}>{recruitmentRequestErrors.tenNguoiThayThe}</span>
                                            )}
                                            <label className="recruitment-request-checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.lyDoTuyen.nhuCauTang}
                                                    onChange={(e) => handleRecruitmentRequestLyDoChange('nhuCauTang', e.target.checked)}
                                                />
                                                <span>Nhu cầu tăng</span>
                                            </label>
                                            <label className="recruitment-request-checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.lyDoTuyen.viTriCongViecMoi}
                                                    onChange={(e) => handleRecruitmentRequestLyDoChange('viTriCongViecMoi', e.target.checked)}
                                                />
                                                <span>Vị trí công việc mới</span>
                                            </label>
                                        </div>
                                        {recruitmentRequestErrors.lyDoTuyen && (
                                            <span className="recruitment-request-error-text">{recruitmentRequestErrors.lyDoTuyen}</span>
                                        )}
                                    </div>

                                    {/* Lý do khác / ghi chú */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">Lý do khác / ghi chú</label>
                                        <textarea
                                            className="recruitment-request-form-textarea"
                                            value={recruitmentRequestForm.lyDoKhacGhiChu}
                                            onChange={(e) => handleRecruitmentRequestChange('lyDoKhacGhiChu', e.target.value)}
                                            placeholder="Nhập lý do khác hoặc ghi chú (nếu có)"
                                            rows="4"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* PHẦN II: TIÊU CHUẨN TUYỂN CHỌN */}
                            <div className="recruitment-request-section">
                                <div className="recruitment-request-section-header">
                                    <h3 className="recruitment-request-section-title">PHẦN II: TIÊU CHUẨN TUYỂN CHỌN</h3>
                                    <div className="recruitment-request-section-divider"></div>
                                </div>

                                <div className="recruitment-request-form-content">
                                    {/* Giới tính và Độ tuổi */}
                                    <div className="recruitment-request-form-row recruitment-request-form-row-2cols">
                                        <div className="recruitment-request-form-field">
                                            <label className="recruitment-request-form-label">Giới tính</label>
                                            <div className="recruitment-request-checkbox-group">
                                                <label className="recruitment-request-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={recruitmentRequestForm.tieuChuanTuyenChon.gioiTinh.nam}
                                                        onChange={(e) => handleTieuChuanTuyenChonNestedChange('gioiTinh', 'nam', e.target.checked)}
                                                    />
                                                    <span>Nam</span>
                                                </label>
                                                <label className="recruitment-request-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={recruitmentRequestForm.tieuChuanTuyenChon.gioiTinh.nu}
                                                        onChange={(e) => handleTieuChuanTuyenChonNestedChange('gioiTinh', 'nu', e.target.checked)}
                                                    />
                                                    <span>Nữ</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div className="recruitment-request-form-field">
                                            <label className="recruitment-request-form-label">Độ tuổi</label>
                                            <input
                                                type="text"
                                                className="recruitment-request-form-input"
                                                value={recruitmentRequestForm.tieuChuanTuyenChon.doTuoi}
                                                onChange={(e) => handleTieuChuanTuyenChonChange('doTuoi', e.target.value)}
                                                placeholder="Ví dụ: 25-35"
                                            />
                                        </div>
                                    </div>

                                    {/* Trình độ học vấn */}
                                    <div className="recruitment-request-form-row recruitment-request-form-row-2cols">
                                        <div className="recruitment-request-form-field">
                                            <label className="recruitment-request-form-label">Trình độ học vấn</label>
                                            <div className="recruitment-request-checkbox-group" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                                                <div style={{ display: 'flex', gap: '1.5rem' }}>
                                                    <label className="recruitment-request-checkbox-label">
                                                        <input
                                                            type="checkbox"
                                                            checked={recruitmentRequestForm.tieuChuanTuyenChon.trinhDoHocVan.ptth}
                                                            onChange={(e) => handleTieuChuanTuyenChonNestedChange('trinhDoHocVan', 'ptth', e.target.checked)}
                                                        />
                                                        <span>PTTH</span>
                                                    </label>
                                                    <label className="recruitment-request-checkbox-label">
                                                        <input
                                                            type="checkbox"
                                                            checked={recruitmentRequestForm.tieuChuanTuyenChon.trinhDoHocVan.daiHoc}
                                                            onChange={(e) => handleTieuChuanTuyenChonNestedChange('trinhDoHocVan', 'daiHoc', e.target.checked)}
                                                        />
                                                        <span>Đại học</span>
                                                    </label>
                                                </div>
                                                <div style={{ display: 'flex', gap: '1.5rem' }}>
                                                    <label className="recruitment-request-checkbox-label">
                                                        <input
                                                            type="checkbox"
                                                            checked={recruitmentRequestForm.tieuChuanTuyenChon.trinhDoHocVan.trungCapNghe}
                                                            onChange={(e) => handleTieuChuanTuyenChonNestedChange('trinhDoHocVan', 'trungCapNghe', e.target.checked)}
                                                        />
                                                        <span>Trung cấp nghề</span>
                                                    </label>
                                                    <label className="recruitment-request-checkbox-label">
                                                        <input
                                                            type="checkbox"
                                                            checked={recruitmentRequestForm.tieuChuanTuyenChon.trinhDoHocVan.caoHocTroLen}
                                                            onChange={(e) => handleTieuChuanTuyenChonNestedChange('trinhDoHocVan', 'caoHocTroLen', e.target.checked)}
                                                        />
                                                        <span>Cao học trở lên</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="recruitment-request-form-field">
                                            <label className="recruitment-request-form-label">Yêu cầu khác</label>
                                            <input
                                                type="text"
                                                className="recruitment-request-form-input"
                                                value={recruitmentRequestForm.tieuChuanTuyenChon.yeuCauKhacHocVan}
                                                onChange={(e) => handleTieuChuanTuyenChonChange('yeuCauKhacHocVan', e.target.value)}
                                                placeholder="Nhập yêu cầu khác"
                                            />
                                        </div>
                                    </div>

                                    {/* Kinh nghiệm */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">Kinh nghiệm</label>
                                        <div className="recruitment-request-checkbox-group">
                                            <label className="recruitment-request-checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.tieuChuanTuyenChon.kinhNghiem.khong}
                                                    onChange={(e) => {
                                                        handleTieuChuanTuyenChonNestedChange('kinhNghiem', 'khong', e.target.checked);
                                                        if (e.target.checked) {
                                                            handleTieuChuanTuyenChonNestedChange('kinhNghiem', 'soNamKinhNghiem', false);
                                                            handleTieuChuanTuyenChonNestedChange('kinhNghiem', 'soNam', '');
                                                        }
                                                    }}
                                                />
                                                <span>Không</span>
                                            </label>
                                            <label className="recruitment-request-checkbox-label recruitment-request-checkbox-label-with-input">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.tieuChuanTuyenChon.kinhNghiem.soNamKinhNghiem}
                                                    onChange={(e) => {
                                                        handleTieuChuanTuyenChonNestedChange('kinhNghiem', 'soNamKinhNghiem', e.target.checked);
                                                        if (e.target.checked) {
                                                            handleTieuChuanTuyenChonNestedChange('kinhNghiem', 'khong', false);
                                                        }
                                                    }}
                                                />
                                                <span>Số năm kinh nghiệm:</span>
                                                <input
                                                    type="text"
                                                    className="recruitment-request-form-input recruitment-request-form-input-inline"
                                                    value={recruitmentRequestForm.tieuChuanTuyenChon.kinhNghiem.soNam}
                                                    onChange={(e) => handleTieuChuanTuyenChonNestedChange('kinhNghiem', 'soNam', e.target.value)}
                                                    placeholder="Ví dụ: 2-5 năm"
                                                    disabled={!recruitmentRequestForm.tieuChuanTuyenChon.kinhNghiem.soNamKinhNghiem}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Kiến thức */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">Kiến thức</label>
                                        <div className="recruitment-request-checkbox-group">
                                            <label className="recruitment-request-checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.tieuChuanTuyenChon.kienThuc.khong}
                                                    onChange={(e) => {
                                                        handleTieuChuanTuyenChonNestedChange('kienThuc', 'khong', e.target.checked);
                                                        if (e.target.checked) {
                                                            handleTieuChuanTuyenChonNestedChange('kienThuc', 'nganhNghe', false);
                                                            handleTieuChuanTuyenChonNestedChange('kienThuc', 'nganhNgheValue', '');
                                                        }
                                                    }}
                                                />
                                                <span>Không</span>
                                            </label>
                                            <label className="recruitment-request-checkbox-label recruitment-request-checkbox-label-with-input">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.tieuChuanTuyenChon.kienThuc.nganhNghe}
                                                    onChange={(e) => {
                                                        handleTieuChuanTuyenChonNestedChange('kienThuc', 'nganhNghe', e.target.checked);
                                                        if (e.target.checked) {
                                                            handleTieuChuanTuyenChonNestedChange('kienThuc', 'khong', false);
                                                        }
                                                    }}
                                                />
                                                <span>Ngành nghề:</span>
                                                <input
                                                    type="text"
                                                    className="recruitment-request-form-input recruitment-request-form-input-inline"
                                                    value={recruitmentRequestForm.tieuChuanTuyenChon.kienThuc.nganhNgheValue}
                                                    onChange={(e) => handleTieuChuanTuyenChonNestedChange('kienThuc', 'nganhNgheValue', e.target.value)}
                                                    placeholder="Nhập ngành nghề"
                                                    disabled={!recruitmentRequestForm.tieuChuanTuyenChon.kienThuc.nganhNghe}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Ngoại ngữ */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">Ngoại ngữ</label>
                                        <div className="recruitment-request-lydo-group">
                                            <label className="recruitment-request-checkbox-label recruitment-request-checkbox-label-with-input">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.tieuChuanTuyenChon.ngoaiNgu.tiengAnh}
                                                    onChange={(e) => handleTieuChuanTuyenChonNestedChange('ngoaiNgu', 'tiengAnh', e.target.checked)}
                                                />
                                                <span>Tiếng Anh</span>
                                                <span style={{ marginLeft: '0.5rem' }}>Trình độ:</span>
                                                <input
                                                    type="text"
                                                    className="recruitment-request-form-input recruitment-request-form-input-inline"
                                                    value={recruitmentRequestForm.tieuChuanTuyenChon.ngoaiNgu.trinhDoTiengAnh}
                                                    onChange={(e) => handleTieuChuanTuyenChonNestedChange('ngoaiNgu', 'trinhDoTiengAnh', e.target.value)}
                                                    placeholder="Ví dụ: TOEIC 600"
                                                    disabled={!recruitmentRequestForm.tieuChuanTuyenChon.ngoaiNgu.tiengAnh}
                                                />
                                            </label>
                                            <label className="recruitment-request-checkbox-label recruitment-request-checkbox-label-with-input">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.tieuChuanTuyenChon.ngoaiNgu.ngoaiNguKhac}
                                                    onChange={(e) => handleTieuChuanTuyenChonNestedChange('ngoaiNgu', 'ngoaiNguKhac', e.target.checked)}
                                                />
                                                <input
                                                    type="text"
                                                    className="recruitment-request-form-input recruitment-request-form-input-inline"
                                                    value={recruitmentRequestForm.tieuChuanTuyenChon.ngoaiNgu.tenNgoaiNguKhac}
                                                    onChange={(e) => handleTieuChuanTuyenChonNestedChange('ngoaiNgu', 'tenNgoaiNguKhac', e.target.value)}
                                                    placeholder="Ngoại ngữ khác"
                                                    disabled={!recruitmentRequestForm.tieuChuanTuyenChon.ngoaiNgu.ngoaiNguKhac}
                                                    style={{ width: '150px' }}
                                                />
                                                <span style={{ marginLeft: '0.5rem' }}>Trình độ:</span>
                                                <input
                                                    type="text"
                                                    className="recruitment-request-form-input recruitment-request-form-input-inline"
                                                    value={recruitmentRequestForm.tieuChuanTuyenChon.ngoaiNgu.trinhDoNgoaiNguKhac}
                                                    onChange={(e) => handleTieuChuanTuyenChonNestedChange('ngoaiNgu', 'trinhDoNgoaiNguKhac', e.target.value)}
                                                    placeholder="Trình độ"
                                                    disabled={!recruitmentRequestForm.tieuChuanTuyenChon.ngoaiNgu.ngoaiNguKhac}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Vi tính */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">Vi tính</label>
                                        <div className="recruitment-request-lydo-group">
                                            <label className="recruitment-request-checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.tieuChuanTuyenChon.viTinh.khong}
                                                    onChange={(e) => {
                                                        handleTieuChuanTuyenChonNestedChange('viTinh', 'khong', e.target.checked);
                                                        if (e.target.checked) {
                                                            handleTieuChuanTuyenChonNestedChange('viTinh', 'msOffice', false);
                                                            handleTieuChuanTuyenChonNestedChange('viTinh', 'khac', false);
                                                            handleTieuChuanTuyenChonNestedChange('viTinh', 'khacValue', '');
                                                        }
                                                    }}
                                                />
                                                <span>Không</span>
                                            </label>
                                            <label className="recruitment-request-checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.tieuChuanTuyenChon.viTinh.msOffice}
                                                    onChange={(e) => {
                                                        handleTieuChuanTuyenChonNestedChange('viTinh', 'msOffice', e.target.checked);
                                                        if (e.target.checked) {
                                                            handleTieuChuanTuyenChonNestedChange('viTinh', 'khong', false);
                                                        }
                                                    }}
                                                />
                                                <span>MS Office (Word / Excel / Access)</span>
                                            </label>
                                            <label className="recruitment-request-checkbox-label recruitment-request-checkbox-label-with-input">
                                                <input
                                                    type="checkbox"
                                                    checked={recruitmentRequestForm.tieuChuanTuyenChon.viTinh.khac}
                                                    onChange={(e) => {
                                                        handleTieuChuanTuyenChonNestedChange('viTinh', 'khac', e.target.checked);
                                                        if (e.target.checked) {
                                                            handleTieuChuanTuyenChonNestedChange('viTinh', 'khong', false);
                                                        }
                                                    }}
                                                />
                                                <span>Khác:</span>
                                                <input
                                                    type="text"
                                                    className="recruitment-request-form-input recruitment-request-form-input-inline"
                                                    value={recruitmentRequestForm.tieuChuanTuyenChon.viTinh.khacValue}
                                                    onChange={(e) => handleTieuChuanTuyenChonNestedChange('viTinh', 'khacValue', e.target.value)}
                                                    placeholder="Nhập kỹ năng vi tính khác"
                                                    disabled={!recruitmentRequestForm.tieuChuanTuyenChon.viTinh.khac}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Kỹ năng */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">Kỹ năng</label>
                                        <input
                                            type="text"
                                            className="recruitment-request-form-input"
                                            value={recruitmentRequestForm.tieuChuanTuyenChon.kyNang}
                                            onChange={(e) => handleTieuChuanTuyenChonChange('kyNang', e.target.value)}
                                            placeholder="Nhập kỹ năng yêu cầu"
                                        />
                                    </div>

                                    {/* Khả năng */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">Khả năng</label>
                                        <input
                                            type="text"
                                            className="recruitment-request-form-input"
                                            value={recruitmentRequestForm.tieuChuanTuyenChon.khaNang}
                                            onChange={(e) => handleTieuChuanTuyenChonChange('khaNang', e.target.value)}
                                            placeholder="Nhập khả năng yêu cầu"
                                        />
                                    </div>

                                    {/* Ngoại hình */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">Ngoại hình</label>
                                        <input
                                            type="text"
                                            className="recruitment-request-form-input"
                                            value={recruitmentRequestForm.tieuChuanTuyenChon.ngoaiHinh}
                                            onChange={(e) => handleTieuChuanTuyenChonChange('ngoaiHinh', e.target.value)}
                                            placeholder="Nhập yêu cầu về ngoại hình"
                                        />
                                    </div>

                                    {/* Tính cách */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">Tính cách</label>
                                        <input
                                            type="text"
                                            className="recruitment-request-form-input"
                                            value={recruitmentRequestForm.tieuChuanTuyenChon.tinhCach}
                                            onChange={(e) => handleTieuChuanTuyenChonChange('tinhCach', e.target.value)}
                                            placeholder="Nhập yêu cầu về tính cách"
                                        />
                                    </div>

                                    {/* Ưu tiên */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">Ưu tiên</label>
                                        <input
                                            type="text"
                                            className="recruitment-request-form-input"
                                            value={recruitmentRequestForm.tieuChuanTuyenChon.uuTien}
                                            onChange={(e) => handleTieuChuanTuyenChonChange('uuTien', e.target.value)}
                                            placeholder="Nhập yêu cầu ưu tiên"
                                        />
                                    </div>

                                    {/* Yêu cầu khác */}
                                    <div className="recruitment-request-form-field">
                                        <label className="recruitment-request-form-label">Yêu cầu khác</label>
                                        <input
                                            type="text"
                                            className="recruitment-request-form-input"
                                            value={recruitmentRequestForm.tieuChuanTuyenChon.yeuCauKhac}
                                            onChange={(e) => handleTieuChuanTuyenChonChange('yeuCauKhac', e.target.value)}
                                            placeholder="Nhập yêu cầu khác (nếu có)"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="recruitment-request-modal-actions">
                                <button
                                    type="button"
                                    className="recruitment-request-modal-btn recruitment-request-modal-btn-secondary"
                                    onClick={handleCloseRecruitmentRequestModal}
                                    disabled={submittingRecruitmentRequest}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="recruitment-request-modal-btn recruitment-request-modal-btn-primary"
                                    disabled={submittingRecruitmentRequest}
                                >
                                    {submittingRecruitmentRequest ? 'Đang gửi...' : 'Gửi yêu cầu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InterviewApprovals;
