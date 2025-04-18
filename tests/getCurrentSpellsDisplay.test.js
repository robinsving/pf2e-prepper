import { describe, it, expect } from "vitest";
import PrepperApp from "../prepper/PrepperApp.js";
import singleSpellActor from "./data/single-spell-actor.json";
import multiSpellActor from "./data/multi-spell-actor.json";

describe("_getCurrentSpellsDisplay on single-spell-actor", () => {
    it("should return the full list of spells with requested data", () => {
        // Setup: Create an instance of PrepperApp with the actor
        const prepperApp = new PrepperApp(singleSpellActor);

        // Call the method
        const spells = prepperApp._getCurrentSpellsDisplay();

        // Assertions
        expect(spells).toStrictEqual([
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
    });
});

describe("_getCurrentSpellsDisplay on multi-spell-actor", () => {
    it("should return the full list of spells with requested data", () => {
        // Setup: Create an instance of PrepperApp with the actor
        const prepperApp = new PrepperApp(multiSpellActor);

        // Call the method
        const spells = prepperApp._getCurrentSpellsDisplay();

        // Assertions
        expect(spells).toStrictEqual([
            {
                "id": "QWWZSn4R4BCnDIQM",
                "flexible": true,
                "name": "Primal Prepared Spells",
                "levels": [
                    {
                        "level": 1,
                        "spells": [
                            {
                                "id": "tIonH8VxLUBgK5O2",
                                "name": "Alarm"
                            },
                            {
                                "id": "LwMKucF3R1VUswV3",
                                "name": "Shocking Grasp"
                            }
                        ]
                    },
                    {
                        "level": 2,
                        "spells": [
                            {
                                "id": "fNSukTeHDwtRv4XN",
                                "name": "Loose Time's Arrow"
                            },
                            {
                                "id": "1IEFT38Vu9nTRCow",
                                "name": "Flame Wisp"
                            }
                        ]
                    },
                    {
                        "level": 3,
                        "spells": [
                            {
                                "id": "jJLw546QWLr90C3L",
                                "name": "Safe Passage"
                            }
                        ]
                    }
                ]
            }
        ]);
    });
}
);