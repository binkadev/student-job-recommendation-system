package com.tttn.jobrecommendation.common.exception;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleResourceNotFoundException(ResourceNotFoundException exception) {
        ErrorCode errorCode = exception.getErrorCode();
        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(ApiResponse.error(errorCode.getCode(), exception.getMessage()));
    }

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException exception) {
        ErrorCode errorCode = exception.getErrorCode();
        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(ApiResponse.error(errorCode.getCode(), exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException exception
    ) {
        String message = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::formatFieldError)
                .collect(Collectors.joining("; "));

        if (message.isBlank()) {
            message = ErrorCode.VALIDATION_ERROR.getDefaultMessage();
        }

        return ResponseEntity
                .status(ErrorCode.VALIDATION_ERROR.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.VALIDATION_ERROR.getCode(), message));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolationException(ConstraintViolationException exception) {
        String message = exception.getConstraintViolations()
                .stream()
                .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                .collect(Collectors.joining("; "));

        if (message.isBlank()) {
            message = ErrorCode.VALIDATION_ERROR.getDefaultMessage();
        }

        return ResponseEntity
                .status(ErrorCode.VALIDATION_ERROR.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.VALIDATION_ERROR.getCode(), message));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDeniedException(AccessDeniedException exception) {
        return ResponseEntity
                .status(ErrorCode.ACCESS_DENIED.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.ACCESS_DENIED.getCode(), ErrorCode.ACCESS_DENIED.getDefaultMessage()));
    }

    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            HttpMediaTypeNotSupportedException.class
    })
    public ResponseEntity<ApiResponse<Void>> handleBadRequestException(Exception exception) {
        return ResponseEntity
                .status(ErrorCode.BAD_REQUEST.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.BAD_REQUEST.getCode(), ErrorCode.BAD_REQUEST.getDefaultMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception exception) {
        return ResponseEntity
                .status(ErrorCode.INTERNAL_SERVER_ERROR.getHttpStatus())
                .body(ApiResponse.error(
                        ErrorCode.INTERNAL_SERVER_ERROR.getCode(),
                        ErrorCode.INTERNAL_SERVER_ERROR.getDefaultMessage()
                ));
    }

    private String formatFieldError(FieldError fieldError) {
        return fieldError.getField() + ": " + fieldError.getDefaultMessage();
    }
}
