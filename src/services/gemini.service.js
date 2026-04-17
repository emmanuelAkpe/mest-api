const HF_BASE = 'https://router.huggingface.co/nebius/v1/chat/completions';
const INSIGHTS_MODEL = 'Qwen/Qwen2.5-72B-Instruct';

function buildEvalPayload({ event, kpis, teams, submissions }) {
  const teamSubmissionMap = {};
  for (const team of teams) {
    teamSubmissionMap[team.id] = [];
  }

  for (const sub of submissions) {
    for (const ts of sub.teamScores) {
      const tid = ts.team.toString();
      if (!teamSubmissionMap[tid]) continue;
      teamSubmissionMap[tid].push({
        evaluatorName: sub.evaluatorName,
        overallComment: ts.overallComment ?? '',
        scores: ts.scores.map((s) => ({
          kpiId: s.kpi.toString(),
          score: s.score,
          comment: s.comment ?? null,
        })),
      });
    }
  }

  function scaleLabel(kpi) {
    switch (kpi.scaleType) {
      case '1_to_5': return '1–5';
      case '1_to_10': return '1–10';
      case 'percentage': return '0–100%';
      case 'custom': return `${kpi.scaleMin ?? 0}–${kpi.scaleMax ?? 10}`;
      default: return '1–10';
    }
  }

  const kpiLines = kpis.map(
    (k) => `  - ${k.name} (weight ${k.weight}, scale ${scaleLabel(k)})${k.description ? ': ' + k.description : ''}`
  ).join('\n');

  const teamBlocks = teams.map((team) => {
    const evals = teamSubmissionMap[team.id] ?? [];
    if (evals.length === 0) return `## ${team.name}\n  [No evaluations submitted yet]`;

    const kpiLines2 = kpis.map((kpi) => {
      const scores = evals.map((e) => e.scores.find((s) => s.kpiId === kpi.id)).filter(Boolean);
      const nums = scores.map((s) => s.score);
      const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : 'N/A';
      const commentLines = scores
        .filter((s) => s.comment)
        .map((s) => {
          const ev = evals.find((e) => e.scores.includes(s));
          return `      • ${ev?.evaluatorName ?? 'Judge'}: "${s.comment}"`;
        })
        .join('\n');
      return `    - ${kpi.name}: avg ${avg} | scores: [${nums.join(', ')}]${commentLines ? '\n      Comments:\n' + commentLines : ''}`;
    }).join('\n');

    const overallLines = evals
      .filter((e) => e.overallComment)
      .map((e) => `    • ${e.evaluatorName}: "${e.overallComment}"`)
      .join('\n');

    return [
      `## ${team.name}`,
      team.productIdea ? `  Product Idea: "${team.productIdea}"` : null,
      team.marketFocus ? `  Market Focus: ${team.marketFocus}` : null,
      `  KPI Scores:\n${kpiLines2}`,
      overallLines ? `  Overall Judge Comments:\n${overallLines}` : null,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return { kpiLines, teamBlocks };
}

async function generateEvaluationInsights({ event, kpis, teams, submissions }) {
  const { kpiLines, teamBlocks } = buildEvalPayload({ event, kpis, teams, submissions });

  const prompt = `You are an expert startup ecosystem analyst at MEST (Meltwater Entrepreneurial School of Technology), a leading African startup accelerator. You are analyzing judge evaluation data from a pitch event to produce deep, specific, and actionable insights for the MEST team.

EVENT: ${event.name} | TYPE: ${event.type}
EVALUATORS: ${submissions.length} judge(s) submitted evaluations
TEAMS: ${teams.length} teams evaluated

KPI FRAMEWORK:
${kpiLines}

EVALUATION DATA:
${teamBlocks}

Respond ONLY with a valid JSON object matching this exact schema — no markdown, no preamble, no trailing text:
{
  "eventSummary": "3–5 sentences: overall quality of pitches, dominant themes, standout moments",
  "cohortStrength": "excellent | good | developing | needs_support",
  "cohortPattern": "1–2 sentences on a pattern visible across the entire cohort (e.g. strong tech, weak market articulation)",
  "rankings": [
    { "rank": 1, "teamId": "<id>", "teamName": "<name>", "headline": "one-line verdict on why they ranked here" }
  ],
  "teamAnalyses": [
    {
      "teamId": "<id>",
      "teamName": "<name>",
      "verdict": "one strong sentence encapsulating this team's performance",
      "strengths": ["very specific strength based on judge comments", "..."],
      "improvements": ["very specific area to address", "..."],
      "judgeConsensus": "what all judges agreed on (positive or negative)",
      "divergence": "where judges disagreed and the likely reason, or null if unanimous",
      "recommendation": "single most important next step for this team",
      "readinessLevel": "investor_ready | near_ready | needs_work | early_stage"
    }
  ],
  "standoutInsights": [
    { "insight": "a surprising or important cross-team finding", "significance": "why this matters for MEST or the cohort" }
  ],
  "facilitatorActions": [
    { "action": "specific thing MEST facilitators should do", "urgency": "immediate | this_week | this_month", "targetTeams": ["team name or 'All teams'"] }
  ]
}

Be specific. Reference actual scores, actual judge comments, and actual team names. Avoid generic startup advice.`;

  const res = await fetch(HF_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
    },
    body: JSON.stringify({
      model: INSIGHTS_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HF API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';

  // Strip any markdown code fences if the model wraps output
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(clean);
}

const OPENAI_BASE = 'https://api.openai.com/v1/chat/completions';
const KPI_MODEL = 'gpt-4o';

async function generateKpiSuggestion({ name, scaleType, appliesTo }) {
  const scaleLabel = scaleType === '1_to_5' ? '1 to 5'
    : scaleType === '1_to_10' ? '1 to 10'
    : scaleType === 'percentage' ? '0 to 100'
    : 'custom';

  const scorePoints = scaleType === '1_to_5' ? [1, 2, 3, 4, 5]
    : scaleType === '1_to_10' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    : scaleType === 'percentage' ? [0, 25, 50, 75, 100]
    : [];

  const prompt = `You are helping design a KPI evaluation rubric for a startup accelerator programme (MEST Africa).

KPI Name: "${name}"
Scale: ${scaleLabel}
Applies to: ${appliesTo}
${scorePoints.length > 0 ? `Score points: ${scorePoints.join(', ')}` : ''}

Return ONLY valid JSON with this exact shape (no markdown, no commentary):
{
  "description": "One sentence describing what this KPI measures and why it matters.",
  "rubric": [
    { "score": <number>, "label": "<2-3 word label>", "description": "<One sentence of what this score level looks like in practice.>" }
  ]
}

Generate a rubric entry for EACH score point. Labels should be concise (e.g. "Vague", "Basic", "Solid", "Strong", "Exceptional"). Descriptions should be specific and actionable for evaluators judging startup teams.`;

  const res = await fetch(OPENAI_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: KPI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(text);
}

async function generateTeamFeedbackLetters({ event, teams, scoreData, insights }) {
  const teamSections = teams.map((team) => {
    const sd = scoreData[team.id] ?? { kpis: [], overallComments: [] };
    const teamInsight = insights?.teamAnalyses?.find(
      (t) => t.teamId === team.id || t.teamName === team.name
    );

    const kpiLines = sd.kpis
      .filter((k) => k.avg !== null || k.comments.length > 0)
      .map((k) => {
        const scaleCtx = k.scaleMax ? ` / ${k.scaleMax}` : '';
        const lines = [`  ${k.name}${k.avg !== null ? ` — avg ${k.avg}${scaleCtx}` : ''}`];
        if (k.comments.length) {
          lines.push(`    Direct feedback:`);
          k.comments.forEach((c) => lines.push(`      • "${c}"`));
        }
        if (k.recommendations.length) {
          lines.push(`    Recommendations:`);
          k.recommendations.forEach((r) => lines.push(`      • "${r}"`));
        }
        return lines.join('\n');
      }).join('\n');

    const insightBlock = teamInsight ? [
      teamInsight.verdict        ? `  Verdict: ${teamInsight.verdict}` : null,
      teamInsight.strengths?.length  ? `  Strengths: ${teamInsight.strengths.join('; ')}` : null,
      teamInsight.improvements?.length ? `  Improvements: ${teamInsight.improvements.join('; ')}` : null,
      teamInsight.recommendation ? `  Key recommendation: ${teamInsight.recommendation}` : null,
      teamInsight.readinessLevel ? `  Readiness: ${teamInsight.readinessLevel.replace(/_/g, ' ')}` : null,
    ].filter(Boolean).join('\n') : null;

    return [
      `TEAM ID: ${team.id}`,
      `TEAM NAME: ${team.name}`,
      team.productIdea ? `Product idea: ${team.productIdea}` : null,
      team.marketFocus ? `Target market: ${team.marketFocus}` : null,
      kpiLines         ? `Evaluation data:\n${kpiLines}` : null,
      sd.overallComments.length
        ? `Overall panel observations:\n${sd.overallComments.map((c) => `  • "${c}"`).join('\n')}`
        : null,
      insightBlock     ? `AI analysis:\n${insightBlock}` : null,
    ].filter(Boolean).join('\n');
  }).join('\n\n---\n\n');

  const prompt = `You are the Programme Director at MEST (Meltwater Entrepreneurial School of Technology), Africa's leading startup accelerator. You are writing official post-evaluation feedback letters to startup teams.

EVENT: ${event.name}

Write a unique, professional, specific, and genuinely useful written feedback letter for EACH team. These letters will be sent directly to the founders.

STRICT RULES:
- Never mention judges, evaluators, or experts in any form — speak as a single unified MEST institutional voice ("we observed", "your team demonstrated", "the panel noted", "feedback highlighted")
- Use scores to calibrate your language: scores ≥70% of scale max = strong performance, 40–69% = developing, <40% = needs significant work — translate into qualitative terms, never state the raw number
- You MAY weave in paraphrased or lightly-edited verbatim observations from the comments/overall notes — but remove any attribution (no "one judge said", no names) — present them as collective MEST observations
- Every specific claim you make MUST be directly traceable to the evaluation data provided — zero fabrication
- Every letter must be completely unique — directly reference that team's specific product, market, and actual evaluation observations — zero generic phrases
- Write exactly 3 paragraphs: (1) overall performance and context, (2) specific strengths with concrete examples drawn from the data, (3) specific areas to develop with clear, actionable guidance grounded in the evaluation
- Tone: authoritative but warm — like a mentor who respects the team enough to be direct and honest
- Open every letter with: "Thank you for your participation in ${event.name}."
- Do NOT include greetings (Dear...), sign-offs, subject lines, or headers — body paragraphs only

TEAM DATA:
${teamSections}

Return ONLY valid JSON (no markdown fences):
{
  "letters": [
    { "teamId": "<exact team id>", "teamName": "<name>", "letter": "<3 paragraphs separated by \\n\\n>" }
  ]
}

Target 200–260 words per letter. Be specific, direct, and useful. Generic startup advice is not acceptable.`;

  const res = await fetch(OPENAI_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: KPI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.65,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  const parsed = JSON.parse(text);
  return parsed.letters ?? [];
}

async function generateSubmissionSummary({ submission, scoringStyle }) {
  const teamBlocks = submission.teamScores.map((ts) => {
    const kpiLines = ts.scores.map((s) => {
      const lines = [`    - ${s.kpi.name}: ${s.score}`];
      if (s.comment) lines.push(`      Comment: "${s.comment}"`);
      if (s.recommendation) lines.push(`      Recommendation: "${s.recommendation}"`);
      return lines.join('\n');
    }).join('\n');

    return [
      `## ${ts.team.name}`,
      ts.overallComment ? `  Overall comment: "${ts.overallComment}"` : null,
      `  KPI scores:\n${kpiLines}`,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const prompt = `You are analyzing a single judge's evaluation from a MEST Africa startup pitch event.

EVALUATOR: ${submission.evaluatorName}
SCORING STYLE (computed): ${scoringStyle} — ${
    scoringStyle === 'strict' ? 'scored below the group average' :
    scoringStyle === 'generous' ? 'scored above the group average' :
    'scored close to the group average'
  }

EVALUATION DATA:
${teamBlocks}

Return ONLY valid JSON matching this exact schema — no markdown, no preamble:
{
  "overallTake": "2–3 sentences on this evaluator's perspective, tone, and what they emphasised across all teams",
  "scoringStyle": "${scoringStyle}",
  "keyThemes": ["3–5 specific themes that appear consistently across their comments"],
  "teamHighlights": [
    { "teamName": "<name>", "observation": "The most notable thing this evaluator said or scored for this team" }
  ],
  "standoutComment": "The single most insightful or impactful thing this evaluator wrote, verbatim if possible"
}

Be specific — reference actual team names, actual scores, actual comments. Do not be generic.`;

  const res = await fetch(OPENAI_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: KPI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(text);
}

module.exports = { generateEvaluationInsights, generateKpiSuggestion, generateSubmissionSummary, generateTeamFeedbackLetters };
