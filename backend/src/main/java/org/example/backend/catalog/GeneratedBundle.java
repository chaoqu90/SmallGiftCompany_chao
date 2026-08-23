package org.example.backend.catalog;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "generated_bundle")
public class GeneratedBundle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true, length = 30)
    private String publicId;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Column(name = "requested_age", nullable = false)
    private short requestedAge;

    @Enumerated(EnumType.STRING)
    @Column(name = "audience_preference", nullable = false, length = 20)
    private AudiencePreference audiencePreference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Interest interest;

    @Enumerated(EnumType.STRING)
    @Column(name = "party_type", nullable = false, length = 20)
    private PartyType partyType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "budget_tier_id", nullable = false)
    private BudgetTier budgetTier;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bundle_template_id", nullable = false)
    private BundleTemplate bundleTemplate;

    @Column(name = "base_retail_price", precision = 10, scale = 2)
    private BigDecimal baseRetailPrice;

    @Column(name = "standard_item_cogs_snapshot", nullable = false, precision = 10, scale = 2)
    private BigDecimal standardItemCogsSnapshot;

    @Column(nullable = false, length = 20)
    private String status = "GENERATED";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @OneToMany(mappedBy = "generatedBundle", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @OrderBy("displayOrder ASC")
    private List<GeneratedBundleItem> items = new ArrayList<>();

    @OneToOne(mappedBy = "generatedBundle", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private GeneratedBundleUpgrade upgrade;

    @OneToOne(mappedBy = "generatedBundle", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private GeneratedBundleGiftBag giftBag;

    protected GeneratedBundle() {}

    public GeneratedBundle(String publicId, short requestedAge, AudiencePreference audiencePreference,
                           Interest interest, PartyType partyType, BudgetTier budgetTier,
                           BundleTemplate bundleTemplate, BigDecimal standardItemCogsSnapshot) {
        this.publicId = publicId;
        this.requestedAge = requestedAge;
        this.audiencePreference = audiencePreference;
        this.interest = interest;
        this.partyType = partyType;
        this.budgetTier = budgetTier;
        this.bundleTemplate = bundleTemplate;
        this.standardItemCogsSnapshot = standardItemCogsSnapshot;
        this.createdAt = Instant.now();
    }

    public Long getId()                                  { return id; }
    public String getPublicId()                          { return publicId; }
    public String getSessionId()                         { return sessionId; }
    public short getRequestedAge()                       { return requestedAge; }
    public AudiencePreference getAudiencePreference()    { return audiencePreference; }
    public Interest getInterest()                        { return interest; }
    public PartyType getPartyType()                      { return partyType; }
    public BudgetTier getBudgetTier()                    { return budgetTier; }
    public BundleTemplate getBundleTemplate()            { return bundleTemplate; }
    public BigDecimal getBaseRetailPrice()               { return baseRetailPrice; }
    public BigDecimal getStandardItemCogsSnapshot()      { return standardItemCogsSnapshot; }
    public String getStatus()                            { return status; }
    public Instant getCreatedAt()                        { return createdAt; }
    public Instant getExpiresAt()                        { return expiresAt; }
    public List<GeneratedBundleItem> getItems()          { return items; }
    public GeneratedBundleUpgrade getUpgrade()           { return upgrade; }
    public GeneratedBundleGiftBag getGiftBag()           { return giftBag; }

    public void setItems(List<GeneratedBundleItem> items)               { this.items = items; }
    public void setUpgrade(GeneratedBundleUpgrade upgrade)              { this.upgrade = upgrade; }
    public void setGiftBag(GeneratedBundleGiftBag giftBag)             { this.giftBag = giftBag; }
    public void setStandardItemCogsSnapshot(BigDecimal cogs)           { this.standardItemCogsSnapshot = cogs; }
    public void setBaseRetailPrice(BigDecimal price)                   { this.baseRetailPrice = price; }
}
