import { describe, it, expect, beforeEach } from 'vitest';
import { silentExtractionService } from '../services/extraction.js';

describe('Silent Extraction Service Tests', () => {
  beforeEach(() => {
    silentExtractionService.clearSuggestions();
  });

  it('deve extrair produto, quantidade e modalidade entrega a partir do texto', () => {
    const text = 'Olá, gostaria de pedir 2 caixas de dipirona para entregar na Rua das Flores, 123';
    const suggestion = silentExtractionService.extractFromText(
      '11111111-1111-1111-1111-111111111111',
      101,
      1,
      text
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.suggested_product_name).toBe('Dipirona');
    expect(suggestion?.suggested_quantity).toBe(2);
    expect(suggestion?.suggested_unit_price).toBe(8.50);
    expect(suggestion?.suggested_fulfillment).toBe('delivery');
    expect(suggestion?.suggested_address).toContain('Rua das Flores');
    expect(suggestion?.confidence).toBeGreaterThan(0.8);
  });

  it('deve identificar modalidade de retirada quando mencionada', () => {
    const text = 'Tem dorflex? Posso passar aí no balcão para retirar';
    const suggestion = silentExtractionService.extractFromText(
      '11111111-1111-1111-1111-111111111111',
      101,
      2,
      text
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.suggested_product_name).toBe('Dorflex');
    expect(suggestion?.suggested_fulfillment).toBe('pickup');
  });

  it('deve retornar null para texto que não mencione produto do catálogo', () => {
    const text = 'Bom dia, que horas a farmácia abre amanhã?';
    const suggestion = silentExtractionService.extractFromText(
      '11111111-1111-1111-1111-111111111111',
      101,
      3,
      text
    );

    expect(suggestion).toBeNull();
  });
});
