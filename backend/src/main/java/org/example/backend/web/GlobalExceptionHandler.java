package org.example.backend.web;

import jakarta.validation.ConstraintViolationException;
import org.example.backend.catalog.BundleGenerationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.net.URI;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {
        ProblemDetail pd = ProblemDetail.forStatus(status);
        pd.setType(URI.create("about:validation-error"));
        pd.setTitle("Validation failed");
        pd.setDetail(ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("Unknown validation error"));
        return ResponseEntity.status(status).body(pd);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ProblemDetail> handleConstraintViolation(ConstraintViolationException ex) {
        String detail = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .sorted()
                .collect(java.util.stream.Collectors.joining("; "));
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setType(URI.create("about:validation-error"));
        pd.setTitle("Validation failed");
        pd.setDetail(detail);
        return ResponseEntity.badRequest().body(pd);
    }

    @ExceptionHandler(BundleGenerationException.class)
    public ResponseEntity<ProblemDetail> handleBundleGeneration(BundleGenerationException ex) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.UNPROCESSABLE_ENTITY);
        pd.setType(java.net.URI.create("about:bundle-generation-error"));
        pd.setTitle("Bundle generation failed");
        pd.setDetail(ex.getDetail());
        pd.setProperty("failureCode", ex.getCode().name());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(pd);
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        pd.setType(URI.create("about:internal-error"));
        pd.setTitle("Internal server error");
        pd.setDetail("An unexpected error occurred");
        return pd;
    }
}
