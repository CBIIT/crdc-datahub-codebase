import PDFDocument from 'pdfkit';
import { VerificationState } from './model';

export type Cell = {
  text: string;
  bold?: boolean;
  mono?: boolean;
  color?: string;
  /** Draws the text as a status pill using the supplied colour pair. */
  pill?: { text: string; color: string; background: string };
  /** External or file link target. */
  link?: string;
  /** Internal named destination target. */
  goTo?: string;
  align?: 'left' | 'right' | 'center';
};

export type Column = {
  header: string;
  /** Relative width weight. */
  weight: number;
  align?: 'left' | 'right' | 'center';
};

export const COLORS = {
  ink: '#12212f',
  muted: '#5b6b7a',
  line: '#d5dde5',
  accent: '#0b5c8a',
  headerFill: '#f3f6f9',
  noticeFill: '#f7f8fa',
  stateFill: '#f5fafd',
  codeFill: '#f7f8fa',
  warn: '#8a5300',
};

const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_MONO = 'Courier';

const SIZE = {
  title: 19,
  h1: 15,
  h2: 11.5,
  h3: 10,
  body: 9,
  table: 8.2,
  small: 7.5,
};

const PADDING = 4;

const CHAR_REPLACEMENTS: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '⇒': '=>',
  '✓': 'v',
  '✗': 'x',
  '≥': '>=',
  '≤': '<=',
  '≠': '!=',
};

/** Characters above Latin-1 that the standard PDF fonts can still represent. */
const EXTRA_ENCODABLE = new Set('…—–•·‘’“”€™©®†‡‰ƒŠŒŽšœžŸ');

/** Standard PDF fonts use WinAnsi encoding; anything else must be substituted. */
function sanitize(text: string): string {
  return [...(text ?? '')]
    .map((char) => {
      if (CHAR_REPLACEMENTS[char]) return CHAR_REPLACEMENTS[char];
      if (char.codePointAt(0)! < 256 || EXTRA_ENCODABLE.has(char)) return char;
      return '?';
    })
    .join('');
}

/**
 * Thin layout layer over PDFKit: headings, tables, metric cards, images and
 * pagination. The document is composed directly as PDF content objects.
 */
export class PdfBuilder {
  readonly doc: PDFKit.PDFDocument;

  private readonly outlineItems = new Map<string, PDFKit.PDFOutline>();

