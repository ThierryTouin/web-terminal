// public/client.js
document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const terminalContainer = document.getElementById('terminal-container');

    const term = new Terminal({
        cursorBlink: true,
        macOptionIsMeta: true,
        scrollback: 1000,
        theme: {
            background: '#000000',
            foreground: '#ffffff',
            cursor: '#ffffff',
            selectionBackground: '#5f6368',
            black: '#000000',
            red: '#cc3333',
            green: '#33cc33',
            yellow: '#cccc33',
            blue: '#3333cc',
            magenta: '#cc33cc',
            cyan: '#33cccc',
            white: '#cccccc',
            brightBlack: '#666666',
            brightRed: '#ff6666',
            brightGreen: '#66ff66',
            brightYellow: '#ffff66',
            brightBlue: '#6666ff',
            brightMagenta: '#ff66ff',
            brightCyan: '#66ffff',
            brightWhite: '#ffffff'
        }
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalContainer);
    fitAddon.fit();

    let inputBuffer = '';
    // --- NOUVEAU : Historique des commandes ---
    const commandHistory = [];
    let historyIndex = -1; // -1 signifie que nous ne sommes pas en train de naviguer dans l'historique

    // Fonction pour effacer la ligne courante dans le terminal (utile pour l'historique)
    function clearCurrentLine() {
        term.write('\x1b[2K\r'); // Efface la ligne complète et ramène le curseur au début
    }

    // Gérer les données reçues du serveur
    socket.on('terminal:data', (data) => {
        term.write(data);
    });

// public/client.js (extrait de term.onData)

    // Gérer les saisies de l'utilisateur
    term.onData((data) => {
        const charCode = data.charCodeAt(0);

        // Détection des flèches Haut et Bas
        if (charCode === 27) { // ASCII 27 est le début d'une séquence d'échappement (pour les flèches)
            // Nous ne faisons PAS un term.write(data) ici pour les séquences d'échappement complètes
            // car xterm.js les interprète directement (cursor movement, etc.).
            // Si vous le faites, cela affichera des caractères bizarres comme `^[[A` dans le terminal.

            // Séquence de flèche Haut: \x1b[A
            // Séquence de flèche Bas: \x1b[B
            if (data === '\x1b[A') { // Flèche Haut
                if (historyIndex === -1) {
                    historyIndex = commandHistory.length - 1; // Commence par la dernière commande
                } else if (historyIndex > 0) {
                    historyIndex--;
                }

                if (historyIndex >= 0) {
                    clearCurrentLine();
                    inputBuffer = commandHistory[historyIndex];
                    term.write(inputBuffer);
                }
                return; // Ne pas traiter comme une entrée normale
            } else if (data === '\x1b[B') { // Flèche Bas
                if (historyIndex !== -1 && historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    clearCurrentLine();
                    inputBuffer = commandHistory[historyIndex];
                    term.write(inputBuffer);
                } else {
                    // Si on est à la fin de l'historique ou qu'on n'est pas en navigation, on efface la ligne
                    historyIndex = -1; // Réinitialiser pour éviter de boucler sur la dernière commande
                    clearCurrentLine();
                    inputBuffer = '';
                }
                return; // Ne pas traiter comme une entrée normale
            }
            // Si c'est une autre séquence d'échappement non gérée (ex: F1, F2), on l'ignore
            return;
        }

        if (data === '\x03') { // Ctrl+C
            console.log('script:interrupt');
            socket.emit('script:interrupt');
            return;
        // Gérer la touche Entrée
        } else if (data === '\r') {
            term.write(data); // Echo le retour chariot pour passer à la ligne
            if (inputBuffer.length > 0) { // N'ajoute pas de commandes vides à l'historique
                commandHistory.push(inputBuffer);
                // Optionnel: Limiter la taille de l'historique, ex: 100 commandes
                if (commandHistory.length > 100) {
                    commandHistory.shift(); // Supprime la plus ancienne
                }
            }
            socket.emit('terminal:input', inputBuffer);
            inputBuffer = ''; // Réinitialiser le buffer
            historyIndex = -1; // Réinitialiser l'index de l'historique
        } else if (data === '\x7F') { // Touche Backspace (ASCII 127)
            if (inputBuffer.length > 0) {
                inputBuffer = inputBuffer.slice(0, -1);
                term.write('\x1b[D'); // Déplacer le curseur à gauche
                term.write('\x1b[K'); // Effacer jusqu'à la fin de la ligne
            }
        } else {
            // C'est un caractère normal : l'ajouter au buffer et l'afficher
            inputBuffer += data;
            term.write(data); // <--- C'est cette ligne qui était manquante ou mal placée !
        }
    });

    // Gérer le redimensionnement de la fenêtre du navigateur
    window.addEventListener('resize', () => {
        fitAddon.fit();
        socket.emit('terminal:resize', {
            cols: term.cols,
            rows: term.rows
        });
    });

    // Envoyer la taille initiale du terminal au serveur
    socket.emit('terminal:resize', {
        cols: term.cols,
        rows: term.rows
    });

    term.focus(); // Mettre le focus sur le terminal
});