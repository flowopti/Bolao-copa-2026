/* =========================================================
   APP.JS — Inicialização, navegação e orquestração geral
   ========================================================= */

// ── Estado de UI ──────────────────────────────────────────
let _countdownInterval        = null;
let _countdownIntervalPremium = null;
let _notificacaoAgendada       = false;
let _notificacaoAgendadaPremium = false;
let _convitesJaDisparadosNestePalpite = false;
const VERSAO_ATUAL = document.querySelector('meta[name="app-version"]')?.content || "";
let _versaoIntervalo = null;

// ── Inicialização principal ───────────────────────────────

window.addEventListener("DOMContentLoaded", async () => {
  window.__bolaoIniciado = true;

  // Render imediato (não depende do Firebase)
  jogoAtual = obterProximoJogo();
  renderAreaJogoAtual();
  iniciarCountdown();
  iniciarVerificacaoVersao();
  registrarPWA();

  if (!firebaseOk) {
    const aviso = document.getElementById("avisoConfig");
    if (aviso) {
      aviso.style.display = "block";
      aviso.innerHTML = "&#9888;&#65039; <strong>Configuração pendente:</strong> banco de dados não configurado.";
    }
    return;
  }

  // Carrega placares salvos no Firebase
  try {
    const snap     = await db.ref("placares").once("value");
    const placares = snap.val() || {};
    for (const jogo of jogos) {
      if (placares[jogo.id]) {
        jogo.placarCasa = placares[jogo.id].placarCasa;
        jogo.placarFora = placares[jogo.id].placarFora;
      }
    }
    jogoAtual = obterProximoJogo();
    renderAreaJogoAtual();
    iniciarCountdown();
  } catch (e) { console.error("Erro ao carregar placares:", e); }

  try { await calcularPremioAcumulado(); }        catch (_) {}
  try { await calcularPremioAcumuladoPremium(); } catch (_) {}
  try { renderDistribuicao(); }                   catch (_) {}
  try { renderPalpites(); }                       catch (_) {}
  try { atualizarPremioDuplo(); }                 catch (_) {}
  try { renderRanking(); }                        catch (_) {}
  try { renderHistorico(); }                      catch (_) {}
  try { await carregarConfirmacoesData(); }       catch (_) {}
  try { iniciarSincronizacaoCalendario(); }       catch (_) {}
  try { iniciarVerificacaoPlacarAutomatica(); }   catch (_) {}
  try { iniciarAutoRefreshJogosDia(); }           catch (_) {}
  try {
    sincronizarChaveamento();
    setInterval(sincronizarChaveamento, 30 * 60 * 1000);
  } catch (_) {}
});

// ── Navegação por abas ────────────────────────────────────

