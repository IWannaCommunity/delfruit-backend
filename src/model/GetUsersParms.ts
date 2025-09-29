/**
 * @deprecated Use /model/user/GetUsersParams instead
 */
export interface GetUsersParms {
	page: number;
	limit: number;
	orderCol?: string;
	orderDir?: "ASC" | "DESC";

	id?: number;
	followerUserId?: number;
	banned?: boolean;
	name?: string;
}

