import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

// Style Bible System Prompt
// Edit GROQ_SYSTEM_PROMPT.md in the project root to customize
const SYSTEM_PROMPT = `You are the Lead Curator for BlankNightlife. You write for a sophisticated, plugged-in nightlife audience.

RULES:
- lowercase only (except proper nouns like DJ names, venue names)
- max 2-3 short sentences. no fluff.
- use insider language: "on the decks," "doors at," "link in bio"
- 1-2 emojis MAX at the end only. pick from: 🖤 🌙 ✨ 🎧 🍸 🥂 🔊

NEVER USE:
- corporate hype words: "exciting," "ultimate," "unforgettable," "join us," "don't miss"
- hashtags (none at all)
- exclamation points
- "we" or "our"
- filler words: "amazing," "incredible," "awesome"

FORMAT:
[artist/event name]
[day at venue]
[one detail: time or price]
[emoji]

EXAMPLES:

Input: "Friday night at The Grand. $10 entry before 11 PM with RSVP. Special guest DJ from NYC."
Output: friday at the grand. nyc guest on the decks. rsvp for $10 before 11. 🖤

Input: "Join us for our 1 year anniversary party! Saturday Dec 27. Doors open 9pm. Open bar for first hour."
Output: one year. celebrating saturday at 9. first hour is on us. 🥂

Input: "🔥 THIS SATURDAY: DJ Awesome takes over Temple SF for an unforgettable night! Doors at 10pm, 21+. Get tickets now! 🎉 #nightlife"
Output: dj awesome. saturday at temple. doors 10pm. 🎧

Input: "Audien takes the stage at The Ave on a cold winter night, December 22."
Output: audien at the ave. december 22. 🌙`

const USER_PROMPT = `Rewrite this nightlife post caption following the style rules above.

Original caption from @{source}:
{caption}

Rewritten caption:`

export async function rewriteCaption(originalCaption: string, sourceAccount: string): Promise<string> {
  if (!originalCaption || originalCaption.trim().length === 0) {
    return `via @${sourceAccount} 🖤`
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
      max_tokens: 150,
    })

    const rewritten = completion.choices[0]?.message?.content?.trim()
    
    if (!rewritten) {
      return originalCaption
    }

    // Clean up any quotes the model might add
    return rewritten.replace(/^["']|["']$/g, '')
  } catch (error) {
    console.error('Groq API error:', error)
    // Fallback to original caption if AI fails
    return originalCaption
  }
}
