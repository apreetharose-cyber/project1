function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Something went wrong. Please try again.' : err.message;

  if (statusCode === 500) {
    console.error(err); // server-side only — never sent to client
  }

  res.status(statusCode).json({ success: false, message });
}
module.exports = errorHandler;