# Migration Scripts

Comprehensive migration tools for moving your UltimatePOS database from local to Supabase.

## 📁 Files

### Core Migration Scripts

1. **`migrate-to-supabase.ts`** - Main migration script
2. **`validate-migration.ts`** - Validation and integrity checks
3. **`setup-migration.sh`** / **`setup-migration.ps1`** - Interactive setup wizards

## 🚀 Quick Start

```bash
# 1. Run setup (creates .env.migration and backups)
npm run migrate:setup

# 2. Migrate to Supabase
npm run migrate:supabase

# 3. Validate migration
npm run migrate:validate
```

## 📋 NPM Scripts Available

- `npm run migrate:setup` - Interactive setup wizard
- `npm run migrate:supabase` - Run migration
- `npm run migrate:validate` - Validate migration
- `npm run migrate:full` - Migrate + Validate

## 📖 Full Documentation

See **MIGRATION_GUIDE.md** in the project root for complete instructions.

## ⚡ Quick Commands

### Windows
```powershell
.\scripts\setup-migration.ps1
npx tsx scripts/migrate-to-supabase.ts
npx tsx scripts/validate-migration.ts
```

### Linux/Mac
```bash
chmod +x scripts/setup-migration.sh
./scripts/setup-migration.sh
npx tsx scripts/migrate-to-supabase.ts
npx tsx scripts/validate-migration.ts
```
