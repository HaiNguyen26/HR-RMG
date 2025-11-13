import * as XLSX from 'xlsx';

const formatDateToIso = (dateObj) => {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
    return '';
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateString = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Accept dd/mm/yyyy or dd-mm-yyyy
  const parts = trimmed.split(/[\/\-]/);
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (
    Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year) ||
    day < 1 || day > 31 || month < 1 || month > 12 || year < 1000
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
};

/**
 * Export employees to Excel template
 */
export const exportEmployeeTemplate = () => {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Define headers
  const headers = [
    'Mã Nhân Viên',
    'Họ Và Tên',
    'Chi Nhánh',
    'Phòng Ban',
    'Bộ Phận',
    'Chức Danh',
    'Ngày Nhận Việc',
    'Quản Lý Trực Tiếp',
    'Quản Lý Gián Tiếp',
  ];

  // Create worksheet with headers
  const ws = XLSX.utils.aoa_to_sheet([headers]);

  // Set column widths
  ws['!cols'] = [
    { wch: 14 }, // Mã Nhân Viên
    { wch: 26 }, // Họ Và Tên
    { wch: 20 }, // Chi Nhánh
    { wch: 20 }, // Phòng Ban
    { wch: 22 }, // Bộ Phận
    { wch: 20 }, // Chức Danh
    { wch: 18 }, // Ngày Nhận Việc
    { wch: 24 }, // Quản Lý Trực Tiếp
    { wch: 24 }, // Quản Lý Gián Tiếp
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Nhân viên');

  // Generate filename with current date
  const filename = `Mau_Nhan_Vien_${new Date().toISOString().split('T')[0]}.xlsx`;

  // Write file
  XLSX.writeFile(wb, filename);
};

/**
 * Export employees data to Excel
 */
export const exportEmployeesToExcel = (employees) => {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Define headers
  const headers = [
    'Mã Nhân Viên',
    'Họ Và Tên',
    'Chi Nhánh',
    'Phòng Ban',
    'Bộ Phận',
    'Chức Danh',
    'Ngày Nhận Việc',
    'Quản Lý Trực Tiếp',
    'Quản Lý Gián Tiếp',
  ];

  // Convert employees to rows
  const rows = employees.map(emp => [
    emp.ma_nhan_vien || '',
    emp.ho_ten || '',
    emp.chi_nhanh || emp.chiNhanh || '',
    emp.phong_ban || '',
    emp.bo_phan || '',
    emp.chuc_danh || '',
    emp.ngay_gia_nhap ? new Date(emp.ngay_gia_nhap).toLocaleDateString('vi-VN') : '',
    emp.quan_ly_truc_tiep || emp.quanLyTrucTiep || '',
    emp.quan_ly_gian_tiep || emp.quanLyGianTiep || '',
  ]);

  // Combine headers and rows
  const data = [headers, ...rows];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 14 }, // Mã Nhân Viên
    { wch: 26 }, // Họ Và Tên
    { wch: 20 }, // Chi Nhánh
    { wch: 20 }, // Phòng Ban
    { wch: 22 }, // Bộ Phận
    { wch: 20 }, // Chức Danh
    { wch: 18 }, // Ngày Nhận Việc
    { wch: 24 }, // Quản Lý Trực Tiếp
    { wch: 24 }, // Quản Lý Gián Tiếp
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Nhân viên');

  // Generate filename with current date
  const filename = `Danh_Sach_Nhan_Vien_${new Date().toISOString().split('T')[0]}.xlsx`;

  // Write file
  XLSX.writeFile(wb, filename);
};

/**
 * Parse Excel file and return employee data
 */
