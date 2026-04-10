const { Router } = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/authenticate');
const {
  create, listByTeam, deleteLink,
  getPublic, requestAccess, verifyAccess, submitFile, deleteSubmission, adminDeleteSubmission, getTeamPortal,
} = require('../controllers/submissionLink.controller');

const memoryStorage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

// Auth-gated
const adminRouter = Router();
adminRouter.post('/', authenticate, create);
adminRouter.delete('/:id', authenticate, deleteLink);
adminRouter.delete('/:id/submissions/:submissionId', authenticate, adminDeleteSubmission);

// Team-scoped: GET /teams/:id/submission-links
const teamRouter = Router({ mergeParams: true });
teamRouter.get('/', authenticate, listByTeam);

// Public token-based
const publicRouter = Router({ mergeParams: true });
publicRouter.get('/', getPublic);
publicRouter.get('/portal', getTeamPortal);
publicRouter.post('/request-access', requestAccess);
publicRouter.post('/verify-access', verifyAccess);
publicRouter.post('/submissions', memoryStorage.single('file'), submitFile);
publicRouter.delete('/submissions/:submissionId', deleteSubmission);

module.exports = { adminRouter, teamRouter, publicRouter };
