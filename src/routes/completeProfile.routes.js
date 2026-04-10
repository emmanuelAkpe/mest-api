const express = require('express');
const { getForm, submit } = require('../controllers/completeProfile.controller');

const router = express.Router();

router.get('/:token', getForm);
router.patch('/:token', submit);

module.exports = router;
