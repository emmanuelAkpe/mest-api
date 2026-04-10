async function extractPdf(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return data.text?.trim() ?? '';
}

module.exports = { extractPdf };
