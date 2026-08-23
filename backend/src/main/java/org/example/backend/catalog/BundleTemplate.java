package org.example.backend.catalog;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "bundle_template")
public class BundleTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "min_age", nullable = false)
    private short minAge;

    @Column(name = "max_age", nullable = false)
    private short maxAge;

    @Column(nullable = false)
    private boolean active = true;

    @OneToMany(mappedBy = "bundleTemplate", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @OrderBy("displayOrder ASC")
    private List<BundleTemplateSlot> slots = new ArrayList<>();

    protected BundleTemplate() {}

    public Long getId()                          { return id; }
    public String getCode()                      { return code; }
    public String getName()                      { return name; }
    public short getMinAge()                     { return minAge; }
    public short getMaxAge()                     { return maxAge; }
    public boolean isActive()                    { return active; }
    public List<BundleTemplateSlot> getSlots()   { return slots; }
}
