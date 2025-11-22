This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Production Deployment

### Complete Production Deployment Package Available

This project includes comprehensive documentation for deploying to production with database migration.

#### 📚 Start Here

**New to deployment?**
→ [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) - Complete step-by-step guide

**Need quick reference?**
→ [DEPLOYMENT_QUICK_REFERENCE.md](DEPLOYMENT_QUICK_REFERENCE.md) - One-page command reference

**Want overview first?**
→ [DEPLOYMENT_INDEX.md](DEPLOYMENT_INDEX.md) - Navigate all deployment docs

#### 🎯 What's Included

- ✅ Complete deployment guides for beginners and experts
- ✅ Database migration scripts (export/import with real data)
- ✅ Support for multiple database providers (Supabase, Vercel, Railway, Neon)
- ✅ Security best practices
- ✅ Troubleshooting guides
- ✅ Verification scripts

#### ⚡ Quick Start (Experienced Users)

```bash
# 1. Export local data
node scripts/export-data.mjs

# 2. Set up production database (choose provider)
# Get connection strings

# 3. Push schema & import data
$env:DATABASE_URL="YOUR_PROD_DB_URL"
npx prisma db push
node scripts/import-data.mjs backup/export-*.json

# 4. Create admin user
node scripts/create-production-admin.mjs

# 5. Verify
node scripts/verify-production-data.mjs

# 6. Deploy on Vercel
# Import GitHub repo, set env vars, deploy
```

#### 📖 All Documentation

| Document | Purpose |
|----------|---------|
| [DEPLOYMENT_INDEX.md](DEPLOYMENT_INDEX.md) | Navigate all docs |
| [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) | Complete guide |
| [DEPLOYMENT_QUICK_REFERENCE.md](DEPLOYMENT_QUICK_REFERENCE.md) | Quick commands |
| [PRODUCTION_MIGRATION_CHECKLIST.md](PRODUCTION_MIGRATION_CHECKLIST.md) | Detailed checklist |
| [DATABASE_PROVIDER_COMPARISON.md](DATABASE_PROVIDER_COMPARISON.md) | Choose database |
| [DEPLOYMENT_WORKFLOW_DIAGRAM.md](DEPLOYMENT_WORKFLOW_DIAGRAM.md) | Visual diagrams |
| [scripts/README.md](scripts/README.md) | Script documentation |

#### 🔗 Additional Resources

- [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying)
- [Vercel Platform](https://vercel.com)
- [Supabase Documentation](https://supabase.com/docs)
# Updated Nov 22, 2025  1:50:50 PM
