import PDFDocument from "pdfkit";
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";
import { ParsedResume } from "../types";

/**
 * ATS-friendly means a single column of real text in reading order, standard section headings and a common font,
 * with no tables, text boxes, images or icons, which parsers often skip or scramble.
 */
export interface ExportResume {
  name: string;
  contact: string[];
  skills: string[];
  experience: { role: string; company: string; duration: string; bullets: string[] }[];
  projects: { name: string; description: string; techStack: string[] }[];
  education: string[];
}

export type ExportFormat = "pdf" | "docx";

const clean = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Built from the parsed resume, so anything the parser didn't keep, such as a phone number or links, is missing. */
export const toExportResume = (resume: ParsedResume): ExportResume => {
  const seen = new Set<string>();
  const skills = [...resume.skills, ...resume.tools].map(clean).filter(skill => {
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    name: clean(resume.name) || "Resume",
    contact: [resume.email, resume.location].map(clean).filter(Boolean),
    skills,
    experience: resume.workHistory.map(w => ({
      role: clean(w.role), company: clean(w.company), duration: clean(w.duration),
      bullets: w.highlights.map(clean).filter(Boolean),
    })),
    projects: resume.projects
      .map(p => ({ name: clean(p.name), description: clean(p.description), techStack: p.techStack.map(clean).filter(Boolean) }))
      .filter(p => p.name || p.description),
    education: resume.education
      .map(e => [[e.degree, e.field].map(clean).filter(Boolean).join(", "), clean(e.institution)].filter(Boolean).join(", "))
      .filter(Boolean),
  };
};

/** A file name without characters that some systems reject. */
export const exportFileName = (doc: ExportResume, format: ExportFormat): string =>
  `${doc.name.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "resume"}-resume.${format}`;

// ---------- PDF ----------

// The standard PDF fonts only cover Windows-1252. Accents are dropped where possible, and anything else is replaced,
// so the export never contains text an ATS would read as garbage. The DOCX export keeps every character.
const WIN_ANSI_EXTRAS = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);
const isWinAnsi = (ch: string): boolean => {
  const code = ch.codePointAt(0)!;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(ch);
};
export const toPdfText = (text: string): string =>
  [...text.normalize("NFC")].map(ch => {
    if (isWinAnsi(ch)) return ch;
    const plain = ch.normalize("NFD").replace(/\p{M}/gu, "");
    return [...plain].every(isWinAnsi) ? plain : "?";
  }).join("");

const PAGE_MARGIN = 54;
const BULLET_INDENT = 12;

