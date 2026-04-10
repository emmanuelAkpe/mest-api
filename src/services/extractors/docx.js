async function extractDocx(buffer) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value?.trim() ?? '';
}

module.exports = { extractDocx };
