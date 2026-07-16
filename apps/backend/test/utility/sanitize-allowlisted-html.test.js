const {
    sanitizeAllowlistedHtml,
    PRESET_SR_APPROVAL_PENDING_HTML,
    PRESET_NOTIFICATION_TEXT_HTML
} = require('../../utility/sanitize-allowlisted-html');

describe('sanitizeAllowlistedHtml', () => {
    it('returns empty string for null, undefined, or non-string', () => {
        expect(sanitizeAllowlistedHtml(null, { allowedTags: [], allowedAttributes: {} })).toBe('');
        expect(sanitizeAllowlistedHtml(undefined, { allowedTags: [], allowedAttributes: {} })).toBe('');
        expect(sanitizeAllowlistedHtml(123, { allowedTags: [], allowedAttributes: {} })).toBe('');
    });

    it('throws when options is missing or not an object', () => {
        expect(() => sanitizeAllowlistedHtml('<p>x</p>')).toThrow(TypeError);
        expect(() => sanitizeAllowlistedHtml('<p>x</p>', null)).toThrow(TypeError);
    });

    it('applies caller-supplied allowlist', () => {
        const out = sanitizeAllowlistedHtml('<p>ok</p><script>no</script>', {
            allowedTags: ['p'],
            allowedAttributes: {}
        });
        expect(out).toContain('<p>');
        expect(out).not.toMatch(/script/i);
    });
});

describe('PRESET_SR_APPROVAL_PENDING_HTML via sanitizeAllowlistedHtml', () => {
    const sanitize = (html) => sanitizeAllowlistedHtml(html, PRESET_SR_APPROVAL_PENDING_HTML);

    it('preserves https anchor text', () => {
        const html = 'See <a href="https://docs.example.com/doc">the document</a> for details.';
        const out = sanitize(html);
        expect(out).toContain('https://docs.example.com/doc');
        expect(out).toContain('the document');
        expect(out).toMatch(/<a\s[^>]*href="https:\/\/docs\.example\.com\/doc"/);
    });

    it('omits href when anchor has no href to avoid href="undefined"', () => {
        const out = sanitize('<a>plain text</a>');
        expect(out).not.toMatch(/href="undefined"/);
        expect(out).not.toMatch(/\bhref=/);
        expect(out).toContain('plain text');
        expect(out).toMatch(/rel="noopener noreferrer"/);
    });

    it('omits href when href is only whitespace', () => {
        const out = sanitize('<a href="   ">label</a>');
        expect(out).not.toMatch(/href="undefined"/);
        expect(out).not.toMatch(/\bhref=/);
        expect(out).toContain('label');
    });

    it('preserves http anchor for legacy links', () => {
        const html = '<a href="http://example.com/x">link</a>';
        const out = sanitize(html);
        expect(out).toContain('http://example.com/x');
    });

    it('preserves mailto links', () => {
        const html = 'Email <a href="mailto:help@nih.gov">help</a>.';
        const out = sanitize(html);
        expect(out).toContain('mailto:help@nih.gov');
    });

    it('strips script tags and content', () => {
        const html = 'Hi <script>alert(1)</script><a href="https://safe.com">ok</a>';
        const out = sanitize(html);
        expect(out).not.toMatch(/script/i);
        expect(out).toContain('safe.com');
    });

    it('strips event handler attributes', () => {
        const html = '<a href="https://x.com" onclick="alert(1)">x</a>';
        const out = sanitize(html);
        expect(out).not.toMatch(/onclick/i);
        expect(out).toContain('https://x.com');
    });

    it('removes javascript: URLs', () => {
        const html = '<a href="javascript:alert(1)">bad</a> and <a href="https://good.com">good</a>';
        const out = sanitize(html);
        expect(out).not.toMatch(/javascript:/i);
        expect(out).toContain('https://good.com');
    });

    it('removes unexpected tags like iframe', () => {
        const html = '<iframe src="https://evil.com"></iframe><p>text</p>';
        const out = sanitize(html);
        expect(out).not.toMatch(/iframe/i);
        expect(out).toContain('text');
    });

    it('allows basic formatting tags', () => {
        const html = '<p>One</p><br><strong>B</strong><em>e</em>';
        const out = sanitize(html);
        expect(out).toContain('<p>');
        expect(out).toContain('<strong>');
        expect(out).toContain('<em>');
    });
});

describe('PRESET_NOTIFICATION_TEXT_HTML via sanitizeAllowlistedHtml', () => {
    const sanitize = (html) => sanitizeAllowlistedHtml(html, PRESET_NOTIFICATION_TEXT_HTML);

    it('preserves <b> tags', () => {
        const html = 'The <b>Test Study</b> has been approved.';
        const out = sanitize(html);
        expect(out).toBe('The <b>Test Study</b> has been approved.');
    });

    it('preserves <strong> tags', () => {
        const out = sanitize('<strong>Important</strong> text');
        expect(out).toContain('<strong>Important</strong>');
    });

    it('preserves <i> and <em> tags', () => {
        const out = sanitize('<i>italic</i> and <em>emphasis</em>');
        expect(out).toContain('<i>italic</i>');
        expect(out).toContain('<em>emphasis</em>');
    });

    it('preserves <u> tags', () => {
        const out = sanitize('<u>underlined</u> text');
        expect(out).toContain('<u>underlined</u>');
    });

    it('strips anchor tags but keeps inner text', () => {
        const html = 'Contact <a href="https://evil.com">Click Here</a> for info.';
        const out = sanitize(html);
        expect(out).not.toMatch(/<a[\s>]/);
        expect(out).not.toContain('href');
        expect(out).toContain('Click Here');
    });

    it('strips script tags completely', () => {
        const html = '<script>alert("xss")</script>Safe content';
        const out = sanitize(html);
        expect(out).not.toMatch(/script/i);
        expect(out).toContain('Safe content');
    });

    it('strips iframe tags', () => {
        const html = '<iframe src="https://evil.com"></iframe>Normal text';
        const out = sanitize(html);
        expect(out).not.toMatch(/iframe/i);
        expect(out).toContain('Normal text');
    });

    it('strips block-level tags like p, div, span', () => {
        const html = '<p>paragraph</p><div>div</div><span>span</span>';
        const out = sanitize(html);
        expect(out).not.toMatch(/<p>/);
        expect(out).not.toMatch(/<div>/);
        expect(out).not.toMatch(/<span>/);
        expect(out).toContain('paragraph');
        expect(out).toContain('div');
        expect(out).toContain('span');
    });

    it('strips list tags', () => {
        const html = '<ul><li>item</li></ul>';
        const out = sanitize(html);
        expect(out).not.toMatch(/<ul>/);
        expect(out).not.toMatch(/<li>/);
        expect(out).toContain('item');
    });

    it('strips all attributes from allowed tags', () => {
        const html = '<b class="highlight" style="color:red" onclick="alert(1)">bold</b>';
        const out = sanitize(html);
        expect(out).toBe('<b>bold</b>');
    });

    it('handles typical notification message with <b> study name', () => {
        const html = 'Data Submission SUB-001 / My-Sub for study <b>Cancer Research Study</b> has been canceled by user Admin.';
        const out = sanitize(html);
        expect(out).toBe(html);
    });

    it('strips injected anchor from user-controlled study name', () => {
        const html = 'The Data Submission for the <b><a href="https://evil.com">Fake Study</a></b> study has been completed.';
        const out = sanitize(html);
        expect(out).not.toMatch(/<a[\s>]/);
        expect(out).toContain('<b>Fake Study</b>');
    });
});
