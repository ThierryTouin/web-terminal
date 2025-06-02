// commands/nodeScript.js
const { spawn } = require('child_process');
const path = require('path');

module.exports = (socket, normalizeNewlines, scriptPath, projectDir) => {
    const fullScriptPath = path.join(projectDir, scriptPath);

    const child = spawn('node', [fullScriptPath]);

    child.stdout.on('data', (data) => {
        socket.emit('terminal:data', normalizeNewlines(data.toString()));
    });

    child.stderr.on('data', (data) => {
        socket.emit('terminal:data', `Erreur d'exécution de script: ${normalizeNewlines(data.toString())}`);
    });

    child.on('close', (code) => {
        socket.emit('terminal:data', normalizeNewlines(`\nScript Node.js "${scriptPath}" terminé avec le code ${code}\n`));
    });
    child.on('error', (err) => {
        socket.emit('terminal:data', normalizeNewlines(`Erreur: Assurez-vous que le fichier existe et que Node.js est installé. ${err.message}\n`));
    });
};