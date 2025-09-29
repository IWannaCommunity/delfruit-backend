import { Type, Static } from "@sinclair/typebox";

const UserType = Type.Object({
	id: Type.Integer({ minimum: 0, maximum: 4294967295 }),
	name: Type.String({ minLength: 1, maxLength: 50 }),
	phash: Type.String(),
	salt: Type.String(),
	phash2: Type.String(),
	email: Type.String({}),
	dateCreated: Type.Date({ default: Date.now() }),
	dateLastLogin: Type.Date(),
	lastIP: Type.String({}),
	unsuccessfulLogins: Type.Integer({ minimum: 0, maximum: 4294967295 }),
	isAdmin: Type.Boolean({ default: false }),
	canReport: Type.Boolean({ default: true }),
	canSubmit: Type.Boolean({ default: true }),
	canReview: Type.Boolean({ default: true }),
	canScreenshot: Type.Boolean({ default: true }),
	canMessage: Type.Boolean({ default: true }),
	banned: Type.Boolean({ default: false }),
	twitchLink: Type.String({ minLength: 1, maxLength: 50 }),
	nicoLink: Type.String({ minLength: 1, maxLength: 50 }),
	youtubeLink: Type.String({ minLength: 1, maxLength: 50 }),
	twitterLink: Type.String({ minLength: 1, maxLength: 50 }),
	bio: Type.String({ minLength: 1, maxLength: 65535 }),
	aliToken: Type.String({ minLength: 1, maxLength: 300 }),
	aliDateSet: Type.Date(),
	resetToken: Type.String({ minLength: 1, maxLength: 255 }),
	resetTokenSetTime: Type.Date(),
	locale: Type.String({ minLength: 1, maxLength: 5, default: "en_US" }),
	selectedBadge: Type.Integer(),
});

export type User = Static<typeof UserType>;
