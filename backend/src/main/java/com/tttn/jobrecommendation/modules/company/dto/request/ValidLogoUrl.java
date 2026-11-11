package com.tttn.jobrecommendation.modules.company.dto.request;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.net.URI;

@Documented
@Constraint(validatedBy = ValidLogoUrl.Validator.class)
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidLogoUrl {
    String message() default "must be an absolute HTTP(S) URL without credentials or whitespace";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidLogoUrl, String> {
        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            if (value == null || value.isEmpty()) return true;
            if (value.codePoints().anyMatch(c -> Character.isWhitespace(c) || Character.isSpaceChar(c))) return false;
            try {
                URI uri = URI.create(value);
                return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                        && uri.getHost() != null && !uri.getHost().isBlank()
                        && uri.getRawUserInfo() == null;
            } catch (IllegalArgumentException ex) {
                return false;
            }
        }
    }
}
