# Horologium Permanent Content Quality Standard

> **The Governing Principle:** Every word must justify its existence. Treat user attention with respect. Speak with the dignity, restraint, and mathematical precision of Swiss chronometry and reliable systems engineering.

---

## 1. The Quality Gate Checklist
Before any user-facing copy or feature is merged, it must satisfy all 10 criteria:

1. **Purpose:** Does this text serve a genuine user need or clarify actual functionality?
2. **Clarity:** Can a first-time user immediately understand the meaning without decoding jargon?
3. **Specificity:** Does the copy describe Horologium specifically, rather than a generic SaaS template?
4. **Accuracy:** Can every technical claim (Marzullo, NTP, solar terminator, slewing) be proven in code?
5. **Credibility:** Are all status indicators, SLAs, and performance metrics grounded in real telemetry?
6. **Naturalness:** Does the text read as thoughtful, human-written English?
7. **Concision:** Can any adjectives, adverbs, or introductory filler be removed without losing meaning?
8. **Consistency:** Does the copy adhere to Horologium terminology and sentence case standards?
9. **Accessibility:** Are form labels, button texts, and tooltips screen-reader friendly and descriptive?
10. **Actionability:** Does every button, link, and error message guide the user on what happens next?

---

## 2. Forbidden Patterns & Blacklist

### A. Generic Marketing Clichés
- Never use: *seamless, effortless, revolutionary, cutting-edge, next-generation, world-class, best-in-class, powerful, innovative, transformative, unparalleled, game-changing, groundbreaking, future-ready, state-of-the-art, supercharge, revolutionize, elevate, unleash*.
- Never use: *"Unlock the power of...", "Experience the future of...", "Redefining the way you...", "Everything you need in one place", "Where innovation meets intelligence"*.

### B. Fabricated Security & Trust Tropes
- Never use: *"Military-grade encryption"*, *"Quantum secured"*, *"100% secure"*, *"Immutable verification"*, *"Verified cryptographic anchor"* unless an actual cryptosystem is being described and users need to audit it.
- State the actual technology used: *"SHA-256 Key Hashing"*, *"Local Browser Storage (IndexedDB)"*, *"HTTPS / TLS 1.3"*.

### C. Fictional Sci-Fi / Arcade Labels
- Avoid: *"ARMED"*, *"LOCKED"*, *"RADAR RETICLE"*, *"TRANSMISSION PROTOCOL LIAISON"*, *"OPERATOR CLEARANCE VAULT"*.
- Use clean, modern system terminology: *"Active"*, *"Synchronized"*, *"Crosshair"*, *"Contact & Inquiries"*, *"Settings & Preferences"*.

---

## 3. Microcopy Design Guidelines

- **Buttons:** Start with a verb: `Open World Map`, `Compare Time Zones`, `Copy Time`, `Run Diagnostics`.
- **Empty States:** Always tell the user:
  1. What is missing.
  2. Why it is empty.
  3. What action they can take to populate it.
- **Loading Messages:** State the actual asynchronous operation (`Synchronizing with Stratum-1 servers...`, `Loading timezone boundaries...`). Never use *"Awakening intelligence..."* or *"AI magic happening..."*.
- **Error Messages:** State what failed, why it failed, whether user data was preserved, and what recovery step to take.