function trocarAba(aba) {
  const abas = {
    principal: document.getElementById("abaPrincipal"),
    jogosdia:  document.getElementById("abaJogosDia"),
    premium:   document.getElementById("abaPremium"),
    historico: document.getElementById("abaHistorico"),
    stats:     document.getElementById("abaStats")
  };
  const navs = {
    principal: document.getElementById("navAbaPrincipal"),
    jogosdia:  document.getElementById("navAbaJogosDia"),
    historico: document.getElementById("navAbaHistorico"),
    stats:     document.getElementById("navAbaStats")
  };
  const toggle  = document.getElementById("togglePalpitar");
  const btnTrad = document.getElementById("toggleBtnTrad");
  const btnPrem = document.getElementById("toggleBtnPrem");

  // Esconde tudo
  Object.values(abas).forEach(el => { if (el) el.style.display = "none"; });
  Object.values(navs).forEach(el => { if (el) el.classList.remove("ativa"); });

  // Toggle só nas abas de palpite
  if (toggle) toggle.style.display = (aba === "principal" || aba === "premium") ? "grid" : "none";

  switch (aba) {
    case "stats":
      abas.stats.style.display = "block";
      navs.stats.classList.add("ativa");
      renderDashboardStats();
      break;

    case "historico":
      abas.historico.style.display = "block";
      navs.historico.classList.add("ativa");
      renderResumoGeral();
      renderRanking();
      renderHistorico();
      renderResumoGeralPremium();
      renderRankingPremium();
      break;

    case "jogosdia":
      abas.jogosdia.style.display = "block";
      navs.jogosdia.classList.add("ativa");
      irParaHoje();
      renderChaveamento();
      break;

    case "premium":
      abas.premium.style.display = "block";
      navs.principal.classList.add("ativa");
      if (btnTrad) btnTrad.classList.remove("ativo");
      if (btnPrem) btnPrem.classList.add("ativo");
      renderAbaPremium();
      break;

    default: // principal
      abas.principal.style.display = "block";
      navs.principal.classList.add("ativa");
      if (btnTrad) btnTrad.classList.add("ativo");
      if (btnPrem) btnPrem.classList.remove("ativo");
      break;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function trocarPainelPalpitar(painel) {
  trocarAba(painel === "prem" ? "premium" : "principal");
}

function trocarHistorico(painel) {
  const histTrad = document.getElementById("histPainelTrad");
  const histPrem = document.getElementById("histPainelPrem");
  const btnT     = document.getElementById("histBtnTrad");
  const btnP     = document.getElementById("histBtnPrem");
  if (!histTrad || !histPrem) return;

  if (painel === "prem") {
    histTrad.style.display = "none";
    histPrem.style.display = "block";
    if (btnT) btnT.classList.remove("ativo");
    if (btnP) btnP.classList.add("ativo");
  } else {
    histTrad.style.display = "block";
    histPrem.style.display = "none";
    if (btnT) btnT.classList.add("ativo");
    if (btnP) btnP.classList.remove("ativo");
  }
}

// ── Versão / atualização ──────────────────────────────────

function iniciarVerificacaoVersao() {
  if (_versaoIntervalo) clearInterval(_versaoIntervalo);
  _versaoIntervalo = setInterval(verificarNovaVersao, 5 * 60 * 1000); // a cada 5min
}

async function verificarNovaVersao() {
  try {
    const resp  = await fetch("index.html?_=" + Date.now(), { cache: "no-store" });
    const texto = await resp.text();
    const match = texto.match(/app-version[^"]*"([^"]+)"/);
    if (!match) return;
    const novaVersao = match[1];
    if (VERSAO_ATUAL && novaVersao && novaVersao !== VERSAO_ATUAL) {
      const aviso = document.getElementById("avisoNovaVersao");
      if (aviso) aviso.style.display = "flex";
    }
  } catch (_) {}
}

// ── Countdown ─────────────────────────────────────────────

function iniciarCountdown() {
  if (_countdownInterval) clearInterval(_countdownInterval);
  const box = document.getElementById("countdownBox");
  if (!box || !jogoAtual) return;

  function atualizar() {
    const agora  = new Date();
    const inicio = new Date(jogoAtual.dataISO);
    const diff   = inicio - agora;

    if (jogoAtual.placarCasa !== null || diff <= 0) {
      box.style.display = "none";
      return;
    }

    box.style.display = "block";

    const dias  = Math.floor(diff / 86400000);
    const horas = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    const segs  = Math.floor((diff % 60000) / 1000);

    const cdDias   = document.getElementById("cdDias");
    const cdSep    = document.getElementById("cdSepDias");
    const cdDiasN  = document.getElementById("cdDiasNum");
    const cdHoras  = document.getElementById("cdHoras");
    const cdMins   = document.getElementById("cdMinutos");
    const cdSegs   = document.getElementById("cdSegundos");
    const cdCardSeg= document.getElementById("cdCardSeg");
    const cdLabel  = document.getElementById("countdownLabel");

    if (cdDias && cdSep) {
      cdDias.style.display = dias > 0 ? "block" : "none";
      cdSep.style.display  = dias > 0 ? "inline" : "none";
    }
    if (cdDiasN) cdDiasN.textContent = String(dias).padStart(2,"0");
    if (cdHoras) cdHoras.textContent = String(horas).padStart(2,"0");
    if (cdMins)  cdMins.textContent  = String(mins).padStart(2,"0");
    if (cdSegs)  cdSegs.textContent  = String(segs).padStart(2,"0");

    // Urgência (< 1min)
    const urgente = diff < 60000;
    if (cdCardSeg) cdCardSeg.classList.toggle("urgente", urgente);
    if (cdLabel)   cdLabel.textContent = urgente ? "⚠️ Fechando agora!" : "📅 Fecha quando o jogo começar";

    // Agenda notificação 30min antes
    if (!_notificacaoAgendada && diff > 0 && diff <= 1800000) {
      agendarNotificacaoPreJogo();
      _notificacaoAgendada = true;
    }
  }

  atualizar();
  _countdownInterval = setInterval(atualizar, 1000);
}

function iniciarCountdownPremium() {
  if (_countdownIntervalPremium) clearInterval(_countdownIntervalPremium);
  const box = document.getElementById("countdownBoxPremium");
  if (!box || !jogoAtual) return;

  function atualizar() {
    const agora  = new Date();
    const inicio = new Date(jogoAtual.dataISO);
    const diff   = inicio - agora;

    if (jogoAtual.placarCasa !== null || diff <= 0) {
      box.style.display = "none";
      return;
    }

    box.style.display = "block";

    const dias  = Math.floor(diff / 86400000);
    const horas = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    const segs  = Math.floor((diff % 60000) / 1000);

    const cdDias  = document.getElementById("cdDiasPrem");
    const cdSep   = document.getElementById("cdSepDiasPrem");
    const cdDiasN = document.getElementById("cdDiasNumPrem");
    const cdHoras = document.getElementById("cdHorasPrem");
    const cdMins  = document.getElementById("cdMinutosPrem");
    const cdSegs  = document.getElementById("cdSegundosPrem");

    if (cdDias && cdSep) {
      cdDias.style.display = dias > 0 ? "block" : "none";
      cdSep.style.display  = dias > 0 ? "inline" : "none";
    }
    if (cdDiasN) cdDiasN.textContent = String(dias).padStart(2,"0");
    if (cdHoras) cdHoras.textContent = String(horas).padStart(2,"0");
    if (cdMins)  cdMins.textContent  = String(mins).padStart(2,"0");
    if (cdSegs)  cdSegs.textContent  = String(segs).padStart(2,"0");
  }

  atualizar();
  _countdownIntervalPremium = setInterval(atualizar, 1000);
}

// ── Notificações ──────────────────────────────────────────

function agendarNotificacaoPreJogo() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const diff = new Date(jogoAtual.dataISO) - new Date() - 30 * 60 * 1000;
  if (diff > 0) setTimeout(dispararNotificacao, diff);
  else dispararNotificacao();
}

function dispararNotificacao() {
  if (Notification.permission !== "granted") return;
  new Notification("⚽ Bolão Copa 2026", {
    body: `${jogoAtual.casa} x ${jogoAtual.fora} começa em breve! Faça seu palpite.`,
    icon: "./missao-hexa.jpg"
  });
}

async function ativarNotificacao() {
  if (!("Notification" in window)) { alert("Notificações não suportadas neste dispositivo."); return; }
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    _notificacaoAgendada = false;
    agendarNotificacaoPreJogo();
    _notificacaoAgendada = true;
  } else {
    alert("Permissão de notificação negada. Ative nas configurações do navegador.");
  }
}

async function ativarNotificacaoPremium() {
  await ativarNotificacao();
}

// ── PWA ───────────────────────────────────────────────────

let _deferredInstall = null;

function registrarPWA() {
  // Manifest inline via blob
  const manifest = {
    name:             "Bolão Copa 2026",
    short_name:       "Bolão Hexa",
    start_url:        ".",
    display:          "standalone",
    background_color: "#0a6847",
    theme_color:      "#0a6847",
    icons: [{ src: "./missao-hexa.jpg", sizes: "192x192", type: "image/jpeg" }]
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const link = document.getElementById("pwaManifest");
  if (link) link.href = URL.createObjectURL(blob);

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    _deferredInstall = e;
    const btn = document.getElementById("btnInstalarApp");
    if (btn) btn.style.display = "flex";
  });
}

function instalarApp() {
  if (!_deferredInstall) return;
  _deferredInstall.prompt();
  _deferredInstall.userChoice.then(() => {
    _deferredInstall = null;
    const btn = document.getElementById("btnInstalarApp");
    if (btn) btn.style.display = "none";
  });
}

// ── Modal genérico ────────────────────────────────────────

function abrirModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("ativo");
  document.body.classList.add("modal-aberto");
}

function fecharModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("ativo");
  document.body.classList.remove("modal-aberto");
}

