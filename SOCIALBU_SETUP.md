# SocialBu Integration Setup Guide

This guide walks you through setting up the SocialBu API integration for multi-account social media scheduling.

## 🎯 What You Get

- **Multi-account posting**: Schedule to Instagram, TikTok, Twitter from one interface
- **Automatic status tracking**: Posts automatically marked as "posted" when published
- **No Meta token refreshing**: SocialBu handles all platform authentication
- **Professional media handling**: Automatic upload and optimization

---

## 📋 Setup Steps

### 1. Create SocialBu Account

1. Go to [SocialBu.com](https://socialbu.com)
2. Sign up for an account (Free plan works for testing)
3. Connect your social media accounts:
   - Instagram Business account
   - TikTok (optional)
   - Twitter/X (optional)
   - Any other platforms you want

### 2. Get Your API Key

1. Log into SocialBu dashboard
2. Navigate to **Settings** → **API Access** (or Developer Settings)
3. Click **Generate API Key**
4. Copy your API key (keep it secret!)

### 3. Get Your Account IDs

After connecting your social accounts, you need their SocialBu account IDs:

**Option A: Use the API route (after setup)**
```bash
# Start your dev server
npm run dev

# Call the accounts endpoint
curl http://localhost:3000/api/socialbu-accounts
```

You'll get a response like:
```json
{
  "success": true,
  "accounts": [
    {
      "id": 101,
      "name": "BlankNightlife",
      "type": "instagram",
      "username": "blanknightlife",
      "is_active": true
    },
    {
      "id": 102,
      "name": "BlankNightlife TikTok",
      "type": "tiktok",
      "username": "blanknightlife",
      "is_active": true
    }
  ]
}
```

**Save these account IDs** - you'll use them when scheduling posts.

### 4. Configure Environment Variables

Add to your `.env` file:

```env
# SocialBu API
SOCIALBU_API_KEY=your_api_key_here

# Base URL for postback webhooks
NEXT_PUBLIC_BASE_URL=http://localhost:3000
# For production: https://your-domain.vercel.app
```

### 5. Deploy Webhook Endpoint (Production Only)

When you deploy to production, make sure your postback webhook is accessible:

**Vercel/Production URL:**
```
https://your-domain.vercel.app/api/socialbu-postback
```

This endpoint receives status updates from SocialBu when posts are published or fail.

---

## 🚀 Usage

### Scheduling a Post via UI

1. Go to **Pending** tab
2. Review/edit the AI-generated caption
3. Select a date/time in the calendar
4. Click **Approve & Schedule**
5. The post will be sent to SocialBu automatically

### Scheduling a Post via API

```typescript
// Example: Schedule a post to multiple accounts
const response = await fetch('/api/socialbu-schedule', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventId: 'your-event-uuid',
    accountIds: [101, 102], // Instagram + TikTok
  }),
});
```

### Checking Connected Accounts

```typescript
// Get all connected SocialBu accounts
const response = await fetch('/api/socialbu-accounts');
const { accounts } = await response.json();

console.log(accounts);
// [
//   { id: 101, name: 'Instagram', type: 'instagram', ... },
//   { id: 102, name: 'TikTok', type: 'tiktok', ... }
// ]
```

---

## 🔄 How It Works

### 1. Media Upload Flow (Automatic)

When you schedule a post:

```
Your App → Downloads media from Supabase Storage
         ↓
SocialBu API → Initiates upload, returns signed URL
         ↓
Your App → Uploads media to signed URL
         ↓
SocialBu API → Processes media, returns upload_token
         ↓
Your App → Creates post with upload_token
```

### 2. Post Status Flow

```
Approved (your DB)
    ↓
Scheduled (sent to SocialBu)
    ↓
Posted (SocialBu postback confirms)
```

### 3. Postback Webhook

SocialBu automatically calls your webhook when:
- Post is created: `status: 'created'`
- Post is published: `status: 'published'` → Updates your DB to "posted"
- Post fails: `status: 'failed'` → Reverts to "approved" for retry

---

## 🎨 Multi-Account Strategy

### Tracking Accounts in Supabase (Optional Enhancement)

You might want to create a `social_accounts` table:

```sql
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socialbu_account_id INTEGER UNIQUE NOT NULL,
  platform TEXT NOT NULL, -- 'instagram', 'tiktok', 'twitter'
  account_name TEXT NOT NULL,
  username TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

This lets you:
- Store account preferences per platform
- Let users select which accounts to post to in the UI
- Track which account each post went to

### Example: Account Selection UI

```tsx
// In your approval modal
const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);

// Fetch accounts on mount
useEffect(() => {
  fetch('/api/socialbu-accounts')
    .then(r => r.json())
    .then(data => setAccounts(data.accounts));
}, []);

// Let user choose
<div>
  {accounts.map(account => (
    <Checkbox
      key={account.id}
      checked={selectedAccounts.includes(account.id)}
      onCheckedChange={() => toggleAccount(account.id)}
    >
      {account.name} ({account.type})
    </Checkbox>
  ))}
</div>
```

---

## 🐛 Troubleshooting

### "Failed to fetch accounts"
- Check your `SOCIALBU_API_KEY` is correct
- Verify you have at least one connected account in SocialBu dashboard

### "Media upload failed"
- Check your media URLs are publicly accessible
- Verify image file size < 10MB (SocialBu limit)
- Check image format (JPG, PNG, GIF supported)

### "Post not scheduling"
- Verify `scheduled_for` is in the future
- Check `final_caption` exists
- Ensure `media_urls` array is not empty

### "Postback not working"
- In production, verify `NEXT_PUBLIC_BASE_URL` points to your deployed domain
- Check Vercel logs for incoming webhook requests
- Test webhook locally with ngrok: `ngrok http 3000`

---

## 📊 Performance Metrics (Future Enhancement)

Pull engagement data after posts are published:

```typescript
import { socialBuClient } from '@/lib/socialbu';

// Cron job: Run weekly
const metrics = await socialBuClient.getPostMetrics(postId);

// Update Supabase with engagement data
await supabase.from('event_discovery').update({
  engagement_likes: metrics.likes,
  engagement_comments: metrics.comments,
  engagement_shares: metrics.shares,
}).eq('meta_post_id', postId);
```

Use this data to:
- Show "Top Posts" in your dashboard
- Train your LLM to write better captions for your audience
- Track which source accounts perform best

---

## 💡 Tips

1. **Test with one account first**: Connect just Instagram to start
2. **Use staging environment**: Test webhook flow before production
3. **Monitor SocialBu dashboard**: Check scheduled posts there too
4. **Set up error alerts**: Use Vercel log drains or Discord webhooks
5. **Rate limits**: SocialBu free tier has limits - upgrade if posting frequently

---

## 🔗 Resources

- [SocialBu API Docs](https://socialbu.com/developers/docs)
- [SocialBu Help Center](https://help.socialbu.com)
- [SocialBu Webhook Guide](https://help.socialbu.com/article/402-how-to-setup-a-webhook-automation)

---

**Next Steps:**
1. Get your SocialBu API key ✓
2. Add to `.env` file ✓
3. Test `/api/socialbu-accounts` endpoint ✓
4. Schedule your first post! 🚀

