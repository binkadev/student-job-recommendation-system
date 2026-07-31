const apiErrorMessages: Record<string, string> = {
  ACCESS_DENIED: "Bạn không có quyền thực hiện thao tác này.",
  ALREADY_APPLIED: "Bạn đã ứng tuyển công việc này trước đó.",
  AI_SERVICE_INVALID_RESPONSE: "Dịch vụ AI trả về dữ liệu chưa hợp lệ. Vui lòng thử lại sau.",
  AI_SERVICE_TIMEOUT: "Dịch vụ AI phản hồi quá lâu. Vui lòng thử lại sau.",
  AI_SERVICE_UNAVAILABLE: "Dịch vụ AI hiện chưa sẵn sàng. Vui lòng thử lại sau.",
  BAD_REQUEST: "Yêu cầu chưa hợp lệ. Vui lòng kiểm tra lại thông tin.",
  CV_ANALYSIS_NOT_READY: "CV chưa sẵn sàng để dùng cho tính năng này.",
  CV_IN_USE: "CV đang được sử dụng nên chưa thể xóa.",
  DUPLICATE_RESOURCE: "Dữ liệu đã tồn tại trong hệ thống.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  JOB_NOT_ACTIVE: "Tin tuyển dụng không còn ở trạng thái đang tuyển.",
  NOT_FOUND: "Không tìm thấy dữ liệu phù hợp.",
  RECOMMENDATION_GENERATION_FAILED: "Không thể tạo gợi ý việc làm. Vui lòng thử lại sau.",
  RESOURCE_NOT_FOUND: "Không tìm thấy dữ liệu phù hợp.",
  SAVED_CANDIDATE_ALREADY_EXISTS: "Hồ sơ ứng viên này đã được lưu trước đó.",
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
