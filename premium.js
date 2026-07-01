/* =========================================================
   PREMIUM.JS — Fluxo completo do Bolão Premium
   Elegibilidade, render, modal PIX, edição, contador,
   confirmações e exclusão (admin).
   ========================================================= */

// ── Elegibilidade ──────────────────────────────────────────

async function elegivelParaPremium(nomeNormalizado, telefoneNormalizado) {
  try {
    const snapshot = await db.ref(`palpites/${jogoAtual.id}`).once("value");
    const todos = snapshot.val() || {};
    return Object.entries(todos).some(([chave, dados]) =>
      (chave === nomeNormalizado || chave.startsWith(nomeNormalizado + "_")) &&
      (dados.telefone || "") === telefoneNormalizado
    );
  } catch (_) { return false; }
}

async function buscarElegibilidadePremiumPorIdent(identPix, identTelefone) {
  try {
    const snapshot = await db.ref(`palpites/${jogoAtual.id}`).once("value");
    const todos = snapshot.val() || {};
    for (const chave in todos) {
      const p = todos[chave];
      const pixBate = identPix && (p.pix || "").trim() === identPix;
      const telBate = identTelefone && identTelefone.length >= 8 && (p.telefone || "") === identTelefone;
      if (pixBate || telBate) return p;
    }
  } catch (_) {}
  return null;
}

async function contarApostasPremiumRodadaAnterior(nome) {
  const idxAtual = jogos.findIndex(j => j.id === jogoAtual.id);
  if (idxAtual <= 0) return 0;
  const jogoAnterior = jogos[idxAtual - 1];
  try {
    const snapshot = await db.ref(`palpitesPremium/${jogoAnterior.id}`).once("value");
    const nomeNorm = normalizarNome(nome);
    return Object.values(snapshot.val() || {}).filter(p =>
      normalizarNome(p.nome) === nomeNorm || normalizarNome(p.nome).startsWith(nomeNorm)
    ).length;
  } catch (_) { return 0; }
}

async function contarApostasPremiumNestaRodada(nome) {
  try {
    const snapshot = await db.ref(`palpitesPremium/${jogoAtual.id}`).once("value");
    const nomeNorm = normalizarNome(nome);
    return Object.values(snapshot.val() || {}).filter(p =>
      normalizarNome(p.nome) === nomeNorm || normalizarNome(p.nome).startsWith(nomeNorm)
    ).length;
  } catch (_) { return 0; }
}

async function buscarPixDoApostadorNoBolaoAberto(nomeNormalizado, telefoneNormalizado) {
  try {
    const snapshot = await db.ref(`palpites/${jogoAtual.id}`).once("value");
    const todos = snapshot.val() || {};
    for (const chave in todos) {
      const dados = todos[chave];
      if ((chave === nomeNormalizado || chave.startsWith(nomeNormalizado + "_")) &&
          (dados.telefone || "") === telefoneNormalizado) {
        return dados.pix || "";
      }
    }
  } catch (_) {}
  return "";
}

async function buscarApostaPorNomeNoBolaoAberto(nomeNormalizado) {
  try {
    const snapshot = await db.ref(`palpites/${jogoAtual.id}`).once("value");
    const todos = snapshot.val() || {};
    for (const chave in todos) {
      if (chave === nomeNormalizado || chave.startsWith(nomeNormalizado + "_")) return todos[chave];
    }
  } catch (_) {}
  return null;
}

// ── Render: aba Premium ───────────────────────────────────

async function renderAbaPremium() {
  const bloqueado = document.getElementById("premiumBloqueado");
  const liberado  = document.getElementById("premiumLiberado");
  if (!bloqueado || !liberado) return;

  bloqueado.style.display = "none";
  liberado.style.display  = "block";

  atualizarTeaserPremium();

  const identSessao = (window._ultimoPixUsado || window._ultimoTelefoneUsado || "").trim();
  const identInput = document.getElementById("identVerifPremium");
  if (identInput && !identInput.value && identSessao) identInput.value = identSessao;
}

async function verificarIdentPremium() {
  const input    = document.getElementById("identVerifPremium");
  const aviso    = document.getElementById("avisoIdentPremium");
  const formArea = document.getElementById("formAreaPremium");
  const bloqArea = document.getElementById("bloqAreaPremium");
  if (!input) return;

  const ident = input.value.trim();
  if (!ident) {
    mostrarAviso(aviso, "Digite seu telefone ou chave PIX usados no Bolão Tradicional.", "erro");
    return;
  }

  aviso.innerHTML = '<span style="color:#888;font-size:.82rem;">🔍 Verificando...</span>';

  const telNorm  = ident.replace(/\D/g, "");
  const palpite  = await buscarElegibilidadePremiumPorIdent(ident, telNorm);

  if (palpite) {
    window._ultimoNomeUsado     = palpite.nome     || window._ultimoNomeUsado;
    window._ultimoPixUsado      = palpite.pix      || ident;
    window._ultimoTelefoneUsado = palpite.telefone || telNorm;

    const nomeInput = document.getElementById("nomeJogadorPremium");
    const telInput  = document.getElementById("telefoneJogadorPremium");
    const pixInput  = document.getElementById("pixJogadorPremium");
    if (nomeInput) nomeInput.value = palpite.nome || "";
    if (telInput)  telInput.value  = palpite.telefone || telNorm;
    if (pixInput)  pixInput.value  = palpite.pix || ident;

    aviso.innerHTML = `<span style="color:var(--verde);font-size:.82rem;">✅ Olá, <strong>${sanitize(palpite.nome)}</strong>! Palpite Tradicional confirmado — escolha seu placar Premium abaixo.</span>`;
    if (formArea) formArea.style.display = "block";
    if (bloqArea) bloqArea.style.display = "none";

    renderAreaJogoPremium();
    renderPalpitesPremium();
    renderDistribuicaoPremium();
  } else {
    aviso.innerHTML = "";
    if (formArea) formArea.style.display = "none";
    if (bloqArea) bloqArea.style.display = "block";
  }
}

async function atualizarTeaserPremium() {
  try {
    const palpites      = await obterPalpitesPremiumDoJogo(jogoAtual.id);
    const arrecadado    = calcularArrecadacaoPremium(palpites);
    const premioTotal   = arrecadado + premioAcumuladoPremium;
    const participantes = palpites.length;
    const elPremio = document.getElementById("teaserPremioPremium");
    const elPart   = document.getElementById("teaserParticipantesPremium");
    if (elPremio) elPremio.textContent = `R$ ${premioTotal.toFixed(2).replace(".",",")}`;
    if (elPart)   elPart.textContent   = `${participantes} ${participantes === 1 ? "apostador" : "apostadores"}`;
  } catch (_) {}
}

async function verificarAcessoPremium() {
  const aviso = document.getElementById("avisoVerificarPremium");
  const redir = document.getElementById("bloqueioRedirecionamento");
  const ident = document.getElementById("telVerificarPremium").value.trim();

  if (!ident) {
    mostrarAviso(aviso, "Digite sua chave PIX ou telefone para verificar o acesso.", "erro");
    return;
  }

  const identTelefone = ident.replace(/\D/g, "");
  const identPix       = ident.trim();

  let palpiteEncontrado = null;
  try {
    const snapshot = await db.ref(`palpites/${jogoAtual.id}`).once("value");
    const todos    = snapshot.val() || {};
    for (const chave in todos) {
      const p = todos[chave];
      const pixBate = identPix && (p.pix || "").trim() === identPix;
      const telBate = identTelefone && identTelefone.length >= 8 && (p.telefone || "") === identTelefone;
      if (pixBate || telBate) { palpiteEncontrado = p; break; }
    }
  } catch (_) {}

  if (!palpiteEncontrado) {
    mostrarAviso(aviso, "❌ Nenhum palpite encontrado com essa chave PIX ou telefone no Bolão Tradicional desta rodada.", "erro");
    if (redir) redir.style.display = "block";
    return;
  }

  if (redir) redir.style.display = "none";
  window._ultimoNomeUsado     = palpiteEncontrado.nome     || "";
  window._ultimoTelefoneUsado = palpiteEncontrado.telefone || "";
  window._ultimoPixUsado      = palpiteEncontrado.pix      || "";
  mostrarAviso(aviso, "✅ Acesso liberado!", "sucesso");
  setTimeout(() => renderAbaPremium(), 800);
}

// ── Render: área do jogo Premium ──────────────────────────

