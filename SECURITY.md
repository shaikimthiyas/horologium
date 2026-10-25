# Security Policy & Vulnerability Disclosure

## Supported Versions

Security updates and critical patches are actively applied to the following release branches:

| Version | Supported          | Security Status |
| ------- | ------------------ | --------------- |
| 1.x.x   | :white_check_mark: | Active Support  |
| < 1.0.0 | :x:                | Deprecated      |

---

## Reporting a Vulnerability

The Horologium engineering team takes the security of distributed chronometry and telemetry protocols seriously. If you discover a security vulnerability, please report it responsibly:

1. **Do not disclose publicly**: Avoid opening public GitHub issues for security vulnerabilities.
2. **Contact Channel**: Email vulnerability disclosures to `shaik.imthiyas.t@gmail.com` with the subject tag `[SECURITY] Horologium Vulnerability Report`.
3. **Report Details**:
   - Component affected (e.g., Express Gateway, WebSocket SNTP, Rate Limiter, SQLite / TimescaleDB engine).
   - Detailed proof-of-concept (PoC) or reproduction steps.
   - Potential impact (e.g., Denial of Service, Unauthorized Elevation, Timing Side-Channel).

---

## Response Timeline & SLA

- **Initial Acknowledgment**: Within 24 hours.
- **Triage & Reproduction**: Within 48 hours.
- **Remediation & Patch Release**: Within 7 business days for high/critical severity issues.
- **Public Disclosure**: Coordinated following patch deployment.
