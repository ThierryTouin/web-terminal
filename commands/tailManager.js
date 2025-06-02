// commands/tailManager.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let currentTailProcess = null;
let currentGreppedTailProcess = null;
let currentTailFilePath = null;

const startTail = async (socket, normalizeNewlines, userInputCommand, useFilter = true) => {
    if (currentTailProcess) {
        socket.emit('terminal:data', normalizeNewlines(`Un processus 'tail -f' est déjà en cours pour ${currentTailFilePath}. Arrêtez-le avec 'stop-tail' d'abord.\n`));
        return;
    }

    let filePath = userInputCommand;
    console.log(`Chemin du fichier extrait: ${filePath}`);

    if (!filePath) {
        socket.emit('terminal:data', normalizeNewlines(`Erreur: Le chemin du fichier est manquant pour la commande 'tail -f'.\n`));
        return;
    }

    try {
        let absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        await fs.promises.access(absoluteFilePath, fs.constants.R_OK);
        filePath = absoluteFilePath;
    } catch (err) {
        socket.emit('terminal:data', normalizeNewlines(`Erreur: Le fichier '${filePath}' n'existe pas ou n'est pas lisible. Détails: ${err.message}\n`));
        return;
    }

    const commandDesc = useFilter ? `'tail -f ${filePath} | grep -E "ERROR|WARN|DEBUG"'` : `'tail -f ${filePath}'`;
    socket.emit('terminal:data', normalizeNewlines(`Démarrage de ${commandDesc}...\n`));
    socket.emit('terminal:data', normalizeNewlines(`Tapez 'stop-tail' pour l'arrêter.\n`));

    const commonEnv = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' };

    const tailChild = spawn('tail', ['-n', '10', '-f', filePath], {
        env: commonEnv,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    currentTailProcess = tailChild;
    currentTailFilePath = filePath;

    if (useFilter) {
        const grepArgs = ['--color=always', '-E', "ERROR|WARN|DEBUG"];
        const grepChild = spawn('grep', grepArgs, {
            env: commonEnv,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        currentGreppedTailProcess = grepChild;
        tailChild.stdout.pipe(grepChild.stdin);

        grepChild.stdout.on('data', (data) => {
            socket.emit('terminal:data', normalizeNewlines(data.toString()));
        });

        grepChild.stderr.on('data', (data) => {
            socket.emit('terminal:data', `Erreur 'grep': ${normalizeNewlines(data.toString())}`);
        });

        grepChild.on('close', (code) => {
            if (currentGreppedTailProcess === grepChild) {
                socket.emit('terminal:data', normalizeNewlines(`\n'grep' terminé avec le code ${code}.\n`));
                currentGreppedTailProcess = null;
                if (currentTailProcess) {
                    currentTailProcess.kill();
                    currentTailProcess = null;
                    currentTailFilePath = null;
                }
            }
        });

        grepChild.on('error', (err) => {
            socket.emit('terminal:data', normalizeNewlines(`Erreur grep : ${err.message}\n`));
            if (currentTailProcess) currentTailProcess.kill();
            currentTailProcess = null;
            currentGreppedTailProcess = null;
        });

    } else {
        tailChild.stdout.on('data', (data) => {
            socket.emit('terminal:data', normalizeNewlines(data.toString()));
        });
    }

    tailChild.stderr.on('data', (data) => {
        socket.emit('terminal:data', `Erreur 'tail': ${normalizeNewlines(data.toString())}`);
    });

    tailChild.on('error', (err) => {
        socket.emit('terminal:data', normalizeNewlines(`Erreur lors du démarrage de 'tail': ${err.message}\n`));
        currentTailProcess = null;
        currentTailFilePath = null;
    });

    tailChild.on('close', (code) => {
        socket.emit('terminal:data', normalizeNewlines(`\n'tail -f' terminé avec le code ${code}.\n`));
        currentTailProcess = null;
        currentTailFilePath = null;
        if (currentGreppedTailProcess) {
            currentGreppedTailProcess.kill();
            currentGreppedTailProcess = null;
        }
    });
};

const stopTail = (socket, normalizeNewlines) => {
    let message = '';
    if (currentTailProcess) {
        message += `Arrêt du processus 'tail -f' pour ${currentTailFilePath}...\n`;
        currentTailProcess.kill();
        currentTailProcess = null;
        currentTailFilePath = null;
    }
    if (currentGreppedTailProcess) {
        message += `Arrêt du processus 'grep' associé...\n`;
        currentGreppedTailProcess.kill();
        currentGreppedTailProcess = null;
    }
    if (!message) {
        message = `Aucun processus 'tail -f' ou 'grep' n'est en cours.\n`;
    }
    socket.emit('terminal:data', normalizeNewlines(message));
};

const killCurrentTailProcess = () => {
    if (currentTailProcess) {
        console.log(`Tuer le processus 'tail' (PID: ${currentTailProcess.pid})`);
        currentTailProcess.kill();
        currentTailProcess = null;
        currentTailFilePath = null;
    }
    if (currentGreppedTailProcess) {
        console.log(`Tuer le processus 'grep' (PID: ${currentGreppedTailProcess.pid})`);
        currentGreppedTailProcess.kill();
        currentGreppedTailProcess = null;
    }
};

module.exports = {
    startTail,
    stopTail,
    killCurrentTailProcess
};