function renderAreaJogoPremium() {
  const modalAberto = document.getElementById("modalContadorPremium");
  if (modalAberto && modalAberto.classList.contains("ativo")) return;

  const area      = document.getElementById("areaJogoPremium");
  const btnEnviar = document.getElementById("btnEnviarPremium");
  if (!area || !jogoAtual) return;

  const flagCasa = bandeiraIMG(jogoAtual.casa);
  const flagFora = bandeiraIMG(jogoAtual.fora);
  const liberadoPrazo = palpitesLiberados(jogoAtual);
  const agora    = new Date();
  const jogoComecou = agora >= new Date(jogoAtual.dataISO);

  if (jogoAtual.placarCasa !== null) {
    area.innerHTML = `
      <div class="jogo-destaque" style="border-color:var(--verde-claro);background:linear-gradient(160deg,#0e3324,var(--azul-noite));">
        <div class="badge-encerrado" style="background:#d4edda;color:#155724;border-color:#28a745;">🏁 JOGO ENCERRADO — Resultado final</div>
        <div class="confronto">${flagCasa} ${jogoAtual.casa} ${jogoAtual.placarCasa} x ${jogoAtual.placarFora} ${jogoAtual.fora} ${flagFora}</div>
        <div id="resultadoFinalPremium" class="status-msg" style="margin-top:8px;">Carregando resultado...</div>
        <div id="areaImagemVitoriaPremium" style="margin-top:12px;display:none;">
          <canvas id="posterVitoriaPremium" width="1080" height="1920" style="max-width:100%;border-radius:10px;"></canvas>
          <button class="btn btn-secundario" onclick="baixarImagemVitoria(true)" style="margin-top:8px;">⬇️ Baixar imagem</button>
        </div>
      </div>
    `;
    renderResultadoFinalPremium();
    const formElP = document.getElementById("formNovoPalpitePremium");
    if (formElP) formElP.style.display = "none";
    const ctdBox = document.getElementById("countdownBoxPremium");
    if (ctdBox) ctdBox.style.display = "none";
    if (_countdownIntervalPremium) clearInterval(_countdownIntervalPremium);
    return;
  }

  const bloqueadoCampo = jogoComecou || !liberadoPrazo;
  let badge = "";
  if (jogoComecou)            badge = `<div class="badge-encerrado">⛔ Palpites encerrados — confira o placar ao vivo acima</div>`;
  else if (!liberadoPrazo)    badge = `<div class="badge-encerrado" style="background:#fff3cd;color:#856404;border-color:#ffc107;">⏳ Aguardando liberação</div>`;

  const formElP = document.getElementById("formNovoPalpitePremium");

  if (jogoComecou) {
    area.innerHTML = "";
    if (formElP) formElP.style.display = "none";
    const ctdBox = document.getElementById("countdownBoxPremium");
    if (ctdBox) ctdBox.style.display = "none";
    if (_countdownIntervalPremium) clearInterval(_countdownIntervalPremium);
    return;
  }

  if (formElP) formElP.style.display = "block";

  area.innerHTML = `
    <div class="jogo-destaque">
      ${badge}
      <div class="data">${jogoAtual.fase} — ${jogoAtual.dataLabel}</div>
      <div class="confronto">${flagCasa} ${jogoAtual.casa} x ${jogoAtual.fora} ${flagFora}</div>
      <div class="placares">
        <div class="stepper">
          <button type="button" class="stepper-btn" onclick="ajustarPlacar('placarCasaPremium',-1)" ${bloqueadoCampo ? "disabled" : ""} aria-label="Diminuir gols ${jogoAtual.casa}">−</button>
          <input type="number" id="placarCasaPremium" min="0" max="20" placeholder="0" ${bloqueadoCampo ? "disabled" : ""}>
          <button type="button" class="stepper-btn" onclick="ajustarPlacar('placarCasaPremium',1)" ${bloqueadoCampo ? "disabled" : ""} aria-label="Aumentar gols ${jogoAtual.casa}">+</button>
        </div>
        <span class="placar-x">×</span>
        <div class="stepper">
          <button type="button" class="stepper-btn" onclick="ajustarPlacar('placarForaPremium',-1)" ${bloqueadoCampo ? "disabled" : ""} aria-label="Diminuir gols ${jogoAtual.fora}">−</button>
          <input type="number" id="placarForaPremium" min="0" max="20" placeholder="0" ${bloqueadoCampo ? "disabled" : ""}>
          <button type="button" class="stepper-btn" onclick="ajustarPlacar('placarForaPremium',1)" ${bloqueadoCampo ? "disabled" : ""} aria-label="Aumentar gols ${jogoAtual.fora}">+</button>
        </div>
      </div>
    </div>
  `;
  btnEnviar.disabled = bloqueadoCampo || !firebaseOk;
  btnEnviar.textContent = bloqueadoCampo ? "Palpites encerrados" : "⭐ Enviar palpite Premium";
  iniciarCountdownPremium();
}

async function renderResultadoFinalPremium() {
  const el = document.getElementById("resultadoFinalPremium");
  if (!el || !jogoAtual) return;
  const palpites = await obterPalpitesPremiumDoJogo(jogoAtual.id);
  const rC = Number(jogoAtual.placarCasa), rF = Number(jogoAtual.placarFora);
  const ganhadores = palpites.filter(p => Number(p.placarCasa) === rC && Number(p.placarFora) === rF);
  const premioTotal = calcularArrecadacaoPremium(palpites) + premioAcumuladoPremium;

  if (ganhadores.length > 0) {
    const premioCada = premioTotal / ganhadores.length;
    el.innerHTML = `<strong style="color:var(--verde);">🏆 Ganhador(es) Premium: ${ganhadores.map(g => sanitize(g.nome)).join(", ")}</strong><br>
      💰 R$ ${premioCada.toFixed(2).replace(".",",")} para cada um`;

    const nomeSessao = normalizarNome(window._ultimoNomeUsado || "");
    const telSessao  = (window._ultimoTelefoneUsado || "").trim();
    const souGanhador = ganhadores.find(g => normalizarNome(g.nome) === nomeSessao && (g.telefone || "") === telSessao);
    if (souGanhador) {
      el.innerHTML += `<br><button class="btn" style="margin-top:10px;background:#e1306c;" onclick="gerarImagemVitoria('${souGanhador.nome.replace(/'/g,"\\'")}', ${premioCada}, true)">📸 Compartilhar minha vitória</button>`;
    }
  } else {
    el.innerHTML = `Ninguém acertou o placar exato no Premium — prêmio de R$ ${premioTotal.toFixed(2).replace(".",",")} acumula para a próxima rodada!`;
  }
}

// ── Render: tabela e distribuição ─────────────────────────

let _renderPalpitesPremiumEmAndamento = false;
let _renderPalpitesPremiumPendente    = false;
let _debounceFiltroPalpitesPremium    = null;

function filtrarPalpitesPremiumComDebounce() {
  if (_debounceFiltroPalpitesPremium) clearTimeout(_debounceFiltroPalpitesPremium);
  _debounceFiltroPalpitesPremium = setTimeout(() => renderPalpitesPremium(), 250);
}

async function renderPalpitesPremium() {
  if (_renderPalpitesPremiumEmAndamento) {
    _renderPalpitesPremiumPendente = true;
    return;
  }
  _renderPalpitesPremiumEmAndamento = true;
  try {
    await _renderPalpitesPremiumInterno();
  } finally {
    _renderPalpitesPremiumEmAndamento = false;
    if (_renderPalpitesPremiumPendente) {
      _renderPalpitesPremiumPendente = false;
      renderPalpitesPremium();
    }
  }
}

