/* =========================================================
   CALENDAR.JS — Sincronização com a API de futebol:
   calendário do Brasil, placar automático, jogos do dia,
   chaveamento da Copa.
   ========================================================= */

// ── Sincronização do calendário do Brasil ─────────────────

let _verificacaoCalendarioIntervalo = null;

function iniciarSincronizacaoCalendario() {
  if (_verificacaoCalendarioIntervalo) clearInterval(_verificacaoCalendarioIntervalo);
  _verificacaoCalendarioIntervalo = setInterval(sincronizarCalendarioBrasil, 30 * 60 * 1000);
  sincronizarCalendarioBrasil();
}

async function sincronizarCalendarioBrasil() {
  if (!firebaseOk) return;
  try {
    const url = `https://api.football-data.org/v4/competitions/${FOOTBALL_API_COMPETICAO}/matches`;
    const resp = await fetch(FOOTBALL_API_PROXY + encodeURIComponent(url) + `&_=${Date.now()}`, {
      headers: { "X-Auth-Token": FOOTBALL_API_TOKEN },
      cache: "no-store"
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const todasPartidas = data.matches || [];
    const partidasBrasil = todasPartidas.filter(p => ehTimeBrasil(p.homeTeam) || ehTimeBrasil(p.awayTeam));
    await processarPartidasBrasil(partidasBrasil);
  } catch (e) {
    console.error("Erro ao sincronizar calendário:", e);
  }
}

async function processarPartidasBrasil(partidasBrasil) {
  if (!partidasBrasil.length) return;
  let houveAtualizacao = false;

  for (const partida of partidasBrasil) {
    const dataUTC = partida.utcDate;
    if (!dataUTC) continue;
    const dataObj = new Date(dataUTC);
    const dataLocalISO = dataObj.toISOString().slice(0, 10);

    let jogoExistente = jogos.find(j => new Date(j.dataISO).toISOString().slice(0, 10) === dataLocalISO);

    const casaNome = traduzirNomeTime(partida.homeTeam?.name || "?");
    const foraNome = traduzirNomeTime(partida.awayTeam?.name || "?");
    const brasilEhCasa = ehTimeBrasil(partida.homeTeam);
    const adversario = brasilEhCasa ? foraNome : casaNome;
    const faseNome = NOMES_FASE_API[partida.stage] || partida.stage || "Copa do Mundo";

    const horaLabel = dataObj.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    if (jogoExistente) {
      // NUNCA reatribui casa/fora de jogo já existente — protege palpites já salvos
      const dataISOAntiga = jogoExistente.dataISO;
      const novaDataISO = dataObj.toISOString();
      const mudouData = dataISOAntiga.slice(0, 16) !== novaDataISO.slice(0, 16);

      if (mudouData || !jogoExistente.dataConfirmada) {
        jogoExistente.dataISO = novaDataISO;
        jogoExistente.dataLabel = `${horaLabel} (Brasília)`;
        jogoExistente.fase = faseNome;
        if (!jogoExistente.dataConfirmada) {
          jogoExistente.dataConfirmada = true;
          _dataConfirmacaoJogos[jogoExistente.id] = Date.now();
          try { await db.ref(`confirmacoesData/${jogoExistente.id}`).set(Date.now()); } catch (_) {}
        }
        houveAtualizacao = true;
      }
    } else {
      const novoId = `j_api_${dataLocalISO}`;
      const novoJogo = {
        id: novoId,
        fase: faseNome,
        dataISO: dataObj.toISOString(),
        dataLabel: `${horaLabel} (Brasília)`,
        casa: brasilEhCasa ? "Brasil" : adversario,
        fora: brasilEhCasa ? adversario : "Brasil",
        placarCasa: null,
        placarFora: null,
        dataConfirmada: true
      };
      jogos.push(novoJogo);
      _dataConfirmacaoJogos[novoId] = Date.now();
      try { await db.ref(`confirmacoesData/${novoId}`).set(Date.now()); } catch (_) {}
      houveAtualizacao = true;
    }
  }

  if (houveAtualizacao) {
    jogos.sort((a, b) => new Date(a.dataISO) - new Date(b.dataISO));
    jogoAtual = obterProximoJogo();
    renderAreaJogoAtual();
    iniciarCountdown();
  }
}

// ── Verificação automática de placar (ao vivo) ────────────

let _verificacaoPlacarIntervalo = null;

function iniciarVerificacaoPlacarAutomatica() {
  if (_verificacaoPlacarIntervalo) clearInterval(_verificacaoPlacarIntervalo);
  const intervalo = (_statusJogoAoVivo === "IN_PLAY" || _statusJogoAoVivo === "PAUSED") ? 30000 : 60000;
  _verificacaoPlacarIntervalo = setInterval(() => {
    verificarPlacarAutomatico();
    iniciarVerificacaoPlacarAutomatica();
  }, intervalo);
  verificarPlacarAutomatico();
}

// Mobile pausa setInterval em background — força atualização ao voltar para a aba
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  try { verificarPlacarAutomatico(); } catch (_) {}
  try {
    const abaJogosDiaVisivel = document.getElementById("abaJogosDia")?.style.display === "block";
    if (abaJogosDiaVisivel) renderJogosDoDia();
  } catch (_) {}
});

