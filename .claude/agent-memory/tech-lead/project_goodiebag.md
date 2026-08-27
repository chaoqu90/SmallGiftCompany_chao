---
name: Goodie Bag MVP project overview
description: Children's goodie-bag business -- Spring Boot 4.1, Java 21, PostgreSQL, React/Vite frontend. Dynamic bundle generation with multi-dimensional affinity scoring. Modular monolith, not microservices.
type: project
---

Goodie Bag MVP is a children's party favor e-commerce app with two journeys: commerce (gift finder -> bundle generation -> checkout) and booth/field marketing (QR -> punch pass -> iPad redemption).

**Why:** Single small business MVP -- simplicity and shipping speed are priorities.

**How to apply:**
- Stack is Spring Boot 4.1.0, Java 21, PostgreSQL (NOT MongoDB despite system prompt suggesting it), Flyway migrations, Spring Data JPA (NOT reactive/Project Reactor)
- Architecture is modular monolith with REST endpoints (NOT GraphQL despite system prompt)
- The actual stack diverges from the system prompt's assumptions (no RSocket, no GraphQL, no MongoDB, no Expo/React Native) -- always read current code before applying system prompt patterns
- Backend has 23 Flyway migrations, comprehensive admin CRUD, and a 3-path bundle generation algorithm
- Master plan explicitly forbids: microservices, Kafka, Redis, Kubernetes, Elasticsearch, GraphQL, AI recommendation systems
