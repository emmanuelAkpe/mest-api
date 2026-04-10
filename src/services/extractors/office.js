async function extractOffice(buffer, filename) {
  const officeParser = require('officeparser');
  return new Promise((resolve, reject) => {
    officeParser.parseOfficeAsync(buffer, { outputErrorToConsole: false, newlineDelimiter: ' ', filename })
      .then(text => resolve(text?.trim() ?? ''))
      .catch(reject);
  });
}

module.exports = { extractOffice };
