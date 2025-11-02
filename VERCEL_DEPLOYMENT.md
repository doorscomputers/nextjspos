# Vercel Deployment Guide

## Prerequisites
- ✓ Database migrated to Supabase (DONE!)
- ✓ 11,592 records in Supabase
- GitHub account
- Vercel account

## Step 1: Push to GitHub

1. **Initialize Git repository (if not already done):**
```powershell
git init
git add .
git commit -m "Prepare for Vercel deployment with Supabase database"
```

2. **Create a new GitHub repository:**
   - Go to https://github.com/new
   - Name: `ultimatepos-modern` (or your preferred name)
   - Make it Private
   - Don't initialize with README
   - Click "Create repository"

3. **Push to GitHub:**
```powershell
git remote add origin https://github.com/YOUR-USERNAME/ultimatepos-modern.git
git branch -M main
git push -u origin main
```

## Step 2: Connect to Vercel

1. **Go to Vercel:**
   - Visit https://vercel.com
   - Click "Sign Up" or "Login"
   - Choose "Continue with GitHub"

2. **Import Project:**
   - Click "Add New..." → "Project"
   - Find your `ultimatepos-modern` repository
   - Click "Import"

## Step 3: Configure Environment Variables

**IMPORTANT:** Add these environment variables in Vercel:

### Database (Supabase)
```
DATABASE_URL=postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true
```
**Note:** Use the session pooler URL (port 5432) with `?pgbouncer=true`

### Next Auth
```
NEXTAUTH_URL=https://your-app-name.vercel.app
NEXTAUTH_SECRET=your-secret-key-min-32-chars-random-string
```
**Generate secret:** Run `openssl rand -base64 32` or use any random 32+ character string

### App Configuration
```
NEXT_PUBLIC_APP_NAME=Igoro Tech(IT) Inventory Management System
NEXT_PUBLIC_APP_URL=https://your-app-name.vercel.app
```

### Optional (if you had these configured)
```
OPENAI_API_KEY=your-openai-key
EMAIL_HOST=your-email-host
EMAIL_PORT=587
EMAIL_USER=your-email
EMAIL_PASSWORD=your-email-password
TELEGRAM_BOT_TOKEN=your-telegram-token
TELEGRAM_CHAT_ID=your-chat-id
```

## Step 4: Build Settings

**Framework Preset:** Next.js
**Build Command:** `npm run build` (default)
**Output Directory:** `.next` (default)
**Install Command:** `npm install` (default)
**Node Version:** 18.x or higher

## Step 5: Deploy

1. Click **"Deploy"**
2. Wait for build to complete (2-5 minutes)
3. Vercel will give you a live URL like: `https://your-app-name.vercel.app`

## Step 6: Test Deployment

1. Visit your Vercel URL
2. Try logging in with your existing users:
   - Usernames and passwords from your local database are now in Supabase
   - Example: `superadmin` / `password` (if you seeded the database)

## Step 7: Post-Deployment

1. **Update NEXTAUTH_URL:**
   - After deployment, update `NEXTAUTH_URL` with your actual Vercel URL
   - Redeploy if needed

2. **Custom Domain (Optional):**
   - In Vercel project settings → Domains
   - Add your custom domain

3. **Test All Features:**
   - Login with different users
   - Create products
   - Test transfers
   - Verify reports work

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all environment variables are set
- Verify DATABASE_URL is correct

### Can't Connect to Database
- Use session pooler (port 5432) not transaction pooler (port 6543)
- Include `?pgbouncer=true` in connection string
- Verify password is URL-encoded (`!` = `%21`)

### Authentication Issues
- Check NEXTAUTH_URL matches your deployment URL
- Verify NEXTAUTH_SECRET is set
- Check users exist in Supabase database

## Database Connection Strings Reference

**For Vercel (use this one):**
```
postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true
```

**Transaction Pooler (DON'T use for Vercel):**
```
postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

## Next Steps After Deployment

1. **Monitor Performance:**
   - Vercel Analytics
   - Error tracking

2. **Set Up Backups:**
   - Supabase has automatic backups
   - Check backup settings in Supabase dashboard

3. **Configure Custom Domain:**
   - Buy domain (Namecheap, GoDaddy, etc.)
   - Add to Vercel project

4. **Update Your Team:**
   - Share the new URL with your users
   - Update any integrations or webhooks

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase database logs
3. Verify all environment variables are correct
4. Ensure your GitHub repository is up to date
