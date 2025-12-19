# Model Configuration

## Current Configuration

OnlyFin uses **OpenAI GPT-4.1-mini** for all operations.

## Environment Variables

```env
# Model selection
OPENAI_MODEL=gpt-4.1-mini

# API key
OPENAI_API_KEY=your_key_here
```

## Why GPT-4.1-mini?

- **Fast**: < 1 second first token
- **Reliable**: Excellent function calling support
- **Cost-effective**: Low cost per token
- **High quality**: Great for conversational AI
- **Streaming**: Smooth real-time responses
- **Superior tool calling**: Excellent for multi-tool scenarios

## Usage

The model is used for:
- Main chat responses
- Knowledge base search decisions (via tool calling)
- Document validation
- Topic filtering (integrated in prompt)

## Configuration

Edit `app/api/chat/route.ts`:

```typescript
const model = openai(process.env.OPENAI_MODEL || 'gpt-4.1-mini');
```

## Performance

- First token: < 1s
- Streaming: 45 CPS typing animation
- Function calls: ~500ms
- Context window: 128K tokens

## Cost Optimization

Current setup is optimized:
- Temperature: 0 (deterministic, no retries)
- Concise system prompt
- Efficient tool calling
- Single model for all operations

## Troubleshooting

### Model not found
- Verify API key has access to gpt-4.1-mini
- Check OPENAI_API_KEY is set correctly

### Slow responses
- Check internet connection
- Verify Vercel region matches Qdrant (us-east-1)
- Monitor OpenAI API status
