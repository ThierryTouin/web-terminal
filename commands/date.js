// commands/date.js
module.exports = (socket, normalizeNewlines) => {
    socket.emit('terminal:data', normalizeNewlines(`Date du serveur : ${new Date().toLocaleString()}\n`));
};