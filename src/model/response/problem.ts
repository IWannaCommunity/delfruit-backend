import { HttpStatusCodeLiteral } from "tsoa";

export type Problem = Required<{
	type: URL;
	title: string;
	status: HttpStatusCodeLiteral;
	detail: string;
	instance: URL;
}>;
