'use strict';

const isMacOS = process.platform === 'darwin';

function log(msg) {
  process.stderr.write(msg + '\n');
}

module.exports = { isMacOS, log };
