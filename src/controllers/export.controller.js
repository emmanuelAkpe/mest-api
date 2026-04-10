const EvaluationSubmission = require('../models/EvaluationSubmission.model');
const SubmissionLink = require('../models/SubmissionLink.model');
const Trainee = require('../models/Trainee.model');
const Team = require('../models/Team.model');
const Deliverable = require('../models/Deliverable.model');
const { sendError, ERROR_CODES } = require('../utils/response');

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? '' : String(v).replace(/"/g, '""');
    return /[,"\n\r]/.test(s) ? `"${s}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ].join('\n');
}

function sendCsv(res, filename, rows) {
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

async function exportEvaluationResults(req, res, next) {
  try {
    const { eventId } = req.params;
    const submissions = await EvaluationSubmission.find({ event: eventId })
      .populate('team', 'name')
      .populate('kpi', 'name weight');

    const rows = submissions.map(s => ({
      team: typeof s.team === 'object' ? s.team.name : s.team,
      evaluator: s.evaluatorName,
      kpi: typeof s.kpi === 'object' ? s.kpi.name : s.kpi,
      score: s.score,
      normalizedScore: s.normalizedScore ?? '',
      comment: s.comment ?? '',
      submittedAt: s.createdAt ? new Date(s.createdAt).toISOString() : '',
    }));

    sendCsv(res, `evaluation-results-${eventId}.csv`, rows);
  } catch (err) {
    next(err);
  }
}

async function exportSubmissions(req, res, next) {
  try {
    const { eventId } = req.params;
    const links = await SubmissionLink.find({ event: eventId })
      .populate('team', 'name')
      .populate('deliverable', 'title');

    const rows = [];
    for (const link of links) {
      const teamName = typeof link.team === 'object' ? link.team.name : '';
      const deliverableTitle = link.deliverable ? (typeof link.deliverable === 'object' ? link.deliverable.title : '') : '(manual)';
      if (link.submissions.length === 0) {
        rows.push({
          team: teamName,
          deliverable: deliverableTitle,
          linkTitle: link.title,
          status: link.status,
          fileType: '',
          label: '',
          url: '',
          submittedBy: '',
          submittedAt: '',
          deadline: new Date(link.deadline).toISOString(),
        });
      } else {
        for (const sub of link.submissions) {
          rows.push({
            team: teamName,
            deliverable: deliverableTitle,
            linkTitle: link.title,
            status: link.status,
            fileType: sub.fileType,
            label: sub.label ?? sub.filename ?? '',
            url: sub.url,
            submittedBy: sub.submittedByEmail,
            submittedAt: new Date(sub.submittedAt).toISOString(),
            deadline: new Date(link.deadline).toISOString(),
          });
        }
      }
    }

    sendCsv(res, `submissions-${eventId}.csv`, rows);
  } catch (err) {
    next(err);
  }
}

async function exportTrainees(req, res, next) {
  try {
    const { cohortId } = req.params;
    const trainees = await Trainee.find({ cohort: cohortId }).select(
      'firstName lastName email country technicalBackground aiSkillLevel entryScore isActive createdAt'
    );

    // Get team info for each trainee
    const teams = await Team.find({ cohort: cohortId }).populate('members.trainee', '_id').select('name members event');
    const traineeTeamMap = {};
    for (const team of teams) {
      for (const m of team.members) {
        const tid = m.trainee?._id?.toString() ?? m.trainee?.toString();
        if (tid) traineeTeamMap[tid] = team.name;
      }
    }

    const rows = trainees.map(t => ({
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      country: t.country ?? '',
      team: traineeTeamMap[t._id.toString()] ?? 'Unassigned',
      technicalBackground: t.technicalBackground ?? '',
      aiSkillLevel: t.aiSkillLevel ?? '',
      entryScore: t.entryScore ?? '',
      isActive: t.isActive ? 'Yes' : 'No',
      joinedAt: t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : '',
    }));

    sendCsv(res, `trainees-${cohortId}.csv`, rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { exportEvaluationResults, exportSubmissions, exportTrainees };
