# Model Configuration Guide

## Overview

AskRivo supports multiple LLM providers and models for maximum flexibility and reliability. This guide explains how to configure and switch between different models.

## Supported Models (December 2025)

### OpenAI Models

| Model | Best For | Speed | Quality | Cost |
|-------|----------|-------|---------|------|
| `gpt-5-mini` | **Production (Recommended)** | ⚡⚡⚡ Fast | ⭐⭐⭐ Excellent | 💰 Low |
| `gpt-5.2` | Complex reasoning, quality boost | ⚡⚡ Moderate | ⭐⭐⭐⭐ Best | 💰💰 Higher |
| `gpt-4.1` | Non-reasoning tasks, snappy responses | ⚡⚡⚡ Fast | ⭐⭐⭐ Great | 💰 Low |

### Mistral Models

| Model | Best For | Speed | Quality | Cost |
|-------|----------|-------|---------|------|
| `mistral-large-latest` | Backup/alternative to OpenAI | ⚡⚡ Moderate | ⭐⭐⭐ Excellent | 💰 Competitive |

## Configuration

### Environment Variables

Edit `.env.local`:

```env
# Provider Selection
LLM_PROVIDER=openai          # Options: 'openai' or 'mistral'

# OpenAI Model Selection (when LLM_PROVIDER=openai)
OPENAI_MODEL=gpt-5-mini      # Options: 'gpt-5-mini', 'gpt-5.2', 'gpt-4.1'

# API Keys
OPENAI_API_KEY=sk-proj-...   # Required for OpenAI
MISTRAL_API_KEY=...          # Required for Mistral
```

## Switching Models

### Option 1: Use OpenAI GPT-5-mini (Default, Recommended)

```env
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-5-mini
```

**Why**: Perplexity AI recommends this for production. Fast, reliable, excellent function calling support.

### Option 2: Use OpenAI GPT-5.2 (Quality Boost)

```env
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-5.2
```

**Why**: Best quality for complex reasoning. Use when you need the absolute best responses.

### Option 3: Use OpenAI GPT-4.1 (Non-Reasoning)

```env
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4.1
```

**Why**: Simpler, snappier responses. Good for straightforward conversations.

### Option 4: Use Mistral Large 3 (Backup)

```env
LLM_PROVIDER=mistral
```

**Why**: Alternative provider for redundancy. Mistral Large 3 is a 675B parameter MoE model with strong function calling support.

## Model Selection Logic

The system uses this logic in `app/api/chat/route.ts`:

```typescript
function getModel() {
  if (LLM_PROVIDER === 'mistral') {
    return mistral('mistral-large-latest');
  }
  return openai(OPENAI_MODEL);
}
```

## Perplexity AI Recommendations (Dec 2025)

Based on consultation with Perplexity AI:

1. **Default**: Use `gpt-5-mini` for production
   - Fast response times
   - Reliable function calling
   - Cost-effective
   - Excellent conversational quality

2. **Quality Boost**: Keep `gpt-5.2` available for complex scenarios
   - Best reasoning capabilities
   - Use when user asks complex questions

3. **Backup**: Mistral Large 3 as fallback
   - Strong function calling support
   - Competitive with OpenAI
   - Provider redundancy

## Function Calling Support

All supported models have been verified to support:
- ✅ Function/tool calling (critical for anti-hallucination)
- ✅ Streaming responses (for real-time UX)
- ✅ Conversation history management
- ✅ Temperature control (we use 0 for deterministic responses)

## Performance Characteristics

### GPT-5-mini
- First token: < 1 second
- Function call latency: ~500ms
- Streaming: Smooth, real-time

### GPT-5.2
- First token: ~1-2 seconds
- Function call latency: ~800ms
- Streaming: Smooth, real-time

### Mistral Large 3
- First token: ~1-2 seconds
- Function call latency: ~700ms
- Streaming: Smooth, real-time

## Cost Optimization

If you need to reduce costs:

1. Use `gpt-5-mini` (already the default)
2. Set `temperature: 0` (already configured)
3. Keep system prompt concise (already optimized)
4. Use function calling for all math (already implemented)

## Troubleshooting

### Model not found error
- Check that you're using the correct model identifier
- Verify your API key has access to the model
- Try `gpt-5-mini` as a fallback

### Slow responses
- Switch to `gpt-5-mini` for faster responses
- Check your internet connection
- Verify Vercel Edge runtime is enabled

### Function calling not working
- All supported models have function calling
- Check that tools are properly registered
- Verify Zod schemas are correct

## Future Enhancements

Potential improvements:
- Automatic fallback on provider errors
- Load balancing between providers
- User-selectable model in UI
- Cost tracking and optimization
- A/B testing between models

## References

- Perplexity AI consultation: `Letters to Perplexity/letter_2025-12-14_19-30.md`
- OpenAI API docs: https://platform.openai.com/docs
- Mistral API docs: https://docs.mistral.ai
- Vercel AI SDK: https://sdk.vercel.ai/docs
