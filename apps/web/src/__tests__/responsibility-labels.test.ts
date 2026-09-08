import { expect, it } from "vitest";
import { responsibilityLabels } from "../lib/server/chatwoot";
it("substitui as duas etiquetas legadas de responsável preservando etiquetas comerciais", () => {
  expect(responsibilityLabels(["vip", "atendido-por:ana-souza", "atendente-ana-souza-atendente", "orcamento"], "Carla Prado (Atendente)"))
    .toEqual(["vip", "orcamento", "atendente-carla-prado"]);
});
