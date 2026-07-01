/* =========================================================
   FIREBASE.JS — Camada de acesso ao Firebase Realtime Database
   Todas as leituras e escritas no BD passam por aqui.
   ========================================================= */

// ── Estado global de prêmio acumulado ────────────────────
let premioAcumulado        = 0;
let premioAcumuladoPremium = 0;

// ── Leitura de palpites ───────────────────────────────────

/**
 * Retorna todos os palpites do Bolão Tradicional para um jogo.
 * Inclui a chave real do Firebase em cada objeto (_chave).
 */
async function obterPalpitesDoJogo(jogoId) {
  if (!firebaseOk) return [];
  try {
    const snapshot = await db.ref(`palpites/${jogoId}`).once("value");
    const todos    = snapshot.val() || {};
    return Object.entries(todos).map(([chave, dados]) => ({ ...dados, _chave: chave }));
  } catch (e) {
    console.error("obterPalpitesDoJogo:", e);
    return [];
  }
}

/**
 * Retorna todos os palpites do Bolão Premium para um jogo.
 */
async function obterPalpitesPremiumDoJogo(jogoId) {
  if (!firebaseOk) return [];
  try {
    const snapshot = await db.ref(`palpitesPremium/${jogoId}`).once("value");
    const todos    = snapshot.val() || {};
    return Object.entries(todos).map(([chave, dados]) => ({ ...dados, _chave: chave }));
  } catch (e) {
    console.error("obterPalpitesPremiumDoJogo:", e);
    return [];
  }
}

// ── Cálculo de prêmio acumulado ───────────────────────────

/**
 * Calcula o prêmio acumulado do Tradicional (rodadas passadas sem ganhador).
 * Atualiza a variável global `premioAcumulado`.
 */
async function calcularPremioAcumulado() {
  premioAcumulado = 0;
  for (const j of jogos) {
    if (j.placarCasa === null || j.placarFora === null) break;
    if (j.id === jogoAtual.id) break;
    try {
      const snapshot = await db.ref(`palpites/${j.id}`).once("value");
      const palpites = Object.values(snapshot.val() || {});
      const teveGanhador = palpites.some(p =>
        Number(p.placarCasa) === Number(j.placarCasa) &&
        Number(p.placarFora) === Number(j.placarFora)
      );
      if (!teveGanhador) premioAcumulado += calcularArrecadacao(palpites);
    } catch (_) {}
  }
}

/**
 * Calcula o prêmio acumulado do Premium (rodadas passadas sem ganhador).
 * Atualiza a variável global `premioAcumuladoPremium`.
 */
async function calcularPremioAcumuladoPremium() {
  premioAcumuladoPremium = 0;
  for (const j of jogos) {
    if (j.placarCasa === null || j.placarFora === null) break;
    if (j.id === jogoAtual.id) break;
    try {
      const snapshot = await db.ref(`palpitesPremium/${j.id}`).once("value");
      const palpites = Object.values(snapshot.val() || {});
      const teveGanhador = palpites.some(p =>
        Number(p.placarCasa) === Number(j.placarCasa) &&
        Number(p.placarFora) === Number(j.placarFora)
      );
      if (!teveGanhador) premioAcumuladoPremium += calcularArrecadacaoPremium(palpites);
    } catch (_) {}
  }
}

// ── Contagem de apostas por jogador ──────────────────────

/**
 * Conta apostas do jogador na rodada atual (antes de uma nova aposta).
 * Usado para calcular o valor a cobrar.
 */
async function contarApostasNestaRodada(nome) {
  try {
    const snapshot      = await db.ref(`palpites/${jogoAtual.id}`).once("value");
    const nomeNorm      = normalizarNome(nome);
    return Object.values(snapshot.val() || {}).filter(p =>
      normalizarNome(p.nome) === nomeNorm || normalizarNome(p.nome).startsWith(nomeNorm)
    ).length;
  } catch (_) { return 0; }
}

/**
 * Conta apostas do jogador na rodada imediatamente anterior.
 * Usado para a regra de acúmulo (mantém valor base para quem já jogou antes).
 */
async function contarApostasRodadaAnterior(nome) {
  const idxAtual = jogos.findIndex(j => j.id === jogoAtual.id);
  if (idxAtual <= 0) return 0;
  const jogoAnterior = jogos[idxAtual - 1];
  try {
    const snapshot = await db.ref(`palpites/${jogoAnterior.id}`).once("value");
    const nomeNorm = normalizarNome(nome);
    return Object.values(snapshot.val() || {}).filter(p =>
      normalizarNome(p.nome) === nomeNorm || normalizarNome(p.nome).startsWith(nomeNorm)
    ).length;
  } catch (_) { return 0; }
}

async function jogadorParticipouRodadaAnterior(nome) {
  return (await contarApostasRodadaAnterior(nome)) > 0;
}

// ── Elegibilidade Premium ─────────────────────────────────
// NOTA: as funções de elegibilidade Premium (elegivelParaPremium,
// buscarElegibilidadePremiumPorIdent, buscarPixDoApostadorNoBolaoAberto,
// buscarApostaPorNomeNoBolaoAberto, contarApostasPremiumNestaRodada,
// contarApostasPremiumRodadaAnterior) vivem em premium.js — são as
// versões autoritativas (usam a chave composta nomeNormalizado_N do
// schema real do Firebase). Não duplicar aqui.

// ── Placar automático ─────────────────────────────────────
// NOTA: salvarPlacarAutomatico vive em calendar.js (versão completa,
// integrada ao fluxo de verificação automática de placar). Não duplicar aqui.

// ── Carregamento de confirmações (datas de pagamento) ─────

let _confirmacoesData = {}; // { jogoId_chave: timestamp }

async function carregarConfirmacoesData() {
  if (!firebaseOk) return;
  try {
    const snap = await db.ref("confirmacoesData").once("value");
    _confirmacoesData = snap.val() || {};
  } catch (_) {}
}
