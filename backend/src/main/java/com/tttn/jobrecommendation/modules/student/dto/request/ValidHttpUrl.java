package com.tttn.jobrecommendation.modules.student.dto.request;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import org.springframework.util.StringUtils;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.net.URI;
import java.util.Locale;

@Documented
@Constraint(validatedBy = ValidHttpUrl.Validator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.TYPE_USE})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidHttpUrl {

    String message() default "must be a valid http or https URL";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidHttpUrl, String> {
        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            if (!StringUtils.hasText(value)) {
                return true;
            }
            String trimmed = value.trim();
            if (trimmed.chars().anyMatch(Character::isWhitespace)) {
                return false;
            }
            try {
                URI uri = URI.create(trimmed);
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if (scheme == null || host == null || host.isBlank()) {
                    return false;
                }
                String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
                return ("http".equals(normalizedScheme) || "https".equals(normalizedScheme))
                        && uri.getRawUserInfo() == null;
            } catch (IllegalArgumentException ex) {
                return false;
            }
        }
    }
}
