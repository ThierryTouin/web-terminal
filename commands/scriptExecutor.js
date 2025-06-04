const { spawn } = require('child_process');
const path = require('path');

module.exports = (socket, normalizeNewlines, fullCommand) => {
    const argsArray = fullCommand.trim().split(/\s+/);
    const scriptPath = argsArray.shift();

    const resolvedScriptPath = path.isAbsolute(scriptPath)
        ? scriptPath
        : path.resolve(process.cwd(), scriptPath);

    const child = spawn(resolvedScriptPath, argsArray, {
        env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true
    });

    socket.emit('terminal:data', normalizeNewlines(`Exécution du script : ${resolvedScriptPath} ${argsArray.join(' ')}\n`));

    child.stdout.on('data', (data) => {
        socket.emit('terminal:data', normalizeNewlines(data.toString()));
    });

    child.stderr.on('data', (data) => {
        socket.emit('terminal:data', normalizeNewlines(data.toString()));
    });

    child.on('close', (code) => {
        socket.emit('terminal:data', normalizeNewlines(`\nScript terminé avec le code ${code}.\n`));
    });

    child.on('error', (err) => {
        socket.emit('terminal:data', normalizeNewlines(`Erreur lors de l'exécution du script : ${err.message}\n`));
    });

    return child; // 🔥 Renvoie le process pour pouvoir l’arrêter plus tard
};
