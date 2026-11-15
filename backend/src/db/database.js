'use strict';

if (process.env.DATABASE_ENGINE === 'postgres') {
  module.exports = require('./database-postgres');
} else {
  module.exports = require('./database-sqlite');
}
