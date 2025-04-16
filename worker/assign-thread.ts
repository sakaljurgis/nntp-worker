import { Repository } from './repository';

export async function assignThread(repository: Repository) {
  // root
  let rootWithoutThread = await repository.getArticlesCollection().getList(1, 100, {
    filter: 'thread=null&&isRoot=true',
  })
  console.log(`Updating root thread for ${rootWithoutThread.totalItems} articles. Total pages: ${rootWithoutThread.totalPages}`);

  while (rootWithoutThread.items.length > 0) {
    for (const item of rootWithoutThread.items) {
      await repository.updateArticle(item.id, { thread: item.id });
    }

    rootWithoutThread = await repository.getArticlesCollection().getList(1, 100, {
      filter: 'thread=null&&isRoot=true',
    })
    console.log(`Updating root thread for ${rootWithoutThread.totalItems} articles. Total pages: ${rootWithoutThread.totalPages}`);
  }

  // replies
  let replyWithoutThreadWithRoot = await repository.getArticlesCollection().getList(1, 100, {
    filter: 'thread=null&&references.isRoot?=true',
    expand: 'references',
  })
  console.log(`Updating reply thread for ${replyWithoutThreadWithRoot.totalItems} articles. Total pages: ${replyWithoutThreadWithRoot.totalPages}`);

  while (replyWithoutThreadWithRoot.items.length > 0) {
    for (const item of replyWithoutThreadWithRoot.items) {
      let rootId: string | null = null;
      // @ts-ignore
      for (const ref of item.expand.references) {
        if (ref.isRoot) {
          rootId = ref.id;
          break;
        }
      }

      if (rootId) {
        await repository.updateArticle(item.id, { thread: rootId });
      }
    }

    replyWithoutThreadWithRoot = await repository.getArticlesCollection().getList(1, 100, {
      filter: 'thread=null&&references.isRoot?=true',
      expand: 'references',
    })
    console.log(`Updating reply thread for ${replyWithoutThreadWithRoot.totalItems} articles. Total pages: ${replyWithoutThreadWithRoot.totalPages}`);
  }
}
