# revokeable-jwt

This repository was created to share the idea of how to "revoke" jwt tokens by changing the signature string.

# Motivation

In order to revoke Json Web Tokens, it is either needed a blacklist or a whitelist, which adding or removing the token (or part of the token) will allow an entity to check whethever a token is valid or not.

This may be really space consuming since the jwt token tends to be large.

The proposed method allows an entity to store not the token, but part of the signature used to sign a token. When the signature chagnes, generated tokens won't match the new signature, therefore, not being valid anymore.

# The idea behind the implementation

From the ```TokenManager``` class doc:

The generated token has the following format:

```jwtSecret_GlobalNonce UserNonce LoginID LoginNonce```

It is generated many signatures for many tokens. The idea is to revoke tokens by changing the signature string, if a token is signed with: ```my_jwt_secret_0 0 0 0``` and the global nonce is incremented in the server, all the incoming tokens will be verified with the key ```my_jwt_secret_1 0 0 0```. Therefore, the signature of all the existing tokens won't match, being revoked.

The UserNonce is generated per user, per succeeded login. Many active "sessions" is possible since each will contain a different LoginID. A user obtains a refreshed token for his login session by returning a token signed with the LoginNonce incremented.

# Usage

If you want to try this project, just clone the repository and add it to your existing project. Use the classes defined in ``` TokenManager.ts ```. You should implement the interface ``` LoggedUsersStorage ``` and ``` StorageIncrementer ``` and pass the implementation to the ``` TokenManager ``` constructor.

If you are use Redis, you can instead use the ``` RedisStorage.ts ``` and pass it to the ```TokenManager``` class.

In the ```TokenManager``` class, there are public methods that you can use for:
- Login a user (generates a token);
- Refresh a token;
- Logout one user;
- Logout all users;
- Logout every session from one user;
- Logout a specific session.

### Public Methods in TokenManager

```ts
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
  public async login(userID: string, userData: any): Promise<any>

  /**
   * Refreshes the token, returning a new one with the same information but with a different signature.
   * In practice, it just increments the loginNonce part of the signature.
   * @param token Token to be refreshed
   * @returns The refreshed token, with the same information of the given one, or false if the
   * given token is not valid
   */
  public async refresh(token: string): Promise<any>

  /**
   * Revoke every token from all users.
   */
  public async logoutAllUsers(): Promise<void>

  /**
   * Revoke every token associated with the given user
   * @param id User ID
   * @returns Always true
   */
  public async logoutEveryLoginFrom(id: string): Promise<boolean>

  /**
   * Logouts the user in one of many logins he may have logged.
   * @param userID The ID of the user to be logged out
   * @param loginID Which loggin should be revoked
   * @returns True for success, false if an error has occured in the storage.
   */
  public async logout(userID: string, loginID: number): Promise<boolean>

  /**
   * TODO the performance of the code can be improved by returning also the data gotten from the storage (avoiding lookups to refresh the token)
   * Verifies if the given token is valid, i.e., not revoked.
   * @param token Token to be verified
   * @returns False if not valid, the decoded token otherwise.
   */
  public async isValid(token: string | null | undefined): Promise<any> 
```

# Dependencies

This project only needs the nodejs package ```jsonwebtoken```. Alternatively, you can use the class ```RedisStorage```, which requires the nodejs package ```ioredis```.

Considering that the project has been written in ```TypeScript```, you need your project to be compatible. In the TODO list below, the author shall re-implement the code to be used both in ```JavaScript``` and ```TypeScript``` projects.

# TODO

1. Add an iss field to the token, as well as an expire date to the issued token.
2. Convert the code to be used in JavaScript projects
3. Improve the ```RedisStorage``` class to be able to store information like: which session is active, in which device, etc.

# Example with Apollo Server

To be added soon