function _parseDataEnvioPremium(str) {
  const m = (str || "").match(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  return new Date(yyyy, mm - 1, dd, hh, mi, ss || 0).getTime();
}

async function _renderPalpitesPremiumInterno() {
  const corpo = document.getElementById("corpoTabelaPalpitesPremium");
  const vazio = document.getElementById("vazioPalpitesPremium");
  if (!corpo || !jogoAtual) return;
  corpo.innerHTML = "";

  const palpites = await obterPalpitesPremiumDoJogo(jogoAtual.id);
  const total      = palpites.length;
  const arrecadado = calcularArrecadacaoPremium(palpites);
  const premioTotal = arrecadado + premioAcumuladoPremium;
  document.getElementById("infoParticipantesPremium").textContent = String(total);
  document.getElementById("infoArrecadadoPremium").textContent = "R$ " + arrecadado.toFixed(2).replace(".", ",");
  document.getElementById("infoPremioPremium").textContent = "R$ " + premioTotal.toFixed(2).replace(".", ",");

  const regraEl     = document.getElementById("regraValorPremium");
  const bannerAcumP = document.getElementById("bannerAcumuloPremium");
  const avisoRegraP = document.getElementById("avisoRegraAcumuloPremium");
  const tabelaBoxP  = document.getElementById("tabelaValoresPalpitantesPremiumBox");

  if (premioAcumuladoPremium > 0) {
    const idxAtual = jogos.findIndex(j => j.id === jogoAtual.id);
    const jogoAnt  = idxAtual > 0 ? jogos[idxAtual - 1] : null;
    document.getElementById("valorAcumuladoPremium").textContent = `+ R$ ${premioAcumuladoPremium.toFixed(2).replace(".",",")}`;
    document.getElementById("origemAcumuladoPremium").textContent = jogoAnt
      ? `Ninguém acertou ${jogoAnt.casa} ${jogoAnt.placarCasa} x ${jogoAnt.placarFora} ${jogoAnt.fora}`
      : "Rodada anterior sem ganhador";
    if (bannerAcumP) bannerAcumP.style.display = "block";
    if (avisoRegraP) avisoRegraP.style.display = "block";
    if (regraEl)     regraEl.style.display = "none";

    if (tabelaBoxP && palpites.length > 0) {
      const corpo2 = document.getElementById("corpoValoresPalpitantesPremium");
      if (corpo2) {
        corpo2.innerHTML = "";
        const vistos = new Set();
        palpites.forEach(p => {
          const n = normalizarNome(p.nome);
          if (vistos.has(n)) return;
          vistos.add(n);
          const valor      = typeof p.valor === "number" ? p.valor : VALOR_PREMIUM_BASE;
          const jogouAntes = valor <= VALOR_PREMIUM_BASE;
          const tag = jogouAntes
            ? `<span style="background:#d4edda;color:#155724;border:1px solid #28a745;border-radius:6px;font-size:.68rem;font-weight:700;padding:2px 7px;">Jogou antes</span>`
            : `<span style="background:#ffe5d0;color:#a8540c;border:1px solid #ff8c2e;border-radius:6px;font-size:.68rem;font-weight:700;padding:2px 7px;">Novo / extra</span>`;
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="text-align:left;padding-left:10px;font-weight:700;">${sanitize(p.nome)}</td>
            <td>${tag}</td>
            <td style="font-weight:800;color:${jogouAntes ? 'var(--verde)' : '#c0392b'};">R$ ${valor.toFixed(2).replace(".",",")}</td>
          `;
          corpo2.appendChild(tr);
        });
        tabelaBoxP.style.display = "block";
      }
    }
  } else {
    if (bannerAcumP) bannerAcumP.style.display = "none";
    if (avisoRegraP) avisoRegraP.style.display = "none";
    if (tabelaBoxP)  tabelaBoxP.style.display = "none";
    if (regraEl) { regraEl.style.display = "block"; regraEl.textContent = "Cada palpite custa R$ 10,00. Máximo 2 pessoas por placar exato."; }
  }

  if (palpites.length === 0) {
    vazio.style.display = "block";
    return;
  }

  const flagCasa = bandeiraIMG(jogoAtual.casa);
  const flagFora = bandeiraIMG(jogoAtual.fora);

  const filtroInput = document.getElementById("filtroPalpitesTextoPremium");
  const termo = filtroInput ? filtroInput.value.trim().toLowerCase() : "";
  let listaFiltrada = palpites;
  if (termo) {
    listaFiltrada = palpites.filter(p => {
      const nomeMatch   = p.nome.toLowerCase().includes(termo);
      const placarStr   = `${p.placarCasa}x${p.placarFora}`;
      const placarMatch = placarStr.includes(termo.replace(/\s/g, ""));
      return nomeMatch || placarMatch;
    });
  }

  const ordemSelect = document.getElementById("ordemPalpitesPremium");
  const ordem = ordemSelect ? ordemSelect.value : "data_desc";

  listaFiltrada = [...listaFiltrada].sort((a, b) => {
    if (ordem === "nome_asc")  return a.nome.localeCompare(b.nome, "pt-BR");
    if (ordem === "nome_desc") return b.nome.localeCompare(a.nome, "pt-BR");
    if (ordem === "data_asc")  return _parseDataEnvioPremium(a.enviadoEm) - _parseDataEnvioPremium(b.enviadoEm);
    return _parseDataEnvioPremium(b.enviadoEm) - _parseDataEnvioPremium(a.enviadoEm);
  });

  if (listaFiltrada.length === 0) {
    vazio.style.display = "block";
    vazio.textContent = "Nenhum palpite Premium encontrado para essa busca.";
    return;
  }
  vazio.style.display = "none";

  const totalApostasPorNome = {};
  palpites.forEach(p => {
    const chaveNome = normalizarNome(p.nome);
    totalApostasPorNome[chaveNome] = (totalApostasPorNome[chaveNome] || 0) + 1;
  });

  const numeracaoPorChave = {};
  const ordenadosPorData = [...palpites].sort((a, b) => _parseDataEnvioPremium(a.enviadoEm) - _parseDataEnvioPremium(b.enviadoEm));
  const contadorPorNome = {};
  ordenadosPorData.forEach(p => {
    const chaveNome = normalizarNome(p.nome);
    contadorPorNome[chaveNome] = (contadorPorNome[chaveNome] || 0) + 1;
    numeracaoPorChave[p._chave] = contadorPorNome[chaveNome];
  });

  listaFiltrada.forEach(p => {
    const chaveNome = normalizarNome(p.nome);
    const totalDessaPessoa = totalApostasPorNome[chaveNome] || 1;
    const numeroDestaAposta = numeracaoPorChave[p._chave] || 1;
    const indicadorAposta = totalDessaPessoa > 1
      ? ` <span style="font-size:.72rem;color:#888;">(${numeroDestaAposta}ª aposta)</span>`
      : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align:left;padding-left:10px;">${sanitize(p.nome)}${indicadorAposta}</td>
      <td class="placar">${flagCasa} ${p.placarCasa} x ${p.placarFora} ${flagFora}</td>
      <td style="white-space:nowrap;font-size:.78rem;">${formatarDataTabela(p.enviadoEm)}</td>
    `;
    corpo.appendChild(tr);
  });
}

async function renderDistribuicaoPremium() {
  const corpo = document.getElementById("corpoDistribuicaoPremium");
  const vazio = document.getElementById("vazioDistribuicaoPremium");
  if (!corpo || !jogoAtual) return;
  corpo.innerHTML = "";

  const palpites = await obterPalpitesPremiumDoJogo(jogoAtual.id);
  if (palpites.length === 0) {
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  const premioTotal = calcularArrecadacaoPremium(palpites) + premioAcumuladoPremium;
  const flagC = bandeiraIMG(jogoAtual.casa);
  const flagF = bandeiraIMG(jogoAtual.fora);
  const contagem = {};
  palpites.forEach(p => {
    const k = `${p.placarCasa}x${p.placarFora}`;
    contagem[k] = (contagem[k] || 0) + 1;
  });

  const lim = LIMITE_PESSOAS_POR_PLACAR_PREMIUM;
  const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  ordenado.forEach(([k, qtd]) => {
    const [c, f] = k.split("x").map(Number);
    const premio = qtd > 0 ? (premioTotal / qtd) : 0;
    const cheio = qtd >= lim;
    const pct   = Math.round((qtd / lim) * 100);
    const barraHTML = `
      <div style="display:flex;align-items:center;gap:6px;min-width:80px;">
        <div style="flex:1;height:8px;background:#e9ecef;border-radius:4px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${cheio ? '#c0392b' : 'var(--verde)'};border-radius:4px;transition:width .3s;"></div>
        </div>
        <span style="font-size:.72rem;font-weight:700;color:${cheio ? '#c0392b' : 'var(--verde)'};white-space:nowrap;">${qtd}/${lim}${cheio ? ' 🔒' : ''}</span>
      </div>`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="placar">${flagC} ${c} x ${f} ${flagF}</td>
      <td>${barraHTML}</td>
      <td style="color:var(--verde);font-weight:700;">R$ ${premio.toFixed(2).replace(".",",")}</td>
    `;
    corpo.appendChild(tr);
  });
}

// ── Modal PIX Premium ──────────────────────────────────────

async function abrirModalPixPremium() {
  if (window._abrindoModalPixPremium) return;
  window._abrindoModalPixPremium = true;
  try {
    await _abrirModalPixPremiumInterno();
  } finally {
    window._abrindoModalPixPremium = false;
  }
}

async function _abrirModalPixPremiumInterno() {
  const aviso  = document.getElementById("avisoPalpitePremium");
  const nomeEl = document.getElementById("nomeJogadorPremium");
  const pCasaEl = document.getElementById("placarCasaPremium");
  const pForaEl = document.getElementById("placarForaPremium");

  if (!nomeEl || !pCasaEl || !pForaEl) return;

  const nome  = nomeEl.value.trim();
  const pCasa = pCasaEl.value;
  const pFora = pForaEl.value;

  if (!firebaseOk) { mostrarAviso(aviso, "O banco de dados ainda não foi configurado.", "erro"); return; }
  if (!palpitesLiberados(jogoAtual)) {
    mostrarAviso(aviso, "Os palpites Premium não estão disponíveis no momento.", "erro");
    renderAreaJogoPremium();
    return;
  }
  if (!nome) { mostrarAviso(aviso, "Por favor, digite seu nome antes de enviar.", "erro"); return; }
  if (pCasa === "" || pFora === "" || pCasa < 0 || pFora < 0) {
    mostrarAviso(aviso, "Preencha o placar dos dois times antes de enviar.", "erro");
    return;
  }

  const telefoneSessao = (window._ultimoTelefoneUsado || "").trim();
  const pixSessao       = (window._ultimoPixUsado || "").trim();
  if (!telefoneSessao && !pixSessao) {
    mostrarAviso(aviso, "Sessão expirada. Volte para esta aba e confirme seu acesso novamente.", "erro");
    renderAbaPremium();
    return;
  }
  const palpiteOriginal = await buscarElegibilidadePremiumPorIdent(pixSessao, telefoneSessao);
  if (!palpiteOriginal) {
    mostrarAviso(aviso, "Você precisa apostar no Bolão Tradicional desta rodada primeiro.", "erro");
    return;
  }

  const placarCasaNum = parseInt(pCasa), placarForaNum = parseInt(pFora);
  const todosPremium = await obterPalpitesPremiumDoJogo(jogoAtual.id);
  const qtdNessePlacar = todosPremium.filter(p =>
    Number(p.placarCasa) === placarCasaNum && Number(p.placarFora) === placarForaNum
  ).length;
  if (qtdNessePlacar >= LIMITE_PESSOAS_POR_PLACAR_PREMIUM) {
    mostrarAviso(aviso, `❌ O placar ${placarCasaNum} x ${placarForaNum} já atingiu o limite de ${LIMITE_PESSOAS_POR_PLACAR_PREMIUM} pessoas no Premium. Escolha outro placar.`, "erro");
    return;
  }

  const nomeChave = normalizarNome(nome);
  window._chaveDefinitivaPremium = nomeChave;
  try {
    const snapshot = await db.ref(`palpitesPremium/${jogoAtual.id}/${nomeChave}`).once("value");
    if (snapshot.exists()) {
      const pExistente = snapshot.val();
      await mostrarModalDuplicadoPremium(nome, pExistente);
      if (window._resolucaoDuplicadoPremium === 0) return;
      if (window._resolucaoDuplicadoPremium === 2) {
        window._chaveDefinitivaPremium = `${nomeChave}_${Date.now()}`;
      }
    }
  } catch (_) {}

  window._dadosPendentesPremium = { nome, pCasa, pFora, nomeChave };
  const resumo = document.getElementById("resumoPlacarConfirmaPremium");
  const flagC  = bandeiraIMG(jogoAtual.casa);
  const flagF  = bandeiraIMG(jogoAtual.fora);
  resumo.innerHTML = `${sanitize(nome)}<br>${flagC} ${jogoAtual.casa} ${pCasa} x ${pFora} ${jogoAtual.fora} ${flagF}`;
  abrirModal("modalConfirmaPlacarPremium");
}

function fecharModalConfirmaPlacarPremium() {
  fecharModal("modalConfirmaPlacarPremium");
}

function mostrarModalDuplicadoPremium(nome, pExistente) {
  return new Promise(resolve => {
    document.getElementById("tituloDuplicadoPremium").textContent = `Olá, ${nome}!`;
    document.getElementById("textoDuplicadoPremium").textContent =
      `Você já tem um palpite Premium registrado: ${pExistente.placarCasa} x ${pExistente.placarFora}. Deseja fazer uma nova aposta ou sair?`;
    document.getElementById("modalDuplicadoPremium").classList.add("ativo");
    window._resolverModalDuplicadoPremium = resolve;
  });
}

function resolverDuplicadoPremium(opcao) {
  document.getElementById("modalDuplicadoPremium").classList.remove("ativo");
  window._resolucaoDuplicadoPremium = opcao;
  if (window._resolverModalDuplicadoPremium) window._resolverModalDuplicadoPremium();
}

async function confirmarPlacarCorretoPremium() {
  if (window._confirmandoPlacarPremium) return;
  window._confirmandoPlacarPremium = true;
  try {
    await _confirmarPlacarCorretoPremiumInterno();
  } finally {
    window._confirmandoPlacarPremium = false;
  }
}

async function _confirmarPlacarCorretoPremiumInterno() {
  fecharModal("modalConfirmaPlacarPremium");
  const { nome, pCasa, pFora, nomeChave } = window._dadosPendentesPremium || {};
  if (!nome) return;

  if (!palpitesLiberados(jogoAtual)) {
    const aviso = document.getElementById("avisoPalpitePremium");
    mostrarAviso(aviso, "Os palpites Premium não estão disponíveis no momento.", "erro");
    renderAreaJogoPremium();
    return;
  }

  let valor;
  if (premioAcumuladoPremium > 0) {
    const qtdAnterior  = await contarApostasPremiumRodadaAnterior(nome);
    const qtdJaFeitas  = await contarApostasPremiumNestaRodada(nome);
    const numeroAposta = qtdJaFeitas + 1;
    valor = (numeroAposta <= qtdAnterior) ? VALOR_PREMIUM_BASE : VALOR_PREMIUM_NOVO;
  } else {
    valor = VALOR_PREMIUM_BASE;
  }
  window._valorApostaPremium = valor;

  document.getElementById("valorPalpiteLabelPremium").textContent = `R$ ${valor.toFixed(2).replace(".",",")}`;

  const pixConhecido = (window._ultimoPixUsado || "").trim();
  const telConhecido = (window._ultimoTelefoneUsado || "").trim();
  const pixInput  = document.getElementById("pixJogadorPremium");
  const telInput  = document.getElementById("telefoneJogadorPremium");
  const pixWrap   = document.getElementById("campoPixPremiumWrapper");
  const telWrap   = document.getElementById("campoTelefonePremiumWrapper");
  const dadosEl   = document.getElementById("dadosConfirmadosPremium");

  if (pixConhecido && telConhecido) {
    pixInput.value = pixConhecido;
    telInput.value = telConhecido;
    pixWrap.style.display = "none";
    telWrap.style.display = "none";
    dadosEl.innerHTML = `✅ Usando os mesmos dados do Bolão Tradicional:<br>PIX: <strong>${sanitize(pixConhecido)}</strong> &nbsp;|&nbsp; Tel: <strong>${formatarTelefoneExibicao(telConhecido)}</strong><br>
      <button type="button" class="btn-filtro" style="margin-top:8px;padding:5px 12px;font-size:.75rem;" onclick="editarDadosConfirmadosPremium()">✏️ Editar dados</button>`;
    dadosEl.style.display = "block";
  } else {
    pixInput.value = "";
    telInput.value = "";
    pixWrap.style.display = "block";
    telWrap.style.display = "block";
    dadosEl.style.display = "none";
  }

  abrirModal("modalPixPremium");
}

function editarDadosConfirmadosPremium() {
  document.getElementById("campoPixPremiumWrapper").style.display = "block";
  document.getElementById("campoTelefonePremiumWrapper").style.display = "block";
  document.getElementById("dadosConfirmadosPremium").style.display = "none";
}

function fecharModalPixPremium() {
  fecharModal("modalPixPremium");
}

function copiarPixPremium() {
  const chave = window._pixAtualPremium || "";
  const lembrete     = document.getElementById("lembreteConfirmarPremium");
  const btnConfirmar = document.getElementById("btnConfirmeiPixPremium");

  function avisarCopiou() {
    const btn = document.querySelector('[onclick="copiarPixPremium()"]');
    if (btn) { btn.textContent = "✅ Copiado!"; setTimeout(() => { btn.textContent = "📋 Copiar chave PIX"; }, 2000); }
    if (lembrete)     lembrete.style.display = "block";
    if (btnConfirmar) btnConfirmar.classList.add("btn-pulsar");
  }

  navigator.clipboard.writeText(chave).then(avisarCopiou).catch(() => {
    const el = document.getElementById("pixParaCopiarPremium");
    const range = document.createRange();
    range.selectNode(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand("copy");
    avisarCopiou();
  });
}

// ── Editar palpite Premium ────────────────────────────────

function abrirModalEditarPalpitePremium() {
  const nomeEl = document.getElementById("nomeEditarPalpitePremium");
  if (nomeEl) nomeEl.value = "";
  const resEl = document.getElementById("resultadoEditarPalpitePremium");
  if (resEl) resEl.innerHTML = "";
  const formEl = document.getElementById("formEditarPalpitePremium");
  if (formEl) formEl.style.display = "none";
  const avisoEl = document.getElementById("avisoEditarPalpitePremium");
  if (avisoEl) avisoEl.style.display = "none";
  abrirModal("modalEditarPalpitePremium");
}

function fecharModalEditarPalpitePremium() {
  fecharModal("modalEditarPalpitePremium");
}

async function buscarPalpiteParaEditarPremium() {
  const aviso = document.getElementById("avisoEditarPalpitePremium");
  const nome  = document.getElementById("nomeEditarPalpitePremium").value.trim();

  if (!nome) { mostrarAviso(aviso, "Digite seu nome para buscar seu palpite Premium.", "erro"); return; }
  if (!palpitesLiberados(jogoAtual)) { mostrarAviso(aviso, "Os palpites Premium não estão disponíveis no momento.", "erro"); return; }

  const nomeChave = normalizarNome(nome);
  try {
    const snap  = await db.ref(`palpitesPremium/${jogoAtual.id}`).once("value");
    const todos = snap.val() || {};
    const meusPalpites = Object.entries(todos).filter(([k]) => k === nomeChave || k.startsWith(nomeChave + "_"));

    const resultadoEl = document.getElementById("resultadoEditarPalpitePremium");
    const formEl = document.getElementById("formEditarPalpitePremium");

    if (meusPalpites.length === 0) {
      mostrarAviso(aviso, "Não encontramos nenhum palpite Premium com esse nome.", "erro");
      if (resultadoEl) resultadoEl.innerHTML = "";
      if (formEl) formEl.style.display = "none";
      return;
    }

    aviso.style.display = "none";
    const flagC = bandeiraIMG(jogoAtual.casa);
    const flagF = bandeiraIMG(jogoAtual.fora);

    if (resultadoEl) {
      resultadoEl.innerHTML = meusPalpites.map(([chave, p], i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f9f5e7;border:1px solid #c9a634;border-radius:8px;margin-bottom:6px;">
          <span style="font-size:.88rem;font-weight:700;">${flagC} ${p.placarCasa} x ${p.placarFora} ${flagF}</span>
          <span style="font-size:.72rem;color:#888;">Palpite ${i + 1}</span>
          <button class="btn" style="padding:6px 12px;font-size:.8rem;width:auto;background:#c9a634;"
            onclick="selecionarPalpiteParaEditarPremium('${chave}', ${p.placarCasa}, ${p.placarFora})">✏️ Editar</button>
        </div>
      `).join("");
    }
  } catch (e) {
    mostrarAviso(aviso, "Erro ao buscar palpites: " + e.message, "erro");
  }
}

function selecionarPalpiteParaEditarPremium(chave, casa, fora) {
  window._editandoChavePremium = chave;
  document.getElementById("novoplacarCasaPremium").value = casa;
  document.getElementById("novoplacarForaPremium").value = fora;
  document.getElementById("formEditarPalpitePremium").style.display = "block";
}

async function salvarEdicaoPalpitePremium() {
  const aviso = document.getElementById("avisoEditarPalpitePremium");
  const chave = window._editandoChavePremium;
  if (!chave) { mostrarAviso(aviso, "Erro: localize seu palpite primeiro.", "erro"); return; }

  const novaCasa = parseInt(document.getElementById("novoplacarCasaPremium").value);
  const novaFora = parseInt(document.getElementById("novoplacarForaPremium").value);

  if (isNaN(novaCasa) || isNaN(novaFora) || novaCasa < 0 || novaFora < 0) {
    mostrarAviso(aviso, "Informe um placar válido.", "erro");
    return;
  }
  if (!palpitesLiberados(jogoAtual)) {
    mostrarAviso(aviso, "Os palpites Premium não estão disponíveis no momento.", "erro");
    return;
  }

  try {
    const snapshot = await db.ref(`palpitesPremium/${jogoAtual.id}`).once("value");
    const todos    = snapshot.val() || {};
    let contagemNessePlacar = 0;
    for (const k in todos) {
      if (k === chave) continue;
      const p = todos[k];
      if (p.placarCasa === novaCasa && p.placarFora === novaFora) contagemNessePlacar++;
    }
    if (contagemNessePlacar >= LIMITE_PESSOAS_POR_PLACAR_PREMIUM) {
      mostrarAviso(aviso, `❌ O placar ${novaCasa} x ${novaFora} já atingiu o limite de ${LIMITE_PESSOAS_POR_PLACAR_PREMIUM} pessoas. Escolha outro placar.`, "erro");
      return;
    }

    await db.ref(`palpitesPremium/${jogoAtual.id}/${chave}/placarCasa`).set(novaCasa);
    await db.ref(`palpitesPremium/${jogoAtual.id}/${chave}/placarFora`).set(novaFora);
    mostrarAviso(aviso, `✅ Palpite Premium atualizado para ${novaCasa} x ${novaFora}!`, "sucesso");
    renderPalpitesPremium();
    renderDistribuicaoPremium();
    setTimeout(() => fecharModalEditarPalpitePremium(), 2000);
  } catch (e) {
    mostrarAviso(aviso, "Erro ao salvar edição: " + e.message, "erro");
  }
}

// ── Confirmar envio Premium ───────────────────────────────

async function confirmarEnvioPalpitePremium() {
  if (window._enviandoPalpitePremium) return;
  window._enviandoPalpitePremium = true;
  const btnConfirmar = document.getElementById("btnConfirmarEnvioPalpitePremium");
  if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.textContent = "Enviando..."; }
  try {
    await _confirmarEnvioPalpitePremiumInterno();
  } finally {
    window._enviandoPalpitePremium = false;
    if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.textContent = "✅ Confirmar palpite"; }
  }
}

async function _confirmarEnvioPalpitePremiumInterno() {
  const nome     = document.getElementById("nomeJogadorPremium").value.trim();
  const pCasa    = document.getElementById("placarCasaPremium").value;
  const pFora    = document.getElementById("placarForaPremium").value;
  const pix      = document.getElementById("pixJogadorPremium").value.trim();
  const telefone = document.getElementById("telefoneJogadorPremium").value.trim();
  const aviso    = document.getElementById("avisoPalpitePremium");

  if (pCasa === "" || pFora === "") { alert("Preencha o placar dos dois times antes de enviar."); return; }
  if (!pix)      { alert("Informe sua chave PIX para confirmar o palpite."); return; }
  if (!telefone) { alert("Informe seu WhatsApp/telefone para confirmar o palpite."); return; }

  const telefoneNormalizado = telefone.replace(/\D/g, "");
  if (telefoneNormalizado.length < 10) { alert("Informe um número de telefone válido (com DDD)."); return; }

  if (!palpitesLiberados(jogoAtual)) {
    fecharModalPixPremium();
    mostrarAviso(aviso, "Os palpites Premium não estão disponíveis no momento.", "erro");
    renderAreaJogoPremium();
    return;
  }

  const jogoId     = jogoAtual.id;
  const placarCasa = parseInt(pCasa);
  const placarFora = parseInt(pFora);

  if (isNaN(placarCasa) || isNaN(placarFora) || placarCasa < 0 || placarFora < 0 || placarCasa > 20 || placarFora > 20) {
    mostrarAviso(aviso, "❌ Placar inválido. Use valores entre 0 e 20.", "erro");
    return;
  }
  const nomeChave = window._chaveDefinitivaPremium || normalizarNome(nome);
  window._chaveDefinitivaPremium = null;

  try {
    const snapshot = await db.ref(`palpitesPremium/${jogoId}`).once("value");
    const todos    = snapshot.val() || {};

    let contagemNessePlacar = 0;
    for (const chave in todos) {
      if (chave === nomeChave || chave.startsWith(nomeChave + "_")) continue;
      const p = todos[chave];
      if (Number(p.placarCasa) === placarCasa && Number(p.placarFora) === placarFora) contagemNessePlacar++;
    }
    if (contagemNessePlacar >= LIMITE_PESSOAS_POR_PLACAR_PREMIUM) {
      fecharModalPixPremium();
      mostrarAviso(aviso, `❌ O placar ${placarCasa} x ${placarFora} já atingiu o limite de ${LIMITE_PESSOAS_POR_PLACAR_PREMIUM} pessoas. Escolha outro placar.`, "erro");
      renderDistribuicaoPremium();
      return;
    }

    for (const chave in todos) {
      if (!chave.startsWith(normalizarNome(nome))) continue;
      const p = todos[chave];
      if (Number(p.placarCasa) === placarCasa && Number(p.placarFora) === placarFora) {
        fecharModalPixPremium();
        mostrarAviso(aviso, `❌ Você já tem um palpite ${placarCasa} x ${placarFora} registrado. Escolha um placar diferente.`, "erro");
        return;
      }
    }

    const palpite = {
      nome:       sanitize(nome).slice(0, 60),
      placarCasa: placarCasa,
      placarFora: placarFora,
      pix:        sanitize(pix).slice(0, 80),
      telefone:   telefoneNormalizado,
      enviadoEm:  new Date().toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }),
      valor:      window._valorApostaPremium || VALOR_PREMIUM_BASE
    };

    await db.ref(`palpitesPremium/${jogoId}/${nomeChave}`).set(palpite);

    fecharModalPixPremium();
    iniciarContadorPixPremium(nome, placarCasa, placarFora, pix);
    renderPalpitesPremium();
    renderDistribuicaoPremium();
  } catch (e) {
    fecharModalPixPremium();
    mostrarAviso(aviso, "Erro ao salvar o palpite: " + (e && e.message ? e.message : String(e)), "erro");
    console.error(e);
  }
}

