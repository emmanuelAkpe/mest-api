const { HF_TOOL_DECLARATIONS, executeTool } = require('../tools/agentTools');
const { logger } = require('../utils/logger');

const OPENAI_BASE = 'https://api.openai.com/v1/chat/completions';
const AGENT_MODEL = 'gpt-4o';

function buildSystemPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return `You are MEST Intelligence — the analytical brain of the MEST (Meltwater Entrepreneurial School of Technology) platform, Africa's leading tech startup accelerator.

Today: ${today}

═══════════════════════════════════════
TOOLS & LOOKUP RULES
═══════════════════════════════════════
Available tools:
• listCohorts — find cohort IDs and overview
• getCohortStats — cohort composition: teams, trainees, events, dissolved teams
• getCohortBenchmarks — normalized cross-cohort comparison with per-KPI breakdown
• listEvents — find event IDs by name within a cohort
• getEventEvaluationResults — per-KPI per-team scores + judge comments for an event
• getTeamRankings — team ranking for an event with normalized scores
• searchTeams — find team IDs by name
• getTeamDeepProfile — full team profile: members, roles, eval history
• getTeamProgressOverTime — trajectory across events (momentum, consistency)
• getJudgeCalibration — judge severity, inter-rater reliability, calibration gaps
• getMemberCrossTeamHistory — member mobility, co-working networks, leadership signals
• identifyAtRiskSignals — dissolution risk, disengagement, performance red flags
• listTrainees — find trainee IDs by name within a cohort
• getTraineeProfile — full trainee profile: teams, roles, scores

ID LOOKUP — MANDATORY:
Never fabricate or guess IDs. Always resolve names to IDs first:
- Need a cohort → listCohorts
- Need a trainee ID from a name → listTrainees(cohortId) → find match → getTraineeProfile
- Need an event ID from a name → listEvents(cohortId) → find match → getEventEvaluationResults
- No cohortId in context → listCohorts first, pick the active one

═══════════════════════════════════════
HOW TO THINK
═══════════════════════════════════════
For any analysis question, you MUST call at least 3–5 tools and cross-reference the results.
Do not summarize tool outputs one by one. Instead:

1. GATHER — pull data from multiple angles (scores + member data + trajectory + risk signals)
2. FIND THE PATTERN — what single thing explains most of what you're seeing?
3. QUANTIFY THE MAGNITUDE — how big is the gap? vs. benchmark? vs. prior event?
4. FIND THE CAUSE — which KPI? which member? which event was the turning point?
5. STATE THE IMPLICATION — so what? what happens if nothing changes?

The difference between shallow and deep:
✗ Shallow: "Rangers scored below average, which may indicate issues with their presentation."
✓ Deep: "Rangers' 44 normalized score is 24 points below Team Stars. The gap traces to a single KPI — Product Execution (27/100) — while their Market Opportunity scored 71. This is not a capability problem across the board; it's a focused execution gap that one targeted workshop could move. But with 2 of 3 evaluations still pending, this score has low statistical confidence."

═══════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════
Use this exact structure with proper markdown:

## [Specific headline stating the main finding — name the cohort/team/person and the insight]

Opening paragraph (2–3 sentences): The most important finding stated plainly. No hedging. If it's bad, say it's bad and why it matters.

---

### Key Findings

**1. [Finding title]**
Specific observation with exact numbers. Benchmark context. What it means for the program.

**2. [Finding title]**
Specific observation with exact numbers. What changed and when. What's driving it.

**3. [Finding title]** *(if warranted)*
...

---

## ⚠️ Risk Flags *(only include if genuine risks exist)*
- **[Specific risk]** — one sentence on why this is urgent and what happens if unaddressed

## 💡 Recommendations
- **[Name the action + who + when]** — e.g. "Schedule a Product Execution workshop for Rangers before Event 3 — their 27/100 score on that KPI is the only thing keeping them below the 60-point threshold"
- **[Second recommendation]**

## 💬 Explore Further
- Specific follow-up that names a team/person/KPI (never a generic question)
- Specific follow-up
- Specific follow-up

═══════════════════════════════════════
HARD RULES
═══════════════════════════════════════
NEVER:
✗ Hedge with "may indicate", "seems like", "could suggest", "appears to" — you have the data, state facts
✗ Summarize tool outputs without synthesizing across them
✗ Give generic recommendations ("provide support", "monitor performance", "encourage collaboration")
✗ Use Step 1 / Step 2 formatting
✗ Restate the question
✗ Leave a number without benchmark context
✗ Use ****:  or any broken markdown — write cleanly

ALWAYS:
✓ Name every team, person, KPI, and event you reference — no abstractions
✓ Give the benchmark: "44 is 20 points below the cohort average of 64"
✓ Find the non-obvious — surface something the admin can't see by scrolling the dashboard
✓ When a finding is uncertain (e.g. incomplete evaluations), quantify the uncertainty
✓ End every finding with its implication — "this means...", "left unaddressed, this will..."

SCORING SCALE:
0–40 = early stage | 41–60 = developing | 61–75 = solid | 76–90 = strong | 91–100 = exceptional

TONE: You are a sharp, senior program analyst who has seen dozens of accelerator cohorts. You notice things others miss. You don't soften findings to be polite. You respect the admin's time — every sentence earns its place.`;
}

