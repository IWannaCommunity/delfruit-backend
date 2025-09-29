export type GetUsersParams = {
	page: number;
	limit: number;
	orderCol?: string;
	orderDir?: "ASC" | "DESC";

	id?: number;
	followerUserId?: number;
	banned?: boolean;
	name?: string;
};

export type PatchUserParams = {
	password: string;
	currentPassword: string;
};
