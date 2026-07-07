const GENERIC_PROGRESS_ERROR =
  'Tác vụ trên server bị dừng hoặc không trả về tiến trình. Vui lòng kiểm tra kết quả sau vài phút, sau đó chạy lại nếu dữ liệu chưa được cập nhật.';

const CONNECTION_PROGRESS_ERROR =
  'Mất kết nối khi theo dõi tiến trình. Tác vụ có thể vẫn đang chạy trên server, vui lòng đợi vài phút rồi tải lại dữ liệu.';

const TIMEOUT_PROGRESS_ERROR =
  'Quá thời gian chờ tiến trình phản hồi. Server có thể đang xử lý chậm, vui lòng kiểm tra lại kết quả sau vài phút.';

const NO_TASK_ID_ERROR =
  'Server đã nhận yêu cầu nhưng không trả về mã theo dõi tiến trình. Vui lòng tải lại trang và thử lại thao tác.';

const CONTEXT_MESSAGES: Array<[RegExp, string]> = [
  [/scrape-revenue|monthly-scrape|scrape-data|scrape_/i, 'Không thể theo dõi tiến trình cào doanh thu. Tác vụ có thể vẫn đang chạy trên server, vui lòng đợi vài phút rồi tải lại dữ liệu doanh thu.'],
  [/check-pub-codes/i, 'Không thể theo dõi tiến trình kiểm tra mã Pub. Vui lòng đợi vài phút rồi tải lại dữ liệu chu kỳ.'],
  [/send-emails/i, 'Không thể theo dõi tiến trình gửi email doanh thu. Một số email có thể vẫn đang được gửi, vui lòng kiểm tra lại lịch sử gửi sau vài phút.'],
  [/stats/i, 'Không thể theo dõi tiến trình cập nhật thống kê. Vui lòng đợi vài phút rồi tải lại dữ liệu thống kê.'],
  [/login|scrape/i, 'Không thể theo dõi tiến trình đăng nhập hoặc cào dữ liệu. Vui lòng kiểm tra kết nối Google/GemLogin rồi thử lại.'],
];

const TECHNICAL_ERROR_PATTERNS = [
  /^sse\b/i,
  /^eventsource\b/i,
  /server error/i,
  /network error/i,
  /failed to fetch/i,
  /internal server error/i,
  /connection/i,
  /socket/i,
  /timeout/i,
  /no taskid/i,
];

const KNOWN_SERVER_MESSAGES: Array<[RegExp, string]> = [
  [/no active kocs found/i, 'Không có KOC đang hoạt động để xử lý. Vui lòng kiểm tra danh sách KOC rồi chạy lại.'],
  [/cdp url/i, 'Không kết nối được tới trình duyệt GemLogin. Vui lòng mở lại GemLogin hoặc kiểm tra cấu hình trình duyệt.'],
  [/không có context/i, 'Không tìm thấy phiên trình duyệt đang đăng nhập. Vui lòng đăng nhập lại rồi thử lại.'],
  [/login|logged out|session/i, 'Phiên đăng nhập YouTube/GemLogin không còn hợp lệ. Vui lòng đăng nhập lại rồi chạy lại thao tác.'],
];

export function getProgressErrorMessage(error: unknown, taskId?: string | null): string {
  const raw = error instanceof Error ? error.message : String(error ?? '').trim();
  const contextMessage = CONTEXT_MESSAGES.find(([pattern]) => pattern.test(taskId || ''))?.[1];

  if (!raw || raw === 'progress.unknownError') {
    return contextMessage || GENERIC_PROGRESS_ERROR;
  }

  if (/timeout/i.test(raw)) {
    return TIMEOUT_PROGRESS_ERROR;
  }

  if (/no taskid/i.test(raw)) {
    return NO_TASK_ID_ERROR;
  }

  const knownServerMessage = KNOWN_SERVER_MESSAGES.find(([pattern]) => pattern.test(raw))?.[1];
  if (knownServerMessage) {
    return knownServerMessage;
  }

  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(raw))) {
    return contextMessage || CONNECTION_PROGRESS_ERROR;
  }

  return raw;
}
