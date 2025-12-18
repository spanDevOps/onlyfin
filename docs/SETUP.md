# Setup Guide

## Prerequisites

- Node.js 18+ installed
- OpenAI API key
- (Optional) Qdrant Cloud account for document upload

## Installation

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd onlyfin
npm install
```

### 2. Configure Environment

Create `.env.local` in project root:

```env
# Required: OpenAI API
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4.1-nano

# Optional: Qdrant for document upload
QDRANT_URL=https://your-cluster.us-east-1-1.aws.cloud.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key
QDRANT_COLLECTION=onlyfinance-kb
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Qdrant Setup (Optional)

If you want document upload functionality:

### Option 1: Qdrant Cloud (Free Tier)

1. Go to https://cloud.qdrant.io/
2. Sign up (GitHub/Google/Email)
3. Create cluster:
   - Name: `onlyfinance-kb`
   - Region: **N. Virginia (us-east-1)**
   - Plan: Free (1GB)
4. Copy cluster URL and API key
5. Add to `.env.local`

### Option 2: Self-Hosted Qdrant

```bash
docker run -p 6333:6333 qdrant/qdrant
```

Then use:
```env
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=  # Leave empty for local
```

## Verification

### Test Chat (No KB)

1. Open http://localhost:3000
2. Type: "What is compound interest?"
3. Should get response from GPT-4.1-nano

### Test Document Upload (With KB)

1. Click K-Base sidebar toggle
2. Upload a finance document (TXT/MD/PDF/DOCX)
3. Wait for validation
4. Ask question about the document
5. Response should include citation

## Troubleshooting

### "OpenAI API key not found"
- Check `.env.local` exists in project root
- Verify key starts with `sk-`
- Restart dev server after adding key

### "Cannot connect to Qdrant"
- Check `QDRANT_URL` is correct
- Verify API key is set
- Ensure cluster is running (not provisioning)

### Typing animation issues
- Clear browser cache
- Check console for errors
- Verify React version is 18.3.1

### Upload fails
- Check file size (< 10MB)
- Verify file type (PDF/DOCX/TXT/MD)
- Check Qdrant connection
- View logs in `logs/` folder

## Development Tips

### Hot Reload
- Changes to `app/` auto-reload
- Changes to `lib/` may need manual refresh
- Changes to `.env.local` require restart

### Logging
- Check `logs/app-YYYY-MM-DD.log` for details
- Console shows real-time logs
- Set `LOG_LEVEL=DEBUG` for verbose output

### Testing
```bash
# Type check
npm run build

# Lint
npm run lint
```

## Next Steps

- Upload finance documents to test KB
- Customize system prompt in `app/api/chat/route.ts`
- Adjust typing speed in `app/page.tsx` (CPS constant)
- Deploy to Vercel (see DEPLOYMENT.md)
