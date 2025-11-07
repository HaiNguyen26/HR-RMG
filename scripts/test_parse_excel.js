const path = require('path');
let XLSX;
try {
    XLSX = require('xlsx');
} catch (error) {
    XLSX = require('../frontend/node_modules/xlsx');
}

const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, '../Mau_Nhan_Vien_2025-11-07.xlsx');

console.log('Reading file:', filePath);

const workbook = XLSX.readFile(filePath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    dateNF: 'dd/mm/yyyy',
});

const defaultOrder = [
    'maNhanVien',
    'hoTen',
    'email',
    'chiNhanh',
    'phongBan',
    'boPhan',
    'chucDanh',
    'ngayGiaNhap',
];
const codePattern = /^[A-Za-z]{2,}\d+$/;

const headerMap = {
    'mã nv': 'maNhanVien',
    'mã nhân viên': 'maNhanVien',
    manv: 'maNhanVien',
    'họ tên': 'hoTen',
    'họ và tên': 'hoTen',
    'ho va ten': 'hoTen',
    hoten: 'hoTen',
    tên: 'hoTen',
    'chức danh': 'chucDanh',
    chucdanh: 'chucDanh',
    'chi nhánh': 'chiNhanh',
    'chi nhanh': 'chiNhanh',
    chinhanh: 'chiNhanh',
    'địa điểm': 'chiNhanh',
    'dia diem': 'chiNhanh',
    'email cá nhân': 'email',
    'email ca nhan': 'email',
    'phòng ban': 'phongBan',
    phongban: 'phongBan',
    'phòng': 'phongBan',
    'bộ phận': 'boPhan',
    'bo phan': 'boPhan',
    bophan: 'boPhan',
    email: 'email',
    'ngày gia nhập': 'ngayGiaNhap',
    ngaygianhap: 'ngayGiaNhap',
    'ngày vào làm': 'ngayGiaNhap',
    ngayvaolam: 'ngayGiaNhap',
    'ngày nhận việc': 'ngayGiaNhap',
    'ngay nhan viec': 'ngayGiaNhap',
};

const headersRaw = jsonData[0] || [];
const headers = headersRaw.map((h) => (h ? String(h).trim() : ''));

const fieldIndexes = {};
headers.forEach((header, index) => {
    const key = header.toLowerCase().trim();
    const field = headerMap[key];
    if (field) {
        fieldIndexes[field] = index;
    }
});

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

console.log('Missing fields:', missingFields);
console.log('Detected headerless:', isHeaderless);

if (isHeaderless) {
    startRow = 0;
}

const employees = [];

for (let i = startRow; i < jsonData.length; i += 1) {
    const row = jsonData[i];
    if (!row || row.length === 0 || row.every((cell) => {
        if (cell === undefined || cell === null) return true;
        if (typeof cell === 'string' && cell.trim() === '') return true;
        return false;
    })) {
        continue;
    }

    const fieldsToMap = isHeaderless ? defaultOrder : Object.keys(fieldIndexes);
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
            if (value) {
                let date;
                if (value instanceof Date) {
                    date = value;
                } else if (typeof value === 'number') {
                    const excelEpoch = new Date(1899, 11, 30);
                    date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
                } else if (typeof value === 'string') {
                    const dateStr = value.trim();
                    const parts = dateStr.split(/[\/\-]/);
                    if (parts.length === 3) {
                        const day = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1;
                        const year = parseInt(parts[2], 10);
                        date = new Date(year, month, day);
                    } else {
                        date = new Date(value);
                    }
                } else {
                    date = new Date(value);
                }

                if (!Number.isNaN(date.getTime())) {
                    employee[fieldName] = date.toISOString().split('T')[0];
                } else {
                    employee[fieldName] = '';
                }
            } else {
                employee[fieldName] = '';
            }
        } else {
            employee[fieldName] = value ? String(value).trim() : '';
        }
    });

    defaultOrder.forEach((fieldName) => {
        if (employee[fieldName] === undefined) {
            employee[fieldName] = '';
        }
    });

    if (employee.hoTen) employee.hoTen = employee.hoTen.trim();
    if (employee.phongBan) employee.phongBan = employee.phongBan.trim();

    if (employee.hoTen && employee.phongBan) {
        employees.push(employee);
    }
}

console.log('Parsed employees count:', employees.length);
console.log('First employee:', employees[0]);

