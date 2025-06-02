// commands/echo.js
module.exports = (socket, normalizeNewlines, message) => {
    socket.emit('terminal:data', normalizeNewlines(`${message}\n`));
};