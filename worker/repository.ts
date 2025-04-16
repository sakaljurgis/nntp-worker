import Pocketbase, { RecordModel } from 'pocketbase';
import { ArticleRecord, Attachment, GroupRecord } from './types';
import { readFile } from 'fs/promises';
import { writeFileSync } from 'fs';

export class Repository {
  private readonly client: Pocketbase;
  private groupToId: Map<string, string> | null = null;
  constructor(
    url: string,
    private readonly username: string,
    private readonly password: string
  ) {
    this.client = new Pocketbase(url);
  }

  async connect() {
    return await this.client.collection('_superusers').authWithPassword(
      this.username,
      this.password,
      { autoRefreshThreshold: 30 * 60 }
    );
  }

  /**
   * key groupName
   * value groupId
   * todo - this can be cached
   */
  async getGroupsIds() {
    if (!this.groupToId) {
      const groupToId = new Map<string, string>();
      (await this.client.collection('groups').getFullList()).forEach((group) => {
        groupToId.set(group.name, group.id);
      });

      this.groupToId = groupToId;
    }

    return this.groupToId;
  }

  async getAllGroups() {
    return await this.client.collection<GroupRecord & RecordModel>('groups').getFullList()
  }

  async updateGroupData(groupData: Partial<GroupRecord>) {
    const groupsCollection = this.client.collection('groups');
    if (!groupData.name) {
      return;
    }
    const groupId = await this.getGroupId(groupData.name);
    if (!groupId) {
      return;
    }

    return await groupsCollection.update(groupId, groupData);
  }

  async findGroupArticleNumber(groupName: string, articleNumber: number) {
    const groupId = await this.getGroupId(groupName);

    if (!groupId) {
      return null;
    }

    return await this.client
      .collection('groupArticleNumber')
      .getFirstListItem(`group="${groupId}" && number="${articleNumber}"`)
      .catch(() => null);
  }

  async getGroupId(groupName: string) {
    const groupsIds = await this.getGroupsIds();

    return groupsIds.get(groupName);
  }

  async findGroupsIdsByNames(groupNames: string[]) {
    if (groupNames.length === 0) {
      return [];
    }

    const groupsCollection = this.client.collection('groups');
    const groups = await groupsCollection.getList(1, 100, {
      filter: groupNames.map((name: string) => `name="${name}"`).join('||'),
    });

    return groups.items.map((group) => group.id);
  }

  async findArticleIdByArticleId(articleId: string) {
    const articlesCollection = this.client.collection('articles');

    const articleRecord = await articlesCollection.getFirstListItem(`articleId="${articleId}"`).catch(() => undefined);

    return articleRecord?.id;
  }

  async findArticleIdsByArticleIds(articleIds: string[]) {
    if (articleIds.length === 0) {
      return [];
    }

    const articlesCollection = this.client.collection('articles');

    const articles = await articlesCollection.getList(1, 100, {
      filter: articleIds.map((name: string) => `articleId="${name}"`).join('||'),
    }).catch(() => ({ items: [] }));

    return articles.items.map((art) => art.id);
  }

  async assignArticleToGroupsMessages(id: string, groupsMessageNumbers: { groupName: string; messageNumber: string }[]) {
    const availableGroups = await this.getGroupsIds();

    const promises = groupsMessageNumbers.map(async (inGroup) => {
      const groupId = availableGroups.get(inGroup.groupName);
      if (!groupId) {
        return;
      }
      console.log(`Adding article ${id} to group ${inGroup.groupName} with number ${inGroup.messageNumber}`);
      return await this.client
        .collection('groupArticleNumber')
        .create({
          group: groupId,
          article: id,
          number: inGroup.messageNumber
        }, {requestKey: `${groupId}-${id}-${inGroup.messageNumber}`});
    });

    return await Promise.all(promises);
  }

  async createArticle(articleRecord: ArticleRecord) {
    const articlesCollection = this.client.collection('articles');

    return await articlesCollection.create<ArticleRecord & RecordModel>(articleRecord);
  }

  async updateArticle(articleId: string, articleRecord: Partial<ArticleRecord>) {
    const articlesCollection = this.client.collection('articles');

    return await articlesCollection.update(articleId, articleRecord);
  }

  getArticlesCollection() {
    return this.client.collection('articles');
  }

  async getLastReplyMismatchedArticles(numItems = 100) {
    const lastReplyCollection = this.client.collection('lastReply');

    return await lastReplyCollection.getList<{id: string, calculatedLastReplyDate: string, calculatedNumReplies: number}>(1,numItems, {
      filter: 'lastReplyDate!=calculatedLastReplyDate||numReplies!=calculatedNumReplies',
    });
  }

  async createGroup(groupName: string) {
    const groupsCollection = this.client.collection('groups');
    this.groupToId = null;

    return await groupsCollection.create({ name: groupName, numLastSynced: 0 }, { requestKey: groupName });
  }

  async updateGroupLastSynced(groupName: string, lastUpdatedNumber: number) {
    const groupsCollection = this.client.collection('groups');
    const groupIds = await this.getGroupsIds();
    const groupId = groupIds.get(groupName);

    if (!groupId) {
      return;
    }

    return await groupsCollection.update(groupId, { numLastSynced: lastUpdatedNumber });
  }

  async getGroupLastSynced(groupName: string): Promise<number> {
    const groupsCollection = this.client.collection('groups');
    const groupIds = await this.getGroupsIds();
    const groupId = groupIds.get(groupName);

    if (!groupId) {
      return 0;
    }

    const group = await groupsCollection.getOne(groupId)

    return group.numLastSynced;
  }
}
