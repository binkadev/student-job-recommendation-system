export const cvInUseMessage = "CV này đã được sử dụng trong dữ liệu ứng tuyển, gợi ý việc làm hoặc xếp hạng ứng viên nên không thể xóa.";

export function isCvDeleteAvailable(cv: { deletable: boolean }) {
  return cv.deletable;
}

export function isCvInUseError(error: unknown) {
  return typeof error === "object" && error !== null && "response" in error
    && (error as { response?: { data?: { errorCode?: string } } }).response?.data?.errorCode === "CV_IN_USE";
}
