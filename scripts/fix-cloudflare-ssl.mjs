const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
	console.error('CLOUDFLARE_API_TOKEN missing');
	process.exit(1);
}

const zoneId = 'ec0475093368607816c0a73213ae994e';

async function api(method, endpoint, body) {
	const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: body ? JSON.stringify(body) : undefined
	});
	const json = await res.json();
	console.log(JSON.stringify(json, null, 2));
	return json;
}

const current = await api('GET', `/zones/${zoneId}/settings/ssl`);
if (!current.success) process.exit(1);

if (current.result?.value === 'strict') {
	console.log('Already strict');
	process.exit(0);
}

const updated = await api('PATCH', `/zones/${zoneId}/settings/ssl`, { value: 'strict' });
process.exit(updated.success ? 0 : 1);
