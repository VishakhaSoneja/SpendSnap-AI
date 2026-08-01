const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs an express-validator chain, then returns the first field errors
 * as a 400 response in a consistent shape:
 * { success:false, message, errors:[{ field, message }] }
 */
const validate = (validations) => [
  ...validations,
  (req, _res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const errors = result.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));

    return next(new ApiError(400, 'Validation failed', errors));
  },
];

module.exports = validate;
