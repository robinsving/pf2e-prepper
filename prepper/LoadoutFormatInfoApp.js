import { title as MODULE_TITLE } from "../module.json";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

/** Opens the read-only loadout format changelog as a standard Foundry dialog. */
export default class LoadoutFormatInfoDialog extends ApplicationV2 {
    render() {
        const localize = key => game.i18n.localize(key);

        // formatInfo entries are keyed by loadout format version number ("1", "2", ...) in localization files. We sort them numerically in descending order to show the most recent first.
        const formatInfo = foundry.utils.getProperty(game.i18n.translations, "PREPPER.formatInfo") || {};
        const versions = Object.keys(formatInfo)
            .filter(key => /^\d+$/.test(key))
            .sort((a, b) => Number(b) - Number(a));

        const entries = versions.map(version => {
            const { heading, bullets } = formatInfo[version];
            const items = (bullets || []).map(bullet => `<li>${bullet}</li>`).join("");
            return `<h3>${heading}</h3><ul>${items}</ul>`;
        }).join("");
        const content = `<section>${entries}</section>`;

        return DialogV2.wait({
            window: {
                title: `${MODULE_TITLE}: ${localize("PREPPER.formatInfo.title")}`
            },
            content,
            buttons: [{
                action: "close",
                icon: "fas fa-times",
                label: localize("PREPPER.formatInfo.close"),
                default: true
            }]
        });
    }
}
