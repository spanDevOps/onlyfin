# Loom Video Script (5 minutes)

## Introduction (30 seconds)

"Hi! I'm [Your Name], and this is AskRivo, an AI-native conversational mortgage assistant that replaces traditional calculators with natural dialogue."

## Architecture Overview (1.5 minutes)

**[Show code structure]**

"Let me walk you through the architecture. The key challenge was preventing LLM hallucination on math calculations.

**[Open `lib/mortgage-tools.ts`]**

Here are the four core tools - all pure TypeScript functions:
1. `calculateEMI` - Uses the standard EMI formula, no LLM involved
2. `calculateUpfrontCosts` - 7% UAE transaction fees
3. `calculateMaxLoan` - 80% LTV rule for expats
4. `compareRentVsBuy` - Decision logic with heuristics

Each function returns structured JSON with validation.

**[Open `app/api/chat/route.ts`]**

This is where the magic happens. I'm using Vercel AI SDK's `streamText` with OpenAI GPT-4. The key is the `tools` object - I've registered all four calculation functions here.

When the LLM needs a number, it calls these tools instead of guessing. The SDK handles the function calling loop automatically, and we stream the response back to the user.

**[Show system prompt]**

The system prompt explicitly instructs: 'NEVER perform arithmetic yourself - ALWAYS use the provided tools.' This is critical for accuracy."

## Live Demo (2 minutes)

**[Open browser to deployed app]**

"Let me show you it in action.

**[Type: 'I make 20k AED a month and want to buy in Marina for 2M']**

Watch how it responds naturally - it's not a form, it's a conversation. It understood my income and property price from one sentence.

**[Wait for response]**

See this badge? 'Calculated using verified tools' - that means it called our TypeScript functions, not the LLM.

**[Show the calculation breakdown in the response]**

It's telling me:
- Down payment needed: 400k AED (20%)
- Upfront costs: 140k AED (the hidden killer)
- Monthly EMI: around 8,500 AED

**[Type: 'I'm only staying 2 years']**

Now watch - it should recommend renting because upfront costs won't be recovered.

**[Wait for response]**

Perfect! It's using the heuristic: less than 3 years = rent. The logic is in the `compareRentVsBuy` function."

## Technical Highlights (45 seconds)

**[Show key files quickly]**

"Quick technical highlights:
- Next.js 14 with App Router
- Vercel AI SDK for streaming and function calling
- TypeScript with Zod validation for type safety
- Edge runtime for fast cold starts
- Tailwind for responsive UI
- One-click Vercel deployment

The entire stack is optimized for the 24-hour constraint - I used the AI SDK template as a base and focused on the core logic."

## Edge Case Handling (30 seconds)

**[Type: 'I have zero income']**

"Let me show an edge case.

**[Wait for response]**

It handles it gracefully - explains that banks won't approve without income. The validation is in the tool functions, and the LLM provides the empathetic explanation."

## Conclusion (30 seconds)

"That's AskRivo! The key innovation is the anti-hallucination architecture - all math is deterministic, but the conversation feels human.

The code is modular, type-safe, and production-ready. You can easily swap the LLM or add more tools.

Thanks for watching! The repo link and live demo are in my submission email."

---

## Recording Tips

- Use 1080p resolution
- Show both code and browser side-by-side when possible
- Speak clearly and at a moderate pace
- Keep it under 5 minutes
- Test your mic before recording
- Use Loom's drawing tools to highlight key code sections
