/**
 * Base service class
 */
export abstract class BaseService {
  protected isInitialized = false;

  abstract initialize(): Promise<void>;

  isReady(): boolean {
    return this.isInitialized;
  }
}
