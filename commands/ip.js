// commands/ip.js
const { spawn } = require('child_process');

module.exports = (socket, normalizeNewlines) => {
    const child = spawn('curl', ['ifconfig.me']);

    child.stdout.on('data', (data) => {
        socket.emit('terminal:data', normalizeNewlines(`Adresse IP : ${data.toString().trim()}\n`));
    });
    child.stderr.on('data', (data) => {
        socket.emit('terminal:data', `Erreur: ${normalizeNewlines(data.toString())}\n`);
    });
    child.on('error', (err) => {
        socket.emit('terminal:data', normalizeNewlines(`Erreur: Assurez-vous que 'curl' est installé. ${err.message}\n`));
    });
};