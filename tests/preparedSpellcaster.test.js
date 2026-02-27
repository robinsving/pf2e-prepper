import { describe, it, expect, vi } from "vitest";
import PrepperApp from "../prepper/PrepperApp.js";
import preparedActor from "./data/prepared-actor.json";

describe("_getCurrentSpellsDisplay on single-spell-actor", () => {
    it("should return the full list of spells with requested data", () => {
        // Mock PrepperStorage for this test
        const mockStorage = {
            getSpellLists: vi.fn(() => ({})),
            getActiveListId: vi.fn(() => null),
        };
        vi.spyOn(game.modules, "get").mockImplementation((_) => {
            return { api: { PrepperStorage: mockStorage } };
        });

        // Setup: Create an instance of PrepperApp with the actor
        const prepperApp = new PrepperApp(preparedActor);

        // Call the method
        const data = prepperApp.getData();

        // Assertions
        expect(data.currentSpells).toStrictEqual([
            {
                "id": "oGVGhQnQjByubbM4",
                "flexible": false,
                "name": "Occult Prepared Spells",
                "levels": [
                    {
                        "level": 1,
                        "spells": [
                            {
                                "id": "9csscbuv7MrMXsqE",
                                "name": "Animate Rope"
                            }
                        ]
                    }
                ]
            }
        ]);

        // Restore original behavior
        game.modules.get.mockRestore();
    });
});
