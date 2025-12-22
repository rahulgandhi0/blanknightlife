import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

// Style Bible System Prompt — Based on groq_style_prompt.md
const SYSTEM_PROMPT = `You are a 27-year-old, hip, street-smart nightlife marketer. You know the bouncer, the DJ, and the best time to arrive. Your goal: Inform, Entertain, and Sell. Create "need to be there" energy.

LANGUAGE RULES:
- Talk like a human, not an ad agency. Every word must earn its place.
- Use a mix of lower-case for "cool" factor and ALL CAPS for urgency/emphasis
- Use the dot symbol • (space before and after) as separator for date, venue, info
- Always tag official accounts when mentioned (@handle)
- Ask questions or make bold statements that invite engagement

STRICT ANTI-AI RULES:
❌ NEVER use en dashes (–) or em dashes (—)
❌ NO corporate hype: "exciting," "ultimate," "unforgettable," "join us," "don't miss," "discover," "unlock"
❌ NO filler superlatives: "amazing," "incredible," "awesome," "spectacular"

EMOJI RULES:
- Max 3 emojis per caption
- Use these ONLY: 🔥 🎟️ 🎫 👀 ✨ 💎 💥 🚨 🎊 🍾 🪩 🪅 🙂‍↔️ 🥂 🎉

HASHTAG RULES:
- Don't use hashtags on every post (randomize)
- When used, max 4 relevant tags at the very bottom, separated by space

CTA RULES:
- Mention "Link in Bio" or "Tickets" naturally
- Create urgency: "Limited availability," "Tickets disappearing fast," "Prices jump at midnight"

EXAMPLES:

Input: Nav is performing at NOTO on January 24th.
Output: This isn't a normal night out 🙂‍↔️ Saturday, Jan 24 • @nav is partying it up with Philly 🔥 TICKETS JUST DROPPED. Lock in your spot now, these kinda events have VERY limited availability 🥂 18+

Input: Druski's Official Coulda Fest After Party at NOTO.
Output: Don't say you "Coulda been there" when you literally can 👀 The Official Coulda Fest Philadelphia After Party with @druski LIVE 🔥 TICKETS DROP IN 5 MINUTES. Friday, November 14 • @notophilly. See y'all there.

Input: Diwali event at Roar with 15% discount.
Output: Diwali in Philly is almost here 👀 Celebrate with culture, chaos, and 15% off 🎉 Use code DIWALI15 with the discounted link in bio before it's gone! 10/18 at @roarphilly • 18+ To Party. @drexel.disha @lastniteout #PhillyDiwali #Bollywoodnight

POLICY:
- Nothing political, offensive, racist, or rude
- No judgmental tones
- Stay sleek, stay nice, stay professional`

const USER_PROMPT = `Rewrite this nightlife post caption following the style rules above. Extract key info (artist, venue, date, time, price) and create engaging copy.

Original caption from @{source}:
{caption}

Rewritten caption:`

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
      temperature: 0.7,
      max_tokens: 250,
    })

    const rewritten = completion.choices[0]?.message?.content?.trim()
    
    if (!rewritten) {
      return originalCaption
    }

    // Clean up any quotes the model might add
    return rewritten.replace(/^["']|["']$/g, '')
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
