const apiErrorMessages: Record<string, string> = {
  ACCESS_DENIED: "Bạn không có quyền thực hiện thao tác này.",
  ALREADY_APPLIED: "Bạn đã ứng tuyển công việc này trước đó.",
  CV_ANALYSIS_NOT_READY: "CV chưa sẵn sàng để dùng cho tính năng này.",
  DUPLICATE_RESOURCE: "Dữ liệu đã tồn tại trong hệ thống.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  JOB_NOT_ACTIVE: "Tin tuyển dụng không còn ở trạng thái đang tuyển.",
  NOT_FOUND: "Không tìm thấy dữ liệu phù hợp.",
  UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  VALIDATION_ERROR: "Dữ liệu nhập chưa hợp lệ. Vui lòng kiểm tra lại.",
};

export function getApiErrorMessage(error: unknown, fallback = "Vui lòng thử lại sau.") {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { errorCode?: string | null; message?: string | null } } }).response;
    const errorCode = response?.data?.errorCode;
    if (errorCode && apiErrorMessages[errorCode]) return apiErrorMessages[errorCode];
    return response?.data?.message || fallback;
  }
  return fallback;
}
