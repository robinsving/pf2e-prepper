# Quick-Load Macro

This guide shows how to create a Foundry macro that opens the PF2e Prepper quick-load dialog.

## Quick-Load Dialog
This macro opens a dialog to choose a loadout. If the actor has multiple prepared spellcasting entries, it first asks which entry to use.

```js
const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
if (!actor) {
  ui.notifications.warn("Select a token or assign a character to your user first.");
  return;
}

const prepper = game.modules.get("pf2e-prepper")?.api;
if (!prepper) {
  ui.notifications.warn("PF2e Prepper is not enabled.");
  return;
}

const entries = prepper.getPreparedSpellcastingEntries(actor);
if (!entries.length) {
  ui.notifications.warn("No prepared spellcasting entries found.");
  return;
}

let entryId = entries[0].id;
if (entries.length > 1) {
  const { DialogV2 } = foundry.applications.api;
  const options = entries
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .map((entry) => `<option value="${entry.id}">${entry.name}</option>`)
    .join("");

  const content = `
    <form>
      <div class="form-group">
        <label>Spellcasting Entry</label>
        <select name="entry">${options}</select>
      </div>
    </form>
  `;

  entryId = await DialogV2.wait({
    window: { title: "Quick Load: Choose Entry" },
    content,
    buttons: [
      {
        action: "next",
        label: "Next",
        default: true,
        callback: (_event, button) => button.form?.elements?.entry?.value
      },
      { action: "cancel", label: "Cancel" }
    ]
  });
  if (!entryId) return;
}

await prepper.quickLoadDialog(actor, entryId);
```

## Load fixed Entry
If you want a one-click macro tied to a specific spellcasting entry, pass the entry id:

```js
const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
if (!actor) {
  ui.notifications.warn("Select a token or assign a character to your user first.");
  return;
}

const prepper = game.modules.get("pf2e-prepper")?.api;
if (!prepper) {
  ui.notifications.warn("PF2e Prepper is not enabled.");
  return;
}

const entryId = "ENTRY_ID";
await prepper.quickLoadDialog(actor, entryId);
```
