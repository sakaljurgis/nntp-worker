import { Repository } from '../worker/repository';
import { MeiliSearch } from 'meilisearch';
import dotenv from 'dotenv';
dotenv.config();

async function syncSearch() {
  const start = Date.now();
  const { PB_URL, PB_USER, PB_PASS, SEARCH_HOST, SEARCH_KEY } = process.env;
  if (!PB_URL || !PB_USER || !PB_PASS || !SEARCH_HOST || !SEARCH_KEY) {
    throw new Error('Missing environment variables');
  }

  const repository = new Repository(PB_URL, PB_USER, PB_PASS);
  await repository.connect();

  const searchClient = new MeiliSearch({
    host: SEARCH_HOST,
    apiKey: SEARCH_KEY,
  })

  const indexes = await searchClient.getIndexes()

  const index = indexes.results.find((index) => index.uid === 'articles')

  if (!index) {
    await searchClient.createIndex('articles', {primaryKey: 'id'});
  }

  const searchIndex = await searchClient.getIndex('articles');
  const sortable = await searchIndex.getSortableAttributes()

  if (!sortable.includes('date')) {
    await searchIndex.updateSortableAttributes(['date'])
  }

  let page = 1
  const perPage = 100;
  let totalPages = 1
  let totalUpdated = 0;

  while (page <= totalPages) {
    const articles = await repository.getArticlesCollection().getList(page, perPage, {
      filter: 'isRoot=true',
      expand: 'groups',
    });
    totalPages = articles.totalPages;
    page++;

    const batchUpdate = [];
    for (const article of articles.items) {
      const data = {
        id: article.id,
        subject: article.subject,
        groups: article?.expand?.groups.map((g: {name: string }) => g.name) || [],
        text: article.text,
        date: article.date,
        from: article.from,
      };

      if (data.groups.length === 1 && data.groups[0] === 'omnitel.test') {
        continue;
      }

      batchUpdate.push(data);
    }

    totalUpdated += batchUpdate.length;
    searchIndex.addDocuments(batchUpdate)
  }

  console.log(`search sync completed with ${totalUpdated} items in ${Math.round((Date.now() - start) / 1000)} sec.`)
}

syncSearch();
