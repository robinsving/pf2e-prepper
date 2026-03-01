import { MODULE_ID, MODULE_TITLE } from "../prepper";
export { debug, error, info, popup, settings, getSettings };

const settings = {
    debug: { id: "debugMode", name: "Enable Debugging", hint: "Print debug to console log" },

    flagNames: {
        spellLists: 'spellLists',
    }
}

function getSettings(setting) {
    return game.settings.get(MODULE_ID, setting);
}

function popup(message) {
    ui.notifications.info(`${MODULE_TITLE}: ${message}`);
}

function debug(message) {
    if (getSettings(settings.debug.id))
        console.debug(`${MODULE_TITLE}: ${message}`);
}

function info(message) {
    console.info(`${MODULE_TITLE}: ${message}`);
}

/**
 * Log an error message
 * @param {string} msg - Error message to log
 * @param {*} error - Optional error object
 */
function error(msg, error) {
    console.error(`${MODULE_TITLE}: ERROR | ${msg}`, error);
}
  