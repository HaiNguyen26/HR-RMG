const DOMESTIC_KEYWORDS = [
  'ha noi', 'ho chi minh', 'sai gon', 'hai phong', 'da nang', 'can tho',
  'an giang', 'ba ria vung tau', 'bac giang', 'bac kan', 'bac lieu', 'bac ninh',
  'ben tre', 'binh dinh', 'binh duong', 'binh phuoc', 'binh thuan', 'ca mau',
  'cao bang', 'dak lak', 'daklak', 'dak nong', 'dien bien', 'dong nai', 'dong thap',
  'gia lai', 'ha giang', 'ha nam', 'ha tinh', 'hai duong', 'hau giang', 'hoa binh',
  'hung yen', 'khanh hoa', 'kien giang', 'kon tum', 'lai chau', 'lang son', 'lao cai',
  'lam dong', 'long an', 'nam dinh', 'nghe an', 'ninh binh', 'ninh thuan', 'phu tho',
  'phu yen', 'quang binh', 'quang nam', 'quang ngai', 'quang ninh', 'quang tri',
  'soc trang', 'son la', 'tay ninh', 'thai binh', 'thai nguyen', 'thanh hoa',
  'thua thien hue', 'tien giang', 'tra vinh', 'tuyen quang', 'vinh long', 'vinh phuc',
  'yen bai', 'phu quoc', 'pleiku', 'ngan son', 'bien hoa', 'thu duc'
];

const normalizeText = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const detectLocationType = (locationInput) => {
  const normalized = normalizeText(locationInput);
  if (!normalized) return null;

  for (const keyword of DOMESTIC_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return 'DOMESTIC';
    }
  }
  return 'INTERNATIONAL';
};

export const isOvernightTrip = (startTime, endTime) => {
  if (!startTime || !endTime) return false;
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return end.getTime() - start.getTime() > 24 * 60 * 60 * 1000;
};



