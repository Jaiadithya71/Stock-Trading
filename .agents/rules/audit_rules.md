# Antigravity Audit & Verification Rules

> Applies to all agent tasks within this workspace.

1. **Empirical Verification Required**: Never mark a coding task, bug fix, or feature request as complete without running test commands or verification scripts demonstrating clean execution (`HTTP 200 OK`, `node -c`, syntax checks).
2. **Strict Module Declaration**: All required Node modules must be explicitly imported at the top of the file before any property or method access (`fs`, `path`, `cors`, `bodyParser`).
3. **No Silent Error Swallowing**: Catch blocks must log explicit error messages and return informative JSON or HTTP status codes.
4. **Environment Credential Protection**: Secret API keys, TOTP tokens, or passwords must never be logged or printed to stdout.