let _minutoJogoAoVivo = null;
let _statusJogoAoVivo = null;
let _duracaoTempoAoVivo = null;
let _timestampUltimaAtualizacaoMinuto = null;
let _relogioJogoIntervalo = null;

function iniciarRelogioJogoAoVivo() {
  if (_relogioJogoIntervalo) clearInterval(_relogioJogoIntervalo);
  _relogioJogoIntervalo = setInterval(() => {
    const statusEl = document.getElementById("placarAoVivoStatus");
    const ultimaAtualEl = document.getElementById("placarAoVivoUltimaAtualizacao");
    const segundosPassados = Math.floor((Date.now() - _timestampUltimaAtualizacaoMinuto) / 1000);

    if (ultimaAtualEl) {
      ultimaAtualEl.textContent = segundosPassados < 5 ? "🔄 Atualizado agora" : `Dados de ${segundosPassados}s atrás`;
    }

    if (!statusEl || _minutoJogoAoVivo === null || _statusJogoAoVivo !== "IN_PLAY") return;

    const minutosAdicionais = Math.floor(segundosPassados / 60);
    const minutoEstimado = _minutoJogoAoVivo + minutosAdicionais;

    statusEl.textContent = formatarStatusTempoJogo("IN_PLAY", minutoEstimado, _duracaoTempoAoVivo);
  }, 1000);
}

function pararRelogioJogoAoVivo() {
  if (_relogioJogoIntervalo) { clearInterval(_relogioJogoIntervalo); _relogioJogoIntervalo = null; }
  _minutoJogoAoVivo = null;
  _statusJogoAoVivo = null;
}

async function verificarPlacarAutomatico() {
  if (!firebaseOk || !jogoAtual) return;
  if (jogoAtual.placarCasa !== null) { esconderPlacarAoVivo(); return; }

  const agora = new Date();
  const inicio = new Date(jogoAtual.dataISO);
  if (agora < inicio) { esconderPlacarAoVivo(); return; }

  try {
    const dataJogoStr = inicio.toISOString().slice(0, 10);
    const dataDeObj = new Date(inicio.getTime() - 24 * 60 * 60 * 1000);
    const dataAteObj = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    const dataDe = dataDeObj.toISOString().slice(0, 10);
    const dataAte = dataAteObj.toISOString().slice(0, 10);

    let matchIdAPI = window._matchIdAPIAtual || null;

    if (!matchIdAPI) {
      const urlLista = `https://api.football-data.org/v4/competitions/${FOOTBALL_API_COMPETICAO}/matches?dateFrom=${dataDe}&dateTo=${dataAte}`;
      const respLista = await fetch(FOOTBALL_API_PROXY + encodeURIComponent(urlLista) + `&_=${Date.now()}`, {
        headers: { "X-Auth-Token": FOOTBALL_API_TOKEN },
        cache: "no-store"
      });
      if (!respLista.ok) return;
      const dataLista = await respLista.json();
      const partidas = dataLista.matches || [];

      const partidaBase = partidas.find(p => {
        const ehBrasil = ehTimeBrasil(p.homeTeam) || ehTimeBrasil(p.awayTeam);
        const mesmaData = (p.utcDate || "").slice(0, 10) === dataJogoStr;
        return ehBrasil && mesmaData;
      });

      if (!partidaBase) { esconderPlacarAoVivo(); return; }

      matchIdAPI = partidaBase.id;
      window._matchIdAPIAtual = matchIdAPI;
      window._brasilEhCasaNaAPIAtual = ehTimeBrasil(partidaBase.homeTeam);

      const status = partidaBase.status;
      const brasilEhCasaNaAPI = window._brasilEhCasaNaAPIAtual;
      const brasilEhCasaNoNosso = jogoAtual.casa === "Brasil";

      if (status === "FINISHED") {
        const ft = partidaBase.score?.fullTime || {};
        if (typeof ft.home === "number" && typeof ft.away === "number") {
          const golsBrasil = brasilEhCasaNaAPI ? ft.home : ft.away;
          const golsAdversario = brasilEhCasaNaAPI ? ft.away : ft.home;
          const placarCasaFinal = brasilEhCasaNoNosso ? golsBrasil : golsAdversario;
          const placarForaFinal = brasilEhCasaNoNosso ? golsAdversario : golsBrasil;
          if (placarCasaFinal !== null && placarForaFinal !== null) {
            await salvarPlacarAutomatico(jogoAtual.id, placarCasaFinal, placarForaFinal);
          }
          return;
        }
      } else if (status !== "IN_PLAY" && status !== "PAUSED") {
        esconderPlacarAoVivo();
        return;
      }
    }

    const brasilEhCasaNaAPI = window._brasilEhCasaNaAPIAtual ?? true;
    const brasilEhCasaNoNosso = jogoAtual.casa === "Brasil";
    await _buscarPlacarIndividual(matchIdAPI, brasilEhCasaNaAPI, brasilEhCasaNoNosso, null, null);
  } catch (_) {
    // Falha silenciosa
  }
}

