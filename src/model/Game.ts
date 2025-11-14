/**
 * @deprecated Use \model\response\game instead.
 */
export interface Game {
	id?: number;
	name?: string;
	sortname?: string;
	url?: string;
	urlSpdrn?: string;
	author?: string[];
	author_raw?: string;
	collab?: boolean;
	dateCreated?: string;
	adderId?: string;
	removed?: boolean;
	ownerId?: string;
	ownerBio?: string;
}