// ── Contador PIX Premium ──────────────────────────────────

let _intervaloContadorPremium = null;

function iniciarContadorPixPremium(nome, placarCasa, placarFora, pixJogador) {
  const modal       = document.getElementById("modalContadorPremium");
  const circulo     = document.getElementById("circuloContadorPremium");
  const statusEl    = document.getElementById("statusPixPremium");
  const btnConfirmei = document.getElementById("btnConfirmeiPixPremium");
  const btnWhats    = document.getElementById("btnAvisarWhatsPremium");
  modal.classList.add("ativo");

  const valor = window._valorApostaPremium || VALOR_PREMIUM_BASE;
  const pixKey = valor === VALOR_PREMIUM_BASE ? PIX_PREMIUM_10 : PIX_PREMIUM_20;
  window._pixAtualPremium = pixKey;
  document.getElementById("infovalorPalpiteContadorPremium").innerHTML =
    `Valor desta aposta: <strong>R$ ${valor.toFixed(2).replace(".",",")}</strong>`;
  document.getElementById("pixParaCopiarPremium").textContent = pixKey;
  document.getElementById("lembreteConfirmarPremium").style.display = "none";

  const msg = encodeURIComponent(
    `*Bolao Premium - Copa 2026*\n\n` +
    `Novo palpite registrado!\n` +
    `Nome: *${nome}*\n` +
    `Jogo: *${jogoAtual.casa} x ${jogoAtual.fora}*\n` +
    `Palpite: *${placarCasa} x ${placarFora}*\n` +
    `Chave PIX: *${pixJogador}*\n\n` +
    `_Ja fiz o PIX para ${WHATSAPP_ORGANIZADOR}. Por favor confirme meu palpite Premium!_`
  );
  btnWhats._href = `https://wa.me/${WHATSAPP_ORGANIZADOR}?text=${msg}`;

  if (_intervaloContadorPremium) clearInterval(_intervaloContadorPremium);

  let segundos = 60;
  circulo.classList.remove("urgente");
  const textoCP = document.getElementById("textoContadorPremium");
  const anelCP  = document.getElementById("anelProgContadorPremium");
  if (textoCP) textoCP.textContent = "1:00";
  if (anelCP)  { anelCP.style.strokeDashoffset = "0"; anelCP.classList.remove("urgente"); }
  statusEl.textContent = "⏳ Aguardando pagamento...";
  statusEl.style.color = "#888";
  btnConfirmei.style.display = "block";
  btnConfirmei.classList.remove("btn-pulsar");
  btnWhats.style.display = "none";
  document.getElementById("btnFecharContadorPremium").style.display = "none";

  _intervaloContadorPremium = setInterval(() => {
    segundos--;
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    if (textoCP) textoCP.textContent = `${min}:${seg.toString().padStart(2,"0")}`;
    const pct = segundos / 60;
    if (anelCP) anelCP.style.strokeDashoffset = String(314 * (1 - pct));
    if (segundos <= 20) { circulo.classList.add("urgente"); if (anelCP) anelCP.classList.add("urgente"); }
    if (segundos <= 0) {
      clearInterval(_intervaloContadorPremium);
      _intervaloContadorPremium = null;
      if (textoCP) textoCP.textContent = "⏰";
      statusEl.textContent = "Tempo esgotado. Seu palpite foi salvo — confirme o pagamento com o organizador.";
      statusEl.style.color = "#c0392b";
    }
  }, 1000);

  abrirModal("modalContadorPremium");
  dispararConvitesPosPalpite();
}