async function _buscarPlacarIndividual(matchId, brasilEhCasaNaAPI, brasilEhCasaNoNosso, status, minutoFallback) {
  const urlMatch = `https://api.football-data.org/v4/matches/${matchId}`;
  const resp = await fetch(FOOTBALL_API_PROXY + encodeURIComponent(urlMatch) + `&_=${Date.now()}`, {
    headers: { "X-Auth-Token": FOOTBALL_API_TOKEN },
    cache: "no-store"
  });
  if (!resp.ok) return;
  const partida = await resp.json();

  const ft = partida.score?.fullTime    || {};
  const rt = partida.score?.regularTime || {};
  const ht = partida.score?.halfTime    || {};

  let golsCasaAPI = null, golsForaAPI = null;
  for (const src of [ft, rt, ht]) {
    if (typeof src.home === "number" && typeof src.away === "number") {
      golsCasaAPI = src.home;
      golsForaAPI = src.away;
      break;
    }
  }

  const minuto = partida.minute ?? minutoFallback ?? null;
  const statusReal = partida.status || status;

  if (statusReal === "FINISHED") {
    if (golsCasaAPI !== null && golsForaAPI !== null) {
      const golsBrasil = brasilEhCasaNaAPI ? golsCasaAPI : golsForaAPI;
      const golsAdversario = brasilEhCasaNaAPI ? golsForaAPI : golsCasaAPI;
      const placarCasaFinal = brasilEhCasaNoNosso ? golsBrasil : golsAdversario;
      const placarForaFinal = brasilEhCasaNoNosso ? golsAdversario : golsBrasil;
      await salvarPlacarAutomatico(jogoAtual.id, placarCasaFinal, placarForaFinal);
    }
    return;
  }

  if (golsCasaAPI === null || golsForaAPI === null) {
    await mostrarPlacarAoVivo(null, null, statusReal, minuto, partida.score?.duration);
    return;
  }

  const golsBrasil = brasilEhCasaNaAPI ? golsCasaAPI : golsForaAPI;
  const golsAdversario = brasilEhCasaNaAPI ? golsForaAPI : golsCasaAPI;
  const placarCasaFinal = brasilEhCasaNoNosso ? golsBrasil : golsAdversario;
  const placarForaFinal = brasilEhCasaNoNosso ? golsAdversario : golsBrasil;
  await mostrarPlacarAoVivo(placarCasaFinal, placarForaFinal, statusReal, minuto, partida.score?.duration);
}

