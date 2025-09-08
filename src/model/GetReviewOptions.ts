export interface GetReviewOptions {
    game_id?: number;
    user_id?: number;
    id?: number;
    page?: number;
    limit?: number;
    textReviewsFirst?: boolean;
    includeOwnerReview?: boolean;
    removed?: boolean;
    orderCol?: string;
    orderDir?: "ASC" | "DESC";
}
