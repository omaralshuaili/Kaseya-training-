module.exports.sendResponse =  function(res, statusCode, message, data = null) {
    res.status(statusCode).json({
        message: message,
        data: data
    });
}

