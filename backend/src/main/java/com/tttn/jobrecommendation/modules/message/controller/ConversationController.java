package com.tttn.jobrecommendation.modules.message.controller;

import com.tttn.jobrecommendation.common.response.*;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.message.dto.request.*;
import com.tttn.jobrecommendation.modules.message.dto.response.*;
import com.tttn.jobrecommendation.modules.message.service.MessagingService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/conversations")
@PreAuthorize("hasAnyRole('STUDENT','COMPANY')")
@Validated
@RequiredArgsConstructor
public class ConversationController {
    private final MessagingService service;
    private final SecurityUtils security;

    @PostMapping
    public ApiResponse<ConversationResponse> create(@Valid @RequestBody CreateConversationRequest request) {
        return ApiResponse.success(service.create(security.getCurrentUserId(), security.getCurrentUserRole(), request.applicationId()));
    }

    @GetMapping
    public ApiResponse<PageResponse<ConversationResponse>> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        return ApiResponse.success(service.list(security.getCurrentUserId(), security.getCurrentUserRole(), page, size));
    }

    @GetMapping("/{id}/messages")
    public ApiResponse<PageResponse<MessageResponse>> history(@PathVariable @Positive Long id,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        return ApiResponse.success(service.history(security.getCurrentUserId(), security.getCurrentUserRole(), id, page, size));
    }

    @PostMapping("/{id}/messages")
    public ApiResponse<MessageResponse> send(@PathVariable @Positive Long id, @Valid @RequestBody SendMessageRequest request) {
        return ApiResponse.success(service.send(security.getCurrentUserId(), security.getCurrentUserRole(), id, request.content()));
    }

    @PatchMapping("/{id}/read")
    public ApiResponse<MarkReadResponse> markRead(@PathVariable @Positive Long id) {
        return ApiResponse.success(service.markRead(security.getCurrentUserId(), security.getCurrentUserRole(), id));
    }
}