  constructor(title: string, subject: string) {
    this.doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 58, bottom: 54, left: 46, right: 46 },
      bufferPages: true,
      autoFirstPage: true,
      info: { Title: title, Subject: subject, Creator: 'Playwright QA Release Verification reporter' },
    });
    this.doc.font(FONT).fontSize(SIZE.body).fillColor(COLORS.ink);
  }

  get contentWidth(): number {
    return this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right;
  }

  get left(): number {
    return this.doc.page.margins.left;
  }

  private get bottom(): number {
    return this.doc.page.height - this.doc.page.margins.bottom;
  }

  ensureSpace(height: number): void {
    if (this.doc.y + height > this.bottom) {
      this.doc.addPage();
    }
  }

  pageBreak(): void {
    this.doc.addPage();
  }

  bookmark(title: string, parentKey?: string, key?: string): void {
    const parent = parentKey ? this.outlineItems.get(parentKey) : undefined;
    const target = parent ?? this.doc.outline;
    const item = target.addItem(sanitize(title), { expanded: false });
    if (key) {
      this.outlineItems.set(key, item);
    }
  }

  destination(name: string): void {
    this.doc.addNamedDestination(name);
  }

  title(text: string, subtitle?: string): void {
    this.doc
      .font(FONT_BOLD)
      .fontSize(SIZE.title)
      .fillColor(COLORS.ink)
      .text(sanitize(text), this.left, this.doc.y, { width: this.contentWidth });
    if (subtitle) {
      this.doc
        .font(FONT)
        .fontSize(SIZE.body + 1)
        .fillColor(COLORS.muted)
        .text(sanitize(subtitle), { width: this.contentWidth });
    }
    this.doc.moveDown(0.8);
  }

  heading(text: string, level: 1 | 2 | 3 = 2): void {
    const size = level === 1 ? SIZE.h1 : level === 2 ? SIZE.h2 : SIZE.h3;
    this.ensureSpace(size + 26);
    this.doc.moveDown(level === 3 ? 0.4 : 0.7);
    this.doc
      .font(FONT_BOLD)
      .fontSize(size)
      .fillColor(level === 3 ? COLORS.muted : COLORS.accent)
      .text(sanitize(text), this.left, this.doc.y, { width: this.contentWidth });

    if (level <= 2) {
      const y = this.doc.y + 2;
      this.doc
        .moveTo(this.left, y)
        .lineTo(this.left + this.contentWidth, y)
        .lineWidth(level === 1 ? 1.5 : 0.7)
        .strokeColor(COLORS.accent)
        .stroke();
      this.doc.y = y + 6;
    } else {
      this.doc.moveDown(0.3);
    }
    this.doc.font(FONT).fontSize(SIZE.body).fillColor(COLORS.ink);
  }

  paragraph(text: string, options: { muted?: boolean; size?: number } = {}): void {
    const body = sanitize(text);
    const size = options.size ?? SIZE.body;
    this.doc.font(FONT).fontSize(size).fillColor(options.muted ? COLORS.muted : COLORS.ink);
    this.ensureSpace(this.doc.heightOfString(body, { width: this.contentWidth }));
    this.doc.text(body, this.left, this.doc.y, { width: this.contentWidth });
    this.doc.moveDown(0.4);
  }

  /** Boxed advisory text used for scope and methodology statements. */
  notice(text: string): void {
    const body = sanitize(text);
    this.doc.font(FONT).fontSize(SIZE.small + 0.3).fillColor(COLORS.muted);
    const innerWidth = this.contentWidth - 2 * PADDING - 6;
    const height = this.doc.heightOfString(body, { width: innerWidth }) + 2 * PADDING + 4;
    this.ensureSpace(height + 8);
    const y = this.doc.y;
    this.doc
      .rect(this.left, y, this.contentWidth, height)
      .fillAndStroke(COLORS.noticeFill, COLORS.line);
    this.doc
      .fillColor(COLORS.muted)
      .text(body, this.left + PADDING + 3, y + PADDING + 1, { width: innerWidth });
    this.doc.y = y + height + 8;
  }

  bullets(items: string[], color = COLORS.muted): void {
    this.doc.font(FONT).fontSize(SIZE.body - 0.5).fillColor(color);
    for (const item of items) {
      const text = sanitize(`•  ${item}`);
      this.ensureSpace(this.doc.heightOfString(text, { width: this.contentWidth - 10 }));
      this.doc.text(text, this.left + 6, this.doc.y, { width: this.contentWidth - 10 });
    }
    this.doc.moveDown(0.3);
  }

  stateBox(state: VerificationState, reasons: string[]): void {
    const heading = sanitize(state);
    const lines = reasons.map((reason) => sanitize(`•  ${reason}`));
    this.doc.font(FONT_BOLD).fontSize(SIZE.h1);
    const stateHeight = this.doc.heightOfString(heading, { width: this.contentWidth - 20 });
    this.doc.font(FONT).fontSize(SIZE.body - 0.5);
    const reasonHeight = lines.reduce(
      (sum, line) => sum + this.doc.heightOfString(line, { width: this.contentWidth - 26 }),
      0
    );
    const height = stateHeight + reasonHeight + 18;

    this.ensureSpace(height + 8);
    const y = this.doc.y;
    this.doc
      .rect(this.left, y, this.contentWidth, height)
      .lineWidth(1.4)
      .fillAndStroke(COLORS.stateFill, COLORS.accent);

    this.doc
      .font(FONT_BOLD)
      .fontSize(SIZE.h1)
      .fillColor(COLORS.accent)
      .text(heading, this.left + 10, y + 7, { width: this.contentWidth - 20 });

    this.doc.font(FONT).fontSize(SIZE.body - 0.5).fillColor(COLORS.muted);
    let cursor = y + 9 + stateHeight;
    for (const line of lines) {
      this.doc.text(line, this.left + 13, cursor, { width: this.contentWidth - 26 });
      cursor = this.doc.y;
    }

    this.doc.y = y + height + 8;
    this.doc.lineWidth(1).font(FONT).fontSize(SIZE.body).fillColor(COLORS.ink);
  }

  metricCards(cards: { label: string; value: string }[]): void {
    const gap = 5;
    const width = (this.contentWidth - gap * (cards.length - 1)) / cards.length;
    const height = 38;
    this.ensureSpace(height + 10);
    const y = this.doc.y;

    cards.forEach((card, index) => {
      const x = this.left + index * (width + gap);
      this.doc.rect(x, y, width, height).lineWidth(0.7).fillAndStroke('#ffffff', COLORS.line);
      this.doc
        .font(FONT_BOLD)
        .fontSize(15)
        .fillColor(COLORS.ink)
        .text(card.value, x, y + 6, { width, align: 'center' });
      this.doc
        .font(FONT)
        .fontSize(6.2)
        .fillColor(COLORS.muted)
        .text(sanitize(card.label.toUpperCase()), x + 2, y + 25, { width: width - 4, align: 'center' });
    });

    this.doc.y = y + height + 10;
    this.doc.font(FONT).fontSize(SIZE.body).fillColor(COLORS.ink);
  }

  /** Two-column label/value table. */
  keyValues(rows: { label: string; value: string }[], labelWeight = 0.34): void {
    this.table(
      [
        { header: '', weight: labelWeight },
        { header: '', weight: 1 - labelWeight },
      ],
      rows.map((row) => [{ text: row.label, bold: true }, { text: row.value }]),
      { headerRow: false, labelColumns: [0] }
    );
  }

  /** Denser label/value layout that packs several pairs onto each row. */
  keyValuePairs(rows: { label: string; value: string }[], pairsPerRow = 2): void {
    const columns: Column[] = [];
    const labelColumns: number[] = [];
    for (let pair = 0; pair < pairsPerRow; pair += 1) {
      labelColumns.push(columns.length);
      columns.push({ header: '', weight: 0.85 }, { header: '', weight: 1.4 });
    }

    const tableRows: Cell[][] = [];
    for (let index = 0; index < rows.length; index += pairsPerRow) {
      const cells: Cell[] = [];
      for (let pair = 0; pair < pairsPerRow; pair += 1) {
        const entry = rows[index + pair];
        cells.push({ text: entry?.label ?? '', bold: true }, { text: entry?.value ?? '' });
      }
      tableRows.push(cells);
    }

    this.table(columns, tableRows, { headerRow: false, labelColumns });
  }

  table(
    columns: Column[],
    rows: Cell[][],
    options: { headerRow?: boolean; labelColumns?: number[] } = {}
  ): void {
    const headerRow = options.headerRow ?? true;
    const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
    const widths = columns.map((column) => (column.weight / totalWeight) * this.contentWidth);
    const safeRows = rows.map((row) =>
      row.map((cell) => ({
        ...cell,
        text: sanitize(cell.text),
        pill: cell.pill ? { ...cell.pill, text: sanitize(cell.pill.text) } : undefined,
      }))
    );

    const drawHeader = () => {
      const cells: Cell[] = columns.map((column) => ({
        text: sanitize(column.header),
        bold: true,
        align: column.align,
      }));
      this.drawRow(cells, widths, columns, { fill: COLORS.headerFill });
    };

    if (headerRow) {
      this.ensureSpace(30);
      drawHeader();
    }

    for (const row of safeRows) {
      const height = this.rowHeight(row, widths);
      if (this.doc.y + height > this.bottom) {
        this.doc.addPage();
        if (headerRow) {
          drawHeader();
        }
      }
      this.drawRow(row, widths, columns, {
        labelColumns: options.labelColumns,
      });
    }

    this.doc.y += 6;
    this.doc.font(FONT).fontSize(SIZE.body).fillColor(COLORS.ink);
  }

  private cellFont(cell: Cell): void {
    this.doc
      .font(cell.mono ? FONT_MONO : cell.bold ? FONT_BOLD : FONT)
      .fontSize(cell.mono ? SIZE.table - 0.6 : SIZE.table);
  }

  private rowHeight(row: Cell[], widths: number[]): number {
    let height = 0;
    row.forEach((cell, index) => {
      this.cellFont(cell);
      const text = cell.pill ? cell.pill.text : cell.text;
      height = Math.max(height, this.doc.heightOfString(text || ' ', { width: widths[index] - 2 * PADDING }));
    });
    return height + 2 * PADDING;
  }

  private drawRow(
    row: Cell[],
    widths: number[],
    columns: Column[],
    options: { fill?: string; labelColumns?: number[] } = {}
  ): void {
    const height = this.rowHeight(row, widths);
    const y = this.doc.y;
    let x = this.left;

    row.forEach((cell, index) => {
      const width = widths[index];
      const fill = options.fill ?? (options.labelColumns?.includes(index) ? COLORS.headerFill : undefined);
      this.doc.rect(x, y, width, height).lineWidth(0.5).strokeColor(COLORS.line);
      if (fill) {
        this.doc.fillAndStroke(fill, COLORS.line);
      } else {
        this.doc.stroke();
      }

      if (cell.pill) {
        this.drawPill(cell.pill, x + PADDING, y + PADDING - 1);
      } else {
        this.cellFont(cell);
        this.doc.fillColor(cell.color ?? COLORS.ink).text(cell.text || '', x + PADDING, y + PADDING, {
          width: width - 2 * PADDING,
          align: cell.align ?? columns[index]?.align ?? 'left',
          link: cell.link,
          goTo: cell.goTo,
          underline: Boolean(cell.link || cell.goTo),
        } as PDFKit.Mixins.TextOptions);
      }

      x += width;
    });

    this.doc.y = y + height;
  }

  private drawPill(pill: { text: string; color: string; background: string }, x: number, y: number): void {
    this.doc.font(FONT_BOLD).fontSize(SIZE.table - 0.8);
    const width = this.doc.widthOfString(pill.text) + 10;
    const height = this.doc.currentLineHeight() + 3;
    this.doc
      .roundedRect(x, y, width, height, height / 2)
      .lineWidth(0.6)
      .fillAndStroke(pill.background, pill.color);
    this.doc.fillColor(pill.color).text(pill.text, x + 5, y + 2.4, { width: width - 10, lineBreak: false });
  }

  /** Embeds an image scaled to the content width, with a caption block. */
  image(filePath: string, captionLines: string[], maxHeight = 240): boolean {
    let dimensions: { width: number; height: number };
    try {
      // openImage is available at runtime but missing from @types/pdfkit.
      const opened = (this.doc as unknown as {
        openImage(src: string): { width: number; height: number };
      }).openImage(filePath);
      dimensions = { width: opened.width, height: opened.height };
    } catch {
      return false;
    }

    const width = Math.min(this.contentWidth, (dimensions.width * maxHeight) / dimensions.height);
    const height = (dimensions.height * width) / dimensions.width;

    this.doc.font(FONT).fontSize(SIZE.small);
    const captions = captionLines.map((line) => sanitize(line));
    const captionHeight = captions.reduce(
      (sum, line) => sum + this.doc.heightOfString(line, { width: this.contentWidth }),
      0
    );

    this.ensureSpace(height + captionHeight + 12);
    const y = this.doc.y;
    try {
      this.doc.image(filePath, this.left, y, { width, height });
    } catch {
      return false;
    }
    this.doc.rect(this.left, y, width, height).lineWidth(0.5).strokeColor(COLORS.line).stroke();

    this.doc.y = y + height + 3;
    this.doc.fillColor(COLORS.muted).fontSize(SIZE.small);
    for (const line of captions) {
      this.doc.text(line, this.left, this.doc.y, { width: this.contentWidth });
    }
    this.doc.y += 6;
    this.doc.font(FONT).fontSize(SIZE.body).fillColor(COLORS.ink);
    return true;
  }

  /** Monospaced block used for framework error output. */
  codeBlock(text: string, maxLines = 22): void {
    const lines = sanitize(text).split('\n');
    const body =
      lines.length > maxLines
        ? [...lines.slice(0, maxLines), `... ${lines.length - maxLines} more line(s) in the retained log artifact`].join('\n')
        : lines.join('\n');

    this.doc.font(FONT_MONO).fontSize(7.2).fillColor(COLORS.ink);
    const innerWidth = this.contentWidth - 2 * PADDING - 4;
    const usable = this.bottom - this.doc.page.margins.top;
    const height = Math.min(this.doc.heightOfString(body, { width: innerWidth }) + 2 * PADDING, usable);

    this.ensureSpace(height + 6);
    const y = this.doc.y;
    this.doc.rect(this.left, y, this.contentWidth, height).lineWidth(0.5).fillAndStroke(COLORS.codeFill, COLORS.line);
    this.doc.font(FONT_MONO).fontSize(7.2).fillColor(COLORS.ink).text(body, this.left + PADDING + 2, y + PADDING, {
      width: innerWidth,
      height: height - 2 * PADDING,
      ellipsis: true,
    });

    this.doc.y = y + height + 6;
    this.doc.font(FONT).fontSize(SIZE.body).fillColor(COLORS.ink);
  }

  rule(): void {
    this.ensureSpace(8);
    this.doc
      .moveTo(this.left, this.doc.y)
      .lineTo(this.left + this.contentWidth, this.doc.y)
      .lineWidth(0.5)
      .strokeColor(COLORS.line)
      .stroke();
    this.doc.y += 6;
  }

  /** Draws the running header and footer on every page, then closes the document. */
  finalize(headerLeft: string, headerRight: string, footerLeft: string): void {
    const range = this.doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      this.doc.switchToPage(index);
      const { width, height, margins } = this.doc.page;
      const innerWidth = width - margins.left - margins.right;
      // Writing in the margin area would otherwise push PDFKit onto a new page.
      const originalBottom = margins.bottom;
      this.doc.page.margins.bottom = 0;
      this.doc.font(FONT).fontSize(6.8).fillColor(COLORS.muted);
      this.doc.text(sanitize(headerLeft), margins.left, 28, { width: innerWidth, align: 'left' });
      this.doc.text(sanitize(headerRight), margins.left, 28, { width: innerWidth, align: 'right' });
      this.doc
        .moveTo(margins.left, 40)
        .lineTo(width - margins.right, 40)
        .lineWidth(0.5)
        .strokeColor(COLORS.line)
        .stroke();

      const footerY = height - 34;
      this.doc
        .moveTo(margins.left, footerY - 6)
        .lineTo(width - margins.right, footerY - 6)
        .stroke();
      this.doc.fillColor(COLORS.muted);
      this.doc.text(sanitize(footerLeft), margins.left, footerY, { width: innerWidth, align: 'left' });
      this.doc.text(`Page ${index - range.start + 1} of ${range.count}`, margins.left, footerY, {
        width: innerWidth,
        align: 'right',
      });

      this.doc.page.margins.bottom = originalBottom;
    }

    this.doc.flushPages();
    this.doc.end();
  }
}

export { SIZE, FONT, FONT_BOLD, FONT_MONO };