function confirmarPagamentoPixPremium() {
  if (_intervaloContadorPremium) { clearInterval(_intervaloContadorPremium); _intervaloContadorPremium = null; }
  const circulo      = document.getElementById("circuloContadorPremium");
  const statusEl     = document.getElementById("statusPixPremium");
  const btnConfirmei = document.getElementById("btnConfirmeiPixPremium");
  const btnWhats     = document.getElementById("btnAvisarWhatsPremium");
  const btnFechar    = document.getElementById("btnFecharContadorPremium");

  const textoCP = document.getElementById("textoContadorPremium");
  const anelCP  = document.getElementById("anelProgContadorPremium");
  if (textoCP) textoCP.textContent = "✅";
  if (anelCP)  { anelCP.classList.remove("urgente"); anelCP.style.stroke = "var(--verde-claro)"; }
  circulo.classList.remove("urgente");
  statusEl.textContent = "✅ Pagamento confirmado! Avise o organizador ou feche esta tela:";
  statusEl.style.color = "var(--verde)";
  btnConfirmei.style.display = "none";
  btnWhats.style.display = "block";
  btnFechar.style.display = "block";
}

function abrirWhatsAppPalpitePremium() {
  const btnWhats = document.getElementById("btnAvisarWhatsPremium");
  if (btnWhats && btnWhats._href) {
    abrirLinkWhatsApp(btnWhats._href);
  }
}

