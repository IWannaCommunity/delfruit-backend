import { HttpStatusCodeLiteral } from "tsoa";

export type Problem = {
	type: URL;
	title: string;
	status: HttpStatusCodeLiteral;
	detail: string;
	instance: URL;
};
