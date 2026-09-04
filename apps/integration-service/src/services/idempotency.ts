export interface IdempotencyRecord {
  key: string;
  status: 'processing' | 'completed' | 'failed';
  attempts: number;
  result?: unknown;
  error?: string;
  timestamp: number;
}

export class IdempotencyService {
  private cache = new Map<string, IdempotencyRecord>();
  private readonly ttlMs: number;

  constructor(ttlMinutes = 60) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  public shouldProcess(key: string): boolean {
    this.cleanExpired();
    const existing = this.cache.get(key);
    if (!existing) {
      this.cache.set(key, {
        key,
        status: 'processing',
        attempts: 1,
        timestamp: Date.now(),
      });
      return true; // Primeira vez: pode processar
    }

    if (existing.status === 'completed') {
      return false; // Já processado com sucesso: descartar duplicata
    }

    if (existing.status === 'processing') {
      // Se está em processamento há menos de 30 segundos, considera duplicata concorrente
      if (Date.now() - existing.timestamp < 30000) {
        return false;
      }
      // Se demorou mais de 30s, permite retentativa
      existing.attempts += 1;
      existing.timestamp = Date.now();
      return true;
    }

    // Se falhou anteriormente, permite retentativa até 3 tentativas
    if (existing.status === 'failed' && existing.attempts < 3) {
      existing.attempts += 1;
      existing.status = 'processing';
      existing.timestamp = Date.now();
      return true;
    }

    return false;
  }

  public markCompleted(key: string, result?: unknown): void {
    const record = this.cache.get(key);
    if (record) {
      record.status = 'completed';
      record.result = result;
      record.timestamp = Date.now();
    }
  }

  public markFailed(key: string, error: string): void {
    const record = this.cache.get(key);
    if (record) {
      record.status = 'failed';
      record.error = error;
      record.timestamp = Date.now();
    }
  }

  public getRecord(key: string): IdempotencyRecord | undefined {
    return this.cache.get(key);
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.cache.entries()) {
      if (now - record.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const idempotencyService = new IdempotencyService();
