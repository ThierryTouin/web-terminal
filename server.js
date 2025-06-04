// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Importation des modules de commande
const handleLs = require('./commands/ls');
const handleDate = require('./commands/date');
const handleIp = require('./commands/ip');
const handleEcho = require('./commands/echo');
const handleNodeScript = require('./commands/nodeScript');
const tailManager = require('./commands/tailManager'); // Importation des fonctions startTail/stopTail
const handleTopSnapshot = require('./commands/topSnapshot');
const handleScript = require('./commands/scriptExecutor'); 

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const activeProcesses = new Map(); // socket.id -> child

require('dotenv').config();
const SCRIPT_CMD = process.env.SCRIPT_CMD;

const PORT = process.env.PORT || 3002;

// Servir les fichiers statiques du client (index.html, client.js)
app.use(express.static(path.join(__dirname, 'public')));

// Fonction utilitaire pour normaliser les sauts de ligne (peut rester ici car c'est une utilité générale)
function normalizeNewlines(data) {
    return data.replace(/\n(?!\r)/g, '\r\n');
}

io.on('connection', (socket) => {
    console.log('Nouvelle connexion client !');

    socket.emit('terminal:data', 'Bienvenue au terminal simplifié ! Tapez "aide" pour les commandes disponibles.\r\n');

    // Assurez-vous de tuer le processus tail si le client se déconnecte
    socket.on('disconnect', () => {
        console.log('Client déconnecté.');
        tailManager.killCurrentTailProcess(); // Appeler la fonction de nettoyage
    });

    socket.on('script:interrupt', () => {
        console.log(`Socket reçoit le message : script:interrupt`);
        const child = activeProcesses.get(socket.id);
        //console.log(`socket : ${JSON.stringify(child)}`);

        if (child && child.pid) {
            console.log(`child.pid : ${child.pid}`);
            try {
                process.kill(-child.pid, 'SIGINT'); // kill group
                console.log('child killed !');
                socket.emit('terminal:data', 'Script interrompu avec Ctrl+C\n');
            } catch (err) {
                if (err.code === 'ESRCH') {
                    console.warn('Le processus ou groupe n’existe plus (déjà terminé)');
                } else {
                    console.error('Erreur lors du kill :', err);
                }

                console.log('tentative de kill en single !')
                child.kill('SIGINT');
                console.log('child killed !')

            }
        } else {
            socket.emit('terminal:data', 'Aucun script à interrompre\n');
        }


    });

    socket.on('terminal:input', async (input) => {
        const command = input.trim();
        console.log(`Commande reçue : "${command}"`);

        if (command === 'aide') {
            socket.emit('terminal:data', normalizeNewlines('Commandes disponibles :\n'));
            socket.emit('terminal:data', normalizeNewlines('  - ls (liste les fichiers du serveur)\n'));
            socket.emit('terminal:data', normalizeNewlines('  - date (affiche la date du serveur)\n'));
            socket.emit('terminal:data', normalizeNewlines('  - ip (affiche l\'adresse IP du serveur, nécessite `curl ifconfig.me`)\n'));
            socket.emit('terminal:data', normalizeNewlines('  - echo <message> (répète votre message)\n'));
            socket.emit('terminal:data', normalizeNewlines('  - node <fichier.js> (exécute un script Node.js)\n'));
            socket.emit('terminal:data', normalizeNewlines('  - tail -f <fichier> (suivre un fichier log en temps réel)\n'));
            //socket.emit('terminal:data', normalizeNewlines('  - stop-tail (arrêter le processus tail en cours)\n'));
            socket.emit('terminal:data', normalizeNewlines('  - script1 <args> (execute le script définit dans SCRIPT_CMD )\n'));
            socket.emit('terminal:data', normalizeNewlines('  - top-snapshot (affiche un instantané des processus)\n'));
            socket.emit('terminal:data', normalizeNewlines('  - exit (déconnecte le client)\n'));
        } else if (command.startsWith('ls')) { 
            const parts = command.split(' ');
            let targetPath = parts.length > 1 ? parts.slice(1).join(' ') : '.'; 
            handleLs(socket, normalizeNewlines, targetPath); 
        } else if (command === 'date') {
            handleDate(socket, normalizeNewlines);
        } else if (command.startsWith('echo ')) {
            const message = command.substring(5);
            handleEcho(socket, normalizeNewlines, message);
        } else if (command === 'ip') {
            handleIp(socket, normalizeNewlines);
        } else if (command.startsWith('node ')) {
            const scriptPath = command.substring(5).trim();
            handleNodeScript(socket, normalizeNewlines, scriptPath, __dirname);
        } else if (command.startsWith('tail -f ')) {
            const filePath = command.substring('tail -f '.length).trim();
            const child = await tailManager.startTail(socket, normalizeNewlines, filePath, false);

            activeProcesses.set(socket.id, child);

            child.on('close', () => {
                activeProcesses.delete(socket.id);
            });            

        // } else if (command === 'stop-tail') {
        //     tailManager.stopTail(socket, normalizeNewlines);
        } else if (command === 'top-snapshot') {
            handleTopSnapshot(socket, normalizeNewlines);
        } else if (command.startsWith('script1')) {
            const args = command.substring('script1'.length).trim();
            const fullAliasCommand = `${SCRIPT_CMD} ${args}`;
            const child = handleScript(socket, normalizeNewlines, fullAliasCommand);

            activeProcesses.set(socket.id, child);

            child.on('close', () => {
                activeProcesses.delete(socket.id);
            });
        } else if (command === 'exit') {
            socket.emit('terminal:data', 'Déconnexion...\r\n');
            socket.disconnect();

            const child = activeProcesses.get(socket.id);
            if (child) process.kill(-child.pid, 'SIGINT'); 
            activeProcesses.delete(socket.id);            

        } else {
            socket.emit('terminal:data', normalizeNewlines(`Commande inconnue: "${command}". Tapez "aide" pour les commandes disponibles.\n`));
        }
    });

    socket.on('terminal:resize', ({ cols, rows }) => {
        console.log(`Client demande un redimensionnement à ${cols}x${rows}`);
    });
});

server.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});