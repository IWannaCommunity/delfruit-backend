export type PostGameParams = {
	name: string;
	url?: string;
	urlSpdrn?: string;
	author: string[];
	collab: boolean;
	dateCreated?: Date;
	ownerId?: string;
};

export type GetGamesParams = {
	q?: string;

	page: 0 | number;
	limit: 50 | number;
	orderCol?: string;
	orderDir?: "asc" | "desc";

	id?: number;
	ownerUserId?: number;

	name?: string;
	nameStartsWith?: string;
	nameExp?: string;
	removed?: boolean;

	tags?: string; // QUEST: find a way to stuff a array in a querystring
	author?: string;
	hasDownload?: boolean;
	createdFrom?: Date;
	createdTo?: Date;
	clearedByUserId?: number;
	reviewedByUserId?: number;

	ratingFrom?: number;
	ratingTo?: number;
	difficultyFrom?: number;
	difficultyTo?: number;
};
