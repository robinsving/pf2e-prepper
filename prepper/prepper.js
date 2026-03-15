import "./hooks/Hooks";
import { id as MODULE_ID, title as MODULE_TITLE } from "../module.json";
import PrepperStorage from "./PrepperStorage";
import PrepperApp from "./PrepperApp";

// Create API for other modules to use
const API = {
    PrepperStorage: PrepperStorage,
    PrepperApp: (actor, options = {}) => new PrepperApp(actor, options).render(true),
    getPreparedSpellcastingEntries: (actor) => PrepperStorage.getPreparedSpellcastingEntries(actor),
    getSpellLoadouts: (actor, spellcastingEntryId) => PrepperStorage.getSpellLoadouts(actor, spellcastingEntryId),
    loadSpellLoadout: (actor, spellcastingEntryId, loadoutId) => PrepperStorage.loadSpellLoadout(actor, spellcastingEntryId, loadoutId)
};

export { API, MODULE_ID, MODULE_TITLE };
