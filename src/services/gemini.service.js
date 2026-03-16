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

module.exports = { generateEvaluationInsights };
