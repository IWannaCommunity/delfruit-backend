export interface GetGamesParms {
  q?: string;

  page: number;
  limit: number;
  orderCol?: string;
  orderDir?: "asc" | "desc";

  id?: number;
  ownerUserId?: number;

  name?: string;
  nameStartsWith?: string;
  nameExp?: string;
  removed?: boolean;

  tags?: string[];
  author?: string;
  hasDownload?: boolean;
  createdFrom?: string;
  createdTo?: string;
  clearedByUserId?: number;
  reviewedByUserId?: number;

  ratingFrom?: number;
  ratingTo?: number;
  difficultyFrom?: number;
  difficultyTo?: number;
}