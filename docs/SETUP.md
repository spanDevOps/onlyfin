# Quick Setup Guide

## 1. Configure API Keys and Model Selection

Edit `.env.local` and configure your API keys and preferences:

```env
# OpenAI API key (required)
OPENAI_API_KEY=sk-proj-...your-actual-key...

# Mistral API key (optional - for backup/alternative)
MISTRAL_API_KEY=your_mistral_api_key_here

# LLM Provider: 'openai' or 'mistral' (default: openai)
LLM_PROVIDER=openai

# OpenAI Model: 'gpt-5-mini' (recommended), 'gpt-5.2' (best quality), 'gpt-4.1' (non-reasoning)
OPENAI_MODEL=gpt-5-mini
```

### Model Options

**OpenAI Models** (as of December 2025):
- `gpt-5-mini` - Fast + reliable, best for function calling (recommended by Perplexity)
- `gpt-5.2` - Latest flagship model, best quality for complex reasoning
- `gpt-4.1` - Strong non-reasoning model, simpler and snappy

**Mistral Models**:
- `mistral-large-latest` - Mistral Large 3 (41B active, 675B total)

### Provider Selection

To switch between providers, change `LLM_PROVIDER`:
- `LLM_PROVIDER=openai` - Use OpenAI (default)
- `LLM_PROVIDER=mistral` - Use Mistral Large 3

## 2. Run Development Server

```bash
npm run dev
```

## 3. Open Browser

Navigate to [http://localhost:3000](http://localhost:3000)

## 4. Test the Chat

Try these prompts:
- "I make 20k AED a month and want to buy in Marina for 2M"
- "Should I buy or keep renting?"
- "I'm only staying 2 years in Dubai"

## 5. Deploy to Vercel

1. Push this code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variable: `OPENAI_API_KEY`
5. Deploy!

## Troubleshooting

If you see errors about missing API key:
- Make sure `.env.local` exists
- Make sure the key starts with `sk-`
- Restart the dev server after adding the key

If the chat doesn't respond:
- Check browser console for errors
- Check terminal for API errors
- Verify your OpenAI API key has credits
