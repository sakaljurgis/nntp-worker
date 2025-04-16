import { Repository } from './repository';
import { NntpClient } from './nntp-client';
import { checkPartialContentType, mapParsedMailToArticle } from './mapper';
import { ArticleRecord, Attachment } from './types';
import { parseAttachments } from './attachments';
import { writeFileSync } from 'fs';
import { checkAndCombinePartial } from './partial';
import { truncateText } from './truncate';
import { extractAllUUEncodedAttachments } from './uudecode';

export async function downloadAndProcessArticle(repository: Repository, groupName: string, articleNumber: number, nntpClient: NntpClient) {
  const groupId = await repository.getGroupId(groupName);
  if (!groupId) {
    console.log(`Group ${groupName} not found in local database`);
    return;
  }

  const groupArticleNumber = await repository.findGroupArticleNumber(groupName, articleNumber);

  if (groupArticleNumber) {
    console.log(`Article ${articleNumber} already exists in local database`);
    return;
  }

  if (nntpClient.getSelectedGroup() !== groupName) {
    await nntpClient.selectGroup(groupName);
  }


  const articleMail = await nntpClient.getArticle(articleNumber).catch(e => {
    console.log(e);
    return null;
  });

  if (!articleMail) {
    console.log('No article found');
    return;
  }

  const partial = checkPartialContentType(articleMail.headers);
  // restart from here after combining partials
  let attachments: Attachment[] = await parseAttachments(articleMail, partial);
  let article = mapParsedMailToArticle(articleMail, attachments);



  if (partial) {
    const filePath = `./partials/${partial.id}-part_${partial.number}-article.json`
    writeFileSync(filePath, JSON.stringify(article, null, 2));
    console.log(`Partial article saved to ${filePath}`);
  }

  if (partial) {
    const combined = await checkAndCombinePartial(partial);
    if (!combined) {
      return;
    }

    // TODO - this is duplicate code from let attachments = saveAttachments
    attachments = await parseAttachments(combined, null);
    article = mapParsedMailToArticle(combined, attachments);
  }

  if (!article.text) {
    article.text = '';
  }

  // check and extract uuencoded attachments
  const { text: newText, attachments: moreAttachments } = await extractAllUUEncodedAttachments(article.text);

  attachments = attachments.concat(moreAttachments);
  article.text = newText;

  article.text = article.text.trim();

  const groupsRecordsIds = await repository.findGroupsIdsByNames(article.groups);
  const parentRecordId = article.parent ? await repository.findArticleIdByArticleId(article.parent) : undefined;
  const referencesIds = await repository.findArticleIdsByArticleIds(article.references);

  const isRoot = article.references.length === 0;
  const { text, isTruncated, fullTextFile } = truncateText(article.text, isRoot)

  const data: ArticleRecord = {
    ...article,
    isRoot,
    groups: groupsRecordsIds,
    text,
    isTruncated,
    fullTextFile,
    references: referencesIds,
    parent: parentRecordId ?? null,
    guessRootId: article.references[0] ?? null,
    files: attachments.map((a)=>a.file),
  }

  try {
    const createRecord = await repository.createArticle(data);

    console.log('Record created:', createRecord.id);

    await repository.assignArticleToGroupsMessages(createRecord.id, article.inGroups);
  } catch (e) {
    console.log(data, article);
    throw e;
  }

  console.log('Done');
}
