import { inflateRawSync } from "zlib";
import { describe, expect, it } from "vitest";
import { toComparable } from "../src/services/evidence";
import { exportFileName, exportResume, toDocx, toExportResume, toPdf, toPdfText } from "../src/services/resumeExport";
import { ParsedResume } from "../src/types";
import { extractPdfText } from "../src/utils/pdfText";

const RESUME = {
  name: "Zoë Novák", email: "zoe@example.com", location: "Berlin, Germany", workAuthorization: "",
  skills: ["TypeScript", "Node.js", "PostgreSQL"], tools: ["Docker", "typescript"],
  skillEvidence: [], yearsOfExperience: 6, experienceByDomain: [],
  education: [{ degree: "BSc", field: "Computer Science", institution: "TU Berlin" }],
  projects: [{ name: "queue-viz", description: "Visualizes message queues in real time", techStack: ["React", "D3"] }],
  workHistory: [
    { company: "Shipfast", role: "Senior Backend Engineer", duration: "2021 - 2024", highlights: [
      "Built order APIs in Node.js and TypeScript serving 2 million requests a day across 14 regions with automatic failover between them",
      "Cut PostgreSQL p95 latency from 900ms to 120ms with targeted indexes",
    ] },
    { company: "Webco", role: "Developer", duration: "2018 - 2021", highlights: ["Packaged 30 services with Docker for a team of 6"] },
  ],
  rawText: "",
} as ParsedResume;

const doc = toExportResume(RESUME);
const allBullets = RESUME.workHistory.flatMap(w => w.highlights);

/** Reads one file out of a zip, which is all a .docx is, using only Node's zlib. */
const readZipEntry = (zip: Buffer, name: string): string => {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let offset = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    const nameLength = zip.readUInt16LE(offset + 28);
    const entryName = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (entryName === name) {
      const method = zip.readUInt16LE(offset + 10);
      const size = zip.readUInt32LE(offset + 20);
      const local = zip.readUInt32LE(offset + 42);
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    }
    offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
  }
  throw new Error(`${name} not found in zip`);
};

describe("toExportResume", () => {
  it("merges skills and tools without repeating one", () => {
    expect(doc.skills).toEqual(["TypeScript", "Node.js", "PostgreSQL", "Docker"]);
  });

  it("keeps contact details, roles in order, projects and education", () => {
    expect(doc.contact).toEqual(["zoe@example.com", "Berlin, Germany"]);
    expect(doc.experience.map(e => e.company)).toEqual(["Shipfast", "Webco"]);
    expect(doc.projects[0].techStack).toEqual(["React", "D3"]);
    expect(doc.education).toEqual(["BSc, Computer Science, TU Berlin"]);
  });

  it("names the file after the candidate without accents or spaces", () => {
    expect(exportFileName(doc, "pdf")).toBe("Zoe-Novak-resume.pdf");
  });
});

describe("toPdfText", () => {
  it("keeps characters the standard PDF fonts can show", () => {
    expect(toPdfText("Zoë – café • “quoted”")).toBe("Zoë – café • “quoted”");
  });

  it("drops accents the fonts lack and replaces what they can't show at all", () => {
    expect(toPdfText("Dvořák 東京")).toBe("Dvorák ??");
  });
});

describe("PDF export", () => {
  it("produces text an ATS can read: every bullet, whole and in order", async () => {
    const text = await extractPdfText(await toPdf(doc));
    const comparable = toComparable(text);
    const positions = allBullets.map(b => comparable.indexOf(toComparable(b)));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    for (const heading of ["SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION"]) expect(text).toContain(heading);
    expect(comparable.indexOf("experience")).toBeLessThan(comparable.indexOf("education"));
    expect(text).toContain("Zoë Novák");
  });

  it("includes the accepted rewrites in place of the originals", async () => {
    const { buffer, contentType } = await exportResume({
      ...RESUME,
      workHistory: [{ ...RESUME.workHistory[1], highlights: ["Containerized 30 services with Docker for a team of 6"] }],
    }, "pdf");
    expect(contentType).toBe("application/pdf");
    const text = toComparable(await extractPdfText(buffer));
    expect(text).toContain(toComparable("Containerized 30 services with Docker"));
    expect(text).not.toContain(toComparable("Packaged 30 services"));
  });
});

describe("DOCX export", () => {
  it("writes every bullet as a real list item, in order, keeping every character", async () => {
    const xml = readZipEntry(await toDocx(doc), "word/document.xml");
    const text = xml.replace(/<[^>]+>/g, "");
    const positions = allBullets.map(b => text.indexOf(b));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(text).toContain("Zoë Novák");
    expect(xml.match(/<w:numPr>/g)).toHaveLength(allBullets.length);
    expect(xml).not.toContain("<w:tbl>");
  });
});
