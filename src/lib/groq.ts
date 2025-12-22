import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const SYSTEM_PROMPT = `You write nightlife social media captions. Be cool, direct, and hype.

STRICT FORMAT (follow exactly):
[Hook - short punchy statement with emoji]

[Artist/Event • Date • @Venue • Time if provided]

[CTA - tickets/link in bio]

HOOK EXAMPLES (use these styles, NEVER start with "Generally"):
- "This weekend just got real 🔥"
- "Clear your schedule 👀"  
- "You're not ready for this one 🔥"
- "Mark your calendars 👀"
- "[Artist name] is coming through 🔥"
- "Big night incoming 🪩"

RULES:
✓ Capitalize: Artist names, Venue names, Days
✓ Use " • " between details
✓ MAX 2 emojis (never duplicate types)
✓ One ALL CAPS phrase max
✓ Only include info that exists (don't invent dates)

✗ NEVER use: Generally, exciting, ultimate, unforgettable, amazing, incredible
✗ NO hashtags
✗ NO duplicate emojis

EMOJIS (pick 1-2):
🔥 👀 ✨ 🍾 🪩

EXAMPLES:

Input: "Nav at NOTO January 24"
Output:
Clear your schedule 👀

Nav • Saturday, Jan 24 • @NOTOPhilly

Tickets live, link in bio 🔥

Input: "DJ Diesel December 19 doors 10pm at The Ave"
Output:
Shaq on the decks 🔥

DJ Diesel • Friday, Dec 19 • @TheAveLive • Doors 10pm

Limited tickets, link in bio

Input: "Party this Friday at Temple"
Output:
This Friday just got interesting 👀

@TempleSF • This Friday

Link in bio 🔥`

const USER_PROMPT = `Rewrite. Follow format exactly. NEVER start with "Generally". Max 2 emojis.

Original (@{source}):
{caption}

Output:`

export async function rewriteCaption(originalCaption: string, sourceAccount: string): Promise<string> {
  if (!originalCaption || originalCaption.trim().length === 0) {
    return `via @${sourceAccount} 🔥`
  }

  try {
    const userPrompt = USER_PROMPT
      .replace('{caption}', originalCaption)
      .replace('{source}', sourceAccount)

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens: 120,
    })

    let rewritten = completion.choices[0]?.message?.content?.trim()
    
    if (!rewritten) {
      return originalCaption
    }

    // Clean up
    rewritten = rewritten
      .replace(/^["']|["']$/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^Generally[,.]?\s*/i, '') // Remove "Generally" if it snuck in
      .trim()

    return rewritten
  } catch (error) {
    console.error('Groq API error:', error)
    return originalCaption
  }
}

export async function testCaption(originalCaption: string, sourceAccount: string = 'test_venue'): Promise<{
  original: string
  rewritten: string
  source: string
}> {
  const rewritten = await rewriteCaption(originalCaption, sourceAccount)
  return {
    original: originalCaption,
    rewritten,
    source: sourceAccount,
  }
}