export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON with date handling
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false, // Get formatted values
          dateNF: 'dd/mm/yyyy' // Date format
        });

        if (jsonData.length < 2) {
          reject(new Error('File Excel không hợp lệ. Vui lòng kiểm tra lại.'));
          return;
        }

        // Get headers (first row)
        const headersRaw = jsonData[0] || [];
        const headers = headersRaw.map((h) => (h ? String(h).trim() : ''));

        if (headers.length === 0) {
          reject(new Error('File Excel không có header (dòng đầu tiên). Vui lòng kiểm tra lại file.'));
          return;
        }

        console.log('Headers found in Excel:', headers);

        const defaultOrder = [
          'maNhanVien',
          'hoTen',
          'chiNhanh',
          'phongBan',
          'boPhan',
          'chucDanh',
          'ngayGiaNhap',
          'quanLyTrucTiep',
          'quanLyGianTiep'
        ];
        const codePattern = /^[A-Za-z]{2,}\d+$/;

        // Map header names to field names (case-insensitive and flexible)
        const headerMap = {
          'mã nv': 'maNhanVien',
          'mã nhân viên': 'maNhanVien',
          'manv': 'maNhanVien',
          'họ tên': 'hoTen',
          'họ và tên': 'hoTen',
          'ho va ten': 'hoTen',
          'hoten': 'hoTen',
          'tên': 'hoTen',
          'chức danh': 'chucDanh',
          'chucdanh': 'chucDanh',
          'chi nhánh': 'chiNhanh',
          'chi nhanh': 'chiNhanh',
          'chinhanh': 'chiNhanh',
          'địa điểm': 'chiNhanh',
          'dia diem': 'chiNhanh',
          'phòng ban': 'phongBan',
          'phongban': 'phongBan',
          'phòng': 'phongBan',
          'bộ phận': 'boPhan',
          'bo phan': 'boPhan',
          'bophan': 'boPhan',
          'ngày gia nhập': 'ngayGiaNhap',
          'ngaygianhap': 'ngayGiaNhap',
          'ngày vào làm': 'ngayGiaNhap',
          'ngayvaolam': 'ngayGiaNhap',
          'ngày nhận việc': 'ngayGiaNhap',
          'ngay nhan viec': 'ngayGiaNhap',
          'quản lý trực tiếp': 'quanLyTrucTiep',
          'quan ly truc tiep': 'quanLyTrucTiep',
          'quanlytructiep': 'quanLyTrucTiep',
          'qly truc tiep': 'quanLyTrucTiep',
          'quản lý gián tiếp': 'quanLyGianTiep',
          'quan ly gian tiep': 'quanLyGianTiep',
          'quanlygiantep': 'quanLyGianTiep',
          'qly gian tiep': 'quanLyGianTiep',
        };

        const fieldIndexes = {};
        headers.forEach((header, index) => {
          const headerLower = header.toLowerCase().trim();
          const fieldName = headerMap[headerLower];
          if (fieldName) {
            fieldIndexes[fieldName] = index;
          }
        });

        console.log('Mapped fields:', fieldIndexes);

        const requiredFields = ['hoTen', 'phongBan'];
        let startRow = 1;

        const missingFields = requiredFields.filter((field) => fieldIndexes[field] === undefined);

        const looksLikeDataRow = () => {
          const nonEmpty = headers.filter((h) => h && h.trim() !== '');
          if (nonEmpty.length < 2) return false;
          const maybeCode = nonEmpty[0];
          const maybeName = nonEmpty[1];
          const codeMatch = /^\s*[A-Za-z]{2,}\d+\s*$/.test(maybeCode);
          const nameLooksValid = maybeName && maybeName.split(' ').length >= 2;
          return codeMatch || nameLooksValid;
        };

        const isHeaderless = missingFields.length > 0 && looksLikeDataRow();

        if (missingFields.length > 0 && !isHeaderless) {
          const fieldLabels = {
            hoTen: 'Họ Và Tên',
            phongBan: 'Phòng Ban',
          };
          reject(
            new Error(
              `Thiếu các cột bắt buộc: ${missingFields
                .map((f) => fieldLabels[f] || f)
                .join(', ')}. Vui lòng kiểm tra lại file Excel. Các cột tìm thấy: ${headers
                  .filter((h) => h && h.trim() !== '')
                  .join(', ')}`
            )
          );
          return;
        }

        if (isHeaderless) {
          startRow = 0; // include current first row as data
        }

        const employees = [];

        for (let i = startRow; i < jsonData.length; i += 1) {
          const row = jsonData[i];

          if (!row || row.length === 0 || row.every((cell) => cell === undefined || cell === null || (typeof cell === 'string' && cell.trim() === ''))) {
            continue;
          }

          const fieldsToMap = isHeaderless
            ? defaultOrder
            : defaultOrder.filter((fieldName) => fieldIndexes[fieldName] !== undefined);
          let baseIndex = 0;

          if (isHeaderless) {
            const detectedIndex = row.findIndex((cell) => {
              if (cell === undefined || cell === null) return false;
              const value = String(cell).trim();
              return codePattern.test(value);
            });
            if (detectedIndex >= 0) {
              baseIndex = detectedIndex;
            }
          }

          const employee = {};

          fieldsToMap.forEach((fieldName, orderIndex) => {
            const index = isHeaderless ? baseIndex + orderIndex : fieldIndexes[fieldName];
            if (index === undefined || index < 0 || index >= row.length) {
              return;
            }

            const value = row[index];

            if (fieldName === 'ngayGiaNhap') {
              let formattedDate = '';

              if (value) {
                let dateObj = null;

                if (value instanceof Date) {
                  dateObj = value;
                } else if (typeof value === 'number') {
                  const excelEpoch = new Date(1899, 11, 30);
                  dateObj = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
                } else if (typeof value === 'string') {
                  dateObj = parseDateString(value) || new Date(value);
                }

                if (dateObj instanceof Date && !Number.isNaN(dateObj.getTime())) {
                  formattedDate = formatDateToIso(dateObj);
                }
              }

              employee[fieldName] = formattedDate;
            } else {
              employee[fieldName] = value ? String(value).trim() : '';
            }
          });

          defaultOrder.forEach((fieldName) => {
            if (employee[fieldName] === undefined) {
              employee[fieldName] = '';
            }
          });

          if (employee.hoTen) {
            employee.hoTen = employee.hoTen.trim();
          }
          if (employee.phongBan) {
            employee.phongBan = employee.phongBan.trim();
          }

          if (employee.hoTen && employee.phongBan) {
            employees.push(employee);
          }
        }

        if (employees.length === 0) {
          reject(new Error('Không tìm thấy dữ liệu nhân viên hợp lệ trong file.'));
          return;
        }

        resolve(employees);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (e) => {
      reject(new Error('Error reading file.'));
    };

    reader.readAsArrayBuffer(file);
  });
};