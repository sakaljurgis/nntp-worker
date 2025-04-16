export interface Attachment {
  fileName: string;
  file?: File;
  size: number;
  checksum: string;
  contentType: string;
}

export interface PartialMessageMime {
  value: string;
  params: { number: number; total: number; id: string }
}

export interface ArticleRecord {
  // from nntp
  articleId?: string;
  subject?: string;
  from?: string;
  text?: string;
  headers: Record<string, unknown>;
  date?: Date;
  isRoot: boolean;
  isTruncated: boolean;
  fullTextFile: File | null;
  fullHtmlFile?: File;
  // from nntp and remaped from repo
  groups: string[];
  files: (File | undefined)[];
  references: string[];
  parent: string | null;
  guessRootId?: string;
  lastReplyDate?: string;
  numReplies?: number;
  thread?: string;
}

export interface GroupRecord {
  name: string,
  numLastSynced: number
  first: number,
  last: number,
}
