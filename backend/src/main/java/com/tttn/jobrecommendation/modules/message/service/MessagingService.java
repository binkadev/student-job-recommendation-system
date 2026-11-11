package com.tttn.jobrecommendation.modules.message.service;

import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.exception.*;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.message.dto.response.*;
import com.tttn.jobrecommendation.modules.message.entity.*;
import com.tttn.jobrecommendation.modules.message.repository.*;
import com.tttn.jobrecommendation.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MessagingService {
    private final JobApplicationRepository applications;
    private final ConversationRepository conversations;
    private final MessageRepository messages;

    @Transactional
    public ConversationResponse create(Long userId, UserRole role, Long applicationId) {
        requireRole(role);
        // The existing Application lock serializes creators across JVMs, including the initial empty case.
        var application = applications.findByIdForStatusUpdate(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));
        participant(application, userId, role);
        var conversation = conversations.findByApplicationId(applicationId).orElseGet(() ->
                conversations.saveAndFlush(Conversation.builder().application(application)
                        .company(application.getJob().getCompany()).student(application.getStudent()).build()));
        authorize(conversation, userId, role);
        return ConversationResponse.from(conversation);
    }

    public PageResponse<ConversationResponse> list(Long userId, UserRole role, int page, int size) {
        requireRole(role);
        return page(conversations.findOwned(userId, role == UserRole.COMPANY, PageRequest.of(page - 1, size)));
    }

    public PageResponse<MessageResponse> history(Long userId, UserRole role, Long id, int page, int size) {
        var conversation = find(id, false);
        authorize(conversation, userId, role);
        return page(messages.findByConversationId(id, PageRequest.of(page - 1, size,
                Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id")))).map(MessageResponse::from));
    }

    @Transactional
    public MessageResponse send(Long userId, UserRole role, Long id, String content) {
        var conversation = find(id, true);
        User sender = authorize(conversation, userId, role);
        // PostgreSQL TIMESTAMP precision; time is chosen after locking, never from a client.
        var now = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
        if (conversation.getLastMessageAt() != null && now.isBefore(conversation.getLastMessageAt())) {
            now = conversation.getLastMessageAt();
        }
        var message = messages.saveAndFlush(Message.builder().conversation(conversation).sender(sender)
                .senderRole(role).content(content).read(false).createdAt(now).build());
        conversation.setLastMessageAt(now);
        conversations.flush();
        return MessageResponse.from(message);
    }

    @Transactional
    public MarkReadResponse markRead(Long userId, UserRole role, Long id) {
        var conversation = find(id, true);
        authorize(conversation, userId, role);
        var application = conversation.getApplication();
        var incomingRole = role == UserRole.STUDENT ? UserRole.COMPANY : UserRole.STUDENT;
        var sender = incomingRole == UserRole.COMPANY ? application.getJob().getCompany().getUser()
                : application.getStudent().getUser();
        return new MarkReadResponse(id, messages.markIncomingRead(id, sender.getId(), incomingRole));
    }

    private Conversation find(Long id, boolean lock) {
        return (lock ? conversations.findByIdForUpdate(id) : conversations.findById(id))
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
    }

    private User authorize(Conversation conversation, Long userId, UserRole role) {
        var application = conversation.getApplication();
        // Fail closed if redundant participant references ever disagree with the persisted Application.
        if (!conversation.getStudent().getId().equals(application.getStudent().getId())
                || !conversation.getCompany().getId().equals(application.getJob().getCompany().getId())) {
            throw new AppException(ErrorCode.ACCESS_DENIED);
        }
        return participant(application, userId, role);
    }

    private User participant(JobApplication application, Long userId, UserRole role) {
        requireRole(role);
        var user = role == UserRole.COMPANY ? application.getJob().getCompany().getUser()
                : application.getStudent().getUser();
        if (!user.getId().equals(userId)) throw new AppException(ErrorCode.ACCESS_DENIED);
        return user;
    }

    private void requireRole(UserRole role) {
        if (role != UserRole.STUDENT && role != UserRole.COMPANY) throw new AppException(ErrorCode.ACCESS_DENIED);
    }

    private <T> PageResponse<T> page(Page<T> result) {
        return new PageResponse<>(result.getContent(), result.getNumber() + 1, result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }
}
