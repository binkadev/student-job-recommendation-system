package com.tttn.jobrecommendation.common.utils;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Map;

public final class PageableUtils {

    private PageableUtils() {
    }

    public static Pageable createPageable(
            Integer page,
            Integer size,
            String sort,
            String defaultSortProperty,
            Sort.Direction defaultDirection,
            Map<String, String> allowedSortProperties
    ) {
        int pageNumber = Math.max(page == null ? 1 : page, 1);
        int pageSize = Math.min(Math.max(size == null ? 10 : size, 1), 100);
        return PageRequest.of(
                pageNumber - 1,
                pageSize,
                parseSort(sort, defaultSortProperty, defaultDirection, allowedSortProperties)
        );
    }

    private static Sort parseSort(
            String sort,
            String defaultSortProperty,
            Sort.Direction defaultDirection,
            Map<String, String> allowedSortProperties
    ) {
        if (!StringUtils.hasText(sort)) {
            return Sort.by(defaultDirection, defaultSortProperty);
        }

        String[] parts = sort.trim().split("[,:]", 2);
        String requestedProperty = parts[0].trim();
        String sortProperty = allowedSortProperties.get(requestedProperty);
        if (sortProperty == null) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Unsupported sort field: " + requestedProperty);
        }

        Sort.Direction direction = defaultDirection;
        if (parts.length == 2 && StringUtils.hasText(parts[1])) {
            direction = parseDirection(parts[1].trim());
        }

        return Sort.by(direction, sortProperty);
    }

    private static Sort.Direction parseDirection(String value) {
        try {
            return Sort.Direction.fromString(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Unsupported sort direction: " + value);
        }
    }
}
