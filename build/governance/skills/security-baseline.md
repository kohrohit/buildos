# Security Baseline

Minimum security requirements that every project must meet regardless of size, domain, or technology stack.

## Authentication

### Password Policy
- Minimum 8 characters with complexity requirements (uppercase, lowercase, number)
- Use bcrypt, scrypt, or Argon2 for password hashing (never MD5 or SHA-1)
- Implement account lockout after 5 failed attempts (unlock after 15 minutes)
- Support password reset via email with time-limited tokens (24 hours max)
- Never send passwords in email; send reset links only

### Token Management
- Access tokens: short-lived (15-30 minutes)
- Refresh tokens: longer-lived (7-30 days) with rotation on use
- Tokens are cryptographically signed (JWT with RS256 or ES256)
- Tokens include minimal claims (user ID, roles, expiry)
- Tokens are validated on every request (signature, expiry, issuer)
- Revocation mechanism exists for compromised tokens

### Session Security
- Session IDs are cryptographically random (128+ bits of entropy)
- Sessions expire after inactivity (30 minutes default)
- Sessions are invalidated on logout
- Session fixation protection: regenerate session ID after login
- HttpOnly and Secure flags on session cookies
- SameSite=Strict or SameSite=Lax on all cookies

## Authorization

### Access Control
- Implement role-based access control (RBAC) or attribute-based (ABAC)
- Apply principle of least privilege: minimum permissions by default
- Check authorization on every request (server-side, never client-side only)
- Deny by default; explicitly grant access
- Separate authentication (who are you?) from authorization (what can you do?)

### API Security
- Authenticate all non-public API endpoints
- Implement rate limiting: 100 requests/minute for authenticated, 20 for anonymous
- Use API keys for service-to-service communication
- Validate request origin with CORS (whitelist specific origins)
- Implement request size limits (1MB default for JSON bodies)

## Input Validation

### Server-Side Validation
- Validate all input on the server (never trust client-side validation alone)
- Use allowlists over denylists (accept known good, reject everything else)
- Validate data types, ranges, lengths, and formats
- Reject input that does not match expected patterns
- Sanitize output to prevent XSS (encode HTML entities)

### Injection Prevention
- Use parameterized queries for all database operations (never string concatenation)
- Use ORM/query builders that generate parameterized SQL
- Validate and sanitize file paths to prevent path traversal
- Escape shell arguments if command execution is necessary (prefer alternatives)
- Validate and sanitize URLs to prevent SSRF

## Secrets Management

### Storage
- Never commit secrets to version control (use .gitignore for .env files)
- Use environment variables or dedicated secrets managers (Vault, AWS SSM, GCP Secret Manager)
- Encrypt secrets at rest in configuration stores
- Different secrets for each environment (dev, staging, production)
- Document all required secrets in a template (without values)

### Rotation
- Rotate secrets on a regular schedule (90 days minimum)
- Rotate immediately if a compromise is suspected
- Support zero-downtime rotation (accept old and new during transition)
- Audit secret access logs regularly

### Detection
- Run secret scanning in CI/CD pipelines (gitleaks, trufflehog)
- Pre-commit hooks to prevent accidental commits of secrets
- Monitor public repositories for leaked credentials
- Immediate rotation if a secret is detected in version control

## Data Protection

### PII Handling
- Identify and classify all PII in the system
- Encrypt PII at rest (AES-256 or equivalent)
- Encrypt PII in transit (TLS 1.2+ for all communication)
- Implement data masking in logs and non-production environments
- Define and enforce data retention policies
- Support data deletion for compliance (GDPR right to erasure)

### Encryption Standards
- TLS 1.2 or 1.3 for all external communication (no exceptions)
- AES-256-GCM for symmetric encryption at rest
- RSA-2048 or ECDSA-P256 minimum for asymmetric operations
- Use established cryptographic libraries (never roll your own)
- Store encryption keys separately from encrypted data

## Logging and Monitoring

### Security Logging
- Log all authentication events (login, logout, failed attempts)
- Log all authorization failures (access denied)
- Log all administrative actions (user creation, role changes, config changes)
- Log API access with request metadata (IP, user agent, endpoint, status code)
- Include correlation IDs for request tracing

### What NOT to Log
- Passwords, tokens, or API keys (even in error logs)
- Credit card numbers, SSNs, or other PII
- Encryption keys or certificates
- Full request bodies containing sensitive data
- Health check responses (reduce noise)

### Monitoring and Alerting
- Alert on repeated authentication failures (brute force detection)
- Alert on unusual API access patterns (rate anomalies, geo anomalies)
- Alert on new admin account creation
- Alert on privilege escalation events
- Monitor dependency vulnerability databases daily

## HTTP Security Headers

### Required Headers
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Dependency Security

- Audit dependencies weekly with automated tools (npm audit, safety, OWASP dependency-check)
- Update critical vulnerability patches within 48 hours
- Update high vulnerability patches within 1 week
- Pin dependency versions in production
- Review new dependencies for maintenance status, license, and security history
- Prefer widely-used, well-maintained libraries over niche alternatives

## Incident Response Checklist

- [ ] Identify and contain the breach (revoke access, isolate systems)
- [ ] Rotate all potentially compromised credentials immediately
- [ ] Preserve logs and evidence for investigation
- [ ] Assess the scope and impact of the breach
- [ ] Notify affected users and stakeholders per legal requirements
- [ ] Conduct root cause analysis and implement preventive measures
- [ ] Update security baseline with lessons learned