async function mostrarPlacarAoVivo(placarCasa, placarFora, status, minuto, duracaoTempo) {
  const box = document.getElementById("placarAoVivoBox");
  if (!box || !jogoAtual) return;

  const flagCasa = bandeiraIMG(jogoAtual.casa);
  const flagFora = bandeiraIMG(jogoAtual.fora);

  const placarTexto = (placarCasa !== null && placarFora !== null) ? `${placarCasa} x ${placarFora}` : `? x ?`;

  document.getElementById("placarAoVivoConfronto").innerHTML =
    `${flagCasa} ${jogoAtual.casa} ${placarTexto} ${jogoAtual.fora} ${flagFora}`;

  const minutoUsado = estimarMinutoJogo(minuto, jogoAtual.dataISO, status);
  _minutoJogoAoVivo = (minutoUsado === null || minutoUsado === undefined) ? null : minutoUsado;
  _statusJogoAoVivo = status;
  _duracaoTempoAoVivo = duracaoTempo;
  _timestampUltimaAtualizacaoMinuto = Date.now();

  document.getElementById("placarAoVivoStatus").textContent = formatarStatusTempoJogo(status, minutoUsado, duracaoTempo);

  iniciarRelogioJogoAoVivo();

  const elGanhadores = document.getElementById("ganhadoresParciais");
  const premioInfo = document.getElementById("premioParcialInfo");

  if (placarCasa !== null && placarFora !== null) {
    const palpites = await obterPalpitesDoJogo(jogoAtual.id);
    const ganhadoresParciais = palpites.filter(p => Number(p.placarCasa) === placarCasa && Number(p.placarFora) === placarFora);
    if (ganhadoresParciais.length > 0) {
      elGanhadores.innerHTML = ganhadoresParciais.map(g => `<span class="nome-ganhador">${sanitize(g.nome)}</span>`).join("");
    } else {
      elGanhadores.innerHTML = `<span style="opacity:.75;">Ninguém com esse placar exato ainda...</span>`;
    }
    const premioTotal = calcularArrecadacao(palpites) + premioAcumulado;
    if (ganhadoresParciais.length > 0) {
      const valorCada = premioTotal / ganhadoresParciais.length;
      premioInfo.textContent = `💰 R$ ${valorCada.toFixed(2).replace(".",",")} para cada um se terminar assim`;
    } else {
      premioInfo.textContent = `💰 Prêmio em disputa: R$ ${premioTotal.toFixed(2).replace(".",",")}`;
    }
  } else {
    elGanhadores.innerHTML = `<span style="opacity:.75;">Aguardando placar da API...</span>`;
    premioInfo.textContent = "";
  }

  box.style.display = "block";

  await atualizarPlacarAoVivoPremium(placarCasa, placarFora, status, minutoUsado, duracaoTempo);
}

async function atualizarPlacarAoVivoPremium(placarCasa, placarFora, status, minutoUsado, duracaoTempo) {
  const boxP = document.getElementById("placarAoVivoBoxPremium");
  if (!boxP || !jogoAtual) return;

  const flagCasa = bandeiraIMG(jogoAtual.casa);
  const flagFora = bandeiraIMG(jogoAtual.fora);

  const placarTexto = (placarCasa !== null && placarFora !== null) ? `${placarCasa} x ${placarFora}` : `? x ?`;

  document.getElementById("placarAoVivoConfrontoPremium").innerHTML =
    `${flagCasa} ${jogoAtual.casa} ${placarTexto} ${jogoAtual.fora} ${flagFora}`;
  document.getElementById("placarAoVivoStatusPremium").textContent = formatarStatusTempoJogo(status, minutoUsado, duracaoTempo);

  const ultimaAtualEl = document.getElementById("placarAoVivoUltimaAtualizacaoPremium");
  if (ultimaAtualEl) ultimaAtualEl.textContent = "🔄 Atualizado agora";

  const elGanhadoresP = document.getElementById("ganhadoresParciaisPremium");
  const premioInfoP = document.getElementById("premioParcialInfoPremium");

  if (placarCasa !== null && placarFora !== null) {
    const palpitesPremium = await obterPalpitesPremiumDoJogo(jogoAtual.id);
    const ganhadoresParciaisPremium = palpitesPremium.filter(p => Number(p.placarCasa) === placarCasa && Number(p.placarFora) === placarFora);
    if (ganhadoresParciaisPremium.length > 0) {
      elGanhadoresP.innerHTML = ganhadoresParciaisPremium.map(g => `<span class="nome-ganhador">${sanitize(g.nome)}</span>`).join("");
    } else {
      elGanhadoresP.innerHTML = `<span style="opacity:.75;">Ninguém com esse placar exato ainda...</span>`;
    }
    const premioTotalPremium = calcularArrecadacaoPremium(palpitesPremium) + premioAcumuladoPremium;
    if (ganhadoresParciaisPremium.length > 0) {
      const valorCadaP = premioTotalPremium / ganhadoresParciaisPremium.length;
      premioInfoP.textContent = `💰 R$ ${valorCadaP.toFixed(2).replace(".",",")} para cada um se terminar assim`;
    } else {
      premioInfoP.textContent = `💰 Prêmio em disputa: R$ ${premioTotalPremium.toFixed(2).replace(".",",")}`;
    }
  } else {
    elGanhadoresP.innerHTML = `<span style="opacity:.75;">Aguardando placar da API...</span>`;
    premioInfoP.textContent = "";
  }

  boxP.style.display = "block";
}

function esconderPlacarAoVivo() {
  const box = document.getElementById("placarAoVivoBox");
  if (box) box.style.display = "none";
  const boxP = document.getElementById("placarAoVivoBoxPremium");
  if (boxP) boxP.style.display = "none";
  pararRelogioJogoAoVivo();
}

// ── Salvar placar oficial (versão autoritativa — fluxo automático) ────────
// Substitui a versão simplificada de firebase.js (mantida lá só como fallback
// caso este arquivo não seja carregado). Recalcula prêmio, re-renderiza tudo.

