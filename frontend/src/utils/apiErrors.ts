const apiErrorMessages: Record<string, string> = {
  INVALID_CURRENT_PASSWORD: "Mật khẩu hiện tại không đúng.",
  SETTINGS_REVISION_CONFLICT: "Cài đặt đã thay đổi ở phiên khác. Bản nháp vẫn được giữ; hãy đọc lại dữ liệu để đối chiếu trước khi lưu tiếp.",
  SETTINGS_REVISION_REQUIRED: "Chưa có phiên bản cài đặt để lưu. Hãy đọc lại dữ liệu rồi kiểm tra bản nháp.",
  PROFILE_REVISION_CONFLICT: "Hồ sơ đã thay đổi ở phiên khác. Bản đang soạn vẫn được giữ; hãy tải bản mới để đối chiếu trước khi lưu tiếp.",
  PROFILE_REVISION_REQUIRED: "Hãy tải lại hồ sơ để lấy phiên bản trước khi lưu.",
  ACCESS_DENIED: "Bạn không có quyền thực hiện thao tác này.",
  ALREADY_APPLIED: "Bạn đã ứng tuyển công việc này trước đó.",
  APPLICATION_ALREADY_ACTIVE: "Bạn đã có đơn ứng tuyển đang được xử lý cho việc làm này.",
  AI_SERVICE_INVALID_RESPONSE: "Dịch vụ AI trả về dữ liệu chưa hợp lệ. Vui lòng thử lại sau.",
  AI_SERVICE_TIMEOUT: "Dịch vụ AI phản hồi quá lâu. Vui lòng thử lại sau.",
  AI_SERVICE_UNAVAILABLE: "Dịch vụ AI hiện chưa sẵn sàng. Vui lòng thử lại sau.",
  BAD_REQUEST: "Yêu cầu chưa hợp lệ. Vui lòng kiểm tra lại thông tin.",
  CANDIDATE_RANKING_ALREADY_PROCESSING: "Tin tuyển dụng này đang có lượt xếp hạng ứng viên xử lý. Vui lòng đợi hoàn tất rồi thử lại.",
  CANDIDATE_RANKING_CAPACITY_EXCEEDED: "Số lượng ứng viên hoặc dữ liệu gửi đi vượt giới hạn xử lý. Vui lòng giảm giới hạn và thử lại.",
  CANDIDATE_RANKING_GENERATION_FAILED: "Không thể tạo lượt xếp hạng ứng viên. Nếu tin đã có ứng viên thật, vui lòng kiểm tra AI Service Candidate Ranking.",
  CANDIDATE_RANKING_RUN_NOT_FOUND: "Không tìm thấy lượt xếp hạng ứng viên phù hợp.",
  CV_ANALYSIS_NOT_READY: "CV chưa sẵn sàng để dùng cho tính năng này.",
  CV_IN_USE: "CV đã được dùng trong đơn ứng tuyển, gợi ý việc làm hoặc xếp hạng ứng viên nên chưa thể xóa.",
  DUPLICATE_RESOURCE: "Dữ liệu đã tồn tại trong hệ thống.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  JOB_NOT_ACTIVE: "Tin tuyển dụng không còn ở trạng thái đang tuyển.",
  NOT_FOUND: "Không tìm thấy dữ liệu phù hợp.",
  RECOMMENDATION_GENERATION_FAILED: "Không thể tạo gợi ý việc làm. Vui lòng thử lại sau.",
  RESOURCE_NOT_FOUND: "Không tìm thấy dữ liệu phù hợp.",
  SAVED_CANDIDATE_ALREADY_EXISTS: "Hồ sơ ứng viên này đã được lưu trước đó.",
  SAVED_CANDIDATE_NOT_FOUND: "Dấu lưu không còn tồn tại hoặc không thuộc công ty bạn. Hãy tải lại danh sách.",
  SAVED_CANDIDATE_REVISION_CONFLICT: "Ghi chú đã thay đổi ở phiên khác. Bản nháp vẫn được giữ; hãy tải ghi chú hiện tại để đối chiếu.",
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
