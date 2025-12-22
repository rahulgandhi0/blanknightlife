import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const CAPTION_PROMPT = `You are a minimalist nightlife curator. Rewrite this venue post caption in a hype-focused, clean style.

Rules:
- Maximum 2-3 short sentences
- Use line breaks for rhythm
- Include key info: artist, date, venue (if mentioned)
- Remove excessive hashtags and emojis (keep 1-2 max if relevant)
- Keep it mysterious and exclusive-feeling
- Never use words like "amazing", "incredible", or "don't miss"
- If there's no meaningful content, return just the venue/artist name

Original caption:
{caption}

Source: @{source}`

export async function rewriteCaption(originalCaption: string, sourceAccount: string): Promise<string> {
  if (!originalCaption || originalCaption.trim().length === 0) {
    return `📍 via @${sourceAccount}`
  }

  try {
    const prompt = CAPTION_PROMPT
      .replace('{caption}', originalCaption)
      .replace('{source}', sourceAccount)

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 300,
    })

    const rewritten = completion.choices[0]?.message?.content?.trim()
    
    if (!rewritten) {
      return originalCaption
    }

    return rewritten
  } catch (error) {
    console.error('Groq API error:', error)
    // Fallback to original caption if AI fails
    return originalCaption
  }
}

