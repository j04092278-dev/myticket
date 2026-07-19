const xss = require('xss');

function sanitizeInput(req, res, next) {
  if (req.body) {
    for (let key in req.body) {
      if (typeof req.body[key] === 'string') req.body[key] = xss(req.body[key]);
    }
  }
  next();
}

module.exports = sanitizeInput;