import { Email } from "../email";

export type User = {
	id: number;
	name: string;
	dateCreated: Date;
	isAdmin?: boolean;
	canReport?: boolean;
	canSubmit?: boolean;
	canReview?: boolean;
	canScreenshot?: boolean;
	canMessage?: boolean;
	twitchLink: string;
	nicoLink: string;
	youtubeLink: string;
	twitterLink: string;
	bio: string;
	selectedBadge: number;
	banned?: boolean;
	email?: Email;
};

export type UserRegistrationResponse = {
	token: string;
};
