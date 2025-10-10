# 🤖 AI Assistant Setup Guide

Your UltimatePOS-Modern now has **GPT-4 powered AI Assistant** integrated! Here's how to set it up:

## ✅ What's Been Added

1. **AI Chat Interface** - Beautiful conversational UI at `/dashboard/ai-assistant`
2. **Smart Context** - AI knows your user info, role, and business
3. **POS-Specific** - Trained to help with sales, inventory, and analytics
4. **Real-time Streaming** - Instant responses as AI types
5. **Accessible to All** - Every user role can access AI assistance

## 🚀 Quick Setup

### Step 1: Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create account
3. Click "Create new secret key"
4. Name it "UltimatePOS-Modern"
5. **Copy the key** (starts with `sk-proj-...`)

### Step 2: Configure .env

Edit `.env` file and replace:

```env
# Replace YOUR_PASSWORD_HERE with your PostgreSQL password
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/ultimatepos_modern"

# Replace with your actual OpenAI API key
OPENAI_API_KEY="sk-proj-your-actual-key-here"
```

### Step 3: Setup PostgreSQL Database

**After PostgreSQL installation completes:**

```bash
# Open Command Prompt (Run as Administrator)
psql -U postgres

# Enter your PostgreSQL password when prompted
# Then create the database:
CREATE DATABASE ultimatepos_modern;

# Exit psql
\q
```

### Step 4: Run Setup Commands

```bash
cd C:\xampp\htdocs\ultimatepos-modern

# Generate Prisma client
npx prisma generate

# Push database schema
npm run db:push

# Seed with demo data
npm run db:seed

# Start development server
npm run dev
```

## 🎯 How to Use AI Assistant

1. **Login** with any demo account:
   - `cashier` / `password`
   - `manager` / `password`
   - `admin` / `password`

2. **Click "AI Assistant"** in the sidebar (✨ sparkle icon)

3. **Try these prompts:**
   - "Show me today's sales summary"
   - "What are my top selling products?"
   - "Help me understand inventory management"
   - "Give me business insights"
   - "How do I create a new product?"
   - "Explain the difference between roles"

## 💡 AI Features

### Context-Aware
The AI knows:
- Your name and role
- Your business name
- Your permissions
- POS system features

### Smart Suggestions
Pre-built prompts for:
- 📊 Sales summaries
- 🏆 Top products analysis
- 📦 Inventory help
- 💡 Business insights

### Streaming Responses
Real-time typing effect as AI responds

### Mobile Responsive
Works perfectly on phone, tablet, desktop

## 🔧 Customization

### Change AI Model

Edit `src/app/api/chat/route.ts`:

```typescript
// Current: gpt-4o-mini (fast, cheap)
model: openai('gpt-4o-mini')

// Options:
model: openai('gpt-4o')        // More capable, slower
model: openai('gpt-4-turbo')   // Balanced
```

### Adjust AI Personality

Edit the system message in `src/app/api/chat/route.ts`:

```typescript
content: `You are [YOUR CUSTOM PERSONALITY HERE]`
```

### Add Database Context

When ready to connect to real data, modify the API to:
1. Fetch actual sales data from database
2. Include in system context
3. AI can analyze real numbers!

## 💰 Cost Estimate

**GPT-4o-mini pricing:**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens

**Typical usage:**
- 100 messages/day ≈ **$0.50/month**
- 1000 messages/day ≈ **$5/month**

Very affordable! 🎉

## 🔒 Security

- ✅ Authentication required
- ✅ API key server-side only
- ✅ User context included
- ✅ No data stored by OpenAI (with API)
- ✅ Rate limiting available

## 🐛 Troubleshooting

**"Unauthorized" error:**
- Make sure you're logged in
- Check session is active

**"Invalid API key":**
- Verify OPENAI_API_KEY in .env
- Restart dev server after changes

**"API key not found":**
```bash
# Restart the server
npm run dev
```

**Slow responses:**
- Normal! GPT-4 takes 5-10 seconds
- Streaming shows progress
- Use gpt-4o-mini for faster responses

## 📈 Next Steps

**Connect Real Data:**
Add database queries to provide real analytics:
```typescript
// Get actual sales data
const sales = await prisma.transaction.findMany({
  where: { businessId: user.businessId },
  orderBy: { createdAt: 'desc' },
  take: 10
})

// Include in AI context
systemMessage.content += `\nRecent sales: ${JSON.stringify(sales)}`
```

**Add Voice Input:**
Install speech recognition for voice queries

**Create AI Reports:**
Generate PDF reports from AI analysis

**Multi-language:**
AI supports 50+ languages automatically!

---

## 🎉 You're All Set!

Once PostgreSQL is installed and .env is configured:

```bash
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:3000 and click **AI Assistant**! ✨

Enjoy your AI-powered POS system! 🚀