async function salvarPlacarAutomatico(jogoId, casa, fora) {
  if (typeof casa !== "number" || typeof fora !== "number") return;
  if (casa < 0 || fora < 0 || casa > 20 || fora > 20) return;
  if (!jogoId || typeof jogoId !== "string") return;

  window._matchIdAPIAtual = null;
  window._brasilEhCasaNaAPIAtual = null;

  try {
    await db.ref(`placares/${jogoId}`).set({ placarCasa: casa, placarFora: fora, origem: "api-automatica" });
    const jogo = jogos.find(j => j.id === jogoId);
    if (jogo) {
      jogo.placarCasa = casa;
      jogo.placarFora = fora;
    }
    esconderPlacarAoVivo();
    if (_verificacaoPlacarIntervalo) { clearInterval(_verificacaoPlacarIntervalo); _verificacaoPlacarIntervalo = null; }
    await calcularPremioAcumulado();
    renderDistribuicao();
    renderPalpites();
    renderRanking();
    renderHistorico();
    if (jogoAtual && jogoAtual.id === jogoId) renderAreaJogoAtual();
  } catch (e) {
    console.error("Erro ao salvar placar automático:", e);
  }
}

// ── Jogos do dia ───────────────────────────────────────────

/**
 * Define o seletor de data para "hoje" (fuso de Brasília) e renderiza a lista.
 */
function irParaHoje() {
  const hoje  = obterDataHojeBrasilia();
  const input = document.getElementById("dataJogosDia");
  if (input) input.value = hoje;
  renderJogosDoDia();
}

