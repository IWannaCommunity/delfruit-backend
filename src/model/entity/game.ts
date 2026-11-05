import { type Static, Type } from "@sinclair/typebox";

const GameTypeObject = Type.Object({
	id: Type.Integer({ minimum: 0, maximum: 4294967295 }),
	name: Type.String({ minLength: 1, maxLength: 512 }),
	sortname: Type.String({ minLength: 1, maxLength: 256 }),
	url: Type.String(),
	urlSpdrn: Type.String(),
	author: Type.String(),
	author_raw: Type.String(),
	collab: Type.Boolean({ default: false }),
	dateCreated: Type.Date(),
	adderId: Type.Integer({ minimum: 0, maximum: 4294967295 }),
	removed: Type.Boolean({ default: false }),
	ownerId: Type.Integer({ minimum: 0, maximum: 4294967295 }),
	ownerBio: Type.String(),
});

type Game = Static<typeof GameTypeObject>;

export class Game {
	constructor(g: Game) {
		this.inner = g;
	}
}
