import { Repository } from './repository';
import { NntpClient } from './nntp-client';
import { downloadAndProcessArticle } from './article';

export const updateGroupsList = async (repository: Repository, nntpClient: NntpClient) => {
  const groupsById = await repository.getGroupsIds();
  const groups = await nntpClient.listGroups();
  const groupsRecords = await repository.getAllGroups();
  const filteredGroups: typeof groups = [];

  const createGroupPromises = groups.map(async (group) => {
    if (!group.group.startsWith('omnitel.')) {
      return;
    }
    if (group.group === 'omnitel.binaries') {
      return;
    }
    filteredGroups.push(group);

    if (!groupsById.has(group.group)) {
      return await repository.createGroup(group.group);
    }

    return await repository.updateGroupData({
      name: group.group,
      last: group.last,
      first: group.first,
    })
  })

  await Promise.all(createGroupPromises);

  return filteredGroups;
}

export const downloadAndProcessGroup = async (
  groupsList: Awaited<ReturnType<typeof updateGroupsList>>,
  groupName: string,
  repository: Repository,
  nntpClient: NntpClient
) => {
  const group = groupsList.find((g) => g.group === groupName);

  if (!group) {
    console.log(`Group ${groupName} not found`);
    return 0;
  }


  const lastSynced = await repository.getGroupLastSynced(groupName);

  if (lastSynced >= group.last) {
    console.log(`Group ${groupName} already synced`);
    return 0;
  }

  const articleNumberStart = lastSynced + 1;
  const articleNumberEnd = group.last;
  let numDownloaded = 0;

  for (let articleNumber = articleNumberStart; articleNumber <= articleNumberEnd; articleNumber++) {
    await downloadAndProcessArticle(repository, groupName, articleNumber, nntpClient);
    await repository.updateGroupLastSynced(groupName, articleNumber);
    numDownloaded++;
  }

  return numDownloaded;
}
