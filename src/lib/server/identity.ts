export function isPlaceholderEmail(email: string | null | undefined): boolean {
	return Boolean(email?.endsWith('@users.runaround.invalid'));
}

export function adminEmails(): string[] {
	return (process.env.ADMIN_EMAILS ?? '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
}
