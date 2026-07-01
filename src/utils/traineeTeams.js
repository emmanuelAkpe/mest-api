const Team = require('../models/Team.model');

// Resolve every non-dissolved team a trainee belongs to, sorted by their event's
// start date (most recent first). A trainee accumulates one team per event they
// take part in, so the portal must treat "current team" as the newest — never
// whatever Mongo returns first (which is the oldest inserted, i.e. their old team).
async function resolveTraineeTeams(traineeId) {
  const teams = await Team.find({ 'members.trainee': traineeId, isDissolved: false })
    .populate('event', 'name type startDate endDate')
    .sort({ createdAt: -1 });

  return teams.sort((a, b) => {
    const aDate = a.event?.startDate ? new Date(a.event.startDate).getTime() : 0;
    const bDate = b.event?.startDate ? new Date(b.event.startDate).getTime() : 0;
    return bDate - aDate;
  });
}

// Pick the requested team from a trainee's teams, or default to the most recent.
// Returns null only when the trainee has no teams at all.
function pickTeam(teams, requestedTeamId) {
  if (teams.length === 0) return null;
  if (requestedTeamId) {
    const match = teams.find((t) => t._id.toString() === requestedTeamId.toString());
    if (match) return match;
  }
  return teams[0];
}

// Lightweight summary for the portal's team switcher.
function summarizeTeams(teams, selectedTeamId) {
  return teams.map((t) => ({
    id: t._id,
    name: t.name,
    event: t.event ? { id: t.event._id, name: t.event.name, type: t.event.type, startDate: t.event.startDate } : null,
    isCurrent: t._id.toString() === selectedTeamId?.toString(),
  }));
}

module.exports = { resolveTraineeTeams, pickTeam, summarizeTeams };
