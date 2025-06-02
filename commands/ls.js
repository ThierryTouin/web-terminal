// commands/ls.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs'); // Ajout pour vérifier le chemin

module.exports = async (socket, normalizeNewlines, targetPath) => {
    let effectivePath = targetPath || '.'; // Utilise le chemin fourni ou '.' par défaut

    // Résoudre le chemin pour qu'il soit absolu par rapport au répertoire du serveur
    // Si l'utilisateur tape `ls dossier/`, on veut que ça fonctionne.
    // Si l'utilisateur tape `ls /var/log/`, on veut que ça fonctionne aussi.
    if (!path.isAbsolute(effectivePath)) {
        effectivePath = path.join(process.cwd(), effectivePath); // process.cwd() est le répertoire de travail actuel du processus Node.js
    }

    // Vérifier si le chemin existe et est un répertoire
    try {
        const stats = await fs.promises.stat(effectivePath);
        if (!stats.isDirectory()) {
            socket.emit('terminal:data', normalizeNewlines(`Erreur: '${targetPath}' n'est pas un répertoire ou n'existe pas.\n`));
            return;
        }
    } catch (err) {
        socket.emit('terminal:data', normalizeNewlines(`Erreur: Impossible d'accéder au chemin '${targetPath}'. Détails: ${err.message}\n`));
        return;
    }

    const cmd = process.platform === 'win32' ? 'cmd.exe' : 'ls';
    // Ajoute le chemin cible aux arguments de la commande
    const args = process.platform === 'win32' ? ['/c', 'dir', effectivePath] : ['--color=always', effectivePath];

    const child = spawn(cmd, args, {
        // Le cwd ici est le répertoire de travail du *processus enfant*.
        // Comme nous passons un chemin absolu ou relatif calculé, il n'est plus strictement nécessaire
        // de le définir à __dirname, mais le laisser ne nuit pas.
        // On peut le laisser au défaut du shell parent ou le retirer.
        // Pour les chemins absolus, le cwd n'a pas d'impact.
        // Pour les chemins relatifs, il est important.
        // Puisque nous construisons `effectivePath` pour être complet, on peut le laisser.
        // En fait, le `cwd` du spawn ici pourrait être simplement `process.cwd()` ou omis
        // si l'on passe des chemins absolus à `ls`.
        // Pour la simplicité et la compatibilité, on garde __dirname ou process.cwd() ici.
        // J'ai mis process.cwd() pour qu'il corresponde au répertoire de travail du serveur.
        cwd: process.cwd(), // Assurez-vous que le répertoire de travail du spawn est cohérent
        env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' }
    });

    child.stdout.on('data', (data) => {
        socket.emit('terminal:data', normalizeNewlines(data.toString()));
    });

    child.stderr.on('data', (data) => {
        socket.emit('terminal:data', `Erreur: ${normalizeNewlines(data.toString())}`);
    });

    child.on('close', (code) => {
        socket.emit('terminal:data', normalizeNewlines(`\nCommande "ls ${targetPath || ''}" terminée avec le code ${code}\n`));
    });
    child.on('error', (err) => {
        socket.emit('terminal:data', normalizeNewlines(`Erreur d'exécution de la commande "ls ${targetPath || ''}": ${err.message}\n`));
    });
};