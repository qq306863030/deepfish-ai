import { join } from 'path';

/**
 * Characters invalid in Windows filenames: < > : " / \ | ? *
 * We percent-encode them so filenames work cross-platform.
 * Must be reversible for round-trip (write → read → decode).
 */
const WIN_FILENAME_ENCODE_MAP: Record<string, string> = {
  '<': '%3C',
  '>': '%3E',
  ':': '%3A',
  '"': '%22',
  '/': '%2F',
  '\\': '%5C',
  '|': '%7C',
  '?': '%3F',
  '*': '%2A',
};

const WIN_FILENAME_DECODE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(WIN_FILENAME_ENCODE_MAP).map(([k, v]) => [v, k]),
);

const encodeFilename = (str: string): string =>
  str.replace(/[<>:"/\\|?*]/g, (ch) => WIN_FILENAME_ENCODE_MAP[ch]);

const decodeFilename = (str: string): string =>
  str.replace(/%3[ACF]|%22|%2F|%5C|%7C/g, (enc) => WIN_FILENAME_DECODE_MAP[enc] ?? enc);

export class StorePathResolver {
  public rootFolder: string;
  public splitter: string;
  public readonly defaultCheckpointNs = '__DEFAULT_NS__';

  constructor(rootFolder?: string, splitter?: string) {
    this.rootFolder = rootFolder ?? './checkpoint-file-store';
    this.splitter = splitter ?? '$$';
  }

  /**
   * Join args with the splitter, encoding Windows-invalid filename characters
   * so the result can be used as a filename on any platform.
   */
  public joinWithSplitter(...args: (string | number)[]) {
    return args?.map((a) => encodeFilename(String(a))).join(this.splitter);
  }

  /**
   * Split a filename back into components, decoding percent-encoded characters.
   */
  public splitWithSplitter(str: string) {
    return str.split(this.splitter).map(decodeFilename);
  }

  public getThreadPath(threadId: string) {
    return join(this.rootFolder, this.joinWithSplitter(threadId));
  }

  public getCheckpointNsPath(threadId: string, checkpointNs: string) {
    return join(this.rootFolder);
  }

  public getCheckpointFolderPath(threadId: string, checkpointNs: string, checkpointId: string) {
    return join(this.getCheckpointNsPath(threadId, checkpointNs), checkpointId);
  }

  public getWritesPath(threadId: string, checkpointNs: string, checkpointId: string) {
    return join(this.getCheckpointFolderPath(threadId, checkpointNs, checkpointId), 'writes');
  }

  public getCheckpointsPath(threadId: string, checkpointNs: string, checkpointId: string) {
    return join(this.getCheckpointFolderPath(threadId, checkpointNs, checkpointId), 'checkpoints');
  }
}
