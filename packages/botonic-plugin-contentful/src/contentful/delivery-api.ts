import * as contentful from 'contentful';
import { Entry } from 'contentful';
import * as cms from '../cms';
import { Callback, Content, ContentCallback, ModelType } from '../cms';
import { QueueDelivery, QueueFields } from './queue';
import { UrlFields } from './url';

export class DeliveryApi {
  private client: contentful.ContentfulClientApi;

  /**
   *
   * @param timeoutMs does not work at least when there's no network
   * during the first connection
   *
   * See https://www.contentful.com/developers/docs/references/content-delivery-api/#/introduction/api-rate-limits
   * for API rate limits
   *
   *  https://www.contentful.com/developers/docs/javascript/tutorials/using-js-cda-sdk/
   */
  constructor(spaceId: string, accessToken: string, timeoutMs: number = 30000) {
    this.client = contentful.createClient({
      space: spaceId,
      accessToken: accessToken,
      timeout: timeoutMs
    });
  }

  async getEntryByIdOrName<T>(
    id: string,
    contentType: string
  ): Promise<contentful.Entry<T>> {
    try {
      if (id.indexOf('_') >= 0) {
        let entries = await this.client.getEntries<T>({
          'fields.name': id,
          // eslint-disable-next-line @typescript-eslint/camelcase
          content_type: contentType
        });
        if (entries.total === 0) {
          throw new Error(`No entry with name ${id}`);
        }
        return entries.items[0];
      }
    } catch (error) {
      console.log(error);
    }
    return this.getEntry(id);
  }

  async getAsset(id: string, query?: any): Promise<contentful.Asset> {
    return this.client.getAsset(id, query);
  }

  async getEntry<T>(id: string, query?: any): Promise<contentful.Entry<T>> {
    return this.client.getEntry<T>(id, query);
  }

  async getEntries<T>(query?: any): Promise<contentful.EntryCollection<T>> {
    return this.client.getEntries<T>(query);
  }

  static getContentModel(entry: contentful.Entry<any>): cms.ModelType {
    // https://blog.oio.de/2014/02/28/typescript-accessing-enum-values-via-a-string/
    const typ = entry.sys.contentType.sys.id;
    return typ as cms.ModelType;
  }

  static callbackFromEntry(entry: Entry<any>): Callback {
    let modelType = this.getContentModel(entry);
    if (modelType === ModelType.URL) {
      return Callback.ofUrl((entry.fields as UrlFields).url);
    }
    return new ContentCallback(modelType, entry.sys.id);
  }

  static urlFromAsset(assetField: contentful.Asset): string {
    return 'https:' + assetField.fields.file.url;
  }

  async contents(model: ModelType): Promise<Content[]> {
    if (model != ModelType.QUEUE) {
      throw new Error('CMS.contents only supports queue at the moment');
    }
    let entries = await this.getEntries({
      // eslint-disable-next-line @typescript-eslint/camelcase
      content_type: model,
      include: QueueDelivery.REFERENCES_INCLUDE // TODO change for other types
    });
    return entries.items.map(item =>
      QueueDelivery.fromEntry(item as Entry<QueueFields>)
    );
    //TODO switch with instanceof the model
    // if (model instanceof ModelType.QUEUE) {
    // }
    // switch (true) {
    //   case model instanceof ModelType.QUEUE:
    //     console.log('QUEUE');
    //     return QueueDelivery.fromEntry(entries);
    //   default:
    //     console.error('Content not implemented!');
    // }
  }
}

export interface ContentWithNameFields {
  // An ID (eg. PRE_FAQ1)
  name: string;
}

export interface ContentWithKeywordsFields extends ContentWithNameFields {
  // Useful to display in buttons or reports
  shortText: string;
  keywords: string[];
}
