/* =========================================================
   GAME.JS — Lógica de negócio: estado do jogo atual,
   regras de abertura de palpites, render da área principal.
   ========================================================= */

let jogoAtual = null;

// ── Regras de estado ──────────────────────────────────────

/**
 * Retorna o jogo que deve estar "em foco" agora.
 * Mantém o jogo visível até 12h após o término estimado (janela de transparência).
 */
function obterProximoJogo() {
  const agora                = new Date();
  const DURACAO_JOGO_MS      = 2.25 * 60 * 60 * 1000;  // ~2h15
  const JANELA_TRANSP_MS     = 12   * 60 * 60 * 1000;  // 12h

  for (const j of jogos) {
    const inicio          = new Date(j.dataISO);
    const terminoEstimado = new Date(inicio.getTime() + DURACAO_JOGO_MS);
    const fimJanela       = new Date(terminoEstimado.getTime() + JANELA_TRANSP_MS);
    if (agora < fimJanela) return j;
  }
  return jogos[jogos.length - 1];
}

/**
 * Verifica se os palpites estão liberados para um jogo.
 * Bloqueia se o jogo já começou ou se a data foi confirmada há menos de 12h.
 */
function palpitesLiberados(jogo) {
  if (!jogo) return false;
  const agora = Date.now();
  if (agora >= new Date(jogo.dataISO).getTime()) return false;
  const confirmadoEm = _dataConfirmacaoJogos[jogo.id];
  if (!confirmadoEm) return true;
  return (agora - confirmadoEm) >= HORAS_ESPERA_APOS_CONFIRMACAO;
}

// ── Teasers cruzados ──────────────────────────────────────

async function atualizarPremioDuplo() {
  try {
    const pT   = await obterPalpitesDoJogo(jogoAtual.id);
    const arT  = calcularArrecadacao(pT) + premioAcumulado;
    const elTD = document.getElementById("teaserTradDuplo");
    if (elTD) elTD.textContent = `R$ ${arT.toFixed(2).replace(".",",")} · ${pT.length} apostador${pT.length !== 1 ? "es" : ""}`;
  } catch (_) {}

  try {
    const pP   = await obterPalpitesPremiumDoJogo(jogoAtual.id);
    const arP  = calcularArrecadacaoPremium(pP) + premioAcumuladoPremium;
    const elPD = document.getElementById("teaserPremioDuplo");
    if (elPD) elPD.textContent = `R$ ${arP.toFixed(2).replace(".",",")} · ${pP.length} apostador${pP.length !== 1 ? "es" : ""}`;
  } catch (_) {}
}

// ── Render da área do jogo atual ──────────────────────────

