# Deployment Guide

## Option 1: Vercel (Recommended - 5 minutes)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: AskRivo Anti-Calculator"
git branch -M main
git remote add origin https://github.com/yourusername/anti-calculator.git
git push -u origin main
```

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js
5. Add Environment Variable:
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key
6. Click "Deploy"

### Step 3: Get Your Live URL
- Vercel will provide a URL like: `https://anti-calculator-xyz.vercel.app`
- Share this URL in your submission

## Option 2: Manual Build Test

Test the production build locally:

```bash
npm run build
npm run start
```

Then open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Make sure these are set in Vercel:

| Variable | Value | Required |
|----------|-------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |

## Post-Deployment Checklist

- [ ] Chat interface loads
- [ ] Can send messages
- [ ] Responses stream in real-time
- [ ] Tool calls work (check for "Calculated using verified tools" badge)
- [ ] No console errors
- [ ] Mobile responsive

## Troubleshooting

### Build Fails
- Check TypeScript errors: `npm run build`
- Verify all dependencies installed: `npm install`

### Runtime Errors
- Check Vercel logs in dashboard
- Verify `OPENAI_API_KEY` is set correctly
- Check OpenAI API quota/credits

### Slow Responses
- Normal for first request (cold start)
- Subsequent requests should be fast
- Streaming should show partial responses

## Performance Tips

- Edge runtime is enabled for fast responses
- Streaming reduces perceived latency
- Function calls are deterministic (no LLM delay for math)
