# Contributing to HOROLOGIUM

Thank you for your interest in contributing to **Horologium // Planetary Time & Meridian Telemetry Architecture**. 

We hold the codebase to high standards of architectural rigor, mathematical correctness, strict test coverage, and human-factors engineering.

---

## 1. Development Environment Setup

Ensure you have **Node.js >= 20.10.0** and **npm >= 10.x** installed.

```bash
# Clone the repository
git clone https://github.com/shaikimthiyas/horologium.git
cd horologium

# Install dependencies
npm install

# Start development client & server concurrently
npm run dev

# Run automated test suites
npm test

# Verify production Vite build
npm run build
```

---

## 2. Git Branching & Workflow Model

- `main`: Production release branch. All merges require green CI pipelines.
- `feature/sprint-[letter]-[description]`: Active sprint branches (e.g., `feature/sprint-k-repo-cleanliness-and-governance`).
- `fix/[scope]-[description]`: Targeted bug fixes.

---

## 3. Commit Message Conventions

We adhere to the **Conventional Commits** specification:

```text
feat(scope): add new feature
fix(scope): resolve defect or bug
test(scope): add or modify automated tests
docs(scope): documentation updates
refactor(scope): internal structural improvements without behavioral change
chore(scope): build, dependency, or tooling updates
```

Examples:
- `feat(pwa): implement TCXO quartz oscillator drift simulation`
- `fix(db): isolate SQLite in-memory instance during tests`
- `test(core): add Marzullo intersection consensus verification`

---

## 4. Code Standards & Architectural Rules

1. **Zero External CSS Frameworks**: Styles must use Vanilla CSS tokens defined in `src/styles/tokens.css` and `src/styles/layout.css`.
2. **WCAG 2.2 AAA Accessibility**: Contrast ratios between text and background tokens must strictly satisfy $\ge 7:1$.
3. **Monotonicity & Non-Decreasing Time**: Temporal operations must use monotonic references (`performance.now()` / `process.hrtime.bigint()`) to avoid backwards jumps.
4. **RFC 7807 Standard Error Formatting**: All REST error responses must produce `application/problem+json` envelopes.
5. **Test Coverage**: Any new feature or bug fix must include automated unit tests under `tests/unit/` using the native Node.js test runner (`node:test`).