function renderAreaJogoAtual() {
  const modalContador = document.getElementById("modalContador");
  if (modalContador && modalContador.classList.contains("ativo")) return;

  const area     = document.getElementById("areaJogoAtual");
  const btnEnviar = document.getElementById("btnEnviar");
  const agora    = new Date();
  const inicio   = new Date(jogoAtual.dataISO);
  const comecoujogo = agora >= inicio;
  const liberado = palpitesLiberados(jogoAtual);
  const flagCasa = bandeiraIMG(jogoAtual.casa);
  const flagFora = bandeiraIMG(jogoAtual.fora);

  // Jogo encerrado (placar oficial registrado)
  if (jogoAtual.placarCasa !== null) {
    area.innerHTML = `
      <div class="jogo-destaque" style="border-color:var(--verde-claro);background:linear-gradient(160deg,#0e3324,var(--azul-noite));">
        <div class="badge-encerrado" style="background:#d4edda;color:#155724;border-color:#28a745;">🏁 JOGO ENCERRADO — Resultado final</div>
        <div class="data">${jogoAtual.fase} — ${jogoAtual.dataLabel}</div>
        <div class="confronto">${flagCasa} ${jogoAtual.casa} ${jogoAtual.placarCasa} x ${jogoAtual.placarFora} ${jogoAtual.fora} ${flagFora}</div>
        <div id="resultadoFinalGanhadores" class="status-msg" style="margin-top:8px;">Carregando resultado...</div>
        <div id="areaImagemVitoria" style="margin-top:12px;display:none;">
          <canvas id="posterVitoria" width="1080" height="1920" style="max-width:100%;border-radius:10px;"></canvas>
          <button class="btn btn-secundario" onclick="baixarImagemVitoria(false)" style="margin-top:8px;">⬇️ Baixar imagem</button>
        </div>
      </div>
    `;
    renderResultadoFinalGanhadores();
    const formEl = document.getElementById("formNovoPalpite");
    if (formEl) formEl.style.display = "none";
    return;
  }

  // Jogo em andamento: esconde form (placar ao vivo já mostra tudo)
  if (comecoujogo) {
    area.innerHTML = "";
    const formEl = document.getElementById("formNovoPalpite");
    if (formEl) formEl.style.display = "none";
    return;
  }

  // Jogo futuro
  const formEl = document.getElementById("formNovoPalpite");
  if (formEl) formEl.style.display = "block";

  let badge = "";
  if (!liberado) {
    const confirmadoEm  = _dataConfirmacaoJogos[jogoAtual.id];
    const liberaEm      = new Date(confirmadoEm + HORAS_ESPERA_APOS_CONFIRMACAO);
    const liberaEmLabel = liberaEm.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
    badge = `<div class="badge-encerrado" style="background:#fff3cd;color:#856404;border-color:#ffc107;">⏳ Confronto recém-definido! Palpites abrem às ${liberaEmLabel}</div>`;
  }

  const bloqueado = !liberado;

  area.innerHTML = `
    <div class="jogo-destaque">
      ${badge}
      <div class="data">${jogoAtual.fase} — ${jogoAtual.dataLabel}</div>
      <div class="confronto">${flagCasa} ${jogoAtual.casa} x ${jogoAtual.fora} ${flagFora}</div>
      <div class="placares">
        <div class="stepper">
          <button type="button" class="stepper-btn" onclick="ajustarPlacar('placarCasa',-1)" ${bloqueado ? "disabled" : ""} aria-label="Diminuir gols ${jogoAtual.casa}">−</button>
          <input type="number" id="placarCasa" min="0" max="20" placeholder="0" ${bloqueado ? "disabled" : ""}>
          <button type="button" class="stepper-btn" onclick="ajustarPlacar('placarCasa',1)" ${bloqueado ? "disabled" : ""} aria-label="Aumentar gols ${jogoAtual.casa}">+</button>
        </div>
        <span class="placar-x">×</span>
        <div class="stepper">
          <button type="button" class="stepper-btn" onclick="ajustarPlacar('placarFora',-1)" ${bloqueado ? "disabled" : ""} aria-label="Diminuir gols ${jogoAtual.fora}">−</button>
          <input type="number" id="placarFora" min="0" max="20" placeholder="0" ${bloqueado ? "disabled" : ""}>
          <button type="button" class="stepper-btn" onclick="ajustarPlacar('placarFora',1)" ${bloqueado ? "disabled" : ""} aria-label="Aumentar gols ${jogoAtual.fora}">+</button>
        </div>
      </div>
    </div>
  `;

  btnEnviar.disabled = bloqueado || !firebaseOk;
  if (!liberado)        btnEnviar.textContent = "Aguardando liberação";
  else if (!firebaseOk) btnEnviar.textContent = "Configuração pendente";
  else                  btnEnviar.textContent = "Enviar palpite";
}

// ── Resultado final ───────────────────────────────────────

async function renderResultadoFinalGanhadores() {
  const el = document.getElementById("resultadoFinalGanhadores");
  if (!el || !jogoAtual) return;

  const palpites   = await obterPalpitesDoJogo(jogoAtual.id);
  const rC         = Number(jogoAtual.placarCasa);
  const rF         = Number(jogoAtual.placarFora);
  const ganhadores = palpites.filter(p => Number(p.placarCasa) === rC && Number(p.placarFora) === rF);
  const premioTotal = calcularArrecadacao(palpites) + premioAcumulado;

  if (ganhadores.length > 0) {
    const premioCada = premioTotal / ganhadores.length;
    el.innerHTML = `<strong style="color:var(--verde);">🏆 Ganhador(es): ${ganhadores.map(g => sanitize(g.nome)).join(", ")}</strong><br>
      💰 R$ ${premioCada.toFixed(2).replace(".",",")} para cada um`;

    const nomeSessao = normalizarNome(window._ultimoNomeUsado || "");
    const telSessao  = (window._ultimoTelefoneUsado || "").trim();
    const souGanhador = ganhadores.find(g =>
      normalizarNome(g.nome) === nomeSessao && (g.telefone || "") === telSessao
    );
    if (souGanhador) {
      el.innerHTML += `<br><button class="btn" style="margin-top:10px;background:#e1306c;"
        onclick="gerarImagemVitoria('${souGanhador.nome.replace(/'/g,"\\'")}', ${premioCada}, false)">
        📸 Compartilhar minha vitória</button>`;
    }
  } else {
    el.innerHTML = `Ninguém acertou o placar exato — prêmio de R$ ${premioTotal.toFixed(2).replace(".",",")} acumula para a próxima rodada!`;
  }
}

// ── Área Premium ──────────────────────────────────────────
// NOTA: renderAreaJogoPremium vive em premium.js (versão completa,
// integrada a countdown/badges/ganhadores parciais). Não duplicar aqui.
