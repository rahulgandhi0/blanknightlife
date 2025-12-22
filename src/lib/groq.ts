import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const SYSTEM_PROMPT = `You write nightlife social media captions for a premium brand. Style: confident, insider knowledge, creates FOMO.

FORMAT: Flowing sentences, not rigid structure. 2-4 short punchy lines. Use line breaks sparingly for emphasis.

STYLE NOTES:
- Start with a hook that's specific to the event (not generic)
- Include key details: artist, date, venue, age requirement
- End with urgency or CTA
- Tag venues/artists with @
- Hashtags at the very end, separated, 3-5 max

CAPITALIZATION:
- Sentence case mostly
- ALL CAPS for one emphasis phrase (e.g., "TICKETS JUST DROPPED")
- Proper nouns capitalized

EMOJIS (2-3 max, contextual):
- Electronic/DJ: ⚡️ 🪩 🎧
- Hype/Fire: 🔥 💫
- Party/Celebration: 🎉 🎊 🍾
- Attention: 👀 🎃 🏈
- Tickets: 🎟️ 🎫
- Classy: ✨ 💎

REAL EXAMPLES FROM THE BRAND:

Example 1 (Diwali):
Diwali in Philly is almost here 👀 Celebrate with culture, chaos, and 15% off 🎉 Use code DIWALI15 with the discounted link in bio before it's gone!
10/18 at @roarphilly • 18+ To Party
@drexel.disha @lastniteout #PhillyDiwali #Bollywoodnight

Example 2 (DJ):
This Friday → R3HAB live at NOTO ⚡️ Only a few nights till the drop hits and the walls shake. You already know the vibe 🎫 21+ • Tickets still available, not for long
#philly #philadelphia #phillyevents #phillynightlife

Example 3 (Afrohouse):
Get with the program, we're getting closer 💫 Infusion Lounge hosts the debut afrohouse set by PROGRAMS 🪩 Craft cocktails • luxe VIP • a night to remember THIS FRIDAY!
Make sure to pay attention to the dress code
#drexelnightlife #philly #phillynightlife

Example 4 (Halloween):
PHILADELPHIAS BIGGEST HALLOWEEN BASH IS BACK 🔥
Fright Night IV at NOTO • Thursday, Oct 30th 🎃 and tickets just went live — this is the lowest price you'll ever see 🎟️
- PREMIUM Venue
- Music and Vibes on point (as always)
- Costumes better be on
- 18+ to Party | 21+ for the Bar
Don't wait. This one sells out every year.
Ticket link in bio ⚡️
#drexelnightlife #philly #phillynightlife #halloweenparty

Example 5 (Sports):
Birds vs Boys 🏈 The rivalry starts here!
Opening Day Watch Party at The Post • Thurs, Sept 4 • Party at 7PM • Kickoff at 8:20PM.
Free entry • 10 TVs • Game day specials all night ✨
Table packages available to reserve.

NEVER USE: "exciting," "ultimate," "unforgettable," "amazing," "incredible," "join us"
AVOID: en dashes (–), em dashes (—), generic hooks like "Get ready for"`

const USER_PROMPT = `Rewrite this caption in the brand style shown above. Match the tone, emoji usage, and format of the examples.

Original from @{source}:
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
      temperature: 0.75,
      max_tokens: 250,
    })

    let rewritten = completion.choices[0]?.message?.content?.trim()
    
    if (!rewritten) {
      return originalCaption
    }

    rewritten = rewritten
      .replace(/^["']|["']$/g, '')
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
