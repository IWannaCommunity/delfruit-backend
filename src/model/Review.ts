export interface Review {
	id?: number;
	user_id?: number;
	game_dd?: number;
	rating?: number;
	difficulty?: number;
	comment?: string;
	date_created?: string;
	removed?: boolean;
	tags?: Array<number>;
}