function fecharModalContadorPremium() {
  document.body.classList.remove("modal-aberto");
  const modal   = document.getElementById("modalContadorPremium");
  modal.classList.remove("ativo");
  document.getElementById("btnFecharContadorPremium").style.display = "none";

  const placarCasaEl = document.getElementById("placarCasaPremium");
  const placarForaEl = document.getElementById("placarForaPremium");
  if (placarCasaEl) placarCasaEl.value = "";
  if (placarForaEl) placarForaEl.value = "";
  renderAreaJogoPremium();
}

// ── Envio WhatsApp (admin) ────────────────────────────────

async function enviarPalpitesWhatsAppPremium() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }

  const palpites = await obterPalpitesPremiumDoJogo(jogoAtual.id);

  let msg = `*BOLAO PREMIUM - COPA 2026*\n\n`;
  msg += `*${jogoAtual.fase.toUpperCase()}*\n`;
  msg += `*${jogoAtual.casa} x ${jogoAtual.fora}*\n`;
  msg += `Data: ${jogoAtual.dataLabel}\n`;
  msg += `------------------------------\n\n`;
  msg += `*PALPITES PREMIUM:*\n\n`;

  if (palpites.length === 0) {
    msg += `_Nenhum palpite Premium registrado ainda._\n`;
  } else {
    palpites.forEach((p, i) => { msg += `${i+1}. *${sanitize(p.nome)}*: ${p.placarCasa} x ${p.placarFora}\n`; });
  }

  const premioTotal = calcularArrecadacaoPremium(palpites) + premioAcumuladoPremium;
  msg += `\n------------------------------\n`;
  msg += `Participantes: *${palpites.length}*\n`;
  msg += `Premio acumulado: *R$ ${premioTotal.toFixed(2).replace(".",",")}*\n\n`;
  msg += `_Restrição: máximo 2 apostas no mesmo placar!_ ⭐`;

  abrirLinkWhatsApp(`https://wa.me/${WHATSAPP_ORGANIZADOR}?text=${encodeURIComponent(msg)}`);
}

