import { describe, expect, it } from 'vitest';
import { jsonLdScript } from './seo';

describe('jsonLdScript', () => {
	it('wraps JSON-LD in a complete script tag', () => {
		const html = jsonLdScript({ '@type': 'Thing', name: 'Run' });
		expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
		expect(html.endsWith('</script>')).toBe(true);
		expect(html).toContain('"name":"Run"');
	});

	it('escapes < so a value cannot close the script tag', () => {
		const html = jsonLdScript({ name: '</script><script>alert(1)</script>' });
		expect(html).not.toContain('</script><script>');
		expect(html).toContain('\\u003c/script');
	});
});
