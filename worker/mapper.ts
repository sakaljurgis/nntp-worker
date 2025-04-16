import { Headers, ParsedMail, StructuredHeader } from 'mailparser'
import { Attachment, PartialMessageMime } from './types';

export const checkPartialContentType = (headers: Headers): PartialMessageMime['params'] | null => {
  const contentType = headers.get('content-type') as StructuredHeader | undefined;
  if (!contentType || !contentType.value || !contentType.value.includes('message/partial')) {
    return null;
  }

  const params = contentType.params;

  if (!params || !params.number || !params.total || !params.id) {
    return null;
  }

  return {
    number: parseInt(params.number),
    total: parseInt(params.total),
    id: params.id,
  };
}

export const mapParsedMailToArticle = (article: ParsedMail, attachments: Attachment[]) => {
  let references: string[] | string = article.headers.get('references') as string[] | string || [];
  if (typeof references === 'string') {
    references = [references];
  }

  const groups = article.headers.get('newsgroups') as string;
  const xref = article.headers.get('xref') as string;
  const parent = article.headers.get('in-reply-to') as string ?? references[references.length - 1];

  return {
    groups: groups.split(','),
    subject: article.subject,
    from: article.from?.text,
    date: article.date,
    articleId: article.messageId,
    inGroups: xref.split(' ').map((group: string) => {
      return {
        groupName: group.split(':')[0],
        messageNumber: group.split(':')[1],
      }
    }),
    references,
    parent,
    text: article.text,
    attachments: attachments,
    headers: Object.fromEntries(article.headers),
  };
}
