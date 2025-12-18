# Logging System

## Overview

OnlyFin includes structured logging for debugging and monitoring.

## Log Location

### Development
- **Location**: `logs/` folder
- **Format**: `app-YYYY-MM-DD.log`
- **Example**: `logs/app-2025-12-18.log`

### Production (Vercel)
- **Location**: Vercel dashboard logs
- **Access**: Project → Logs tab

## Log Levels

| Level | Purpose |
|-------|---------|
| `DEBUG` | Detailed diagnostic info |
| `INFO` | General informational messages |
| `WARN` | Warning messages |
| `ERROR` | Error messages |

## Log Categories

- `API_REQUEST` - Incoming HTTP requests
- `API_RESPONSE` - HTTP responses
- `LLM_REQUEST` - Requests to OpenAI
- `LLM_RESPONSE` - Responses from OpenAI
- `TOOL_CALL` - Function invocations
- `TOOL_RESULT` - Function results
- `USER_MESSAGE` - User messages
- `ASSISTANT_MESSAGE` - AI responses
- `PERFORMANCE` - Performance metrics
- `API_ERROR` - Error details

## Usage

```typescript
import { logger } from '@/lib/logger';

// Basic logging
logger.info('CATEGORY', 'Message', { data: 'value' });
logger.error('CATEGORY', 'Error message', error);

// Specialized methods
logger.apiRequest('/api/chat', { messageCount: 5 });
logger.toolCall('searchKnowledgeBase', { query: 'test' });
logger.performanceMetric('API /api/chat', 1234);
```

## Viewing Logs

### Local Development

```bash
# View today's log
cat logs/app-2025-12-18.log

# Follow in real-time
tail -f logs/app-2025-12-18.log

# Search for errors
grep "ERROR" logs/app-2025-12-18.log
```

### Production (Vercel)

1. Go to Vercel dashboard
2. Select project
3. Click "Logs" tab
4. View real-time logs

## Log Analysis

### Find specific events

```bash
# All tool calls
grep "TOOL_CALL" logs/*.log

# Performance issues (>2000ms)
grep "PERFORMANCE" logs/*.log | grep -E "[2-9][0-9]{3}ms"

# User messages
grep "USER_MESSAGE" logs/*.log
```

## Configuration

Edit `.env.local`:

```env
# Log level: DEBUG, INFO, WARN, ERROR
LOG_LEVEL=DEBUG

# Enable file logging (requires Node.js runtime)
ENABLE_FILE_LOGGING=true
```

## Best Practices

1. Use appropriate log levels
2. Include context in data
3. Don't log sensitive data (API keys, PII)
4. Monitor log file size
5. Use log aggregation in production

## Troubleshooting

### Logs not created

- Check if using Edge runtime (no file system)
- Switch to Node.js runtime if needed
- Restart dev server

### Too verbose

- Set `LOG_LEVEL=INFO` to reduce output
- Filter by category in analysis

## Security

- Logs may contain user conversations
- Don't commit log files (in `.gitignore`)
- Implement log retention policies
- Consider GDPR/privacy requirements
