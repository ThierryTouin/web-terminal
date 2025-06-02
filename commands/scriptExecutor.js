const { spawn } = require('child_process');
const path = require('path');

module.exports = async (socket, normalizeNewlines, fullCommand) => {
    // Découpe le fullCommand en tableau : [scriptPath, arg1, arg2, ...]
    const argsArray = fullCommand.trim().split(/\s+/);
    const scriptPath = argsArray.shift();

    // Vérifie que le chemin est absolu ou le rend relatif
    const resolvedScriptPath = path.isAbsolute(scriptPath)
        ? scriptPath
        : path.resolve(process.cwd(), scriptPath);

    const child = spawn(resolvedScriptPath, argsArray, {
        env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' },
        stdio: ['pipe', 'pipe', 'pipe']
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
};
