import { readFileSync } from 'node:fs';

for (const f of ['.env.vercel.tmp', '.env']) {
	try {
		const line = readFileSync(f, 'utf8')
			.split('\n')
			.find((l) => l.startsWith('CLOUDFLARE_API_TOKEN='));
		if (!line) {
			console.log(f, 'no token');
			continue;
		}
		let v = line.slice('CLOUDFLARE_API_TOKEN='.length);
		if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
		console.log(f, 'token_len', v.length, 'valid', v.length > 20 && v !== '[SECRET]');
	} catch {
		console.log(f, 'missing');
	}
}
