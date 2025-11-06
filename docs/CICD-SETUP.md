# CI/CD Pipeline Setup Guide

## Overview

This project uses **GitHub Actions** for continuous integration and deployment. The pipeline automatically runs on every push and pull request to ensure code quality and prevent bugs from reaching production.

## Pipeline Jobs

### 1. 🧹 Lint & Type Check
- **Purpose**: Catch code quality issues and type errors early
- **Runs**: ESLint and TypeScript compiler
- **Duration**: ~30 seconds

### 2. 🧪 Unit Tests
- **Purpose**: Verify business logic calculations
- **Tests**: 58+ unit tests covering:
  - Price calculations
  - Discount logic
  - Tax calculations
  - FIFO inventory valuation
  - Cash reconciliation
  - Financial metrics
- **Duration**: ~30 seconds
- **Coverage**: Automatically uploaded to Codecov

### 3. 🏗️ Build
- **Purpose**: Ensure the application builds successfully
- **Process**: Next.js production build with Turbopack
- **Duration**: ~2-3 minutes

### 4. 🔒 Security Audit
- **Purpose**: Check for vulnerabilities in dependencies
- **Process**: npm audit
- **Level**: Moderate and above

### 5. 🚀 E2E Tests (Optional - Commented Out)
- **Purpose**: Test complete user workflows
- **Framework**: Playwright
- **Note**: Disabled by default (requires database setup)

### 6. 📦 Deploy (Optional - Commented Out)
- **Purpose**: Automatically deploy to production
- **Platform**: Vercel
- **Trigger**: Push to main branch

## How It Works

### On Every Push
```mermaid
graph LR
    A[Push Code] --> B[Lint & Type Check]
    A --> C[Unit Tests]
    B --> D[Build]
    C --> D
    D --> E[Security Audit]
    E --> F{Main Branch?}
    F -->|Yes| G[Deploy]
    F -->|No| H[Done]
```

### Test Results
- ✅ **Pass**: All tests passed, ready to merge
- ❌ **Fail**: Tests failed, check logs and fix issues
- ⚠️ **Warning**: Some issues found but not blocking

## Setup Instructions

### 1. Enable GitHub Actions

The workflow is already committed in `.github/workflows/ci.yml`. GitHub Actions will automatically detect and run it.

### 2. Configure Secrets (Required for full functionality)

Go to **GitHub Repository Settings → Secrets → Actions** and add:

#### Required Secrets:
- `DATABASE_URL`: PostgreSQL connection string
  ```
  postgresql://user:password@host:5432/database
  ```

- `NEXTAUTH_SECRET`: Random 32+ character string
  ```bash
  # Generate with:
  openssl rand -base64 32
  ```

- `NEXTAUTH_URL`: Application URL
  ```
  https://your-app.vercel.app
  ```

#### Optional Secrets (for AI features):
- `OPENAI_API_KEY`: OpenAI API key for AI Assistant
  ```
  sk-proj-...
  ```

#### Optional Secrets (for deployment):
- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID

### 3. Enable E2E Tests (Optional)

Uncomment the `e2e-tests` job in `.github/workflows/ci.yml` to enable Playwright tests on every push.

**Note**: This will increase pipeline time by ~5-10 minutes.

### 4. Enable Auto-Deployment (Optional)

Uncomment the `deploy` job in `.github/workflows/ci.yml` to enable automatic deployment to Vercel.

## Local Development

### Run Tests Locally

```bash
# Unit tests
npm test

# Unit tests with coverage
npm run test:coverage

# Watch mode (during development)
npm run test:watch

# E2E tests
npm run test:e2e

# E2E tests in UI mode
npm run test:e2e:ui
```

### Build Locally

```bash
# Clean build
npm run build

# Build with memory optimization
npm run build:mem
```

## Viewing Test Results

### On GitHub
1. Go to **Actions** tab in your repository
2. Click on the latest workflow run
3. View job results and logs

### Test Coverage
- Coverage reports are uploaded to **Codecov**
- Badge available: `[![codecov](https://codecov.io/gh/YOUR_USERNAME/YOUR_REPO/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/YOUR_REPO)`

## Troubleshooting

### Build Fails
- **Issue**: Out of memory
- **Solution**: Use `npm run build:mem` or increase Node.js memory in workflow

### Tests Fail Locally but Pass on CI
- **Issue**: Environment differences
- **Solution**: Check Node.js version (should match CI: Node 20)

### Database Connection Fails
- **Issue**: `DATABASE_URL` secret not set
- **Solution**: Add `DATABASE_URL` secret in GitHub repository settings

### Deployment Fails
- **Issue**: Missing Vercel secrets
- **Solution**: Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` secrets

## Performance Benchmarks

| Job | Average Time | Status |
|-----|-------------|--------|
| Lint & Type Check | 30s | ✅ |
| Unit Tests | 30s | ✅ |
| Build | 2-3min | ✅ |
| Security Audit | 20s | ✅ |
| Total Pipeline | ~4min | ✅ |

## Best Practices

### Before Pushing
1. ✅ Run tests locally: `npm test`
2. ✅ Check linting: `npm run lint`
3. ✅ Build locally: `npm run build`
4. ✅ Review changes: `git diff`

### Pull Requests
1. ✅ Wait for CI checks to pass
2. ✅ Review test coverage changes
3. ✅ Address any failing tests
4. ✅ Get code review approval

### Merging
1. ✅ All CI checks must pass
2. ✅ At least one approval required
3. ✅ Squash and merge (recommended)

## Future Enhancements

### Planned Improvements
- [ ] Add code quality checks (SonarQube)
- [ ] Add performance testing (Lighthouse)
- [ ] Add visual regression testing
- [ ] Add automated changelog generation
- [ ] Add Slack/Discord notifications
- [ ] Add deployment previews for PRs

### Performance Optimization
- [ ] Cache Prisma Client generation
- [ ] Cache Next.js build
- [ ] Parallelize test execution
- [ ] Use matrix strategy for multi-version testing

## Support

For issues or questions about the CI/CD pipeline:
1. Check GitHub Actions logs
2. Review this documentation
3. Contact DevOps team

## Related Documentation
- [Testing Workflow](../TESTING-WORKFLOW.md)
- [Production Deployment Guide](./DEPLOYMENT.md)
- [Environment Variables](./ENVIRONMENT-VARIABLES.md)
