//http://www.tcpipguide.com/free/t_NNTPCommands-2.htm
import { Socket } from 'net';
import { EventEmitter } from 'events';
import { simpleParser, MailParser } from 'mailparser'
import { writeFileSync } from 'fs';

export interface NntpClientConfig {
  server: string;
  port?: number;
}

const commandsDef = {
    connect: {
        command: '',
        responseCode: '200',
        completeIndicator: '\r\n',
    },
    listGroups: {
        command: 'LIST',
        responseCode: '215',
        completeIndicator: '.\r\n',
    },
    selectGroup: {
        command: 'GROUP',
        responseCode: '211',
        completeIndicator: '\r\n',
    },
    disconnect: {
        command: 'QUIT',
        responseCode: '205',
        completeIndicator: '\r\n',
    },
    getArticle: {
        command: 'ARTICLE',
        responseCode: '220',
        completeIndicator: '\r\n.\r\n',
    },
}

type Command = keyof typeof commandsDef;

interface SendCommandResult {
    command: Command;
    status: 'success' | 'error';
    statusLine: string;
    responseString: string;
    responseBuffer: Buffer;
}

export class NntpClient {
  private config: NntpClientConfig;
  private client: Socket;
  private currentCommand: Command | null = null;
  private currentResponseString = '';
  private currentResponseBuffer: Buffer;
  private eventEmitter: EventEmitter;
  private selectedGroup: string | null = null;

  constructor(config: NntpClientConfig) {
    this.config = config;
    this.client = new Socket();
    this.eventEmitter = new EventEmitter();

    this.currentResponseBuffer = Buffer.alloc(0);
    this.setupClient();
  }

  private setupClient() {
    this.client.on('data', (data)=> {
        this.currentResponseBuffer = Buffer.concat([this.currentResponseBuffer, data]);
        this.currentResponseString += data.toString();
        if (!this.currentCommand) {
            console.error(`Received data without a command: ${this.currentResponseString}`);
            throw new Error('No command is currently being executed');
        }
        const currentCommandDef = commandsDef[this.currentCommand];

        // todo - timeout
        if (this.currentResponseString.endsWith(currentCommandDef.completeIndicator) || !this.currentResponseString.startsWith(currentCommandDef.responseCode)) {
            const statusLine = this.currentResponseString.split('\r\n')[0];
            console.log(`Command ${this.currentCommand} completed with status:`, statusLine);
            this.eventEmitter.emit(`${this.currentCommand}`, {
                command: this.currentCommand,
                status: this.currentResponseString.startsWith(currentCommandDef.responseCode) ? 'success' : 'error',
                statusLine,
                responseString: this.currentResponseString,
                responseBuffer: Buffer.from(this.currentResponseBuffer),
            });
            this.currentResponseBuffer = Buffer.alloc(0);
            this.currentResponseString = '';
            this.currentCommand = null;
        }
    });
  }

  async connect() {
    // todo - handle disconnect (by host)
    // todo - add connected status
    this.currentCommand = 'connect';
    return new Promise((resolve, reject) => {
      this.client.connect(this.config.port || 119, this.config.server);
      this.client.on('error', reject);

      this.eventEmitter.once(`${this.currentCommand}`, (data) => {
        resolve(data);
      });
    });
  }

  async disconnect() {
    await this.sendCommand('disconnect');
  }

  private async sendCommand(command: Command, params?: string): Promise<SendCommandResult> {
    console.log(`Sending command ${command} with params ${params}`);
    if (this.currentCommand) {
        // todo - queue
        return Promise.reject({
            status: 'error',
            message: 'Another command is currently being executed',
        });
    }
    this.currentCommand = command;
    const commandDef = commandsDef[command];
    this.client.write(`${commandDef.command + (params ? ' ' + params : '')}\r\n`);

    return new Promise((resolve, reject) => {
      this.eventEmitter.once(`${this.currentCommand}`, (data) => {
        resolve(data);
      });
    });
  }

  async listGroups() {
    const result = await this.sendCommand('listGroups');

    return result.responseString.split('\r\n').slice(1, -2).map((line) => {
        const [group, last, first, flag] = line.split(' ');
        return {
            group,
            last: parseInt(last),
            first: parseInt(first),
            flag,
        };
    });
  }

  getSelectedGroup() {
    return this.selectedGroup;
  }

  async selectGroup(group: string) {
    const result = await this.sendCommand('selectGroup', group);

    if (result.status === 'error') {
        return {
            status: result.status,
            message: result.statusLine,
        }
    }

    const [statusCode, totalEstimate, first, last, groupName] = result.statusLine.split(' ');
    this.selectedGroup = groupName;

    return {
        statusCode,
        status: result.status,
        totalEstimate: parseInt(totalEstimate),
        first: parseInt(first),
        last: parseInt(last),
        groupName,
    }
  }

  async getArticle(articleId: number) {
    if (!this.selectedGroup) {
        throw new Error('No group selected. Please select a group before fetching articles.');
    }
    const result = await this.sendCommand('getArticle', articleId.toString());

    if (result.status === 'error') {
        throw new Error(`Error fetching article: ${result.statusLine}`);
    }



    // remove 1st and last line from buffer, do not convert to string (to retain encoding)
    const buffer = result.responseBuffer.slice(result.responseBuffer.indexOf('\r\n') + 2, result.responseBuffer.lastIndexOf('\r\n.\r\n') + 2);


    const parsed = await simpleParser(buffer, {
      skipTextToHtml: true,
    });

    // console.log({
    //   final: parsed.text,
    // })

    // if (articleId == 395) {
    //   writeFileSync('./err/article.mail', result.responseBuffer);
    //   console.log(parsed.text?.length);
    //   process.exit(1);
    // }

    return parsed;
  }
}
