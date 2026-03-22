import { API } from "../prepper.js";

export function bindActorSheetHandlers(html, actor) {

    html.find('.pf2e-prepper-spell-loadouts-manager').off('click').on('click', ev => {
        ev.preventDefault();
        const entryId = ev.currentTarget?.dataset?.entryId;
        if (!entryId) return;
        API.PrepperApp(actor, { spellcastingEntryId: entryId });
    });

    html.find(".pf2e-prepper-quick-load").off("click").on("click", async (ev) => {
        ev.preventDefault();
        const entryId = ev.currentTarget?.dataset?.entryId;
        const entryName = ev.currentTarget?.dataset?.entryName || "Spellcasting";
        if (!entryId) return;

        await API.quickLoadDialog(actor, entryId, entryName);
    });
}
