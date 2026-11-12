/**
 * Renders plain ASCII text as a PDF with a real text layer, so fixtures stay reviewable as .txt files.
 *
 * With two columns, the text before a line of "---" goes in a narrow left column and the rest on the right.
 * Lines are written row by row across both columns, as many resume templates do, so wrapped right-column
 * lines are split apart in the extracted text. That is the layout that breaks quote checks in real resumes.
 */

const FONT_SIZE = 10;
const LEADING = 13;
const TOP = 750;
const ROWS_PER_PAGE = 53;
const COLUMN_BREAK = "---";

const SINGLE = [{ x: 56, chars: 95 }];
const TWO_COLUMNS = [{ x: 40, chars: 32 }, { x: 230, chars: 64 }];

const escapePdf = (text: string): string => text.replace(/[\\()]/g, ch => `\\${ch}`);

/** Wraps at word boundaries. Continuation lines of a "- " bullet are indented to match. */
export const wrapLine = (line: string, width: number): string[] => {
  if (line.length <= width) return [line];
  const indent = line.startsWith("- ") ? "  " : "";
  const lines: string[] = [];
  let current = "";
  for (const word of line.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = indent + word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const buildPdf = (pageStreams: string[]): Buffer => {
  const pageIds = pageStreams.map((_, i) => 4 + i * 2);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...pageStreams.flatMap((stream, i) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${pageIds[i] + 1} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ]),
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, i) => {
    const offset = body.length;
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map(o => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
};

export const textToPdf = (text: string, columns: 1 | 2 = 1): Buffer => {
  const normalized = text.replace(/\r\n/g, "\n").trimEnd();
  // The built-in Helvetica font has no Unicode mapping, so other characters would be extracted as garbage.
  const unsupported = normalized.match(/[^\x20-\x7e\n]/);
  if (unsupported) throw new Error(`Fixtures must be plain ASCII, found ${JSON.stringify(unsupported[0])}`);
  const lines = normalized.split("\n");
  const breakAt = lines.indexOf(COLUMN_BREAK);
  const layout = columns === 2 ? TWO_COLUMNS : SINGLE;
  if (columns === 2 && breakAt < 0) throw new Error(`A two-column fixture needs a "${COLUMN_BREAK}" line`);
  const blocks = columns === 2 ? [lines.slice(0, breakAt), lines.slice(breakAt + 1)] : [lines];
  const wrapped = blocks.map((block, i) => block.flatMap(line => wrapLine(line, layout[i].chars)));
  const rowCount = Math.max(...wrapped.map(block => block.length));

  const pages: string[] = [];
  for (let first = 0; first < rowCount; first += ROWS_PER_PAGE) {
    const ops: string[] = [];
    for (let row = first; row < Math.min(first + ROWS_PER_PAGE, rowCount); row++) {
      const y = TOP - (row - first) * LEADING;
      wrapped.forEach((block, i) => {
        const line = block[row];
        if (line) ops.push(`BT /F1 ${FONT_SIZE} Tf ${layout[i].x} ${y} Td (${escapePdf(line)}) Tj ET`);
      });
    }
    pages.push(ops.join("\n"));
  }
  return buildPdf(pages);
};
