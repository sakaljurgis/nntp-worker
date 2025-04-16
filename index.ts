import { NntpClient, type NntpClientConfig } from './worker/nntp-client';
import { Repository } from './worker/repository';
import { downloadAndProcessGroup, updateGroupsList } from './worker/groups';
import { updateLastReplyDate } from './worker/last-reply-date';
import { assignThread } from './worker/assign-thread';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const { PB_URL, PB_USER, PB_PASS, NNTP_SERVER } = process.env;
  if (!PB_URL || !PB_USER || !PB_PASS || !NNTP_SERVER) {
    throw new Error('Missing environment variables');
  }

  const repository = new Repository(PB_URL, PB_USER, PB_PASS);
  await repository.connect();

  const config: NntpClientConfig = {
    server: NNTP_SERVER,
  };
  const client = new NntpClient(config);
  await client.connect();

  const test = false;
  if (test) {
    await client.selectGroup('omnitel.books');
    const parsedArticle = await client.getArticle(2)
    await client.disconnect();
    console.log(parsedArticle);
    return 0;
  }

  const groups = await updateGroupsList(repository, client);
  const groupNames = groups.map((group) => group.group);

  let numDownloaded = 0;

  for (const groupName of groupNames) {
    console.log(`Downloading and processing group ${groupName}`);
    const numDownloadedInGroup = await downloadAndProcessGroup(groups, groupName, repository, client);
    console.log(`Downloaded and processed ${numDownloadedInGroup} articles in group ${groupName}`);
    numDownloaded += numDownloadedInGroup;
  }

  await client.disconnect();

  console.log(`Downloaded and processed ${numDownloaded} articles in total`);

  if (numDownloaded > 0) {
    await updateLastReplyDate(repository);
    await assignThread(repository);
  }

  return numDownloaded;
}

const errors: unknown[] = [];
const successes: string[] = [];

async function runWorker() {
  try {
    const numDownloaded = await main();
    successes.push(`On ${new Date().toISOString()} processed ${numDownloaded}`);
    if (numDownloaded > 0) {
      setTimeout(runWorker, 5 * 60 * 1000);

      return;
    }

    setTimeout(runWorker, 10 * 60 * 1000);
  } catch (e: unknown) {
    console.log(e);
    errors.push([new Date().toISOString(), e]);
  }
}

http.createServer((req, res) => {

  if (req.url === '/restart') {
    runWorker();
    res.writeHead(302, {'Location': '/'});
    res.end();
    return;
  }

  res.writeHead(200, {'Content-Type': 'text/text'});
  const workerRunning = errors.length === 0;
  res.write('Worker running: ' + workerRunning + '\n');
  res.write('Successes:\n' + successes.join('\n'));
  res.write('\n\nErrors:\n' + errors.join('\n'));
  res.end();

}).listen(3000);

runWorker();
