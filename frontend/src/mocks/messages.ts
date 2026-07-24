import type { Conversation } from "../types/domain";

export const conversations: Conversation[] = [
  {
    id: "conversation-1",
    participantName: "Trần Thị Bình",
    participantRole: "recruiter",
    subject: "Trao đổi vị trí Frontend Developer",
    unreadCount: 2,
    messages: [
      { id: "msg-1", conversationId: "conversation-1", senderName: "Trần Thị Bình", body: "Chào An, công ty muốn trao đổi thêm về kinh nghiệm React của bạn.", sentAt: "2026-07-08T09:00:00", read: false },
      { id: "msg-2", conversationId: "conversation-1", senderName: "Nguyễn Văn An", body: "Em sẵn sàng trao đổi thêm ạ.", sentAt: "2026-07-08T09:15:00", read: true },
    ],
  },
  {
    id: "conversation-2",
    participantName: "Đỗ Quốc Huy",
    participantRole: "recruiter",
    subject: "Lịch phỏng vấn Backend Developer",
    unreadCount: 0,
    messages: [
      { id: "msg-3", conversationId: "conversation-2", senderName: "Đỗ Quốc Huy", body: "Bạn xác nhận lịch phỏng vấn ngày 14/07 giúp mình nhé.", sentAt: "2026-07-09T10:00:00", read: true },
    ],
  },
  {
    id: "conversation-3",
    participantName: "Nguyễn Kim Oanh",
    participantRole: "recruiter",
    subject: "CV QA Engineer",
    unreadCount: 1,
    messages: [
      { id: "msg-4", conversationId: "conversation-3", senderName: "Nguyễn Kim Oanh", body: "Bạn vui lòng gửi thêm portfolio test case nếu có.", sentAt: "2026-07-09T13:30:00", read: false },
    ],
  },
  {
    id: "conversation-4",
    participantName: "Quản trị viên",
    participantRole: "admin",
    subject: "Thông báo xác minh tài khoản",
    unreadCount: 0,
    messages: [
      { id: "msg-5", conversationId: "conversation-4", senderName: "Quản trị viên", body: "Tài khoản của bạn đã được xác minh email.", sentAt: "2026-07-07T08:00:00", read: true },
    ],
  },
  {
    id: "conversation-5",
    participantName: "Phan Đức Tài",
    participantRole: "recruiter",
    subject: "Lời mời ứng tuyển Mobile Developer",
    unreadCount: 3,
    messages: [
      { id: "msg-6", conversationId: "conversation-5", senderName: "Phan Đức Tài", body: "Hồ sơ Flutter của bạn rất phù hợp với nhóm mobile.", sentAt: "2026-07-10T09:10:00", read: false },
      { id: "msg-7", conversationId: "conversation-5", senderName: "Phan Đức Tài", body: "Bạn có thể tham gia phỏng vấn tuần tới không?", sentAt: "2026-07-10T09:12:00", read: false },
    ],
  },
];
