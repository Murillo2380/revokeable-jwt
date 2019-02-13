import * as jwt from "jsonwebtoken";

/**
 * Manages the user access token. The generated token has the following format:
 * jwtSecret_GlobalNonce UserNonce LoginID LoginNonce
 *
 * This class uses a different signature for many tokens. The idea is to revoke tokens
 * by changing the signature string, if a token is signed with:
 * "my_jwt_secret_0 0 0 0" and the global nonce is incremented in the server, all the incoming tokens
 * will be verified with the key "my_jwt_secret_1 0 0 0". Therefore, the signature of all the existing
 * tokens won't match, being revoked.
 *
 * The UserNonce is generated per user, per succeeded login. Many active "sessions"
 * is possible since each will contain a different LoginID. A user obtains a refreshed token for his login
 * session by returning a token signed with the LoginNonce incremented.
 */
export class TokenManager {
  /**
   * The key to access the globalNonce, part of the jwt signature
   */
  protected readonly keyGlobalNonce = `gn`;

  public constructor(
    protected storage: LoggedUsersStorage<string, any>,
    protected incrementer: StorageIncrementer<string>,
    protected jwtSecret: string
  ) {}

  /**
   * Login the user, registering a new jwt token for him. The generated token will have
   * the following format:
   *
   * {
   *  loginID: number
   *  userID: number
   *  ...userData
   * }
   * @param userID ID of the user to be logged
   * @param userData Data to be set in the token
   * @returns A jwt token for the user
   *
   */
  public async login(userID: string, userData: any): Promise<any> {
    const loginID = await this.incrementer.increment(this.keyLoginID(userID));
    const userNonce = (await this.storage.get(this.keyUserNonce(userID))) || 0;
    const loginNonce = await this.incrementer.increment(
      this.keyLoginNonce(userID, loginID)
    );

    const signature = await this.generateSignature(
      userNonce,
      loginID,
      loginNonce
    );
    return jwt.sign({ loginID, userID, ...userData }, signature, {
      algorithm: "HS256"
    });
  }

  /**
   * Refreshes the token, returning a new one with the same information but with a different signature.
   * In practice, it just increments the loginNonce part of the signature.
   * @param token Token to be refreshed
   * @returns The refreshed token, with the same information of the given one, or false if the
   * given token is not valid
   */
  public async refresh(token: string): Promise<any> {
    const decoded = await this.isValid(token);

    if (!decoded) {
      return false;
    }

    const { userID, loginID, userData = {} } = decoded;

    const userNonce = (await this.storage.get(this.keyUserNonce(userID))) || 0;
    const loginNonce = await this.incrementer.increment(
      this.keyLoginNonce(userID, loginID)
    );
    const signature = await this.generateSignature(
      userNonce,
      loginID,
      loginNonce
    );

    return jwt.sign({ loginID, userID, ...userData }, signature, {
      algorithm: "HS256"
    });
  }

  /**
   * Revoke every token from all users.
   */
  public async logoutAllUsers(): Promise<void> {
    await this.incrementer.increment(this.keyGlobalNonce);
  }

  /**
   * Revoke every token associated with the given user
   * @param id User ID
   * @returns Always true
   */
  public async logoutEveryLoginFrom(id: string): Promise<boolean> {
    await this.incrementer.increment(this.keyUserNonce(id));
    return true; // TODO handle the return in case of error at the previous line
  }

  /**
   * Logouts the user in one of many logins he may have logged.
   * @param userID The ID of the user to be logged out
   * @param loginID Which loggin should be revoked
   * @returns True for success, false if an error has occured in the storage.
   */
  public async logout(userID: string, loginID: number): Promise<boolean> {
    const res = await this.storage.remove(this.keyLoginNonce(userID, loginID));
    return res;
  }

  /**
   * TODO the performance of the code can be improved by returning also the data gotten from the storage (avoiding lookups to refresh the token)
   * Verifies if the given token is valid, i.e., not revoked.
   * @param token Token to be verified
   * @returns False if not valid, the decoded token otherwise.
   */
  public async isValid(token: string | null | undefined): Promise<any> {
    if (!token) {
      return false;
    }

    // Note that the signature of this token has not been verified
    const decoded = jwt.decode(token) as { [key: string]: any };
    if (!decoded) {
      return false;
    }

    const userNonce =
      (await this.storage.get(this.keyUserNonce(decoded.userID))) || 0;
    const loginNonce =
      (await this.storage.get(
        this.keyLoginNonce(decoded.userID, decoded.loginID)
      )) || 0;

    const key = await this.generateSignature(
      userNonce,
      decoded.loginID,
      loginNonce
    );

    try {
      return jwt.verify(token, key, { algorithms: ["HS256"] });
    } catch (err) {
      console.log(`Error while verifying the token:
            ${err}`);
      return false;
    }
  }

  /**
   * @param id UserID
   * @returns A key to access a nonce number, part of the jwt signature
   */
  protected keyUserNonce(id: string): string {
    return `u${id}`;
  }

  /**
   * @param id UserID
   * @returns A key to access a nonce number, part of the jwt signature
   */
  protected keyLoginID(id: string): string {
    return `l${id}`;
  }

  /**
   * @param id UserID
   * @param loginID The ID of the "session".
   * @returns A key to access a nonce number, part of the jwt signature
   */
  protected keyLoginNonce(id: string, loginID: number): string {
    return `${id}:${loginID}`;
  }

  /**
   * @returns A key to access a nonce number, part of the jwt signature
   */
  protected async globalNonce(): Promise<number> {
    return (await this.storage.get(this.keyGlobalNonce)) || 0;
  }

  /**
   * Genetares a key for a token based on some nonces. They key is the union of
   * many nonces and a common jwt secret, if any of the nonces get
   * changed, the token generated with the previous nonce won't be valid. See the class
   * description to understand each part of the key.
   * @param userNonce The nonce for a specific user
   * @param loginNonce The nonce of a specific "login session"
   * @see TokenManager
   */
  protected async generateSignature(
    userNonce: number,
    loginID: number,
    loginNonce: number
  ): Promise<string> {
    const gnonce = await this.globalNonce();
    const key = `${
      this.jwtSecret
    }_${gnonce} ${userNonce} ${loginID} ${loginNonce}`;
    console.log({ key });
    return key;
  }
}

/**
 * Class that defines basically methods for managing token access
 */
export interface LoggedUsersStorage<keyType = string, dataType = any> {
  /**
   * Puts the given data identified by the given key
   * @param key Key identifying the data
   * @param data Data to be stored/updated
   * @returns True if the data has been saved in the storage
   */
  put(key: keyType, data: dataType): Promise<boolean>;

  /**
   * Gets a data from the storage with the given key.
   * @param key Data identifier
   * @returns Data or null if any is found
   */
  get(key: keyType): Promise<dataType | null>;

  /**
   * Removes the data from the storage with identified by the
   * given key
   * @param key Data ID
   * @returns True if removed sucessfully
   */
  remove(key: keyType): Promise<boolean>;

  /**
   * Clears all the keys and values from the storage
   */
  clear(): Promise<void>;
}

/**
 * Interface that defines it is needed a storage that is capable of incrementing a number
 * saved with the given key
 */
export interface StorageIncrementer<keyType = string> {
  /**
   * Increments a number mapped with the given key
   * @param key Key of the number to be incremented
   * @returns The incremented number
   */
  increment(key: keyType): Promise<number>;
}