export const toPdf = (doc: ExportResume): Promise<Buffer> => new Promise((resolve, reject) => {
  const pdf = new PDFDocument({ size: "LETTER", margin: PAGE_MARGIN, info: { Title: toPdfText(`${doc.name} resume`), Author: toPdfText(doc.name) } });
  const chunks: Buffer[] = [];
  pdf.on("data", chunk => chunks.push(chunk));
  pdf.on("end", () => resolve(Buffer.concat(chunks)));
  pdf.on("error", reject);

  const left = pdf.page.margins.left;
  const width = pdf.page.width - left - pdf.page.margins.right;
  const text = (value: string, font: string, size: number, options: PDFKit.Mixins.TextOptions = {}) =>
    pdf.font(font).fontSize(size).text(toPdfText(value), left, undefined, { width, ...options });

  const heading = (title: string) => {
    pdf.moveDown(0.8);
    text(title.toUpperCase(), "Helvetica-Bold", 11);
    const y = pdf.y + 1;
    pdf.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor("#888888").stroke();
    pdf.moveDown(0.4);
  };

  const bullet = (value: string) => {
    const y = pdf.y;
    pdf.font("Helvetica").fontSize(10).text("•", left, y, { width: BULLET_INDENT, lineBreak: false });
    pdf.text(toPdfText(value), left + BULLET_INDENT, y, { width: width - BULLET_INDENT });
    pdf.moveDown(0.15);
  };

  text(doc.name, "Helvetica-Bold", 18);
  if (doc.contact.length) text(doc.contact.join(" | "), "Helvetica", 10);

  if (doc.skills.length) {
    heading("Skills");
    text(doc.skills.join(", "), "Helvetica", 10);
  }
  if (doc.experience.length) {
    heading("Experience");
    doc.experience.forEach((job, i) => {
      if (i > 0) pdf.moveDown(0.5);
      text(job.role || job.company, "Helvetica-Bold", 10.5);
      const meta = [job.role ? job.company : "", job.duration].filter(Boolean).join(" | ");
      if (meta) text(meta, "Helvetica", 10);
      pdf.moveDown(0.2);
      job.bullets.forEach(bullet);
    });
  }
  if (doc.projects.length) {
    heading("Projects");
    doc.projects.forEach((project, i) => {
      if (i > 0) pdf.moveDown(0.4);
      if (project.name) text(project.name, "Helvetica-Bold", 10.5);
      if (project.description) text(project.description, "Helvetica", 10);
      if (project.techStack.length) text(`Technologies: ${project.techStack.join(", ")}`, "Helvetica", 10);
    });
  }
  if (doc.education.length) {
    heading("Education");
    doc.education.forEach(line => text(line, "Helvetica", 10));
  }
  pdf.end();
});

// ---------- DOCX ----------

const FONT = "Calibri";

const docxHeading = (title: string): Paragraph => new Paragraph({
  spacing: { before: 240, after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "888888", space: 1 } },
  children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 22 })],
});

const line = (value: string, options: { bold?: boolean; size?: number; after?: number } = {}): Paragraph => new Paragraph({
  spacing: { after: options.after ?? 0 },
  children: [new TextRun({ text: value, bold: options.bold, size: options.size })],
});

export const toDocx = (doc: ExportResume): Promise<Buffer> => {
  const children: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: doc.name, bold: true, size: 36 })] }),
  ];
  if (doc.contact.length) children.push(line(doc.contact.join(" | ")));

  if (doc.skills.length) children.push(docxHeading("Skills"), line(doc.skills.join(", ")));
  if (doc.experience.length) {
    children.push(docxHeading("Experience"));
    doc.experience.forEach((job, i) => {
      children.push(new Paragraph({
        spacing: { before: i > 0 ? 160 : 0 },
        children: [new TextRun({ text: job.role || job.company, bold: true })],
      }));
      const meta = [job.role ? job.company : "", job.duration].filter(Boolean).join(" | ");
      if (meta) children.push(line(meta, { after: 40 }));
      for (const text of job.bullets) children.push(new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 40 } }));
    });
  }
  if (doc.projects.length) {
    children.push(docxHeading("Projects"));
    doc.projects.forEach((project, i) => {
      if (project.name) children.push(new Paragraph({ spacing: { before: i > 0 ? 120 : 0 }, children: [new TextRun({ text: project.name, bold: true })] }));
      if (project.description) children.push(line(project.description));
      if (project.techStack.length) children.push(line(`Technologies: ${project.techStack.join(", ")}`));
    });
  }
  if (doc.education.length) {
    children.push(docxHeading("Education"));
    doc.education.forEach(text => children.push(line(text)));
  }

  const document = new Document({
    creator: doc.name,
    title: `${doc.name} resume`,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }],
  });
  return Packer.toBuffer(document);
};

export const exportResume = async (resume: ParsedResume, format: ExportFormat): Promise<{ buffer: Buffer; fileName: string; contentType: string }> => {
  const doc = toExportResume(resume);
  return format === "pdf"
    ? { buffer: await toPdf(doc), fileName: exportFileName(doc, "pdf"), contentType: "application/pdf" }
    : {
      buffer: await toDocx(doc), fileName: exportFileName(doc, "docx"),
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
};
