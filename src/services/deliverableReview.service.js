const { extractPdf } = require('./extractors/pdf');
const { extractDocx } = require('./extractors/docx');
const { extractOffice } = require('./extractors/office');
const { extractUrl } = require('./extractors/url');
const { logger } = require('../utils/logger');

const OPENAI_BASE = 'https://api.openai.com/v1/chat/completions';
const REVIEW_MODEL = 'gpt-4o';

const EXTRACTABLE_TYPES = new Set(['pdf', 'slides', 'spreadsheet', 'document', 'link', 'demo']);

async function downloadBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

async function extractContent(submission) {
  const { fileType, url, filename } = submission;

  try {
    switch (fileType) {
      case 'pdf': {
        const buf = await downloadBuffer(url);
        return await extractPdf(buf);
      }
      case 'document': {
        const buf = await downloadBuffer(url);
        return await extractDocx(buf);
      }
      case 'slides':
      case 'spreadsheet': {
        const buf = await downloadBuffer(url);
        return await extractOffice(buf, filename || `file.${fileType === 'slides' ? 'pptx' : 'xlsx'}`);
      }
      case 'link':
      case 'demo':
        return await extractUrl(url);
      default:
        return null;
    }
  } catch (err) {
    logger.warn('Extraction failed', { fileType, url, err: err?.message });
    return null;
  }
}

async function generateDeliverableReview({ deliverable, links }) {
  const teamBlocks = [];

  for (const link of links) {
    const team = link.team;
    const teamName = team?.name ?? 'Unknown';
    const teamId = team?._id?.toString() ?? link.team?.toString();

    const submissionParts = [];
    const skippedTypes = [];

    for (const sub of link.submissions ?? []) {
      if (!EXTRACTABLE_TYPES.has(sub.fileType)) {
        skippedTypes.push(sub.fileType);
        continue;
      }
      const content = await extractContent(sub);
      if (content?.length > 50) {
        submissionParts.push(`[${sub.fileType}] "${sub.label || sub.filename || sub.url}"\n${content.slice(0, 3000)}`);
      } else {
        skippedTypes.push(sub.fileType);
      }
    }

    teamBlocks.push({
      teamId,
      teamName,
      submissionText: submissionParts.join('\n\n---\n\n'),
      skippedTypes,
      noContent: submissionParts.length === 0,
    });
  }

  const teamsWithContent = teamBlocks.filter(t => !t.noContent);

  if (teamsWithContent.length === 0) {
    return {
      generatedAt: new Date(),
      model: REVIEW_MODEL,
      teams: teamBlocks.map(t => ({
        teamId: t.teamId,
        teamName: t.teamName,
        summary: 'No extractable content available for review.',
        strengths: [],
        improvements: [],
        score: null,
        redFlags: [],
        skippedTypes: t.skippedTypes,
        noContentWarning: true,
      })),
    };
  }

  const teamInputs = teamsWithContent.map(t =>
    `Team: ${t.teamName} (id: ${t.teamId})\nSubmissions:\n${t.submissionText}`
  ).join('\n\n========\n\n');

  const systemPrompt = `You are a startup programme reviewer for MEST (Meltwater Entrepreneurial School of Technology).
Analyse each team's submitted deliverables for the deliverable titled: "${deliverable.title}".
Be specific, evidence-based, and constructive. Reference actual content from the submissions.
Return ONLY a JSON object with this exact shape — no markdown, no code blocks:
{
  "teams": [
    {
      "teamId": "string",
      "teamName": "string",
      "summary": "2-3 sentence overall assessment",
      "strengths": ["specific strength 1", "specific strength 2"],
      "improvements": ["specific improvement area 1", "specific improvement area 2"],
      "score": 7,
      "redFlags": ["any major concern, or empty array"]
    }
  ]
}
Score is 1-10. Only review teams included in the input.`;

  const body = {
    model: REVIEW_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: teamInputs },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4096,
  };

  const res = await fetch(OPENAI_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const parsed = JSON.parse(json.choices[0].message.content);

  const reviewedMap = {};
  for (const t of parsed.teams ?? []) {
    reviewedMap[t.teamId] = t;
  }

  const allTeamReviews = teamBlocks.map(t => {
    if (t.noContent) {
      return {
        teamId: t.teamId,
        teamName: t.teamName,
        summary: 'No extractable content available for review.',
        strengths: [],
        improvements: [],
        score: null,
        redFlags: [],
        skippedTypes: t.skippedTypes,
        noContentWarning: true,
      };
    }
    const r = reviewedMap[t.teamId] ?? {};
    return {
      teamId: t.teamId,
      teamName: t.teamName,
      summary: r.summary ?? '',
      strengths: r.strengths ?? [],
      improvements: r.improvements ?? [],
      score: r.score ?? null,
      redFlags: r.redFlags ?? [],
      skippedTypes: t.skippedTypes,
      noContentWarning: false,
    };
  });

  return {
    generatedAt: new Date(),
    model: REVIEW_MODEL,
    teams: allTeamReviews,
  };
}

module.exports = { generateDeliverableReview };
