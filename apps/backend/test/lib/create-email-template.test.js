const handlebars = require('handlebars');
// Importing the module registers all Handlebars helpers, including markdownToHtml.
require('../../lib/create-email-template');

const render = (template, ctx) => handlebars.compile(template)(ctx);

describe('markdownToHtml Handlebars helper', () => {
  it('returns empty string for falsy input', () => {
    expect(render('{{{markdownToHtml val}}}', { val: null })).toBe('');
    expect(render('{{{markdownToHtml val}}}', { val: undefined })).toBe('');
    expect(render('{{{markdownToHtml val}}}', { val: '' })).toBe('');
  });

  it('renders bold markdown', () => {
    const out = render('{{{markdownToHtml val}}}', { val: '**bold text**' });
    expect(out).toContain('<strong>bold text</strong>');
  });

  it('renders italic markdown', () => {
    const out = render('{{{markdownToHtml val}}}', { val: '_italic text_' });
    expect(out).toContain('<em>italic text</em>');
  });

  it('renders an unordered list', () => {
    const out = render('{{{markdownToHtml val}}}', { val: '- item one\n- item two' });
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>item one</li>');
    expect(out).toContain('<li>item two</li>');
  });

  it('renders an ordered list', () => {
    const out = render('{{{markdownToHtml val}}}', { val: '1. first\n2. second' });
    expect(out).toContain('<ol>');
    expect(out).toContain('<li>first</li>');
    expect(out).toContain('<li>second</li>');
  });

  it('renders a hyperlink with forced rel', () => {
    const out = render('{{{markdownToHtml val}}}', { val: '[CRDC Portal](https://datacommons.cancer.gov)' });
    expect(out).toMatch(/href="https:\/\/datacommons\.cancer\.gov"/);
    expect(out).toContain('CRDC Portal');
    expect(out).toMatch(/rel="noopener noreferrer"/);
  });

  it('strips javascript: URLs from links', () => {
    const out = render('{{{markdownToHtml val}}}', { val: '[bad](javascript:alert(1))' });
    expect(out).not.toMatch(/javascript:/i);
  });

  it('strips script tags', () => {
    const out = render('{{{markdownToHtml val}}}', { val: 'hello <script>alert(1)</script> world' });
    expect(out).not.toMatch(/script/i);
    expect(out).not.toMatch(/alert/i);
    expect(out).toContain('hello');
  });

  it('strips heading tags produced by markdown', () => {
    const out = render('{{{markdownToHtml val}}}', { val: '# Heading One' });
    expect(out).not.toMatch(/<h[1-6]/i);
    expect(out).toContain('Heading One');
  });

  it('plain text renders without raw markdown characters', () => {
    const out = render('{{{markdownToHtml val}}}', { val: 'Please review the study.' });
    expect(out).toContain('Please review the study.');
    expect(out).not.toContain('**');
  });

  it('preserves consecutive blank lines between markdown blocks', () => {
    const out = render('{{{markdownToHtml val}}}', { val: 'Line one\n\n\n\nTwo full blank lines above this' });
    expect(out).toContain('<p>Line one</p>');
    expect(out).toMatch(/(<br\s*\/?>(\n)?){4}/);
    expect(out).toContain('<p>Two full blank lines above this</p>');
  });

  it('preserves mixed spacing and list structure in a realistic review comment', () => {
    const val = [
      'Line one',
      '',
      '',
      '',
      'Two blank lines above this',
      '',
      'Line break but no gap',
      'Still same paragraph',
      '',
      '',
      '- bullet directly under newline',
      '- another bullet',
      '',
      'one empty line above'
    ].join('\n');

    const out = render('{{{markdownToHtml val}}}', { val });

    expect(out).toContain('<p>Line one</p>');
    expect(out).toMatch(/(<br\s*\/?>(\n)?){4}<p>Two blank lines above this<\/p>/);
    expect(out).toMatch(/Line break but no gap<br\s*\/?>(\n)?Still same paragraph/);
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>bullet directly under newline</li>');
    expect(out).toContain('<li>another bullet</li>');
    expect(out).toContain('<p>one empty line above</p>');
  });
});
