# Documentation Index
# Igoro Tech(IT) Inventory Management System

> **Master index of all documentation - Your starting point for understanding the codebase**

---

## 📚 Complete Documentation Library

Welcome to the comprehensive documentation for the Igoro Tech(IT) Inventory Management System. This guide will help you navigate all available documentation and understand the codebase thoroughly.

---

## 🚀 Start Here

### For Absolute Beginners

If you're new to the project, start with these files in order:

1. **[GETTING_STARTED.md](./GETTING_STARTED.md)** ⭐ START HERE
   - Installation guide
   - Setup instructions
   - First code change tutorial
   - Common tasks
   - Troubleshooting

   **Read this first** to get the application running on your machine.

2. **[APPLICATION_FLOW.md](./APPLICATION_FLOW.md)**
   - Login to dashboard flow
   - Authentication system explained
   - RBAC (permissions) system
   - Sidebar navigation structure
   - Multi-tenant architecture

   **Read this second** to understand how the application works.

3. **[CODE_STRUCTURE.md](./CODE_STRUCTURE.md)**
   - Complete directory structure
   - File naming conventions
   - Where to find everything
   - Import aliases
   - Development workflow

   **Read this third** to navigate the codebase confidently.

---

## 📖 Reference Documentation

### Technical References

These are comprehensive reference guides for looking up specific information:

#### [API_ENDPOINTS.md](./API_ENDPOINTS.md)
**When to use**: When you need to know what API endpoints exist or how to use them.

**Contents**:
- All API routes (GET, POST, PUT, DELETE)
- Request/response formats
- Authentication requirements
- Permission requirements
- Example requests
- Error handling

**Use cases**:
- Building a new feature that needs API calls
- Testing API endpoints
- Understanding data flow
- Debugging API issues

---

#### [CLAUDE.md](./CLAUDE.md)
**When to use**: Project-specific instructions and standards.

**Contents**:
- UI/UX design standards
- Button styling guidelines
- DevExtreme component usage
- Multi-tenant rules
- User restrictions
- Report creation patterns

**Use cases**:
- Following project conventions
- Creating new UI components
- Implementing reports
- Understanding business rules

---

## 🔍 Code Documentation

### Heavily Commented Files

The following files have detailed inline comments explaining every section:

#### Authentication System

1. **`src/lib/auth.ts`**
   - **Purpose**: NextAuth configuration and authentication logic
   - **Comments**: Line-by-line explanation of:
     - Login validation process
     - Password verification
     - RFID location scanning
     - Shift conflict detection
     - Schedule-based login restrictions
     - Permission loading
     - Session creation
   - **When to read**: Understanding authentication, adding login features

2. **`middleware.ts`** (root directory)
   - **Purpose**: Route protection and performance monitoring
   - **Comments**: Detailed explanation of:
     - How middleware intercepts requests
     - Authentication checks
     - Redirect logic
     - Performance logging
   - **When to read**: Understanding route protection, debugging auth issues

---

## 🎯 Quick Navigation

### By Topic

#### Authentication & Authorization
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Section: "Understanding Key Concepts"
- [APPLICATION_FLOW.md](./APPLICATION_FLOW.md) - Section: "Authentication Flow"
- `src/lib/auth.ts` - Full source with comments
- `middleware.ts` - Route protection
- `src/lib/rbac.ts` - Permissions and roles

#### Database & Data Models
- [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) - Section: "Database (prisma/)"
- `prisma/schema.prisma` - All database models
- `prisma/seed.ts` - Demo data creation
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Section: "Task 4: Add a Database Model"

#### API Development
- [API_ENDPOINTS.md](./API_ENDPOINTS.md) - Complete API reference
- [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) - Section: "API Routes"
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Section: "Task 1: Create a New API Endpoint"
- `src/app/api/products/route.ts` - Example API route

