// commands/topSnapshot.js
const { spawn } = require('child_process');

module.exports = (socket, normalizeNewlines) => {
    socket.emit('terminal:data', normalizeNewlines('Collecte des informations sur les processus...\n'));

    const cmd = process.platform === 'win32' ? 'tasklist' : 'top';
    const args = process.platform === 'win32' ? [] : ['-bn1'];

    const child = spawn(cmd, args, {
        env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' }
    });

    let output = '';
    child.stdout.on('data', (data) => {
        output += data.toString();
    });

    child.stderr.on('data', (data) => {
        socket.emit('terminal:data', `Erreur 'top-snapshot': ${normalizeNewlines(data.toString())}`);
    });

    child.on('close', (code) => {
        socket.emit('terminal:data', normalizeNewlines(output));
        socket.emit('terminal:data', normalizeNewlines(`\nCommande "top-snapshot" terminée avec le code ${code}\n`));
    });
    child.on('error', (err) => {
        socket.emit('terminal:data', normalizeNewlines(`Erreur lors du démarrage de "top-snapshot": ${err.message}\n`));
    });
};