package org.example.backend.catalog;

public class BundleGenerationException extends RuntimeException {

    public enum FailureCode {
        INSUFFICIENT_ROLE_COVERAGE,
        NO_BUDGET_FEASIBLE,
        NO_ELIGIBLE_PRODUCTS,
        TEMPLATE_NOT_FOUND,
        BUDGET_TIER_NOT_FOUND,
        NO_GIFT_BAG_CONFIGURED
    }

    private final FailureCode code;
    private final String detail;

    public BundleGenerationException(FailureCode code, String detail) {
        super(code.name() + ": " + detail);
        this.code = code;
        this.detail = detail;
    }

    public FailureCode getCode() { return code; }
    public String getDetail()    { return detail; }
}
