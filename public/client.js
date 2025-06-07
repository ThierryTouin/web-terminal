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

    // --- Historique des commandes dans localStorage ---
    const HISTORY_KEY = 'terminal_command_history';
    let commandHistory = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    let historyIndex = -1;

    function saveHistory() {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(commandHistory));
    }

    function clearCurrentLine() {
        term.write('\x1b[2K\r');
    }

    function replaceCurrentCommand(newCommand) {
        clearCurrentLine();
        inputBuffer = newCommand;
        term.write(inputBuffer);
    }

    socket.on('terminal:data', (data) => {
        term.write(data);
    });

    term.onData((data) => {
        const charCode = data.charCodeAt(0);

        if (charCode === 27) {
            if (data === '\x1b[A') { // ↑
                if (historyIndex === -1) {
                    historyIndex = commandHistory.length - 1;
                } else if (historyIndex > 0) {
                    historyIndex--;
                }

                if (historyIndex >= 0) {
                    replaceCurrentCommand(commandHistory[historyIndex]);
                }
                return;
            } else if (data === '\x1b[B') { // ↓
                if (historyIndex !== -1 && historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    replaceCurrentCommand(commandHistory[historyIndex]);
                } else {
                    historyIndex = -1;
                    replaceCurrentCommand('');
                }
                return;
            }
            return;
        }

        if (data === '\x03') { // Ctrl+C
            console.log('script:interrupt');
            socket.emit('script:interrupt');
            return;
        } else if (data === '\r') { // Entrée
            term.write(data);
            if (inputBuffer.length > 0) {
                commandHistory.push(inputBuffer);
                if (commandHistory.length > 100) commandHistory.shift();
                saveHistory();
            }
            // Commandes spéciales côté client (ne pas envoyer au serveur)
            if (inputBuffer === 'history') {
                term.write('\r\nCommand History:\r\n');
                commandHistory.forEach((cmd, index) => {
                    term.write(`  ${index + 1}: ${cmd}\r\n`);
                });
            } else {
                // Envoi normal au serveur
                socket.emit('terminal:input', inputBuffer);
            }

            inputBuffer = '';
            historyIndex = -1;
        } else if (data === '\x7F') { // Backspace
            if (inputBuffer.length > 0) {
                inputBuffer = inputBuffer.slice(0, -1);
                term.write('\x1b[D');
                term.write('\x1b[K');
            }
        } else {
            inputBuffer += data;
            term.write(data);
        }
    });

    window.addEventListener('resize', () => {
        fitAddon.fit();
        socket.emit('terminal:resize', {
            cols: term.cols,
            rows: term.rows
        });
    });

    socket.emit('terminal:resize', {
        cols: term.cols,
        rows: term.rows
    });

    term.focus();
});
