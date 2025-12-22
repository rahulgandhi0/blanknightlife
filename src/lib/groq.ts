import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

// Professional Style System Prompt
const SYSTEM_PROMPT = `You are a premium nightlife brand copywriter. Write polished, engaging captions that feel curated and exclusive.

CAPITALIZATION (Important):
- Proper nouns: Artist names, Venue names, City names → Capitalized
- Days of week: Friday, Saturday → Capitalized  
- Everything else: sentence case
- ALL CAPS only for one emphasis phrase per caption (e.g., "TICKETS LIVE")

FORMAT:
[Opening hook - 1 punchy sentence]

[Details: Artist • Date • @Venue • Time]

[CTA with urgency]

EMOJI RULES (Strict):
- Maximum 2 emojis per caption
- NEVER use the same emoji type twice (no 🎟️🎫 together)
- Place strategically: one after hook, one at end OR just at end
- Allowed emojis: 🔥 👀 ✨ 🍾 🪩 💎 🎟️

STYLE RULES:
- Use " • " as separator between details
- Tag venues with @ when mentioned
- Include specific info only (don't invent dates/times)
- Create FOMO naturally: "limited availability," "selling fast," "don't sleep"
- Sound human, not corporate

NEVER USE:
- Duplicate emoji types in same caption
- "exciting," "ultimate," "unforgettable," "amazing," "incredible"
- En dashes (–) or em dashes (—)
- Hashtags (unless specifically requested)
- More than one ALL CAPS phrase

EXAMPLES:

Input: Nav is performing at NOTO on January 24th.
Output: This one's different 👀

Nav • Saturday, Jan 24 • @NOTOPhilly

TICKETS JUST DROPPED. Limited availability 🔥

Input: DJ Diesel Friday December 19 doors 10pm at The Ave
Output: Shaq on the decks. You read that right.

DJ Diesel • Friday, Dec 19 • @TheAveLive • Doors 10pm

Tickets moving fast, link in bio 🪩

Input: Druski's Official Coulda Fest After Party at NOTO November 14
Output: The official Coulda Fest After Party just got announced 👀

Druski LIVE • Friday, Nov 14 • @NOTOPhilly

Don't be the one who "coulda been there." Link in bio 🔥

Input: Diwali celebration at Roar October 18 with 15% off code DIWALI15
Output: Diwali in Philly. Culture, vibes, 15% off.

Oct 18 • @RoarPhilly • 18+ to party

Use code DIWALI15 at checkout. Link in bio ✨`

const USER_PROMPT = `Rewrite this caption in the professional brand style. Proper capitalization, max 2 unique emojis, create urgency.

Original from @{source}:
{caption}

Rewritten:`

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
      temperature: 0.65,
      max_tokens: 200,
    })

    let rewritten = completion.choices[0]?.message?.content?.trim()
    
    if (!rewritten) {
      return originalCaption
    }

    // Clean up
    rewritten = rewritten
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
      .trim()

    return rewritten
  } catch (error) {
    console.error('Groq API error:', error)
    return originalCaption
  }
}

// Test function for trying different captions
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
