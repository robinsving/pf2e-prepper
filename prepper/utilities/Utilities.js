import { id as SCRIPT_ID, title } from "../../module.json";
export { debug, error, info, popup, settings, getSettings, getNestedProperty };

const settings = {
    debug: { id: "debugMode", name: "Enable Debugging", hint: "Print debug to console log" },

    flagNames: {
        activeList: 'activeListId',
        spellLists: 'spellLists',
    }
}

function getSettings(setting) {
    return game.settings.get(SCRIPT_ID, setting);
}
function setSettings(setting, value) {
    return game.settings.set(SCRIPT_ID, setting, value);
}

function getNestedProperty(obj, path) {
    try {
        const value = path.split('.').reduce((acc, key) => acc[key], obj);
        return value !== undefined ? value : null;
    } catch (error) {
        return null;
    }
}

function popup(message) {
    ui.notifications.info(`${title}: ${message}`);
}

function debug(message) {
    if (getSettings(settings.debug.id))
        console.debug(`${title}: ${message}`);
}

function info(message) {
    console.info(`${title}: ${message}`);
}

/**
 * Log an error message
 * @param {string} msg - Error message to log
 * @param {*} error - Optional error object
 */
function error(msg, error) {
    console.error(`${title}: ERROR | ${msg}`, error);
}
  