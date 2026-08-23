---
name: Eager-copy lazy collections in DTO factory methods
description: When mapping Hibernate entities to DTOs inside a @Transactional service, copy lazy @ElementCollection or @OneToMany sets into plain Java collections to prevent LazyInitializationException during Jackson serialization.
type: feedback
---

When a `@Transactional(readOnly = true)` service returns DTOs built from Hibernate entities, any `@ElementCollection` or lazily-fetched collection accessed in the DTO factory method must be *iterated* within the transaction — not just referenced.

Returning `b.getTags()` (which is a Hibernate `PersistentSet` proxy) in a record field is unsafe: Jackson serializes it after the transaction commits, causing `LazyInitializationException: no session`.

**Fix:** Force eager materialization in the `from()` factory method by copying into a plain collection:

```java
new HashSet<>(b.getTags())   // triggers SQL load while session is open
```

**Why:** `open-in-view: false` (set in application.yaml) means there is no session beyond the service transaction boundary. The JVM record holds a reference to the uninitialized proxy, which Jackson tries to walk after the session closes.

**How to apply:** Any time a DTO factory method reads an `@ElementCollection`, `@OneToMany`, or `@ManyToMany` field from an entity, wrap it in `new ArrayList<>(...)` or `new HashSet<>(...)` to force loading inside the transaction.
