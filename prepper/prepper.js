import "./hooks/Hooks";
import { id as MODULE_ID, title as MODULE_TITLE } from "../module.json";
import PrepperStorage from "./PrepperStorage";
import PrepperApp from "./PrepperApp";

// Create API for other modules to use
const API = {
    PrepperStorage: PrepperStorage,
    PrepperApp: (actor) => new PrepperApp(actor).render(true)
};

export { API, MODULE_ID, MODULE_TITLE };
