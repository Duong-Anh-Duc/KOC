export interface BankOption {
  value: string;
  label: string;
  group: string;
}

export const VIETNAM_BANKS: BankOption[] = [
  // 1. Ngân hàng Thương mại Nhà nước (1)
  { value: 'Agribank', label: 'Agribank – Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', group: 'Ngân hàng Thương mại Nhà nước' },

  // 2. Ngân hàng Thương mại Cổ phần – TMCP (30)
  { value: 'ACB', label: 'ACB – Ngân hàng TMCP Á Châu', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'ABBANK', label: 'ABBANK – Ngân hàng TMCP An Bình', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'Bac A Bank', label: 'Bac A Bank – Ngân hàng TMCP Bắc Á', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'BVBank', label: 'BVBank – Ngân hàng TMCP Bản Việt', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'BAOVIET Bank', label: 'BAOVIET Bank – Ngân hàng TMCP Bảo Việt', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'VietinBank', label: 'VietinBank – Ngân hàng TMCP Công thương Việt Nam', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'PVcomBank', label: 'PVcomBank – Ngân hàng TMCP Đại Chúng Việt Nam', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'BIDV', label: 'BIDV – Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'SeABank', label: 'SeABank – Ngân hàng TMCP Đông Nam Á', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'MSB', label: 'MSB – Ngân hàng TMCP Hàng Hải Việt Nam', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'Kienlongbank', label: 'Kienlongbank – Ngân hàng TMCP Kiên Long', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'Techcombank', label: 'Techcombank – Ngân hàng TMCP Kỹ Thương Việt Nam', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'LVBank', label: 'LVBank – Ngân hàng TMCP Lộc Phát Việt Nam', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'Nam A Bank', label: 'Nam A Bank – Ngân hàng TMCP Nam Á', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'Vietcombank', label: 'Vietcombank – Ngân hàng TMCP Ngoại thương Việt Nam', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'HDBank', label: 'HDBank – Ngân hàng TMCP Phát triển TP. HCM', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'OCB', label: 'OCB – Ngân hàng TMCP Phương Đông', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'MBBank', label: 'MBBank – Ngân hàng TMCP Quân Đội', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'NCB', label: 'NCB – Ngân hàng TMCP Quốc dân', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'VIB', label: 'VIB – Ngân hàng TMCP Quốc Tế Việt Nam', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'SCB', label: 'SCB – Ngân hàng TMCP Sài Gòn', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'SHB', label: 'SHB – Ngân hàng TMCP Sài Gòn – Hà Nội', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'Saigonbank', label: 'Saigonbank – Ngân hàng TMCP Sài Gòn Công Thương', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'Sacombank', label: 'Sacombank – Ngân hàng TMCP Sài Gòn Thương Tín', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'PGBank', label: 'PGBank – Ngân hàng TMCP Thịnh vượng và Phát triển', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'TPBank', label: 'TPBank – Ngân hàng TMCP Tiên Phong', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'VietABank', label: 'VietABank – Ngân hàng TMCP Việt Á', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'VPBank', label: 'VPBank – Ngân hàng TMCP Việt Nam Thịnh Vượng', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'Vietbank', label: 'Vietbank – Ngân hàng TMCP Việt Nam Thương Tín', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },
  { value: 'Eximbank', label: 'Eximbank – Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam', group: 'Ngân hàng Thương mại Cổ phần (TMCP)' },

  // 3. Ngân hàng TNHH Thương mại (4)
  { value: 'GPBank', label: 'GPBank – Ngân hàng TNHH Kỷ Nguyên Thịnh Vượng', group: 'Ngân hàng TNHH Thương mại' },
  { value: 'VCBNeo', label: 'VCBNeo – Ngân hàng TNHH MTV Ngoại thương Công nghệ số', group: 'Ngân hàng TNHH Thương mại' },
  { value: 'Vikki Bank', label: 'Vikki Bank – Ngân hàng TNHH MTV Số Vikki', group: 'Ngân hàng TNHH Thương mại' },
  { value: 'MBV', label: 'MBV – Ngân hàng TNHH MTV Việt Nam Hiện Đại', group: 'Ngân hàng TNHH Thương mại' },

  // 4. Ngân hàng Liên doanh (2)
  { value: 'Indovina Bank', label: 'IVB – Ngân hàng TNHH Indovina', group: 'Ngân hàng Liên doanh' },
  { value: 'VRB', label: 'VRB – Ngân hàng Liên doanh Việt Nga', group: 'Ngân hàng Liên doanh' },

  // 5. Ngân hàng 100% vốn nước ngoài (9)
  { value: 'ANZ Việt Nam', label: 'ANZ – Ngân hàng TNHH MTV ANZ Việt Nam', group: 'Ngân hàng 100% vốn nước ngoài' },
  { value: 'CIMB Việt Nam', label: 'CIMB – Ngân hàng TNHH MTV CIMB Việt Nam', group: 'Ngân hàng 100% vốn nước ngoài' },
  { value: 'Hong Leong Việt Nam', label: 'Hong Leong – Ngân hàng TNHH MTV Hong Leong Việt Nam', group: 'Ngân hàng 100% vốn nước ngoài' },
  { value: 'HSBC Việt Nam', label: 'HSBC – Ngân hàng TNHH MTV HSBC Việt Nam', group: 'Ngân hàng 100% vốn nước ngoài' },
  { value: 'Public Bank Việt Nam', label: 'Public Bank – Ngân hàng TNHH MTV Public Bank Việt Nam', group: 'Ngân hàng 100% vốn nước ngoài' },
  { value: 'Shinhan Việt Nam', label: 'Shinhan – Ngân hàng TNHH MTV Shinhan Việt Nam', group: 'Ngân hàng 100% vốn nước ngoài' },
  { value: 'Standard Chartered Việt Nam', label: 'Standard Chartered – Ngân hàng TNHH MTV Standard Chartered Việt Nam', group: 'Ngân hàng 100% vốn nước ngoài' },
  { value: 'UOB Việt Nam', label: 'UOB – Ngân hàng TNHH MTV UOB Việt Nam', group: 'Ngân hàng 100% vốn nước ngoài' },
  { value: 'Woori Việt Nam', label: 'Woori – Ngân hàng TNHH MTV Woori Việt Nam', group: 'Ngân hàng 100% vốn nước ngoài' },

  // 6. Ngân hàng Chính sách (2)
  { value: 'VBSP', label: 'VBSP – Ngân hàng Chính sách Xã hội Việt Nam', group: 'Ngân hàng Chính sách' },
  { value: 'VDB', label: 'VDB – Ngân hàng Phát triển Việt Nam', group: 'Ngân hàng Chính sách' },

  // 7. Ngân hàng Hợp tác xã (1)
  { value: 'Co-opBank', label: 'Co-opBank – Ngân hàng Hợp tác xã Việt Nam', group: 'Ngân hàng Hợp tác xã' },
];

/** Grouped options for Ant Design Select with optgroup */
export const VIETNAM_BANK_SELECT_OPTIONS = (() => {
  const groups: Record<string, BankOption[]> = {};
  for (const bank of VIETNAM_BANKS) {
    if (!groups[bank.group]) groups[bank.group] = [];
    groups[bank.group].push(bank);
  }
  return Object.entries(groups).map(([label, options]) => ({
    label,
    options: options.map((b) => ({ value: b.value, label: b.label })),
  }));
})();
