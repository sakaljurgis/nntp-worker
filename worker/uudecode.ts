// import { readFileSync, writeFileSync } from 'fs';
import { Attachment } from './types';
import * as crypto from 'crypto';

// Decodes one uuencoded character to its 6-bit value. Reading past the end of
// the line yields 0, which handles encoders that strip trailing spaces.
const decodeChar = (line: string, index: number) => (line.charCodeAt(index) - 32) & 0x3F;

function uudecode(uuencodedText: string) {
  // Regular expressions to identify UUencoded content
  const beginRegex = /^begin\s+(\d+)\s+(\S+)\s*$/;
  const endRegex = /^end\s*$/;
  // The first char encodes the line length: ' ' (0) .. 'M' (45), '`' is an alternative 0
  const uuLineRegex = /^[ -`]/;

  // Split input into lines
  const lines = uuencodedText.split(/\r?\n/);

  let collecting = false;
  let fileName = null;
  let fileMode = null;
  const encodedLines: string[] = [];

  // Extract the UUencoded portion
  for (const line of lines) {
    // Check for beginning of UUencoded data
    const beginMatch = line.match(beginRegex);
    if (beginMatch) {
      collecting = true;
      fileMode = beginMatch[1];
      fileName = beginMatch[2];
      continue;
    }

    // Check for end of UUencoded data
    if (endRegex.test(line)) {
      collecting = false;
      continue;
    }

    // Collect UUencoded lines, skipping empty ones
    if (collecting && line.length > 1 && uuLineRegex.test(line)) {
      encodedLines.push(line);
    }
  }

  // Actual UUdecoding into a preallocated buffer, so the cost stays linear in the input size.
  const totalLength = encodedLines.reduce((sum, line) => sum + decodeChar(line, 0), 0);
  const decodedData = new Uint8Array(totalLength);
  let offset = 0;

  for (const line of encodedLines) {
    const lineEnd = offset + decodeChar(line, 0);

    // Each group of 4 characters decodes into 3 bytes
    for (let i = 1; offset < lineEnd; i += 4) {
      const c0 = decodeChar(line, i);
      const c1 = decodeChar(line, i + 1);
      const c2 = decodeChar(line, i + 2);
      const c3 = decodeChar(line, i + 3);

      decodedData[offset++] = (c0 << 2) | (c1 >> 4);
      if (offset < lineEnd) decodedData[offset++] = ((c1 & 0x0F) << 4) | (c2 >> 2);
      if (offset < lineEnd) decodedData[offset++] = ((c2 & 0x03) << 6) | c3;
    }
  }

  return {
    fileName,
    fileMode,
    data: decodedData
  };
}

export async function extractAllUUEncodedAttachments(messageText: string) {
  const beginRegex = /^begin\s+(\d+)\s+(\S+)\s*$/mg;
  const results = [];
  let match;
  const positions: [number, number][] = [];

  // Find all "begin" markers
  while ((match = beginRegex.exec(messageText)) !== null) {

    const startPos = match.index;
    const endPos = messageText.indexOf("\nend", startPos);

    if (endPos !== -1) {
      const encodedSection = messageText.substring(startPos, endPos + 4);
      const decoded = uudecode(encodedSection);
      if (decoded.data.length > 0) {
        results.push(decoded);
      }

      positions.push([startPos, endPos + 4]);
    }
  }

  // remove the decoded data from the text message, in reverse order so earlier positions stay valid
  let text = messageText;
  for (let i = positions.length - 1; i >= 0; i--) {
    const [startPos, endPos] = positions[i];
    text = text.substring(0, startPos) + text.substring(endPos);
  }

  // for (let i = 0; i < positions.length; i++) {
  //   const [startPos, endPos] = positions[i];
  //   text += messageText.substring(0, startPos) + messageText.substring(endPos);
  // }

  const attachmentsPromises: Promise<Attachment>[] = results.map(async (result) => {
    return {
      file: new File([result.data], result.fileName ?? ''),
      fileName: result.fileName ?? '',
      size: result.data.length,
      // md5 of result.data
      checksum: crypto.createHash('md5').update(result.data).digest('hex'),
      contentType: 'application/octet-stream', // todo - extract from
    }
  })

  const attachments = await Promise.all(attachmentsPromises);


  return {
    attachments,
    positions,
    text,
  };
}

// async function test() {
//   const articleString = readFileSync('../err/article_2.json').toString();
//   const article = JSON.parse(articleString);
//
//   const result = await extractAllUUEncodedAttachments(article.text);
//   article.text = result.text;
//   writeFileSync('../err/article_3.json', JSON.stringify(article, null, 2));
//   for (const attachment of result.attachments) {
//     if (attachment.file) {
//       writeFileSync(`../err/${attachment.fileName}`, Buffer.from((await attachment.file.arrayBuffer())));
//     }
//   }
//
//   console.log(result);
// }
//
// test();
