import { LoggedUsersStorage, StorageIncrementer } from "./TokenManager";
import * as Redis from "ioredis";
/**
 * Class that stores information using Redis.
 */
export class RedisStorage
  implements LoggedUsersStorage<string, any>, StorageIncrementer<string> {
  /**
   *
   * @param redis Redis instance to manage the storage
   */
  public constructor(protected redis: Redis.Redis) {}

  /**
   * Puts the given data identified by the given key
   * @param key Key identifying the data
   * @param data Data to be stored/updated
   * @returns True if the data has been stored succesfully
   */
  public async put(key: string, data: any): Promise<boolean> {
    this.redis.set(key, `${data}`);
    return true;
  }

  /**
   * Gets a data from the storage with the given key.
   * @param key Data identifier
   * @returns Data or null if any is found
   */
  public async get(key: string): Promise<any | null> {
    return await this.redis.get(key);
  }

  /**
   * Removes the data from the storage with identified by the
   * given key
   * @param key Data ID
   * @returns True if removed sucessfully
   */
  public async remove(key: string): Promise<boolean> {
    await this.redis.del(key);
    return true;
  }

  /**
   * Clears all the existing keys and values
   */
  public async clear() {
    await this.redis.flushdb();
  }

  /**
   * Increments a 64 bit number identified by the given key. If the number does not exists, returns 1
   * and start incrementing in the subsequent calls
   * @param key ID of the number to be incremented
   * @returns The incremented number
   */
  public async increment(key: string): Promise<number> {
    return await this.redis.incr(key);
  }
}
