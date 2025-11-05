# 🤖 AI Assistant Setup Guide

## ✅ AI Assistant Now Supports Multiple Providers!

Your AI Assistant can now use:
- **xAI (x.ai)** - Grok models by Elon Musk (RECOMMENDED)
- **OpenAI** - GPT models (alternative)

---

## 🚀 Quick Setup (Choose One)

### Option 1: Use xAI (x.ai) API - RECOMMENDED

xAI offers **Grok** models which are very capable and cost-effective!

#### Step 1: Get xAI API Key

1. Go to: https://x.ai/api
2. Sign up / Log in
3. Create an API key
4. Copy the key (starts with `xai-...`)

#### Step 2: Add to Vercel Environment Variables

1. Go to your Vercel project: https://vercel.com/doorscomputers/nextjspos
2. Click **Settings** → **Environment Variables**
3. Add new variable:
   ```
   Key:   XAI_API_KEY
   Value: xai-YOUR-ACTUAL-KEY-HERE
   ```
4. Click **Save**
5. Click **Redeploy** (Vercel will automatically redeploy with the new key)

#### Step 3: Test

1. Go to your site: https://pcinet.shop/dashboard/ai-assistant
2. Type a question: "How can I check my sales today?"
3. It should work! 🎉

---

### Option 2: Use OpenAI API

If you prefer OpenAI's GPT models:

#### Step 1: Get OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the key (starts with `sk-...`)

#### Step 2: Add to Vercel Environment Variables

1. Go to: https://vercel.com/doorscomputers/nextjspos/settings/environment-variables
2. Find `OPENAI_API_KEY` (currently set to placeholder)
3. Edit it and paste your real API key
4. Click **Save**
5. Redeploy

---

## 🔧 Local Development Setup

### For xAI:

Add to your `.env` file:
```env
XAI_API_KEY=xai-your-actual-key-here
```

### For OpenAI:

Add to your `.env` file:
```env
OPENAI_API_KEY=sk-your-actual-key-here
```

---

## 💡 How It Works

The AI Assistant automatically detects which API key you've configured:

**Priority:**
1. If `XAI_API_KEY` is set → Uses xAI (Grok)
2. Else if `OPENAI_API_KEY` is set → Uses OpenAI (GPT-4o-mini)
3. Else → Shows error message

**You only need ONE API key**, not both!

---

## 💰 Cost Comparison

### xAI (Grok)
- **Model:** grok-beta
- **Cost:** ~$5 per 1M tokens (cheaper than OpenAI)
- **Quality:** Excellent, comparable to GPT-4
- **Speed:** Fast

### OpenAI (GPT-4o-mini)
- **Model:** gpt-4o-mini
- **Cost:** ~$0.60 per 1M tokens
- **Quality:** Very good
- **Speed:** Very fast

**Both are excellent choices!** xAI is newer and often more cost-effective.

---

## 🧪 Testing Your AI Assistant

After adding the API key to Vercel:

1. **Wait 2-3 minutes** for Vercel to redeploy
2. **Go to**: https://pcinet.shop/dashboard/ai-assistant
3. **Try these questions:**
   - "What are my sales today?"
   - "How can I add a new product?"
   - "Show me top selling items"
   - "How do I create a purchase order?"

---

## 🔍 Troubleshooting

### Error: "AI Assistant is not configured"

**Cause:** No valid API key found

**Solution:**
1. Check Vercel environment variables
2. Make sure key doesn't say `your-xai-api-key-here`
3. Redeploy after adding the key

### Error: "Invalid AI API key"

**Cause:** API key is wrong or expired

**Solution:**
1. Go to xAI or OpenAI dashboard
2. Generate a new API key
3. Update Vercel environment variable
4. Redeploy

### Error: "AI API quota exceeded"

**Cause:** You've used up your API credits

**Solution:**
1. Add billing to your xAI or OpenAI account
2. Check your usage dashboard
3. Add more credits

### Error: "Rate limit exceeded"

**Cause:** Too many requests in short time

**Solution:**
1. Wait a few seconds
2. Try again
3. This is normal and temporary

---

## 📊 Vercel Environment Variables Setup

### Current .env on Vercel:

```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=your-openai-api-key-here  ← REPLACE THIS
NEXTAUTH_URL=https://pcinet.shop
NEXTAUTH_SECRET=...
```

### Recommended .env on Vercel:

**Option A: Using xAI (add new variable)**
```
DATABASE_URL=postgresql://...
XAI_API_KEY=xai-YOUR-ACTUAL-KEY-HERE  ← ADD THIS (NEW!)
NEXTAUTH_URL=https://pcinet.shop
NEXTAUTH_SECRET=...
```

**Option B: Using OpenAI (update existing)**
```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-YOUR-ACTUAL-KEY-HERE  ← UPDATE THIS
NEXTAUTH_URL=https://pcinet.shop
NEXTAUTH_SECRET=...
```

---

## 🎯 Quick Setup Summary

1. ✅ **Get API Key** (xAI or OpenAI)
2. ✅ **Add to Vercel** (Environment Variables)
3. ✅ **Redeploy** (Automatic after saving)
4. ✅ **Test** (Visit /dashboard/ai-assistant)

**That's it!** Your AI Assistant will be working in 2-3 minutes! 🚀

---

## 🤖 AI Models Available

### xAI Models:
- `grok-beta` - Latest Grok model (default)
- `grok-2-latest` - Grok 2 (alternative)

### OpenAI Models:
- `gpt-4o-mini` - Fast and affordable (default)
- `gpt-4o` - Most capable (can change in code)

---

## 📝 Code Changes Made

The AI Assistant code has been updated to:
- ✅ Support both xAI and OpenAI
- ✅ Automatically detect which key is configured
- ✅ Provide helpful error messages
- ✅ Log which provider is being used
- ✅ Handle API errors gracefully

**File:** `src/app/api/chat/route.ts`

---

## 🚀 Next Steps

1. **Choose your AI provider** (xAI or OpenAI)
2. **Get your API key**
3. **Add to Vercel environment variables**
4. **Commit and push** the updated chat route
5. **Test** after deployment

Enjoy your AI-powered POS system! 🎉
