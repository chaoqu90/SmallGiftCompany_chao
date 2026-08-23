package org.example.backend.catalog;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "bundle_template_slot")
public class BundleTemplateSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bundle_template_id", nullable = false)
    private BundleTemplate bundleTemplate;

    @Column(name = "slot_code", nullable = false, length = 30)
    private String slotCode;

    @Column(name = "display_order", nullable = false)
    private short displayOrder;

    @Column(nullable = false)
    private boolean required = true;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
        name = "bundle_template_slot_role",
        joinColumns = @JoinColumn(name = "slot_id")
    )
    @Column(name = "role", length = 20)
    private Set<String> allowedRoles = new HashSet<>();

    protected BundleTemplateSlot() {}

    public Long getId()                    { return id; }
    public BundleTemplate getBundleTemplate() { return bundleTemplate; }
    public String getSlotCode()            { return slotCode; }
    public short getDisplayOrder()         { return displayOrder; }
    public boolean isRequired()            { return required; }
    public Set<String> getAllowedRoles()   { return allowedRoles; }
}
