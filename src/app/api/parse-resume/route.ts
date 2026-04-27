import { NextResponse } from "next/server";

/* eslint-disable @typescript-eslint/no-require-imports */
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * Extract readable text from binary file formats like .doc and .rtf
 * by pulling out printable ASCII/Unicode strings.
 */
function extractTextFromBinary(buffer: Buffer): string {
  const text = buffer.toString("utf-8", 0, buffer.length);
  const lines = text
    .replace(/[^\x20-\x7E\r\n\t]/g, " ")
    .split(/\s+/)
    .filter((word: string) => word.length >= 2);
  return lines.join(" ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Parse PDF using pdf-parse v2 API (pdfjs-based).
 * Try the v2 PDFParse class first, then fall back to simpler extraction.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Try v2 PDFParse class API
  try {
    if (pdfParse.PDFParse) {
      const parser = new pdfParse.PDFParse({
        verbosity: 0,
        data: new Uint8Array(buffer),
      });

      const doc = await parser.load();
      let allText = "";

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: { str: string }) => item.str)
          .join(" ");
        allText += pageText + "\n";
      }

      await parser.destroy();
      return allText.trim();
    }
  } catch (err) {
    console.warn("pdf-parse v2 PDFParse failed, trying fallback:", err);
  }

  // Fallback: try calling pdf-parse as a function (v1 API)
  try {
    if (typeof pdfParse === "function") {
      const result = await pdfParse(buffer);
      return (result.text || "").trim();
    }
    if (typeof pdfParse.default === "function") {
      const result = await pdfParse.default(buffer);
      return (result.text || "").trim();
    }
  } catch (err) {
    console.warn("pdf-parse v1 fallback failed:", err);
  }

  // Last resort: extract readable text from raw PDF binary
  return extractTextFromBinary(buffer);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = file.name.toLowerCase();

    let extractedText = "";

    // PDF files
    if (file.type === "application/pdf" || fileName.endsWith(".pdf")) {
      extractedText = await extractPdfText(buffer);
    }
    // DOCX files (modern Word)
    else if (
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }
    // DOC files (legacy Word) — mammoth can sometimes handle these too
    else if (
      file.type === "application/msword" ||
      fileName.endsWith(".doc")
    ) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } catch {
        extractedText = extractTextFromBinary(buffer);
      }
    }
    // RTF files
    else if (
      file.type === "application/rtf" ||
      file.type === "text/rtf" ||
      fileName.endsWith(".rtf")
    ) {
      const rtfContent = buffer.toString("utf-8");
      extractedText = rtfContent
        .replace(/\\[a-z]+[-]?\d*\s?/g, "")
        .replace(/[{}]/g, "")
        .replace(new RegExp("\\\\'[0-9a-f]{2}", "gi"), "")
        .replace(/\s{2,}/g, " ")
        .trim();
    }
    // Plain text fallback (.txt, .md, .csv, etc.)
    else if (
      file.type.startsWith("text/") ||
      fileName.endsWith(".txt") ||
      fileName.endsWith(".md") ||
      fileName.endsWith(".csv") ||
      fileName.endsWith(".json")
    ) {
      extractedText = buffer.toString("utf-8");
    }
    // Unsupported format
    else {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type || fileName.split(".").pop()}. Please use PDF, DOCX, DOC, RTF, or TXT.`,
        },
        { status: 400 }
      );
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not extract any text from this file. Please try a different format or paste your resume text manually.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ text: extractedText }, { status: 200 });
  } catch (error) {
    console.error("Resume Parsing Error:", error);
    return NextResponse.json(
      { error: "Failed to parse document. Please try pasting your resume text manually." },
      { status: 500 }
    );
  }
}
