import { Attachment, PartialMessageMime } from './types';
import { writeFileSync } from 'fs';
import { type ParsedMail } from 'mailparser';

export const parseAttachments = async (article: ParsedMail, partial: PartialMessageMime['params'] | null) => {
  let attachments: Attachment[] = [];
  if (!article.attachments) {
    return attachments;
  }

  article.attachments.map((attachment) => {
    if (partial) {
      const fileName = `${partial.id}-part_${partial.number}-attachment`;
      const filePath = `./partials/${fileName}`
      writeFileSync(filePath, attachment.content);
    }

    attachments.push({
      file: partial ? undefined : new File([attachment.content], attachment.filename ?? crypto.randomUUID(), { type: attachment.contentType }),
      fileName: attachment.filename ?? '',
      size: attachment.size,
      checksum: attachment.checksum,
      contentType: attachment.contentType,
    })
  });

  return attachments;
}