async function enviarPalpitesWhatsAppConsolidado() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }

  const [palpitesT, palpitesP] = await Promise.all([
    obterPalpitesDoJogo(jogoAtual.id),
    obterPalpitesPremiumDoJogo(jogoAtual.id)
  ]);

  const premioT = calcularArrecadacao(palpitesT) + premioAcumulado;
  const premioP = calcularArrecadacaoPremium(palpitesP) + premioAcumuladoPremium;

  let msg = `*BOLAO COPA 2026 - MISSAO HEXA*\n\n`;
  msg += `*${jogoAtual.fase.toUpperCase()}*\n`;
  msg += `*${jogoAtual.casa} x ${jogoAtual.fora}*\n`;
  msg += `Data: ${jogoAtual.dataLabel}\n`;
  msg += `==============================\n\n`;

  msg += `*BOLAO TRADICIONAL (R$ 5,00)*\n`;
  msg += `------------------------------\n`;
  if (palpitesT.length === 0) {
    msg += `_Nenhum palpite ainda._\n`;
  } else {
    palpitesT.forEach((p, i) => { msg += `${i+1}. *${sanitize(p.nome)}*: ${p.placarCasa} x ${p.placarFora}\n`; });
  }
  msg += `\nParticipantes: *${palpitesT.length}* | Premio: *R$ ${premioT.toFixed(2).replace(".",",")}*\n`;

  msg += `\n==============================\n\n`;

  msg += `*BOLAO PREMIUM (R$ 10,00)*\n`;
  msg += `------------------------------\n`;
  if (palpitesP.length === 0) {
    msg += `_Nenhum palpite ainda._\n`;
  } else {
    palpitesP.forEach((p, i) => { msg += `${i+1}. *${sanitize(p.nome)}*: ${p.placarCasa} x ${p.placarFora}\n`; });
  }
  msg += `\nParticipantes: *${palpitesP.length}* | Premio: *R$ ${premioP.toFixed(2).replace(".",",")}*\n`;

  msg += `\n==============================\n`;
  msg += `_Faca seu palpite tambem!_`;

  abrirLinkWhatsApp(`https://wa.me/${WHATSAPP_ORGANIZADOR}?text=${encodeURIComponent(msg)}`);
}

// ── Admin: chaves PIX, confirmações e exclusão ────────────

async function listarChavesPixPremium() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  const aviso = document.getElementById("avisoAdminPremium");
  const div   = document.getElementById("listaPixPremium");
  const corpo = document.getElementById("corpoListaPixPremium");

  if (div.style.display === "block") { div.style.display = "none"; return; }
  if (!firebaseOk) { mostrarAviso(aviso, "Banco de dados não configurado.", "erro"); return; }

  try {
    const jogoId   = jogoAtual.id;
    const palpites = await obterPalpitesPremiumDoJogo(jogoId);
    corpo.innerHTML = "";

    if (palpites.length === 0) {
      corpo.innerHTML = `<tr><td colspan="5" class="vazio">Nenhum palpite Premium enviado ainda para este jogo.</td></tr>`;
    } else {
      palpites.forEach(p => {
        const tr = document.createElement("tr");
        const telLink = p.telefone
          ? `<a href="https://wa.me/55${p.telefone}" target="_blank">${formatarTelefoneExibicao(p.telefone)}</a>`
          : "—";
        tr.innerHTML = `
          <td>${sanitize(p.nome)}</td>
          <td class="placar">${p.placarCasa} x ${p.placarFora}</td>
          <td>${p.pix ? sanitize(p.pix) : "—"}</td>
          <td>${telLink}</td>
          <td>${p.pago ? '<span class="tag-confirmado">✅ Pago</span>' : '<span class="tag-pendente">⏳ Pendente</span>'}</td>
        `;
        corpo.appendChild(tr);
      });
    }
    div.style.display = "block";
  } catch (e) {
    mostrarAviso(aviso, "Erro ao buscar chaves PIX: " + (e && e.message ? e.message : String(e)), "erro");
    console.error(e);
  }
}

async function corrigirPlacarIncorretoPremium() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  const aviso = document.getElementById("avisoCorrigirPlacarPremium");

  const jogosComPlacar = jogos.filter(j => j.placarCasa !== null);
  if (jogosComPlacar.length === 0) { mostrarAviso(aviso, "Nenhum jogo com placar salvo no momento.", "info"); return; }

  const lista = jogosComPlacar.map((j, i) => `${i+1}. ${j.casa} ${j.placarCasa} x ${j.placarFora} ${j.fora} (${j.fase})`).join("\n");
  const escolha = prompt(`Qual jogo deseja recalcular o Premium?\n\n${lista}\n\nDigite o número:`);
  if (!escolha) return;
  const idx = parseInt(escolha) - 1;
  const jogoAlvo = jogosComPlacar[idx];
  if (!jogoAlvo) { alert("Opção inválida."); return; }
  if (!confirm(`Confirma recalcular o prêmio acumulado Premium considerando ${jogoAlvo.casa} x ${jogoAlvo.fora}?`)) return;

  try {
    await calcularPremioAcumuladoPremium();
    mostrarAviso(aviso, `✅ Prêmio acumulado Premium recalculado!`, "sucesso");
    renderAreaJogoPremium();
    renderDistribuicaoPremium();
    renderPalpitesPremium();
  } catch (e) {
    mostrarAviso(aviso, "Erro: " + e.message, "erro");
  }
}

async function abrirConfirmacoesPixPremium() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  const area     = document.getElementById("areaConfirmacoesPremium");
  const jogoId   = jogoAtual.id;
  const palpites = await obterPalpitesPremiumDoJogo(jogoId);
  const corpo    = document.getElementById("corpoConfirmacoesPremium");
  corpo.innerHTML = "";

  const contagemPorNome = {};

  if (palpites.length === 0) {
    corpo.innerHTML = `<tr><td colspan="6" class="vazio">Nenhum palpite Premium registrado.</td></tr>`;
  } else {
    const ordenados = [...palpites].sort((a, b) => {
      const cmp = a.nome.localeCompare(b.nome, "pt-BR");
      return cmp !== 0 ? cmp : (a.enviadoEm || "").localeCompare(b.enviadoEm || "");
    });

    for (const p of ordenados) {
      const chave = p._chave;
      const pago  = p.pago === true;
      const nomeBase = normalizarNome(p.nome);
      contagemPorNome[nomeBase] = (contagemPorNome[nomeBase] || 0) + 1;
      const numeroAposta = contagemPorNome[nomeBase];

      const valorEsperado = typeof p.valor === "number" ? p.valor : VALOR_PREMIUM_BASE;

      const telLink = p.telefone
        ? `<a href="https://wa.me/55${p.telefone}" target="_blank" style="font-size:.72rem;">${formatarTelefoneExibicao(p.telefone)}</a>`
        : "—";

      const tr = document.createElement("tr");
      tr.id = `confp_${chave}`;
      tr.dataset.valor = valorEsperado;
      tr.dataset.pago  = pago;

      const acaoHtml = !pago
        ? `<button class="btn" style="padding:4px 10px;font-size:.75rem;" onclick="confirmarPagamentoAdminPremium('${jogoId}','${chave}')">Confirmar</button>`
        : `<button class="btn" style="padding:4px 10px;font-size:.75rem;background:#aaa;" onclick="desfazerPagamentoAdminPremium('${jogoId}','${chave}')">Desfazer</button>`;

      const btnEnviarWhats = p.telefone
        ? `<button class="btn" style="padding:4px 10px;font-size:.75rem;background:#25D366;margin-top:4px;" onclick="enviarConfirmacaoIndividualWhatsAppPremium('${jogoId}','${chave}')">📲 Enviar</button>`
        : "";

      tr.innerHTML = `
        <td style="text-align:left;">
          ${sanitize(p.nome)}${numeroAposta > 1 ? ` <span style="font-size:.7rem;color:#888;">(${numeroAposta}ª aposta)</span>` : ''}<br>
          <span style="font-size:.7rem;color:#888;">${p.pix ? sanitize(p.pix) : "—"}</span><br>
          ${telLink}
        </td>
        <td class="placar">${p.placarCasa} x ${p.placarFora}</td>
        <td style="font-weight:700;color:var(--verde);">R$ ${valorEsperado.toFixed(2).replace(".",",")}</td>
        <td style="font-size:.72rem;white-space:nowrap;">${formatarDataTabela(p.enviadoEm)}</td>
        <td>${pago ? '<span class="tag-confirmado">✅ Pago</span>' : '<span class="tag-pendente">⏳ Pendente</span>'}</td>
        <td>${acaoHtml}${btnEnviarWhats}</td>`;
      corpo.appendChild(tr);
    }
  }
  area.style.display = "block";
}