#### UI Development
- [CLAUDE.md](./CLAUDE.md) - UI standards and button styling
- [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) - Section: "Components"
- `src/components/Sidebar.tsx` - Navigation component
- `src/components/ui/*` - ShadCN UI components
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Section: "Your First Code Change"

#### Permissions & Roles
- [APPLICATION_FLOW.md](./APPLICATION_FLOW.md) - Section: "Authorization & RBAC System"
- `src/lib/rbac.ts` - Permission definitions and functions
- `src/hooks/usePermissions.ts` - React hook for permissions
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Section: "Task 2: Add a New Permission"

#### Multi-Tenancy
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Section: "Multi-Tenant Architecture"
- [APPLICATION_FLOW.md](./APPLICATION_FLOW.md) - Section: "Multi-Tenant Architecture"
- [CLAUDE.md](./CLAUDE.md) - Multi-tenant rules

---

## 📂 File Location Quick Reference

### Core Configuration Files

| File | Location | Purpose | Documentation |
|------|----------|---------|---------------|
| NextAuth Config | `src/lib/auth.ts` | Authentication setup | Fully commented |
| Middleware | `middleware.ts` | Route protection | Fully commented |
| RBAC | `src/lib/rbac.ts` | Permissions system | [APPLICATION_FLOW.md](./APPLICATION_FLOW.md) |
| Database Schema | `prisma/schema.prisma` | All models | [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) |
| Environment | `.env` | Configuration | [GETTING_STARTED.md](./GETTING_STARTED.md) |

### Key Application Files

| Component | Location | Purpose | Documentation |
|-----------|----------|---------|---------------|
| Login Page | `src/app/login/page.tsx` | User login UI | [APPLICATION_FLOW.md](./APPLICATION_FLOW.md) |
| Dashboard Home | `src/app/dashboard/page.tsx` | Main dashboard | [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) |
| Sidebar | `src/components/Sidebar.tsx` | Navigation menu | [APPLICATION_FLOW.md](./APPLICATION_FLOW.md) |
| POS | `src/app/dashboard/pos/page.tsx` | Point of Sale | [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) |

---

## 🛠️ Development Workflow

### Common Development Scenarios

#### Scenario 1: "I need to add a new feature"

1. Read: [GETTING_STARTED.md](./GETTING_STARTED.md) - "Common Tasks"
2. Check: [API_ENDPOINTS.md](./API_ENDPOINTS.md) - See if API exists
3. Review: [CLAUDE.md](./CLAUDE.md) - Follow project standards
4. Refer: [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) - Find where to add files

#### Scenario 2: "I need to understand how authentication works"

1. Read: [APPLICATION_FLOW.md](./APPLICATION_FLOW.md) - "Authentication Flow" section
2. Study: `src/lib/auth.ts` - Fully commented source code
3. Review: `middleware.ts` - Route protection logic
4. Check: [GETTING_STARTED.md](./GETTING_STARTED.md) - "Authentication Flow" concept

#### Scenario 3: "I need to add a new API endpoint"

1. Read: [GETTING_STARTED.md](./GETTING_STARTED.md) - "Task 1: Create a New API Endpoint"
2. Reference: [API_ENDPOINTS.md](./API_ENDPOINTS.md) - See patterns and conventions
3. Example: `src/app/api/products/route.ts` - Study existing endpoint
4. Check: [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) - Understand API structure

#### Scenario 4: "I need to add a new permission"

1. Read: [GETTING_STARTED.md](./GETTING_STARTED.md) - "Task 2: Add a New Permission"
2. Study: `src/lib/rbac.ts` - Permission definitions
3. Review: [APPLICATION_FLOW.md](./APPLICATION_FLOW.md) - "RBAC System" section
4. Example: `src/hooks/usePermissions.ts` - How to use permissions

#### Scenario 5: "I need to create a new page"

1. Read: [GETTING_STARTED.md](./GETTING_STARTED.md) - "Task 3: Create a New Dashboard Page"
2. Review: [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) - Dashboard pages structure
3. Reference: [CLAUDE.md](./CLAUDE.md) - UI standards and button styling
4. Example: `src/app/dashboard/products/page.tsx` - Study existing page

