import { Repository } from './repository';

export async function updateLastReplyDate(repository: Repository) {
  let mismatched = await repository.getLastReplyMismatchedArticles(100);
  console.log(`Updating last reply date for ${mismatched.totalItems} articles. Total pages: ${mismatched.totalPages}`);
  while (mismatched.items.length > 0) {
    for (const item of mismatched.items) {
      await repository.updateArticle(item.id, {
        lastReplyDate: item.calculatedLastReplyDate,
        numReplies: item.calculatedNumReplies,
      });
    }

    mismatched = await repository.getLastReplyMismatchedArticles(100);
    console.log(`Updating last reply date for ${mismatched.totalItems} articles. Total pages: ${mismatched.totalPages}`);
  }
}