// ── Convites pós-palpite ──────────────────────────────────

function dispararConvitesPosPalpite() {
  if (_convitesJaDisparadosNestePalpite) return;
  _convitesJaDisparadosNestePalpite = true;
  setTimeout(() => {
    mostrarConviteParaPremium();
  }, 800);
}

function limparFormularioPalpite() {
  const nome = document.getElementById("nomeJogador");
  const pC   = document.getElementById("placarCasa");
  const pF   = document.getElementById("placarFora");
  if (nome) nome.value = "";
  if (pC)   pC.value   = "";
  if (pF)   pF.value   = "";
  _convitesJaDisparadosNestePalpite = false;
}

// ── Convite grupo WhatsApp ────────────────────────────────

function mostrarConviteGrupoWhatsApp() {
  const btn = document.getElementById("btnEntrarGrupoWhats");
  if (btn) btn.href = LINK_GRUPO_WHATSAPP;
  abrirModal("modalConviteGrupoWhatsApp");
}

function fecharModalConviteGrupoWhatsApp() {
  fecharModal("modalConviteGrupoWhatsApp");
}

// ── Convite Premium ───────────────────────────────────────

async function mostrarConviteParaPremium() {
  if (!jogoAtual || jogoAtual.placarCasa !== null) return;
  const nome = (window._ultimoNomeUsado || "").trim();
  if (!nome) return;
  const elegivel = await elegivelParaPremium(normalizarNome(nome), "");
  if (!elegivel) return;
  abrirModal("modalConvitePremium");
}

