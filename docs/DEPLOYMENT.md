# Deployment Guide

## Vercel Deployment (Recommended)

### Prerequisites

- GitHub account
- Vercel account (free)
- OpenAI API key
- (Optional) Qdrant Cloud account

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/onlyfin.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel auto-detects Next.js
5. Add environment variables (initial deployment):
   - `OPENAI_API_KEY` (required)
   - `OPENAI_MODEL` = `gpt-4.1-mini`
   - `QDRANT_URL` (optional)
   - `QDRANT_API_KEY` (optional)
   - `QDRANT_COLLECTION` = `onlyfinance-kb` (optional)
   - `TAVILY_API_KEY` (optional - for web search)
   - `COHERE_API_KEY` (optional - for faster reranking)
   - `RERANKER_TYPE` = `cohere` (optional - cohere/llm/heuristic)
   - `NEXT_PUBLIC_CORNER_LOTTIE_COUNT` = `2` (optional)
6. Click "Deploy"
7. **After first deployment**: Add `NEXT_PUBLIC_APP_URL` environment variable:
   - Go to Project Settings → Environment Variables
   - Add `NEXT_PUBLIC_APP_URL` = `https://your-actual-app.vercel.app`
   - Redeploy for location API to work

### Step 3: Verify Deployment

- Vercel provides URL: `https://onlyfin-xyz.vercel.app`
- Test chat functionality
- Test document upload (if Qdrant configured)
- Check for console errors

## Manual Build Test

Test production build locally:

```bash
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `OPENAI_MODEL` | No | Model name (default: gpt-4.1-mini) |
| `QDRANT_URL` | No | Qdrant cluster URL |
| `QDRANT_API_KEY` | No | Qdrant API key |
| `QDRANT_COLLECTION` | No | Collection name (default: onlyfinance-kb) |
| `TAVILY_API_KEY` | No | Tavily API key for web search |
| `COHERE_API_KEY` | No | Cohere API key for faster reranking |
| `RERANKER_TYPE` | No | Reranker type: cohere/llm/heuristic (default: cohere if key available) |
| `NEXT_PUBLIC_APP_URL` | Yes* | Your app URL (for location API) - *Add after first deployment |
| `NEXT_PUBLIC_CORNER_LOTTIE_COUNT` | No | Number of corner lotties (default: 2) |

## Post-Deployment Checklist

- [ ] Chat interface loads
- [ ] Can send messages
- [ ] Responses stream correctly
- [ ] Typing animation works (no flash)
- [ ] K-Base sidebar toggles
- [ ] Document upload works (if Qdrant configured)
- [ ] No console errors
- [ ] Mobile responsive

## Troubleshooting

### Build Fails

```bash
# Check TypeScript errors
npm run build

# Check dependencies
npm install
```

### Runtime Errors

- Check Vercel logs in dashboard
- Verify `OPENAI_API_KEY` is set
- Check OpenAI API quota/credits
- Verify Qdrant connection (if using KB)

### Slow Responses

- Normal for first request (cold start)
- Subsequent requests should be fast
- Streaming should show partial responses

### Upload Fails

- Check Qdrant environment variables
- Verify cluster is running
- Check file size (< 10MB)
- View logs for details

## Performance Tips

- Vercel Edge Network provides global CDN
- Streaming reduces perceived latency
- Qdrant co-located in us-east-1 for low latency
- Static assets cached automatically

## Monitoring

- **Vercel Dashboard**: View logs, analytics, performance
- **OpenAI Dashboard**: Monitor token usage, costs
- **Qdrant Dashboard**: Check storage, queries

## Custom Domain

1. Go to Vercel project settings
2. Click "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. SSL certificate auto-provisioned

## Scaling

Vercel free tier includes:
- Unlimited requests
- 100GB bandwidth/month
- Automatic scaling
- Global CDN

For higher traffic:
- Upgrade to Vercel Pro ($20/month)
- Increase OpenAI rate limits
- Upgrade Qdrant plan if needed
