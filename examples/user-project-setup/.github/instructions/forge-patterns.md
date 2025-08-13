# Cappy Patterns - Context-Specific Guidelines

## 🚨 **Known Patterns to AVOID**

### `manual_migration_creation`
- **Trigger**: Creating Alembic migration files manually instead of using commands
- **Prevention**: Always use `alembic revision` or `alembic revision --autogenerate`
- **Example**: `alembic revision -m "create_users_table"` not manual file creation
- **❌ DON'T**: Create migration files manually - missing imports, wrong structure

### `dependency_version_conflicts`
- **Trigger**: Adding new dependencies without checking compatibility
- **Prevention**: Pin versions, check compatibility matrix first
- **Example**: `sqlx = "0.7.4"` not `sqlx = "0.7"`
- **❌ DON'T**: Use open version ranges without checking compatibility

### `shell_environment_mismatch`  
- **Trigger**: Using bash commands on Windows
- **Prevention**: Use PowerShell syntax, include .exe suffix
- **Example**: `cargo.exe build` not `cargo build`
- **❌ DON'T**: Assume bash commands work on Windows

### `feature_flags_missing`
- **Trigger**: Missing required features for dependencies
- **Prevention**: Read crate docs, include necessary features
- **Example**: `sqlx = { version = "0.7", features = ["migrate"] }`
- **❌ DON'T**: Add dependencies without checking required features

### `authentication_issues`
- **Trigger**: Not testing auth flow end-to-end
- **Prevention**: Test with valid/invalid tokens early
- **Example**: Test expired tokens, refresh logic
- **❌ DON'T**: Deploy auth without testing edge cases

## 💡 **Context-Specific Guidelines**

### Database Tasks:
- Always test connection first
- **ALWAYS use Alembic commands**: `alembic revision -m "description"`
- **NEVER create migration files manually** - use `alembic revision --autogenerate`
- Backup before schema changes
- Test migrations in dev environment
- **❌ DON'T**: Create migration files manually - missing structure/imports
- **❌ DON'T**: Run migrations on production without testing

### Authentication Tasks:
- Test with expired/invalid tokens
- Verify CORS settings
- Check security best practices
- Test token refresh flow
- Validate user permissions
- **❌ DON'T**: Skip edge case testing
- **❌ DON'T**: Store tokens in plain text
- **❌ DON'T**: Forget rate limiting

### API Tasks:  
- Define schemas first
- Test all error scenarios
- Use proper HTTP status codes
- Document endpoints
- Validate input data
- **❌ DON'T**: Deploy without error handling
- **❌ DON'T**: Skip input validation
- **❌ DON'T**: Return raw database errors

### Setup Tasks:
- Pin dependency versions
- Test in clean environment
- Document all prerequisites
- Test cross-platform compatibility
- **❌ DON'T**: Use loose version constraints
- **❌ DON'T**: Assume platform compatibility
- **❌ DON'T**: Skip environment validation

### Testing Tasks:
- Test both success and failure paths
- Include edge cases
- Mock external dependencies
- Test error handling
- **❌ DON'T**: Only test happy path
- **❌ DON'T**: Skip integration tests
- **❌ DON'T**: Forget to test error scenarios

### DevOps/Deployment Tasks:
- Test in staging first
- Have rollback plan
- Monitor after deployment
- Document deployment steps
- **❌ DON'T**: Deploy without testing
- **❌ DON'T**: Skip rollback planning
- **❌ DON'T**: Forget monitoring

## ✅ **Success Patterns to FOLLOW**

### Incremental Development:
- Make small changes (1-3h chunks)
- Test after each change
- Commit working state frequently
- Use feature flags for incomplete features

### Error Handling:
- Always handle errors explicitly
- Use Result<T,E> pattern consistently  
- Never use `.unwrap()` in production code
- Log errors with context

### Testing Strategy:
- Write tests for business logic
- Test error scenarios
- Integration tests for critical paths
- Performance tests for bottlenecks

### Documentation:
- Document decisions and why
- Include examples in documentation
- Keep README updated
- Document API changes

## 📋 **Pre-Flight Checklist (Before Starting)**

For EVERY task, check:
- [ ] Is task atomic (≤3 hours)?
- [ ] Have I read accumulated "DON'T DO" rules?
- [ ] Are dependencies compatible?
- [ ] Do I understand the requirements?
- [ ] Is environment properly set up?
- [ ] Have I reviewed similar past issues?
- [ ] Do I have a rollback plan?
- [ ] Are tests in place?

## 🎯 **Task Categories & Patterns**

### Development Tasks:
- New features, enhancements
- Focus on incremental delivery
- Test early and often

### Bug Fix Tasks:
- Error corrections, hotfixes
- Reproduce issue first
- Add tests to prevent regression

### Testing Tasks:
- Test creation, QA activities
- Cover edge cases
- Performance and security testing

### Documentation Tasks:
- Docs, README updates
- Include examples
- Keep up to date with code

### DevOps Tasks:
- Deployment, configuration, CI/CD
- Test in staging
- Monitor and alert

### UI/UX Tasks:
- Interface design, user experience
- Test with real users
- Consider accessibility

### Security Tasks:
- Authentication, authorization, vulnerability fixes
- Follow security best practices
- Regular security audits

### Performance Tasks:
- Optimization, monitoring
- Measure before optimizing
- Profile and benchmark

### Research Tasks:
- Spike tasks, proof of concepts
- Time-boxed exploration
- Document findings
