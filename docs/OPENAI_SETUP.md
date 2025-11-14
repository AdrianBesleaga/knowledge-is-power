# OpenAI API Setup Guide

## The "Insufficient Quota" Error

If you're seeing this error:
```
insufficient_quota: You exceeded your current quota, please check your plan and billing details.
```

**This means:** Even though you created an API key, OpenAI requires you to add a payment method before you can use the API, even if you have free credits.

## How to Fix It

### Step 1: Add Payment Method

1. Go to [OpenAI Platform Billing](https://platform.openai.com/account/billing)
2. Sign in with your OpenAI account
3. Click **"Add payment method"** or **"Set up paid account"**
4. Add a credit card or other payment method
5. You may need to add a minimum amount (usually $5) as a one-time credit

### Step 2: Verify Your Account

- After adding payment, your account should be active
- You'll typically get some free credits to start with
- Check your usage at [OpenAI Usage Dashboard](https://platform.openai.com/usage)

### Step 3: Test Your API Key

Once billing is set up, your API key should work immediately. Try generating a graph again!

## Cost Information

**Good news:** The app is designed to be cost-effective:
- Each graph generation costs approximately **$0.01 - $0.05** (1-5 cents)
- Uses GPT-4 Turbo which is more efficient than GPT-4
- You can generate 20-100 graphs for just $1

**Free Credits:**
- New OpenAI accounts often get $5-10 in free credits
- That's enough for 100-500 graph generations!

## Alternative: Use GPT-3.5 Turbo (Cheaper)

If you want to reduce costs, you can modify the model in `backend/src/services/aiService.ts`:

Change:
```typescript
model: "gpt-4-turbo-preview",
```

To:
```typescript
model: "gpt-3.5-turbo",
```

**Cost difference:**
- GPT-4 Turbo: ~$0.01-0.05 per graph
- GPT-3.5 Turbo: ~$0.001-0.005 per graph (10x cheaper!)

**Trade-off:** GPT-3.5 is slightly less sophisticated but still works well for knowledge graphs.

## Monitoring Usage

1. Go to [OpenAI Usage Dashboard](https://platform.openai.com/usage)
2. Set up usage limits to prevent unexpected charges
3. Monitor your spending regularly

## Setting Usage Limits

To prevent unexpected charges:

1. Go to [OpenAI Billing Limits](https://platform.openai.com/account/billing/limits)
2. Set a **hard limit** (e.g., $10/month)
3. Set **soft limits** for alerts (e.g., $5/month)

## Troubleshooting

### "Still getting quota error after adding payment"
- Wait 5-10 minutes for the account to activate
- Verify payment method is confirmed
- Check that you're using the correct API key

### "Don't want to add a payment method"
Unfortunately, OpenAI requires billing setup even for free credits. This is their policy to prevent abuse.

### "Want to test without costs"
- Use GPT-3.5 Turbo (much cheaper)
- Set usage limits
- Monitor your dashboard closely

## Need Help?

- [OpenAI Documentation](https://platform.openai.com/docs)
- [OpenAI Support](https://help.openai.com/)
- [OpenAI Community](https://community.openai.com/)

---

**Once billing is set up, restart your backend server and try generating a graph again!** 🚀