async function renderJogosDoDia() {
  const lista = document.getElementById("listaJogosDia");
  const vazio = document.getElementById("vazioJogosDia");
  const inputData = document.getElementById("dataJogosDia");
  if (!lista || !inputData) return;

  const dataAlvo = inputData.value;
  if (!dataAlvo) return;

  if (!lista.querySelector(".jogo-dia-card")) {
    lista.innerHTML = `<p class="status-msg">Carregando jogos...</p>`;
  }
  vazio.style.display = "none";

  try {
    const dataAlvoObj = new Date(dataAlvo + "T12:00:00-03:00");
    const dataDeISO = new Date(dataAlvoObj.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dataAteISO = new Date(dataAlvoObj.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const urlLista = `https://api.football-data.org/v4/competitions/${FOOTBALL_API_COMPETICAO}/matches?dateFrom=${dataDeISO}&dateTo=${dataAteISO}`;
    const resp = await fetch(FOOTBALL_API_PROXY + encodeURIComponent(urlLista) + `&_=${Date.now()}`, {
      headers: { "X-Auth-Token": FOOTBALL_API_TOKEN },
      cache: "no-store"
    });
    if (!resp.ok) return;
    const data = await resp.json();

    let partidas = (data.matches || [])
      .filter(p => {
        if (!p.utcDate) return false;
        const dataLocalBR = new Date(p.utcDate).toLocaleString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 10);
        return dataLocalBR === dataAlvo;
      })
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    if (partidas.length === 0) {
      lista.innerHTML = "";
      vazio.style.display = "block";
      vazio.textContent = "Nenhum jogo da Copa nesta data.";
      return;
    }

    const aoVivo = partidas.filter(p => p.status === "IN_PLAY" || p.status === "PAUSED");
    if (aoVivo.length > 0) {
      const resultados = await Promise.allSettled(aoVivo.map(async p => {
        const url = `https://api.football-data.org/v4/matches/${p.id}`;
        const r = await fetch(FOOTBALL_API_PROXY + encodeURIComponent(url) + `&_=${Date.now()}`, {
          headers: { "X-Auth-Token": FOOTBALL_API_TOKEN },
          cache: "no-store"
        });
        if (!r.ok) return null;
        return await r.json();
      }));

      resultados.forEach((res, i) => {
        if (res.status !== "fulfilled" || !res.value) return;
        const atualizado = res.value;
        const idx = partidas.findIndex(p => p.id === aoVivo[i].id);
        if (idx < 0) return;
        partidas[idx] = {
          ...partidas[idx],
          score: atualizado.score,
          minute: atualizado.minute,
          status: atualizado.status || partidas[idx].status,
        };
      });
    }

    lista.innerHTML = "";
    partidas.forEach(p => renderizarCardJogoDia(p, lista));

    const temAoVivo = partidas.some(p => p.status === "IN_PLAY" || p.status === "PAUSED");
    iniciarAutoRefreshJogosDia(temAoVivo ? 20000 : 30000);
  } catch (e) {
    // Falha silenciosa — mantém o que já estava na tela
  }
}

let _intervaloJogosDia = null;

function iniciarAutoRefreshJogosDia(intervaloMs) {
  const ms = intervaloMs || 30000;
  if (_intervaloJogosDia && _intervaloJogosDia._ms === ms) return;
  if (_intervaloJogosDia) clearInterval(_intervaloJogosDia);
  _intervaloJogosDia = setInterval(() => {
    const abaVisivel = document.getElementById("abaJogosDia")?.style.display === "block";
    if (abaVisivel) renderJogosDoDia();
  }, ms);
  _intervaloJogosDia._ms = ms;
}

function renderizarCardJogoDia(partida, container) {
  const casaNome = traduzirNomeTime(partida.homeTeam?.name || "A definir");
  const foraNome = traduzirNomeTime(partida.awayTeam?.name || "A definir");
  const flagCasa = bandeiraIMG(casaNome, 16);
  const flagFora = bandeiraIMG(foraNome, 16);
  const siglaCasa = abreviarSelecao(casaNome);
  const siglaFora = abreviarSelecao(foraNome);
  const status = partida.status;
  const dataObj = new Date(partida.utcDate);
  const horaLabel = dataObj.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  let placarTexto = "—";
  let statusClasse = "agendado";
  let statusTexto = "🕐 " + horaLabel;
  let cardClasse = "";

  if (status === "IN_PLAY" || status === "PAUSED") {
    const ft = partida.score?.fullTime || {};
    const rt = partida.score?.regularTime || {};
    const ht = partida.score?.halfTime || {};
    let ghome = null, gaway = null;
    for (const src of [ft, rt, ht]) {
      if (typeof src.home === "number" && typeof src.away === "number") { ghome = src.home; gaway = src.away; break; }
    }
    placarTexto = (ghome !== null) ? `${ghome} x ${gaway}` : "? x ?";
    statusClasse = "aovivo";
    cardClasse = "ao-vivo";
    const minutoEstimado = estimarMinutoJogo(partida.minute ?? null, partida.utcDate, status);
    statusTexto = formatarStatusTempoJogo(status, minutoEstimado, partida.score?.duration);
  } else if (status === "FINISHED") {
    const placar = partida.score?.fullTime || {};
    placarTexto = `${placar.home ?? "–"} x ${placar.away ?? "–"}`;
    statusClasse = "encerrado";
    statusTexto = "🏁 Encerrado";
    cardClasse = "encerrado";
  }

  const div = document.createElement("div");
  div.className = `jogo-dia-card ${cardClasse}`;
  div.innerHTML = `
    <div class="jogo-dia-times" title="${casaNome} x ${foraNome}">${flagCasa} ${siglaCasa} x ${siglaFora} ${flagFora}</div>
    <div class="jogo-dia-placar">${placarTexto}</div>
    <div class="jogo-dia-status ${statusClasse}">${statusTexto}</div>
  `;
  container.appendChild(div);
}

// ── Chaveamento da Copa 2026 ───────────────────────────────

const CHAVEAMENTO_2026 = [
  // ── 16avos de Final ──
  { id:"chave-d1",  fase:"16avos", casa:"Uruguai",        fora:"EUA",           data:"28/06 · 15h", placar:"1×0",  brasil:false, apiId:null },
  { id:"chave-d2",  fase:"16avos", casa:"Brasil",         fora:"Japão",         data:"29/06 · 14h", placar:"—",    brasil:true,  apiId:null },
  { id:"chave-d3",  fase:"16avos", casa:"Alemanha",       fora:"Turquia",       data:"28/06 · 21h", placar:"2×1",  brasil:false, apiId:null },
  { id:"chave-d4",  fase:"16avos", casa:"Holanda",        fora:"Marrocos",      data:"28/06 · 18h", placar:"2×0",  brasil:false, apiId:null },
  { id:"chave-d5",  fase:"16avos", casa:"Costa do Marfim",fora:"Bélgica",       data:"29/06 · 14h", placar:"—",    brasil:false, apiId:null },
  { id:"chave-d6",  fase:"16avos", casa:"México",         fora:"Argentina",     data:"29/06 · 21h", placar:"—",    brasil:false, apiId:null },
  { id:"chave-d7",  fase:"16avos", casa:"Portugal",       fora:"Coreia do Sul", data:"29/06 · 18h", placar:"—",    brasil:false, apiId:null },
  { id:"chave-d8",  fase:"16avos", casa:"Espanha",        fora:"Senegal",       data:"29/06 · 21h", placar:"—",    brasil:false, apiId:null },
  { id:"chave-d9",  fase:"16avos", casa:"França",         fora:"Equador",       data:"30/06 · 14h", placar:"—",    brasil:false, apiId:null },
  { id:"chave-d10", fase:"16avos", casa:"Inglaterra",     fora:"Colômbia",      data:"30/06 · 18h", placar:"—",    brasil:false, apiId:null },
  { id:"chave-d11", fase:"16avos", casa:"Argentina",      fora:"Chile",         data:"30/06 · 21h", placar:"—",    brasil:false, apiId:null },
  { id:"chave-d12", fase:"16avos", casa:"Noruega",        fora:"Austrália",     data:"01/07 · 14h", placar:"—",    brasil:false, apiId:null },
  { id:"chave-d13", fase:"16avos", casa:"Canadá",         fora:"Suíça",         data:"01/07 · 18h", placar:"—",    brasil:false, apiId:null },
  { id:"chave-d14", fase:"16avos", casa:"Portugal",       fora:"Polônia",       data:"01/07 · 21h", placar:"—",    brasil:false, apiId:null },
  { id:"chave-d15", fase:"16avos", casa:"África do Sul",  fora:"Gana",          data:"02/07",       placar:"—",    brasil:false, apiId:null },
  { id:"chave-d16", fase:"16avos", casa:"Dinamarca",      fora:"Irã",           data:"02/07",       placar:"—",    brasil:false, apiId:null },
  // ── Oitavas de Final ──
  { id:"chave-o1", fase:"Oitavas", casa:"A definir", fora:"A definir", data:"04/07", placar:null, brasil:false, apiId:null },
  { id:"chave-o2", fase:"Oitavas", casa:"A definir", fora:"A definir", data:"04/07", placar:null, brasil:false, apiId:null },
  { id:"chave-o3", fase:"Oitavas", casa:"A definir", fora:"A definir", data:"05/07", placar:null, brasil:false, apiId:null },
  { id:"chave-o4", fase:"Oitavas", casa:"A definir", fora:"A definir", data:"05/07", placar:null, brasil:false, apiId:null },
  { id:"chave-o5", fase:"Oitavas", casa:"A definir", fora:"A definir", data:"06/07", placar:null, brasil:false, apiId:null },
  { id:"chave-o6", fase:"Oitavas", casa:"A definir", fora:"A definir", data:"06/07", placar:null, brasil:false, apiId:null },
  { id:"chave-o7", fase:"Oitavas", casa:"A definir", fora:"A definir", data:"07/07", placar:null, brasil:false, apiId:null },
  { id:"chave-o8", fase:"Oitavas", casa:"A definir", fora:"A definir", data:"07/07", placar:null, brasil:false, apiId:null },
  // ── Quartas de Final ──
  { id:"chave-q1", fase:"Quartas", casa:"A definir", fora:"A definir", data:"09/07", placar:null, brasil:false, apiId:null },
  { id:"chave-q2", fase:"Quartas", casa:"A definir", fora:"A definir", data:"09/07", placar:null, brasil:false, apiId:null },
  { id:"chave-q3", fase:"Quartas", casa:"A definir", fora:"A definir", data:"11/07", placar:null, brasil:false, apiId:null },
  { id:"chave-q4", fase:"Quartas", casa:"A definir", fora:"A definir", data:"12/07", placar:null, brasil:false, apiId:null },
  // ── Semifinais ──
  { id:"chave-s1", fase:"Semifinal", casa:"A definir", fora:"A definir", data:"15/07", placar:null, brasil:false, apiId:null },
  { id:"chave-s2", fase:"Semifinal", casa:"A definir", fora:"A definir", data:"16/07", placar:null, brasil:false, apiId:null },
  // ── Final ──
  { id:"chave-final", fase:"Final", casa:"A definir", fora:"A definir", data:"19/07 · 16h · MetLife", placar:null, brasil:false, apiId:null },
];

async function sincronizarChaveamento() {
  try {
    const dataDe = "2026-06-28";
    const dataAte = "2026-07-19";
    const url = `https://api.football-data.org/v4/competitions/${FOOTBALL_API_COMPETICAO}/matches?dateFrom=${dataDe}&dateTo=${dataAte}`;
    const resp = await fetch(FOOTBALL_API_PROXY + encodeURIComponent(url) + `&_=${Date.now()}`, {
      headers: { "X-Auth-Token": FOOTBALL_API_TOKEN }, cache: "no-store"
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const partidas = data.matches || [];

    const porFase = {};
    partidas.forEach(p => {
      const fase = p.stage || "";
      if (!porFase[fase]) porFase[fase] = [];
      porFase[fase].push(p);
    });

    const mapa = {
      "LAST_32":        CHAVEAMENTO_2026.filter(j => j.fase === "16avos"),
      "LAST_16":        CHAVEAMENTO_2026.filter(j => j.fase === "Oitavas"),
      "QUARTER_FINALS": CHAVEAMENTO_2026.filter(j => j.fase === "Quartas"),
      "SEMI_FINALS":    CHAVEAMENTO_2026.filter(j => j.fase === "Semifinal"),
      "FINAL":          CHAVEAMENTO_2026.filter(j => j.fase === "Final"),
    };

    for (const [faseMapa, jogosChave] of Object.entries(mapa)) {
      const partidasFase = (porFase[faseMapa] || []).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
      partidasFase.forEach((p, i) => {
        if (i >= jogosChave.length) return;
        const j = jogosChave[i];
        const nomeCasa = p.homeTeam?.name || j.casa;
        const nomeFora = p.awayTeam?.name || j.fora;
        j.casa = traduzirNomeTime(nomeCasa);
        j.fora = traduzirNomeTime(nomeFora);
        j.brasil = j.casa === "Brasil" || j.fora === "Brasil";
        if (p.status === "FINISHED") {
          const ft = p.score?.fullTime || {};
          if (typeof ft.home === "number") j.placar = `${ft.home} x ${ft.away}`;
        } else if (p.status === "IN_PLAY" || p.status === "PAUSED") {
          j.placar = "🔴";
        }
      });
    }
    renderChaveamento();
  } catch (_) {}
}

function renderChaveamento() {
  const fases = {};
  CHAVEAMENTO_2026.forEach(j => {
    if (!fases[j.fase]) fases[j.fase] = [];
    fases[j.fase].push(j);
  });

  const container = document.getElementById("chaveamentoContainer");
  if (!container) return;
  container.innerHTML = "";

  const ordemFases = ["16avos", "Oitavas", "Quartas", "Semifinal", "Final"];
  const labelsFases = {
    "16avos": "⚽ 16avos de Final",
    "Oitavas": "🏅 Oitavas de Final",
    "Quartas": "🎯 Quartas de Final",
    "Semifinal": "🔥 Semifinais",
    "Final": "🏆 Final"
  };

  ordemFases.forEach(fase => {
    const jogosFase = fases[fase];
    if (!jogosFase) return;

    const secao = document.createElement("div");
    secao.style.cssText = "margin-bottom:14px;";

    const titulo = document.createElement("div");
    titulo.style.cssText = "font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#888;padding:4px 0 6px;border-bottom:2px solid var(--borda);margin-bottom:6px;";
    titulo.textContent = labelsFases[fase] || fase;
    secao.appendChild(titulo);

    jogosFase.forEach(j => {
      const row = document.createElement("div");
      const isBrasil = j.brasil;
      const temPlacar = j.placar && j.placar !== "—" && j.placar !== null;
      const indefinido = j.casa === "A definir" || j.fora === "A definir";

      row.style.cssText = `
        display:flex;align-items:center;justify-content:space-between;
        padding:8px 10px;margin-bottom:4px;border-radius:8px;
        background:${isBrasil ? "linear-gradient(135deg,#0a3d20,#0a6847)" : indefinido ? "#f8f9fa" : "#fff"};
        border:1px solid ${isBrasil ? "transparent" : "var(--borda)"};
      `.replace(/\s+/g, ' ').trim();

      const flagC = flagChave(j.casa);
      const flagF = flagChave(j.fora);
      const corTexto = isBrasil ? "#fff" : "#333";
      const corSub = isBrasil ? "rgba(255,255,255,.6)" : "#888";

      row.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="font-size:.82rem;font-weight:700;color:${corTexto};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${flagC} ${j.casa} <span style="color:${corSub};font-weight:400;">×</span> ${j.fora} ${flagF}
          </div>
          <div style="font-size:.7rem;color:${corSub};margin-top:1px;">${j.data}</div>
        </div>
        <div style="font-size:.88rem;font-weight:800;color:${isBrasil ? "#ffd700" : temPlacar ? "var(--verde)" : "#ccc"};margin-left:10px;flex-shrink:0;">
          ${temPlacar ? j.placar : "—"}
        </div>
      `;
      secao.appendChild(row);
    });

    container.appendChild(secao);
  });
}

// ── Expõe globalmente ──────────────────────────────────────

window.iniciarSincronizacaoCalendario     = iniciarSincronizacaoCalendario;
window.sincronizarCalendarioBrasil        = sincronizarCalendarioBrasil;
window.iniciarVerificacaoPlacarAutomatica = iniciarVerificacaoPlacarAutomatica;
window.salvarPlacarAutomatico             = salvarPlacarAutomatico;
window.renderJogosDoDia                   = renderJogosDoDia;
window.irParaHoje                         = irParaHoje;
window.iniciarAutoRefreshJogosDia         = iniciarAutoRefreshJogosDia;
window.sincronizarChaveamento             = sincronizarChaveamento;
window.renderChaveamento                  = renderChaveamento;