---

## 🔧 Troubleshooting Guide

### Documentation for Common Issues

| Issue | Documentation | Section |
|-------|--------------|---------|
| Installation problems | [GETTING_STARTED.md](./GETTING_STARTED.md) | "Installation" |
| Database connection errors | [GETTING_STARTED.md](./GETTING_STARTED.md) | "Troubleshooting" |
| Authentication not working | `src/lib/auth.ts` | Read comments |
| Permission denied errors | [APPLICATION_FLOW.md](./APPLICATION_FLOW.md) | "RBAC System" |
| API endpoint not found | [API_ENDPOINTS.md](./API_ENDPOINTS.md) | Search endpoint |
| Can't find a file | [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) | Directory structure |

---

## 📚 Learning Path

### Recommended Reading Order for Different Goals

#### Goal: Get Started Quickly (2-3 hours)

1. [GETTING_STARTED.md](./GETTING_STARTED.md) - Complete read (1 hour)
2. [APPLICATION_FLOW.md](./APPLICATION_FLOW.md) - Sections 1-5 (1 hour)
3. [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) - Skim structure (30 min)
4. Make your first code change (30 min)

#### Goal: Understand Architecture (4-6 hours)

1. [GETTING_STARTED.md](./GETTING_STARTED.md) - Complete read
2. [APPLICATION_FLOW.md](./APPLICATION_FLOW.md) - Complete read
3. [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) - Complete read
4. `src/lib/auth.ts` - Read all comments
5. `middleware.ts` - Read all comments
6. `src/lib/rbac.ts` - Study permission system
7. `prisma/schema.prisma` - Review database models

#### Goal: Start Building Features (6-8 hours)

1. Complete "Understand Architecture" path above
2. [API_ENDPOINTS.md](./API_ENDPOINTS.md) - Complete read
3. [CLAUDE.md](./CLAUDE.md) - Study UI standards
4. Practice all tasks in [GETTING_STARTED.md](./GETTING_STARTED.md)
5. Build a simple feature (e.g., notes system)

#### Goal: Become Expert (2-3 weeks)

1. Read all documentation thoroughly
2. Study all commented source files
3. Explore entire `src/app/api/` directory
4. Review multiple dashboard pages
5. Practice building complex features
6. Understand DevExtreme components
7. Master the permission system
8. Learn multi-tenant best practices

---

## 🎓 Additional Resources

### External Documentation

1. **Next.js**: https://nextjs.org/docs
   - App Router guide
   - API routes
   - Server Components

2. **Prisma**: https://www.prisma.io/docs
   - Schema definition
   - Queries and relations
   - Migrations

3. **NextAuth.js**: https://next-auth.js.org
   - Configuration
   - Providers
   - Callbacks

4. **Tailwind CSS**: https://tailwindcss.com/docs
   - Utility classes
   - Customization
   - Dark mode

5. **DevExtreme React**: https://js.devexpress.com/React/
   - DataGrid
   - PivotGrid
   - Components

6. **ShadCN UI**: https://ui.shadcn.com/
   - Component library
   - Installation
   - Customization

---

## 📝 Documentation Maintenance

### How to Keep Documentation Updated

When making significant code changes, update:

1. **Comments in source files** - Add/update inline comments
2. **CLAUDE.md** - Update project standards if changed
3. **API_ENDPOINTS.md** - Add new endpoints
4. **APPLICATION_FLOW.md** - Update flows if routing changes

---

## 🤝 Contributing

### Documentation Improvements

Found something unclear? Want to add examples?

**What to do**:
1. Update the relevant documentation file
2. Add code examples where helpful
3. Improve explanations
4. Add troubleshooting tips

---

## 📊 Documentation Summary

### Complete File List