async function enviarConfirmacaoIndividualWhatsAppPremium(jogoId, chave) {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  try {
    const snapshot = await db.ref(`palpitesPremium/${jogoId}/${chave}`).once("value");
    const p = snapshot.val();
    if (!p) { alert("Palpite não encontrado."); return; }
    if (!p.telefone) { alert("Este jogador não tem telefone cadastrado."); return; }

    const jogo = jogos.find(j => j.id === jogoId) || jogoAtual;
    const valor = typeof p.valor === "number" ? p.valor : VALOR_PREMIUM_BASE;
    const statusPagamento = p.pago === true ? "✅ Pagamento CONFIRMADO" : "⏳ Pagamento PENDENTE";

    let msg = `*BOLAO PREMIUM - COPA 2026*\n\n`;
    msg += `Ola, ${sanitize(p.nome)}!\n\n`;
    msg += `*Seu palpite Premium:* ${jogo.casa} ${p.placarCasa} x ${p.placarFora} ${jogo.fora}\n`;
    msg += `*Valor da aposta:* R$ ${valor.toFixed(2).replace(".",",")}\n`;
    msg += `*Status:* ${statusPagamento}\n\n`;
    msg += p.pago === true ? `_Tudo certo, boa sorte!_ 🍀⭐` : `_Por favor, confirme o pagamento PIX para validar seu palpite Premium._`;

    abrirLinkWhatsApp(`https://wa.me/55${p.telefone}?text=${encodeURIComponent(msg)}`);
  } catch (e) {
    alert("Erro ao enviar: " + e.message);
  }
}

async function confirmarPagamentoAdminPremium(jogoId, chave) {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  try {
    await db.ref(`palpitesPremium/${jogoId}/${chave}/pago`).set(true);
    document.getElementById("areaConfirmacoesPremium").style.display = "none";
    abrirConfirmacoesPixPremium();
    renderPalpitesPremium();
    mostrarAviso(document.getElementById("avisoAdminPremium"), "✅ Pagamento confirmado!", "sucesso");
  } catch (e) { alert("Erro ao confirmar."); }
}

async function desfazerPagamentoAdminPremium(jogoId, chave) {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  try {
    await db.ref(`palpitesPremium/${jogoId}/${chave}/pago`).set(false);
    document.getElementById("areaConfirmacoesPremium").style.display = "none";
    abrirConfirmacoesPixPremium();
    mostrarAviso(document.getElementById("avisoAdminPremium"), "↩️ Confirmação desfeita.", "info");
  } catch (e) { alert("Erro ao desfazer."); }
}

async function abrirExclusaoPalpitesPremium() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  const area     = document.getElementById("areaExclusaoPremium");
  const jogoId   = jogoAtual.id;
  const palpites = await obterPalpitesPremiumDoJogo(jogoId);
  const corpo    = document.getElementById("corpoExclusaoPremium");
  corpo.innerHTML = "";
  if (palpites.length === 0) {
    corpo.innerHTML = `<tr><td colspan="3" class="vazio">Nenhum palpite Premium.</td></tr>`;
  } else {
    for (const p of palpites) {
      const chave = p._chave;
      const tr = document.createElement("tr");
      tr.id = `excp_${chave}`;
      tr.innerHTML = `
        <td>${sanitize(p.nome)}</td>
        <td class="placar">${p.placarCasa} x ${p.placarFora}</td>
        <td><button class="btn" style="padding:4px 10px;font-size:.75rem;background:#c0392b;" onclick="excluirUmPalpitePremium('${jogoId}','${chave}')">🗑️</button></td>`;
      corpo.appendChild(tr);
    }
  }
  area.style.display = "block";
}

async function excluirUmPalpitePremium(jogoId, chave) {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  if (!confirm("Excluir este palpite Premium?")) return;
  try {
    await db.ref(`palpitesPremium/${jogoId}/${chave}`).remove();
    const tr = document.getElementById(`excp_${chave}`);
    if (tr) tr.remove();
    renderPalpitesPremium();
    renderDistribuicaoPremium();
    mostrarAviso(document.getElementById("avisoAdminPremium"), "✅ Palpite Premium excluído.", "sucesso");
  } catch (e) { alert("Erro ao excluir."); }
}

async function excluirTodosPalpitesPremium() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  if (!confirm(`Excluir TODOS os palpites Premium de ${jogoAtual.casa} x ${jogoAtual.fora}? Irreversível!`)) return;
  try {
    await db.ref(`palpitesPremium/${jogoAtual.id}`).remove();
    document.getElementById("areaExclusaoPremium").style.display = "none";
    renderPalpitesPremium();
    renderDistribuicaoPremium();
    mostrarAviso(document.getElementById("avisoAdminPremium"), "✅ Todos os palpites Premium foram excluídos.", "sucesso");
  } catch (e) { alert("Erro ao excluir."); }
}

// ── Expõe globalmente ──────────────────────────────────────

window.verificarIdentPremium                     = verificarIdentPremium;
window.verificarAcessoPremium                    = verificarAcessoPremium;
window.abrirModalPixPremium                      = abrirModalPixPremium;
window.fecharModalConfirmaPlacarPremium          = fecharModalConfirmaPlacarPremium;
window.confirmarPlacarCorretoPremium             = confirmarPlacarCorretoPremium;
window.resolverDuplicadoPremium                  = resolverDuplicadoPremium;
window.fecharModalPixPremium                     = fecharModalPixPremium;
window.editarDadosConfirmadosPremium             = editarDadosConfirmadosPremium;
window.copiarPixPremium                          = copiarPixPremium;
window.abrirModalEditarPalpitePremium            = abrirModalEditarPalpitePremium;
window.fecharModalEditarPalpitePremium           = fecharModalEditarPalpitePremium;
window.buscarPalpiteParaEditarPremium            = buscarPalpiteParaEditarPremium;
window.selecionarPalpiteParaEditarPremium        = selecionarPalpiteParaEditarPremium;
window.salvarEdicaoPalpitePremium                = salvarEdicaoPalpitePremium;
window.confirmarEnvioPalpitePremium              = confirmarEnvioPalpitePremium;
window.filtrarPalpitesPremiumComDebounce         = filtrarPalpitesPremiumComDebounce;
window.renderPalpitesPremium                     = renderPalpitesPremium;
window.renderDistribuicaoPremium                 = renderDistribuicaoPremium;
window.confirmarPagamentoPixPremium              = confirmarPagamentoPixPremium;
window.abrirWhatsAppPalpitePremium               = abrirWhatsAppPalpitePremium;
window.fecharModalContadorPremium                = fecharModalContadorPremium;
window.enviarPalpitesWhatsAppPremium             = enviarPalpitesWhatsAppPremium;
window.enviarPalpitesWhatsAppConsolidado         = enviarPalpitesWhatsAppConsolidado;
window.listarChavesPixPremium                    = listarChavesPixPremium;
window.corrigirPlacarIncorretoPremium            = corrigirPlacarIncorretoPremium;
window.abrirConfirmacoesPixPremium               = abrirConfirmacoesPixPremium;
window.enviarConfirmacaoIndividualWhatsAppPremium = enviarConfirmacaoIndividualWhatsAppPremium;
window.confirmarPagamentoAdminPremium            = confirmarPagamentoAdminPremium;
window.desfazerPagamentoAdminPremium             = desfazerPagamentoAdminPremium;
window.abrirExclusaoPalpitesPremium              = abrirExclusaoPalpitesPremium;
window.excluirUmPalpitePremium                   = excluirUmPalpitePremium;
window.excluirTodosPalpitesPremium               = excluirTodosPalpitesPremium;
window.renderAbaPremium                          = renderAbaPremium;
window.renderAreaJogoPremium                     = renderAreaJogoPremium;
window.renderResultadoFinalPremium               = renderResultadoFinalPremium;
window.atualizarTeaserPremium                    = atualizarTeaserPremium;