function fecharModalConvitePremium() { fecharModal("modalConvitePremium"); }

function irParaPremiumDoConvite() {
  fecharModalConvitePremium();
  trocarAba("premium");
}

// ── Celebração ────────────────────────────────────────────

function renderCardResultado(jogoId, palpites, premioTotal) {
  const jogo = jogos.find(j => j.id === jogoId);
  if (!jogo) return;
  const rC         = Number(jogo.placarCasa);
  const rF         = Number(jogo.placarFora);
  const ganhadores = palpites.filter(p => Number(p.placarCasa) === rC && Number(p.placarFora) === rF);
  const premioCada = ganhadores.length > 0 ? premioTotal / ganhadores.length : 0;
  const el         = document.getElementById("cardResultadoTrad");
  if (!el) return;

  el.style.display = "block";
  el.innerHTML = `
    <div class="card-resultado">
      <div class="res-fase">${jogo.fase}</div>
      <div class="res-placar">${jogo.placarCasa} x ${jogo.placarFora}</div>
      <div class="res-times">${jogo.casa} x ${jogo.fora}</div>
      <div class="res-ganhadores">
        ${ganhadores.length > 0
          ? `🏆 ${ganhadores.map(g => sanitize(g.nome)).join(", ")}<span class="res-premio">R$ ${premioCada.toFixed(2).replace(".",",")}</span>`
          : `Ninguém acertou — prêmio acumula!`}
      </div>
    </div>
  `;
}

function abrirCelebracao(palpites, premioTotal) {
  const rC         = Number(jogoAtual.placarCasa);
  const rF         = Number(jogoAtual.placarFora);
  const ganhadores = palpites.filter(p => Number(p.placarCasa) === rC && Number(p.placarFora) === rF);
  const premioCada = ganhadores.length > 0 ? premioTotal / ganhadores.length : 0;

  const elPlacar = document.getElementById("celPlacar");
  const elTimes  = document.getElementById("celTimes");
  const elGanh   = document.getElementById("celGanhadores");
  const elPrem   = document.getElementById("celPremio");

  if (elPlacar) elPlacar.textContent = `${rC} x ${rF}`;
  if (elTimes)  elTimes.textContent  = `${jogoAtual.casa} × ${jogoAtual.fora}`;

  if (ganhadores.length > 0) {
    if (elGanh) elGanh.innerHTML = ganhadores.map(g =>
      `<div class="cel-nome">${sanitize(g.nome)}</div>`
    ).join("");
    if (elPrem) elPrem.textContent = `R$ ${premioCada.toFixed(2).replace(".",",")}`;
  }

  abrirModal("modalCelebracao");
}

function compartilharResultadoWhatsApp() {
  const rC = Number(jogoAtual.placarCasa);
  const rF = Number(jogoAtual.placarFora);
  const msg = `🏆 *BOLÃO COPA 2026 — MISSÃO HEXA*\n\nResultado: *${jogoAtual.casa} ${rC} x ${rF} ${jogoAtual.fora}*\n\nAposte você também! 🇧🇷`;
  abrirLinkWhatsApp(`https://wa.me/?text=${encodeURIComponent(msg)}`);
}

// ── Expõe no escopo global (chamadas inline no HTML) ──────

window.trocarAba                           = trocarAba;
window.trocarPainelPalpitar                = trocarPainelPalpitar;
window.trocarHistorico                     = trocarHistorico;
window.instalarApp                         = instalarApp;
window.abrirModal                          = abrirModal;
window.fecharModal                         = fecharModal;
window.fecharModalConviteGrupoWhatsApp     = fecharModalConviteGrupoWhatsApp;
window.fecharModalConvitePremium           = fecharModalConvitePremium;
window.irParaPremiumDoConvite              = irParaPremiumDoConvite;
window.compartilharResultadoWhatsApp       = compartilharResultadoWhatsApp;
window.ativarNotificacao                   = ativarNotificacao;
window.ativarNotificacaoPremium            = ativarNotificacaoPremium;