| File | Size | Purpose | Priority |
|------|------|---------|----------|
| **GETTING_STARTED.md** | ~300 lines | Beginner's guide | ⭐⭐⭐⭐⭐ |
| **APPLICATION_FLOW.md** | ~800 lines | Complete architecture guide | ⭐⭐⭐⭐⭐ |
| **CODE_STRUCTURE.md** | ~600 lines | File organization reference | ⭐⭐⭐⭐ |
| **API_ENDPOINTS.md** | ~700 lines | API reference guide | ⭐⭐⭐⭐ |
| **CLAUDE.md** | ~200 lines | Project standards | ⭐⭐⭐ |
| **DOCUMENTATION_INDEX.md** | This file | Master index | ⭐⭐⭐⭐⭐ |

### Source Code with Comments

| File | Lines | Comments | Priority |
|------|-------|----------|----------|
| **src/lib/auth.ts** | ~510 | Extensive | ⭐⭐⭐⭐⭐ |
| **middleware.ts** | ~184 | Extensive | ⭐⭐⭐⭐ |
| **src/lib/rbac.ts** | ~400 | Moderate | ⭐⭐⭐ |

---

## ✅ Quick Checklist for New Developers

### Day 1: Setup
- [ ] Read [GETTING_STARTED.md](./GETTING_STARTED.md)
- [ ] Install dependencies
- [ ] Set up database
- [ ] Run `npm run dev`
- [ ] Login with demo account
- [ ] Make first code change

### Week 1: Understanding
- [ ] Read [APPLICATION_FLOW.md](./APPLICATION_FLOW.md)
- [ ] Read [CODE_STRUCTURE.md](./CODE_STRUCTURE.md)
- [ ] Study `src/lib/auth.ts`
- [ ] Study `middleware.ts`
- [ ] Explore dashboard pages
- [ ] Test API endpoints

### Week 2: Building
- [ ] Read [API_ENDPOINTS.md](./API_ENDPOINTS.md)
- [ ] Read [CLAUDE.md](./CLAUDE.md)
- [ ] Complete all tasks in GETTING_STARTED
- [ ] Build a simple feature
- [ ] Add a new API endpoint
- [ ] Create a new dashboard page

### Month 1: Mastery
- [ ] Understand multi-tenancy thoroughly
- [ ] Master RBAC system
- [ ] Comfortable with Prisma queries
- [ ] Can create complex features
- [ ] Understand DevExtreme components
- [ ] Follow all project standards

---

## 🎯 Final Tips

### Best Practices

1. **Always start with documentation** - Don't guess, read first
2. **Study commented source code** - Learn from existing patterns
3. **Follow project standards** - Check CLAUDE.md for guidelines
4. **Ask questions** - Document unclear areas
5. **Practice regularly** - Build features to learn

### Getting Help

1. **Search documentation first** - Use Ctrl+F in .md files
2. **Check source comments** - Many answers in code comments
3. **Study similar code** - Find existing examples
4. **Review error messages** - Read carefully and search
5. **Use debugging tools** - Browser DevTools, Prisma Studio

---

## 📞 Support

### Resources

- **Documentation**: This file and linked .md files
- **Source Comments**: `src/lib/auth.ts`, `middleware.ts`
- **Project Instructions**: `CLAUDE.md`
- **Online Docs**: Links in [GETTING_STARTED.md](./GETTING_STARTED.md)

---

## 🎉 You're Ready!

You now have access to comprehensive documentation covering:
- ✅ Installation and setup
- ✅ Complete architecture explanation
- ✅ All API endpoints
- ✅ File structure and organization
- ✅ Commented source code
- ✅ Practical tutorials and examples
- ✅ Troubleshooting guides

**Next Step**: Open [GETTING_STARTED.md](./GETTING_STARTED.md) and begin your journey!

---

**Generated**: 2025-11-12
**Version**: 1.0
**Project**: Igoro Tech(IT) Inventory Management System
**Documentation Coverage**: ~3,500 lines across 6 files
**Fully Commented Files**: 2 core files (auth.ts, middleware.ts)
