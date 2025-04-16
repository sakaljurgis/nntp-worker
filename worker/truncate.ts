export function truncateText(originalText: string | undefined, isRoot: boolean) {

  const allowedLength = isRoot ? 8000 : 4000;
  const level3Threshold = 1000; // if more than this, truncate L3 (>>>) quotes
  const level2Threshold = 1000; // if after truncation more than this, truncate L2 (>>) quotes
  const level1Threshold = 2500; // if after truncation more than this, truncate L1 (>) quotes

  originalText = originalText ?? '';
  let txt = originalText ?? '';

  let isTruncated = false;

  if (txt.length > level3Threshold && !isRoot) {
    const truncateResult = truncateQuotes(txt, isTruncated, 3);
    isTruncated = truncateResult.isTruncated;
    txt = truncateResult.truncatedText;
  }

  if (txt.length > level2Threshold && !isRoot) {
    const truncateResult = truncateQuotes(txt, isTruncated, 2);
    isTruncated = truncateResult.isTruncated;
    txt = truncateResult.truncatedText;
  }

  if (txt.length > level1Threshold && !isRoot) {
    const truncateResult = truncateQuotes(txt, isTruncated, 1);
    isTruncated = truncateResult.isTruncated;
    txt = truncateResult.truncatedText;
  }

  const truncateMore = txt.length > allowedLength;
  const fullTextFile = isTruncated || truncateMore ? new File([originalText], 'article.txt', { type: 'text/plain' }) : null;
  const text = truncateMore ? txt.substring(0, allowedLength) : txt;

  return {
    text,
    isTruncated,
    fullTextFile,
  }
}

/* todo - check if needs a blank row in between
test test test
> ok this is one level
>> another one
>
> back to one

done
*/
function truncateQuotes(text: string, isTruncated: boolean, level: number) {
  const lines = text.split('\n');
  const levelString = '>'.repeat(level);
  let currentlyInNestedQuote = false;
  const truncatedText = lines.map((line) => {
    return line.trim();
  }).filter((line) => {
    if (line.startsWith(levelString)) {
      isTruncated = true;
      if (currentlyInNestedQuote) {
        return false;
      }
      currentlyInNestedQuote = true;
      return true;
    }
    currentlyInNestedQuote = false;
    return true;
  }).map((line) => {
    if (line.startsWith(levelString)) {
      return `${line.substring(0,49)} ...[truncated]`;
    }
    return line;
  }).join('\n');

  return {
    truncatedText,
    isTruncated,
  }
}

// function fixLineQuotes(text: string): string {
//   // Only fix quote markers at the beginning of the string
//   const match = text.match(/^((?:>\s*)+)(.*)$/);
//
//   if (!match) {
//     return text;
//   }
//
//   const [, quotePart, contentPart] = match;
//
//   // Count the number of > characters in the quote part
//   const quoteCount = (quotePart.match(/>/g) || []).length;
//
//   // Create a normalized quote prefix
//   const normalizedPrefix = '>'.repeat(quoteCount);
//
//   // Add a space if there's content after the quotes
//   return contentPart.length > 0 ?
//     `${normalizedPrefix} ${contentPart}` :
//     normalizedPrefix;
// }

// function test() {
//   const tests = [
//     'test this out',
//     '>> > test3 with some addi > tional',
//     '>> > test3 with some addi >>> tional',
//     '>> > test3 with some addi > >> tional',
//     '>> > test3 with some addi > > > tional',
//     '>> test',
//     '>>test',
//     '> test',
//     '>test',
//     '>> test',
//     '>>test',
//     '>> > test',
//     '>> >test',
//     '>> > > test',
//     '>> > >test',
//     '>> > > > test',
//     '>> > > >test',
//     '>> > > > > test',
//     '>> > > > >test',
//     '>> > > > > > test',
//     '>> > > > > >test',
//     `> >> what about
// > >> multiline`
//   ]
//   tests.forEach((test) => {
//     console.log({
//       test,
//       resl: fixLineQuotes(test),
//     });
//   })
// }
// test();
