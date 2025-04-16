import { PartialMessageMime } from './types';
import { stat, readFile, unlink } from 'fs/promises';
import { simpleParser } from 'mailparser';

export const checkAndCombinePartial = async (partial: PartialMessageMime['params']) => {
  const allStats = await Promise.allSettled(
    [...
      Array(partial.total)
      .fill(null)
      .map((_, i) => stat(`./partials/${partial.id}-part_${i + 1}-attachment`)),
      ...Array(partial.total)
        .fill(null)
        .map((_, i) => stat(`./partials/${partial.id}-part_${i + 1}-article.json`)),
      ]
  );
  const allExists = allStats.every((result) => result.status === 'fulfilled' && result.value.isFile());

  if (!allExists) {
    return null;
  }

  //combine all partials
  const filesReadPromises = Array(partial.total)
    .fill(null)
    .map((_, index) => {
      console.log(`Reading file ./partials/${partial.id}-part_${index + 1}-attachment`)
      return readFile(`./partials/${partial.id}-part_${index + 1}-attachment`)
    })

  const files = await Promise.all(filesReadPromises);

  const file = Buffer.concat(files);

  const parsed = await simpleParser(file);
  const xrefs = new Set<string>();
  let articleId = '';
  const articlesReadPromises = Array(partial.total)
    .fill(null)
    .map(async (_, index) => {
      console.log(`Reading file ./partials/${partial.id}-part_${index + 1}-article.json`)
      const articleJson = await readFile(`./partials/${partial.id}-part_${index + 1}-article.json`)
      const article = JSON.parse(articleJson.toString());
      if (index === 0) {
        articleId = article.articleId;
      }
      if (article && article.headers && article.headers.xref) {
        return article.headers.xref as string;
      }
    })

  const articlesXrefs = await Promise.all(articlesReadPromises);

  articlesXrefs.forEach((xref) => {
    if (xref) {
      xref.split(' ').forEach(xre => xrefs.add(xre))
    }
  })

  parsed.headers.set('xref', Array.from(xrefs).join(' '));

  if (!articleId) {
    throw new Error(`articleId not found for ${partial.id}`);
  }

  const deletePromises = Array(partial.total)
    .fill(null)
    .map(async (_, index) => {
      console.log(`Deleting file ./partials/${partial.id}-part_${index + 1}-article.json`)
      await unlink(`./partials/${partial.id}-part_${index + 1}-article.json`)
      console.log(`Deleting file ./partials/${partial.id}-part_${index + 1}-attachment`)
      await unlink(`./partials/${partial.id}-part_${index + 1}-attachment`)
    })

  await Promise.all(deletePromises);
  parsed.headers.set('messageId', articleId);
  parsed.messageId = articleId;

  return parsed;
}
