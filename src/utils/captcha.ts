import type { Controller } from "tsoa";
import type { Problem } from "../model/response/problem";

const verificationEndpoint = new URL(
	"https://challenges.cloudflare.com/turnstile/v0/siteverify",
);

type CFTurnstileResponse = {
	success: boolean;
	challenge_ts?: Date;
	hostname?: URL;
	"error-codes": Array<string>;
	action?: string;
	cdata?: string;
	metadata?: CFTurnstileResponseMetadata;
};

type CFTurnstileResponseMetadata = {
	ephemeral_id: string;
};

export class CFTurnstileVerifier {
	// TODO: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
	private secret: string;

	constructor(secret: string) {
		this.secret = secret;
	}

	/**
	 * verify
	 */
	public async verify(proof: string): Promise<boolean> {
		const req = fetch(verificationEndpoint, {
			method: "POST",
			body: `secret=${encodeURIComponent(this.secret)}&response=${encodeURIComponent(proof)}`,
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
		});
		const resp = await req;

		const data: CFTurnstileResponse =
			(await resp.json()); //satisfies CFTurnstileResponse;
		return data.success;
	}

	public async verifyWithReq(
		req: Controller,
		proof: string,
	): Promise<void | Problem> {
		const human = await this.verify(proof);

		if (!human) {
			// details are left vague intentionally.
			req.setStatus(412);
			return {
				type: new URL("about:blank"),
				title: "",
				status: 412,
				details: "",
				instance: new URL("about:blank"),
			};
		}
		return;
	}
}
