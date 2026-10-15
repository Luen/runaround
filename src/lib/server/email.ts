const endpoint = (accountId: string) =>
	`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`;

export type SendEmailInput = {
	to: string;
	subject: string;
	html: string;
	text: string;
};

export type SendEmailResult =
	| { ok: true; delivered: string[]; queued: string[] }
	| { ok: false; retry: boolean; error: string; suppressed?: boolean };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	const token = process.env.CLOUDFLARE_API_TOKEN;
	const from = process.env.MAIL_FROM ?? 'info@runaround.com.au';
	if (!accountId || !token) {
		return { ok: false, retry: false, error: 'Cloudflare email is not configured' };
	}

	const res = await fetch(endpoint(accountId), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			to: input.to,
			from: { address: from, name: 'RunAround' },
			subject: input.subject,
			html: input.html,
			text: input.text
		})
	});

	if (res.status === 429 || res.status >= 500) {
		return { ok: false, retry: true, error: `Cloudflare ${res.status}` };
	}

	const json = (await res.json()) as {
		success: boolean;
		errors?: { message: string; code?: number }[];
		result?: { delivered?: string[]; queued?: string[]; permanent_bounces?: string[] };
	};

	if (!res.ok || !json.success) {
		const message = json.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
		const suppressed = /suppress/i.test(message);
		return { ok: false, retry: false, error: message, suppressed };
	}

	if (json.result?.permanent_bounces?.includes(input.to)) {
		return { ok: false, retry: false, error: 'permanent bounce', suppressed: true };
	}

	return {
		ok: true,
		delivered: json.result?.delivered ?? [],
		queued: json.result?.queued ?? []
	};
}

export function positionGainedEmail(opts: {
	name: string;
	raceTitle: string;
	board: 'race' | 'overall';
	oldRank: number | null;
	newRank: number;
	url: string;
}): { subject: string; html: string; text: string } {
	const boardLabel = opts.board === 'race' ? 'race leaderboard' : 'overall leaderboard';
	const from = opts.oldRank ? `from ${opts.oldRank} ` : '';
	const subject = `You moved up on ${opts.raceTitle}`;
	const text = `Hi ${opts.name},\n\nYou moved ${from}to ${opts.newRank} on the ${boardLabel} for ${opts.raceTitle}.\n\nSee the results: ${opts.url}\n`;
	const html = `<p>Hi ${escapeHtml(opts.name)},</p><p>You moved ${from}to <strong>${opts.newRank}</strong> on the ${boardLabel} for <strong>${escapeHtml(opts.raceTitle)}</strong>.</p><p><a href="${opts.url}">See the results</a></p>`;
	return { subject, html, text };
}

export function raceEndedEmail(opts: {
	name: string;
	raceTitle: string;
	rank: number;
	time: string;
	url: string;
}): { subject: string; html: string; text: string } {
	const subject = `${opts.raceTitle} has finished — you placed ${opts.rank}`;
	const text = `Hi ${opts.name},\n\n${opts.raceTitle} is over. You placed ${opts.rank} with a time of ${opts.time}.\n\nSee the results: ${opts.url}\n`;
	const html = `<p>Hi ${escapeHtml(opts.name)},</p><p><strong>${escapeHtml(opts.raceTitle)}</strong> is over. You placed <strong>${opts.rank}</strong> with a time of ${escapeHtml(opts.time)}.</p><p><a href="${opts.url}">See the results</a></p>`;
	return { subject, html, text };
}

function escapeHtml(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
