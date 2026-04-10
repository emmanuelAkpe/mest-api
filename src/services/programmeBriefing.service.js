const { logger } = require('../utils/logger')

const OPENAI_BASE = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o'

async function generateProgrammeBriefing({ cohortData }) {
  const today = new Date().toISOString().split('T')[0]

  const systemPrompt = `You are the AI Programme Manager for MEST (Meltwater Entrepreneurial School of Technology), Africa's top startup accelerator.
Today: ${today}

You receive a data snapshot of an active cohort and produce a structured briefing for the programme facilitators.

OUTPUT: Return ONLY valid JSON matching this exact schema (no markdown fences):
{
  "healthScore": <0-100 integer>,
  "summary": "<2-3 sentence cohort pulse>",
  "urgentActions": [
    { "priority": "high|medium|low", "action": "<specific action>", "reason": "<why urgent>" }
  ],
  "teamHealth": [
    { "teamName": "<name>", "status": "thriving|on_track|at_risk|critical", "score": <0-100 or null>, "note": "<one sentence>" }
  ],
  "coachingPrompts": [
    { "teamName": "<name>", "prompt": "<direct coaching question or prompt to ask the team>", "focusArea": "<area>" }
  ],
  "resourceRecommendations": [
    { "topic": "<resource topic>", "rationale": "<why needed>", "targetTeams": ["<team names>"] }
  ],
  "highlights": [
    { "type": "win|concern|milestone|trend", "text": "<specific highlight>" }
  ]
}

Rules:
- urgentActions: max 5, ordered by priority
- teamHealth: include every team. Status: thriving=top 20%, on_track=middle 60%, at_risk=low performers, critical=dissolved or danger signals
- coachingPrompts: only for teams that need intervention (at_risk + critical)
- resourceRecommendations: max 4, specific topics not vague platitudes
- highlights: 3-6 specific facts that would surprise or concern a facilitator
- healthScore: weighted average of submission rates, eval scores, mentor engagement, team stability`

  const dataJson = JSON.stringify(cohortData, null, 2)
  const userMessage = `Generate a programme briefing for the following cohort data snapshot:\n\n${dataJson}`

  const res = await fetch(OPENAI_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${body}`)
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from OpenAI')

  return JSON.parse(content)
}

module.exports = { generateProgrammeBriefing }
