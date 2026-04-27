export interface Report {
	id?: number;
	type?:
		| "game"
		| "game_add"
		| "game_remove"
		| "game_update_url"
		| "game_update_owner"
		| "game_update_creator"
		| "game_update"
		| "game_restored"
		| "user"
		| "user_register"
		| "user_password_change"
		| "review"
		| "review_restore"
		| "review_reported"
		| "review_removed"
		| "screenshot"
		| "screenshot_remove"
		| "screenshot_added"
		| "screenshot_reported"
		| "screenshot_approved"
		| "screenshot_denied";
	targetId?: number;
	report?: string;
	reporterId?: number;
	reporterName?: string;
	answeredById?: number;
	answeredByName?: string;
	dateCreated?: string;
	dateAnswered?: string;
}
