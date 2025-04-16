// import { readFileSync, writeFileSync } from 'fs';
import { Attachment } from './types';
import * as crypto from 'crypto';

function uudecode(uuencodedText: string) {
  // Regular expressions to identify UUencoded content
  const beginRegex = /^begin\s+(\d+)\s+(\S+)\s*$/;
  const endRegex = /^end\s*$/;
  const uuLineRegex = /^[M-` ]/;

  // Split input into lines
  const lines = uuencodedText.split(/\r?\n/);

  let collecting = false;
  let fileName = null;
  let fileMode = null;
  let encodedData = [];

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

    // Collect UUencoded lines
    if (collecting && uuLineRegex.test(line)) {
      encodedData.push(line);
    }
  }

  // Actual UUdecoding
  let decodedData = new Uint8Array(encodedData.reduce((acc, line) => {
    if (line.length <= 1) return acc; // Skip empty lines

    // First character of each line indicates the length
    const length = (line.charCodeAt(0) - 32) & 0x3F;
    if (length === 0) return acc; // Skip zero-length lines

    // Process the line in groups of 4 characters
    const bytes = [];
    for (let i = 1; i < line.length; i += 4) {
      if (i + 3 >= line.length) break;

      // Decode each group of 4 characters into 3 bytes
      const chars = line.slice(i, i + 4).split('').map(c => (c.charCodeAt(0) - 32) & 0x3F);

      if (bytes.length < length) bytes.push((chars[0] << 2) | (chars[1] >> 4));
      if (bytes.length < length) bytes.push(((chars[1] & 0x0F) << 4) | (chars[2] >> 2));
      if (bytes.length < length) bytes.push(((chars[2] & 0x03) << 6) | chars[3]);
    }

    return acc.concat(bytes);
  }, [] as number[]));

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

  // remove the decoded data from the text message
  let text = '';
  if (positions.length === 0) {
    text = messageText;
  }

  if (positions.length > 1) {
    // remove one by one in reverse order
    text = messageText;
    for (let i = positions.length - 1; i >= 0; i--) {
      const [startPos, endPos] = positions[i];
      text = text.substring(0, startPos) + text.substring(endPos);
    }
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
