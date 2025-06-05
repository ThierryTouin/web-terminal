// logger.js

// Importation dynamique de chalk
// Nous allons devoir le gérer de manière asynchrone ou le faire charger au démarrage.
// Pour un logger, il est préférable de le charger au démarrage ou de s'assurer qu'il est disponible.

let chalk; // Déclarer chalk pour qu'il soit accessible globalement dans le module

// Fonction asynchrone pour charger chalk
async function loadChalk() {
    try {
        const chalkModule = await import('chalk');
        chalk = chalkModule.default; // chalk est un module ESM avec une exportation par défaut
    } catch (error) {
        console.error('Erreur lors du chargement de chalk. Les logs ne seront pas colorés.', error);
        // Fallback pour une version sans couleur si chalk ne peut pas être chargé
        chalk = {
            red: { bold: (msg) => msg },
            yellow: (msg) => msg,
            green: (msg) => msg,
            blue: (msg) => msg,
            magenta: (msg) => msg,
            cyan: (msg) => msg
        };
    }
}

// Appelez cette fonction au démarrage du module pour charger chalk
loadChalk();


const LOG_LEVELS = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
    SILLY: 5
};

let currentLogLevel = LOG_LEVELS.INFO; // Niveau de log par défaut

class Logger {
    constructor(moduleName = 'App') {
        this.moduleName = moduleName;
    }

    _log(level, message, ...args) {
        if (level > currentLogLevel) {
            return; // Ne pas logger si le niveau actuel est inférieur
        }

        const timestamp = new Date().toISOString();
        let formattedMessage = `${timestamp} [${this.moduleName}] `;

        // Utiliser chalk si disponible, sinon revenir à du texte brut
        const useChalk = chalk || {
            red: { bold: (msg) => msg },
            yellow: (msg) => msg,
            green: (msg) => msg,
            blue: (msg) => msg,
            magenta: (msg) => msg,
            cyan: (msg) => msg
        };

        switch (level) {
            case LOG_LEVELS.ERROR:
                formattedMessage += useChalk.red.bold(`[ERROR] ${message}`);
                break;
            case LOG_LEVELS.WARN:
                formattedMessage += useChalk.yellow(`[WARN] ${message}`);
                break;
            case LOG_LEVELS.INFO:
                formattedMessage += useChalk.green(`[INFO] ${message}`);
                break;
            case LOG_LEVELS.DEBUG:
                formattedMessage += useChalk.blue(`[DEBUG] ${message}`);
                break;
            case LOG_LEVELS.SILLY:
                formattedMessage += useChalk.magenta(`[SILLY] ${message}`);
                break;
            default:
                formattedMessage += message;
        }

        console.log(formattedMessage, ...args);
    }

    error(message, ...args) {
        this._log(LOG_LEVELS.ERROR, message, ...args);
    }

    warn(message, ...args) {
        this._log(LOG_LEVELS.WARN, message, ...args);
    }

    info(message, ...args) {
        this._log(LOG_LEVELS.INFO, message, ...args);
    }

    debug(message, ...args) {
        this._log(LOG_LEVELS.DEBUG, message, ...args);
    }

    silly(message, ...args) {
        this._log(LOG_LEVELS.SILLY, message, ...args);
    }

    static setLevel(level) {
        if (Object.values(LOG_LEVELS).includes(level)) {
            currentLogLevel = level;
            // Utiliser chalk si disponible
            const useChalk = chalk || { cyan: (msg) => msg, yellow: (msg) => msg };
            console.log(useChalk.cyan(`Niveau de log défini sur: ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level)}`));
        } else {
            const useChalk = chalk || { yellow: (msg) => msg };
            console.warn(useChalk.yellow(`Niveau de log invalide: ${level}. Les niveaux disponibles sont: ${Object.keys(LOG_LEVELS).join(', ')}`));
        }
    }

    static disable() {
        currentLogLevel = LOG_LEVELS.NONE;
        const useChalk = chalk || { red: (msg) => msg };
        console.log(useChalk.red('Logger désactivé.'));
    }

    static enable() {
        currentLogLevel = LOG_LEVELS.INFO; // Rétablir le niveau par défaut ou un niveau souhaité
        const useChalk = chalk || { green: (msg) => msg };
        console.log(useChalk.green('Logger activé.'));
    }

    static getLevels() {
        return LOG_LEVELS;
    }
}

module.exports = Logger;