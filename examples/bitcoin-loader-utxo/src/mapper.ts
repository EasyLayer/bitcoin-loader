import { ILoaderMapper } from '@easylayer/bitcoin-loader';
import { ScriptUtilService } from '@easylayer/components/bitcoin-network-provider';
import { Currency, Money } from '@easylayer/common/arithmetic';
import { OutputsRepository, InputsRepository } from './repositories';

export class Mapper implements ILoaderMapper {
  // Initialize an LRUCache with a maximum of 50k entries and a TTL of 60 seconds
  private cache = new LRUCache<string>(50000, 60000); // Max 1000 elements, TTL 60 seconds

  public async onLoad(block: any) {
    const networkName: string = process.env.BITCOIN_LOADER_BLOCKCHAIN_NETWORK_NAME!;

    const currency: Currency = {
      code: 'BTC',
      minorUnit: 8,
    };

    const { height, tx } = block;

    const outputRepos: InstanceType<typeof OutputsRepository>[] = [];
    const inputRepos: InstanceType<typeof InputsRepository>[] = [];

    if (!tx || tx.length === 0) {
      throw new Error(`Tx length = 0`);
    }

    for (const t of tx) {
      const txid = t.txid;

      for (const vout of t.vout) {
        let scriptHash: string | null = null;

        // Create a unique cache key based on the serialized scriptPubKey
        const scriptPubKeyHex = this.getScriptPubKeyHex(vout.scriptPubKey);

        if (scriptPubKeyHex) {
          // Attempt to retrieve the scriptHash from the cache
          const cachedScript = this.cache.get(scriptPubKeyHex);

          if (cachedScript) {
            scriptHash = cachedScript;
          } else {
            // Calculate the scriptHash and store it in the cache
            scriptHash = ScriptUtilService.getScriptHashFromScriptPubKey(vout.scriptPubKey, networkName);

            if (scriptHash) {
              this.cache.set(scriptPubKeyHex, scriptHash);
            }
          }
        }

        const value = Money.fromDecimal(vout.value, currency).toCents();
        const outputRepo = new OutputsRepository();

        outputRepo.insert({
          txid,
          script_hash: scriptHash,
          value,
          n: Number(vout.n),
          block_height: Number(height),
        });

        outputRepos.push(outputRepo);
      }

      for (const vin of t.vin) {
        if (vin.txid && vin.vout !== undefined) {
          const inputRepo = new InputsRepository();

          inputRepo.insert({
            txid,
            output_txid: vin.txid,
            output_n: Number(vin.vout),
          });

          inputRepos.push(inputRepo);
        }
      }
    }

    return [...outputRepos, ...inputRepos];
  }

  public async onReorganisation(lightBlock: any) {
    const { tx } = lightBlock;

    const outputRepos: InstanceType<typeof OutputsRepository>[] = [];

    for (let txid of tx) {
      const outputRepo = new OutputsRepository();

      outputRepo.update(
        { txid },
        { is_suspended: true },
      );

      outputRepos.push(outputRepo);
    }

    return outputRepos;
  }

  /**
   * Serializes scriptPubKey to a HEX string for use as a cache key.
   * @param scriptPubKey - The scriptPubKey from TxOut.
   * @returns HEX representation of the scriptPubKey or null if serialization fails.
   */
  private getScriptPubKeyHex(scriptPubKey: any): string | null {
    // Assumes scriptPubKey has a 'hex' property. Adjust based on your structure.
    if (typeof scriptPubKey === 'string') {
      return scriptPubKey;
    } else if (scriptPubKey.hex) {
      return scriptPubKey.hex;
    } else if (scriptPubKey.asm) {
      try {
        // Convert ASM string to HEX if necessary
        return Buffer.from(scriptPubKey.asm, 'utf8').toString('hex');
      } catch (error) {
        // Log the error if conversion fails
        console.error('Error converting asm to hex:', error);
        return null;
      }
    } else {
      // Return null if scriptPubKey does not have 'hex' or 'asm' properties
      return null;
    }
  }
}

/**
 * Implementation of an LRU (Least Recently Used) Cache.
 * This cache evicts the least recently used items when the maximum size is reached.
 */
class LRUCache<T> {
  private cache: Map<string, { value: T; expiresAt: number }>;
  private maxSize: number;
  private defaultTTL: number;

  /**
   * @param maxSize - Maximum number of elements the cache can hold.
   * @param defaultTTL - Time-to-live for each cache entry in milliseconds.
   */
  constructor(maxSize: number, defaultTTL: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Retrieves a value from the cache.
   * @param key - The key associated with the desired value.
   * @returns The value if present and not expired; otherwise, null.
   */
  get(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update the entry's position to mark it as recently used
    this.cache.delete(key);
    this.cache.set(key, cached);

    return cached.value;
  }

  /**
   * Sets a value in the cache.
   * If the cache exceeds maxSize, it evicts the least recently used item.
   * @param key - The key to associate with the value.
   * @param value - The value to cache.
   * @param ttl - Optional custom TTL for this entry in milliseconds.
   */
  set(key: string, value: T, ttl?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict the least recently used item if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Clears a specific entry from the cache.
   * @param key - The key of the entry to remove.
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clears the entire cache.
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Retrieves the current size of the cache.
   * @returns The number of entries in the cache.
   */
  size(): number {
    return this.cache.size;
  }
}