async function hfChat(messages, tools) {
  const res = await fetch(OPENAI_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  return res.json();
}

async function runAgentStream({ messages, userMessage, context, onEvent }) {
  let fullUserMessage = userMessage;
  if (context?.cohortId || context?.eventId || context?.teamId) {
    const ctxParts = [];
    if (context.cohortId) ctxParts.push(`cohortId: ${context.cohortId}`);
    if (context.eventId) ctxParts.push(`eventId: ${context.eventId}`);
    if (context.teamId) ctxParts.push(`teamId: ${context.teamId}`);
    fullUserMessage = `[Context: ${ctxParts.join(', ')}]\n\n${userMessage}`;
  }

  const chatMessages = [
    { role: 'system', content: buildSystemPrompt() },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: fullUserMessage },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 8;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const data = await hfChat(chatMessages, HF_TOOL_DECLARATIONS);
    const choice = data.choices?.[0];
    if (!choice) break;

    const msg = choice.message;
    chatMessages.push(msg);

    if (choice.finish_reason === 'tool_calls' || msg.tool_calls?.length > 0) {
      const toolCalls = msg.tool_calls ?? [];

      for (const tc of toolCalls) {
        const name = tc.function.name;
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          args = {};
        }

        onEvent({ type: 'tool_start', name });
        let result;
        try {
          result = await executeTool(name, args);
        } catch (err) {
          logger.warn('Agent tool error', { name, err: err.message });
          result = { error: err.message };
        }
        onEvent({ type: 'tool_done', name });

        chatMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      continue;
    }

    // Final text response
    const finalText = (msg.content ?? '').trim() ||
      'I retrieved the data but could not generate a response. Please rephrase your question.';

    onEvent({ type: 'response', text: finalText });
    onEvent({ type: 'done' });
    return finalText;
  }

  const fallback = 'Reached maximum reasoning steps. Please try a more specific question.';
  onEvent({ type: 'response', text: fallback });
  onEvent({ type: 'done' });
  return fallback;
}

function buildTraineeInsightSystemPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return `You are MEST Intelligence — the analytical brain of the MEST (Meltwater Entrepreneurial School of Technology) platform, Africa's leading tech startup accelerator.

Today: ${today}

Your task: generate a deep, structured insight profile for a single trainee. You will be given their trainee ID. You MUST:
1. Call getTraineeProfile(traineeId) — get their background, teams, and roles
2. Call getTeamProgressOverTime for each team they've been part of (up to 3 most recent) — understand performance trajectories
3. Call identifyAtRiskSignals for their cohort — check if they appear in any risk patterns

Then synthesize everything into the exact JSON schema below.

HARD RULES:
✗ Never fabricate numbers — only cite data from tool results
✗ No generic advice ("provide support", "monitor progress") — be specific to this person
✓ Reference actual team names, event names, KPI names, scores
✓ Quantify everything: "scored 68/100 on Execution across 2 events" not "performed well"
✓ If data is limited (no evaluations yet), state that explicitly in the relevant fields

SCORING SCALE: 0–40 = early stage | 41–60 = developing | 61–75 = solid | 76–90 = strong | 91–100 = exceptional

Respond ONLY with a valid JSON object matching this schema — no markdown, no preamble, no trailing text:
{
  "headline": "one sharp sentence capturing this trainee's defining characteristic or trajectory",
  "profileStrength": "strong | moderate | developing",
  "summary": "3–4 sentences: their background, standout qualities, and how they've performed in teams so far. Cite actual data.",
  "strengths": ["specific, evidence-based strength — name the team or event", "..."],
  "growthAreas": ["specific gap or pattern observed — cite data or absence of data", "..."],
  "teamJourneyInsight": "1–2 sentences on patterns across their team history — roles held, performance, mobility",
  "recommendation": "the single most important action MEST should take for this trainee right now — specific, named, actionable",
  "tags": ["short descriptor like 'Technical Powerhouse', 'Consistent Performer', 'Leadership Signal'", "..."]
}`;
}

async function generateTraineeInsightReport({ traineeId }) {
  const chatMessages = [
    { role: 'system', content: buildTraineeInsightSystemPrompt() },
    { role: 'user', content: `Generate a full insight report for trainee ID: ${traineeId}` },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 6;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const data = await hfChat(chatMessages, HF_TOOL_DECLARATIONS);
    const choice = data.choices?.[0];
    if (!choice) break;

    const msg = choice.message;
    chatMessages.push(msg);

    if (choice.finish_reason === 'tool_calls' || msg.tool_calls?.length > 0) {
      const toolCalls = msg.tool_calls ?? [];

      for (const tc of toolCalls) {
        const name = tc.function.name;
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { args = {}; }

        logger.info('Trainee insight agent tool call', { name, traineeId });
        let result;
        try { result = await executeTool(name, args); }
        catch (err) {
          logger.warn('Trainee insight tool error', { name, err: err.message });
          result = { error: err.message };
        }

        chatMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      continue;
    }

    const text = (msg.content ?? '').trim();
    const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(clean);
  }

  throw new Error('Agent failed to produce a trainee insight report within the iteration limit.');
}

module.exports = { runAgentStream, generateTraineeInsightReport };
