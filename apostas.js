/* =========================================================
   APOSTAS.JS — Fluxo completo do Bolão Tradicional
   Modal PIX, confirmação de placar, edição de palpite,
   envio de aposta, render da tabela e distribuição.
   ========================================================= */

// ── Modal PIX (abertura) ──────────────────────────────────

async function abrirModalPix() {
  if (window._abrindoModalPix) return;
  window._abrindoModalPix = true;
  try {
    await _abrirModalPixInterno();
  } finally {
    window._abrindoModalPix = false;
  }
}

async function _abrirModalPixInterno() {
  const aviso  = document.getElementById("avisoPalpite");
  const nomeEl = document.getElementById("nomeJogador");
  const pCasaEl = document.getElementById("placarCasa");
  const pForaEl = document.getElementById("placarFora");

  if (!nomeEl || !pCasaEl || !pForaEl) {
    mostrarAviso(aviso, "Erro: campos do formulário não encontrados. Recarregue a página e tente novamente.", "erro");
    return;
  }

  const nome  = nomeEl.value.trim();
  const pCasa = pCasaEl.value;
  const pFora = pForaEl.value;

  if (!firebaseOk) {
    mostrarAviso(aviso, "O banco de dados ainda não foi configurado. Avise o organizador.", "erro");
    return;
  }
  if (!palpitesLiberados(jogoAtual)) {
    mostrarAviso(aviso, "Os palpites para este jogo não estão disponíveis no momento (encerrados ou aguardando liberação).", "erro");
    renderAreaJogoAtual();
    return;
  }
  if (!nome) {
    mostrarAviso(aviso, "Por favor, digite seu nome antes de enviar.", "erro");
    return;
  }
  if (pCasa === "" || pFora === "" || pCasa < 0 || pFora < 0) {
    mostrarAviso(aviso, "Preencha o placar dos dois times antes de enviar.", "erro");
    return;
  }

  const nomeChave = normalizarNome(nome);
  const jogoId    = jogoAtual.id;
  window._chaveDefinitiva = nomeChave;

  try {
    const snapshot = await db.ref(`palpites/${jogoId}/${nomeChave}`).once("value");
    if (snapshot.exists()) {
      const pExistente = snapshot.val();
      window._ultimoNomeUsado     = nome;
      window._ultimoTelefoneUsado = pExistente.telefone || "";
      window._ultimoPixUsado      = pExistente.pix || "";
      await mostrarModalDuplicado(nome, pExistente);
      if (window._resolucaoDuplicado === 0) return;
      if (window._resolucaoDuplicado === 2) {
        window._chaveDefinitiva = `${nomeChave}_${Date.now()}`;
      }
    } else {
      const dadosReaproveitados = await buscarApostaPorNomeNoBolaoAberto(nomeChave);
      if (dadosReaproveitados) {
        window._ultimoNomeUsado     = nome;
        window._ultimoTelefoneUsado = dadosReaproveitados.telefone || "";
        window._ultimoPixUsado      = dadosReaproveitados.pix || "";
      }
    }
  } catch (_) {}

  window._dadosPendentes = { nome, pCasa, pFora, nomeChave };
  const resumo = document.getElementById("resumoPlacarConfirma");
  const flagC  = bandeiraIMG(jogoAtual.casa);
  const flagF  = bandeiraIMG(jogoAtual.fora);
  resumo.innerHTML = `${sanitize(nome)}<br>${flagC} ${jogoAtual.casa} ${pCasa} x ${pFora} ${jogoAtual.fora} ${flagF}`;
  abrirModal("modalConfirmaPlacar");
}

function fecharModalConfirmaPlacar() {
  fecharModal("modalConfirmaPlacar");
}

// ── Confirmação do placar ─────────────────────────────────

async function confirmarPlacarCorreto() {
  if (window._confirmandoPlacar) return;
  window._confirmandoPlacar = true;
  try {
    await _confirmarPlacarCorretoInterno();
  } finally {
    window._confirmandoPlacar = false;
  }
}

async function _confirmarPlacarCorretoInterno() {
  fecharModal("modalConfirmaPlacar");
  const { nome, pCasa, pFora, nomeChave } = window._dadosPendentes || {};
  if (!nome) return;

  if (!palpitesLiberados(jogoAtual)) {
    const aviso = document.getElementById("avisoPalpite");
    mostrarAviso(aviso, "Os palpites para este jogo não estão disponíveis no momento (encerrados ou aguardando liberação).", "erro");
    renderAreaJogoAtual();
    return;
  }

  let valor;
  if (premioAcumulado > 0) {
    const qtdAnterior = await contarApostasRodadaAnterior(nome);
    const qtdJaFeitas  = await contarApostasNestaRodada(nome);
    const numeroAposta = qtdJaFeitas + 1;
    valor = (numeroAposta <= qtdAnterior) ? VALOR_BASE : VALOR_NOVO;
  } else {
    valor = VALOR_BASE;
  }
  window._valorAposta = valor;

  document.getElementById("valorPalpiteLabel").textContent = `R$ ${valor.toFixed(2).replace(".",",")}`;

  const mesmoNome    = normalizarNome(nome) === normalizarNome(window._ultimoNomeUsado || "");
  const pixConhecido = mesmoNome ? (window._ultimoPixUsado || "").trim() : "";
  const telConhecido = mesmoNome ? (window._ultimoTelefoneUsado || "").trim() : "";
  const pixInput  = document.getElementById("pixJogador");
  const telInput  = document.getElementById("telefoneJogador");
  const pixWrap   = document.getElementById("campoPixAbertoWrapper");
  const telWrap   = document.getElementById("campoTelefoneAbertoWrapper");
  const dadosEl   = document.getElementById("dadosConfirmadosAberto");

  if (pixConhecido && telConhecido) {
    pixInput.value = pixConhecido;
    telInput.value = telConhecido;
    pixWrap.style.display = "none";
    telWrap.style.display = "none";
    dadosEl.innerHTML = `✅ Usando os mesmos dados da sua aposta anterior:<br>PIX: <strong>${sanitize(pixConhecido)}</strong> &nbsp;|&nbsp; Tel: <strong>${formatarTelefoneExibicao(telConhecido)}</strong><br>
      <button type="button" class="btn-filtro" style="margin-top:8px;padding:5px 12px;font-size:.75rem;" onclick="editarDadosConfirmadosAberto()">✏️ Editar dados</button>`;
    dadosEl.style.display = "block";
  } else {
    pixInput.value = "";
    telInput.value = "";
    pixWrap.style.display = "block";
    telWrap.style.display = "block";
    dadosEl.style.display = "none";
  }

  abrirModal("modalPix");
}

function editarDadosConfirmadosAberto() {
  document.getElementById("campoPixAbertoWrapper").style.display = "block";
  document.getElementById("campoTelefoneAbertoWrapper").style.display = "block";
  document.getElementById("dadosConfirmadosAberto").style.display = "none";
}

// ── Copiar PIX ─────────────────────────────────────────────

function copiarPix() {
  const chave = window._pixAtual || "";
  const lembrete     = document.getElementById("lembreteConfirmar");
  const btnConfirmar = document.getElementById("btnConfirmeiPix");

  function avisarCopiou() {
    const btn = document.querySelector('[onclick="copiarPix()"]');
    if (btn) { btn.textContent = "✅ Copiado!"; setTimeout(() => { btn.textContent = "📋 Copiar chave PIX"; }, 2000); }
    if (lembrete)     lembrete.style.display = "block";
    if (btnConfirmar) btnConfirmar.classList.add("btn-pulsar");
  }

  navigator.clipboard.writeText(chave).then(avisarCopiou).catch(() => {
    const el = document.getElementById("pixParaCopiar");
    const range = document.createRange();
    range.selectNode(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand("copy");
    avisarCopiou();
  });
}

// ── Modal duplicado (já tem palpite) ──────────────────────

function mostrarModalDuplicado(nome, pExistente) {
  return new Promise(resolve => {
    document.getElementById("tituloDuplicado").textContent = `Olá, ${nome}!`;
    document.getElementById("textoDuplicado").textContent =
      `Você já tem um palpite registrado: ${pExistente.placarCasa} x ${pExistente.placarFora}. Deseja fazer uma nova aposta (palpite extra) ou sair?`;
    document.getElementById("modalDuplicado").classList.add("ativo");
    window._resolverModalDuplicado = resolve;
  });
}

function resolverDuplicado(opcao) {
  document.getElementById("modalDuplicado").classList.remove("ativo");
  window._resolucaoDuplicado = opcao;
  if (window._resolverModalDuplicado) window._resolverModalDuplicado();
}

function fecharModalPix() {
  fecharModal("modalPix");
}

// ── Editar palpite existente ──────────────────────────────

function abrirModalEditarPalpite() {
  const nomeEl = document.getElementById("nomeEditarPalpite");
  if (nomeEl) nomeEl.value = "";
  const resEl = document.getElementById("resultadoEditarPalpite");
  if (resEl) resEl.innerHTML = "";
  const formEl = document.getElementById("formEditarPalpite");
  if (formEl) formEl.style.display = "none";
  const avisoEl = document.getElementById("avisoEditarPalpite");
  if (avisoEl) avisoEl.style.display = "none";
  abrirModal("modalEditarPalpite");
}

function fecharModalEditarPalpite() {
  fecharModal("modalEditarPalpite");
}

async function buscarPalpiteParaEditar() {
  const aviso = document.getElementById("avisoEditarPalpite");
  const nome  = document.getElementById("nomeEditarPalpite").value.trim();

  if (!nome) {
    mostrarAviso(aviso, "Digite seu nome para buscar seu palpite.", "erro");
    return;
  }
  if (!palpitesLiberados(jogoAtual)) {
    mostrarAviso(aviso, "Os palpites para este jogo não estão disponíveis no momento.", "erro");
    return;
  }

  const nomeChave = normalizarNome(nome);
  try {
    const snap  = await db.ref(`palpites/${jogoAtual.id}`).once("value");
    const todos = snap.val() || {};

    const meusPalpites = Object.entries(todos).filter(([k]) =>
      k === nomeChave || k.startsWith(nomeChave + "_")
    );

    const resultadoEl = document.getElementById("resultadoEditarPalpite");
    const formEl       = document.getElementById("formEditarPalpite");

    if (meusPalpites.length === 0) {
      mostrarAviso(aviso, "Não encontramos nenhum palpite com esse nome.", "erro");
      if (resultadoEl) resultadoEl.innerHTML = "";
      if (formEl) formEl.style.display = "none";
      return;
    }

    aviso.style.display = "none";
    const flagC = bandeiraIMG(jogoAtual.casa);
    const flagF = bandeiraIMG(jogoAtual.fora);

    if (resultadoEl) {
      resultadoEl.innerHTML = meusPalpites.map(([chave, p], i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f4f6f5;border:1px solid var(--borda);border-radius:8px;margin-bottom:6px;">
          <span style="font-size:.88rem;font-weight:700;">${flagC} ${p.placarCasa} x ${p.placarFora} ${flagF}</span>
          <span style="font-size:.72rem;color:#888;">Palpite ${i + 1}</span>
          <button class="btn" style="padding:6px 12px;font-size:.8rem;width:auto;background:var(--verde);"
            onclick="selecionarPalpiteParaEditar('${chave}', ${p.placarCasa}, ${p.placarFora})">✏️ Editar</button>
        </div>
      `).join("");
    }
  } catch (e) {
    mostrarAviso(aviso, "Erro ao buscar palpites: " + e.message, "erro");
  }
}

function selecionarPalpiteParaEditar(chave, casa, fora) {
  window._editandoChave = chave;
  document.getElementById("novoplacarCasa").value = casa;
  document.getElementById("novoplacarFora").value = fora;
  document.getElementById("formEditarPalpite").style.display = "block";
}

async function salvarEdicaoPalpite() {
  const aviso = document.getElementById("avisoEditarPalpite");
  const chave = window._editandoChave;
  if (!chave) { mostrarAviso(aviso, "Erro: localize seu palpite primeiro.", "erro"); return; }

  const novaCasa = parseInt(document.getElementById("novoplacarCasa").value);
  const novaFora = parseInt(document.getElementById("novoplacarFora").value);

  if (isNaN(novaCasa) || isNaN(novaFora) || novaCasa < 0 || novaFora < 0) {
    mostrarAviso(aviso, "Informe um placar válido.", "erro");
    return;
  }
  if (!palpitesLiberados(jogoAtual)) {
    mostrarAviso(aviso, "Os palpites para este jogo não estão disponíveis no momento (encerrados ou aguardando liberação).", "erro");
    return;
  }

  try {
    await db.ref(`palpites/${jogoAtual.id}/${chave}/placarCasa`).set(novaCasa);
    await db.ref(`palpites/${jogoAtual.id}/${chave}/placarFora`).set(novaFora);
    mostrarAviso(aviso, `✅ Palpite atualizado para ${novaCasa} x ${novaFora}!`, "sucesso");
    renderPalpites();
    renderDistribuicao();
    setTimeout(() => fecharModalEditarPalpite(), 2000);
  } catch (e) {
    mostrarAviso(aviso, "Erro ao salvar edição: " + e.message, "erro");
  }
}

// ── Confirmar envio (após etapa de PIX/telefone) ──────────

async function confirmarEnvioPalpite() {
  if (window._enviandoPalpite) return;
  window._enviandoPalpite = true;
  const btnConfirmar = document.getElementById("btnConfirmarEnvioPalpite");
  if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.textContent = "Enviando..."; }

  try {
    await _confirmarEnvioPalpiteInterno();
  } finally {
    window._enviandoPalpite = false;
    if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.textContent = "✅ Confirmar palpite"; }
  }
}

async function _confirmarEnvioPalpiteInterno() {
  const nome     = document.getElementById("nomeJogador").value.trim();
  const pCasa    = document.getElementById("placarCasa").value;
  const pFora    = document.getElementById("placarFora").value;
  const pix      = document.getElementById("pixJogador").value.trim();
  const telefone = document.getElementById("telefoneJogador").value.trim();
  const aviso    = document.getElementById("avisoPalpite");

  if (pCasa === "" || pFora === "") { alert("Preencha o placar dos dois times antes de enviar."); return; }
  if (!pix)      { alert("Informe sua chave PIX para confirmar o palpite."); return; }
  if (!telefone) { alert("Informe seu WhatsApp/telefone para confirmar o palpite."); return; }

  const telefoneNormalizado = telefone.replace(/\D/g, "");
  if (telefoneNormalizado.length < 10) { alert("Informe um número de telefone válido (com DDD)."); return; }

  if (!palpitesLiberados(jogoAtual)) {
    fecharModalPix();
    mostrarAviso(aviso, "Os palpites para este jogo não estão disponíveis no momento (encerrados ou aguardando liberação).", "erro");
    renderAreaJogoAtual();
    return;
  }

  const jogoId      = jogoAtual.id;
  const placarCasa  = parseInt(pCasa);
  const placarFora  = parseInt(pFora);

  if (isNaN(placarCasa) || isNaN(placarFora) || placarCasa < 0 || placarFora < 0 || placarCasa > 20 || placarFora > 20) {
    mostrarAviso(aviso, "❌ Placar inválido. Use valores entre 0 e 20.", "erro");
    return;
  }

  const nomeChave = window._chaveDefinitiva || normalizarNome(nome);
  window._chaveDefinitiva = null;

  try {
    const snapshot = await db.ref(`palpites/${jogoId}`).once("value");
    const todos    = snapshot.val() || {};

    const nomeNormalizadoAtual = normalizarNome(nome);
    const jaTinhaApostaAntes = Object.keys(todos).some(chave =>
      chave === nomeNormalizadoAtual || chave.startsWith(nomeNormalizadoAtual + "_")
    );
    window._ehPrimeiraApostaDaPessoa = !jaTinhaApostaAntes;

    for (const chave in todos) {
      if (!chave.startsWith(normalizarNome(nome))) continue;
      const p = todos[chave];
      if (Number(p.placarCasa) === placarCasa && Number(p.placarFora) === placarFora) {
        fecharModalPix();
        mostrarAviso(aviso, `❌ Você já tem um palpite ${placarCasa} x ${placarFora} registrado. Escolha um placar diferente.`, "erro");
        return;
      }
    }

    let contagem = 0;
    for (const chave in todos) {
      if (chave === nomeChave || chave.startsWith(nomeChave + "_")) continue;
      const p = todos[chave];
      if (Number(p.placarCasa) === placarCasa && Number(p.placarFora) === placarFora) contagem++;
    }
    if (contagem >= LIMITE_PALPITES_IGUAIS) {
      fecharModalPix();
      mostrarAviso(aviso, `❌ O palpite ${placarCasa} x ${placarFora} já atingiu o limite de ${LIMITE_PALPITES_IGUAIS} apostas iguais. Escolha outro placar.`, "erro");
      return;
    }

    const palpite = {
      nome:       sanitize(nome).slice(0, 60),
      placarCasa: placarCasa,
      placarFora: placarFora,
      pix:        sanitize(pix).slice(0, 80),
      telefone:   telefoneNormalizado,
      enviadoEm:  new Date().toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }),
      valor:      window._valorAposta || VALOR_BASE
    };

    await db.ref(`palpites/${jogoId}/${nomeChave}`).set(palpite);

    window._ultimoNomeUsado     = nome;
    window._ultimoTelefoneUsado = telefoneNormalizado;
    window._ultimoPixUsado      = pix;

    fecharModalPix();
    iniciarContadorPix(nome, placarCasa, placarFora, pix);
    renderPalpites();
    renderDistribuicao();
  } catch (e) {
    fecharModalPix();
    mostrarAviso(aviso, "Erro ao salvar o palpite: " + (e && e.message ? e.message : String(e)), "erro");
    console.error(e);
  }
}

// ── Render: distribuição de palpites ──────────────────────

async function renderDistribuicao() {
  const corpo = document.getElementById("corpoDistribuicao");
  const vazio = document.getElementById("vazioDistribuicao");
  if (!corpo) return;
  corpo.innerHTML = "";

  const palpites = await obterPalpitesDoJogo(jogoAtual.id);
  if (palpites.length === 0) {
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  const flagCasa = bandeiraIMG(jogoAtual.casa);
  const flagFora = bandeiraIMG(jogoAtual.fora);
  const premioTotal = calcularArrecadacao(palpites) + premioAcumulado;

  const contagem = {};
  palpites.forEach(p => {
    const k = `${p.placarCasa}x${p.placarFora}`;
    contagem[k] = (contagem[k] || 0) + 1;
  });

  const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  ordenado.forEach(([k, qtd]) => {
    const [c, f] = k.split("x").map(Number);
    const premio = qtd > 0 ? (premioTotal / qtd) : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="placar">${flagCasa} ${c} x ${f} ${flagFora}</td>
      <td>${qtd}</td>
      <td style="color:var(--verde);font-weight:700;">R$ ${premio.toFixed(2).replace(".",",")}</td>
    `;
    corpo.appendChild(tr);
  });
}

// ── Render: tabela de palpites ────────────────────────────

let _renderPalpitesEmAndamento = false;
let _renderPalpitesPendente    = false;
let _debounceFiltroPalpites    = null;

function filtrarPalpitesComDebounce() {
  if (_debounceFiltroPalpites) clearTimeout(_debounceFiltroPalpites);
  _debounceFiltroPalpites = setTimeout(() => renderPalpites(), 250);
}

async function renderPalpites() {
  if (_renderPalpitesEmAndamento) {
    _renderPalpitesPendente = true;
    return;
  }
  atualizarPremioDuplo();
  _renderPalpitesEmAndamento = true;

  try {
    await _renderPalpitesInterno();
  } finally {
    _renderPalpitesEmAndamento = false;
    if (_renderPalpitesPendente) {
      _renderPalpitesPendente = false;
      renderPalpites();
    }
  }
}

function _parseDataEnvio(str) {
  const m = (str || "").match(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  return new Date(yyyy, mm - 1, dd, hh, mi, ss || 0).getTime();
}

async function _renderPalpitesInterno() {
  const jogoId = jogoAtual.id;
  const corpo  = document.getElementById("corpoTabelaPalpites");
  const vazio  = document.getElementById("vazioPalpites");
  corpo.innerHTML = "";

  const palpites = await obterPalpitesDoJogo(jogoId);

  const total      = palpites.length;
  const arrecadado = calcularArrecadacao(palpites);
  const premioTotal = arrecadado + premioAcumulado;
  document.getElementById("infoParticipantes").textContent = String(total);
  document.getElementById("infoArrecadado").textContent = "R$ " + arrecadado.toFixed(2).replace(".", ",");
  document.getElementById("infoPremio").textContent = "R$ " + premioTotal.toFixed(2).replace(".", ",");

  const bannerAcum = document.getElementById("bannerAcumuloTradicional");
  const avisoRegra = document.getElementById("avisoRegraAcumulo");
  const tabelaBox  = document.getElementById("tabelaValoresPalpitantesBox");
  const regraEl    = document.getElementById("regraValorTradicional");

  if (premioAcumulado > 0) {
    const idxAtual = jogos.findIndex(j => j.id === jogoAtual.id);
    const jogoAnt  = idxAtual > 0 ? jogos[idxAtual - 1] : null;
    document.getElementById("valorAcumuladoTradicional").textContent = `+ R$ ${premioAcumulado.toFixed(2).replace(".",",")}`;
    document.getElementById("origemAcumuladoTradicional").textContent = jogoAnt
      ? `Ninguém acertou ${jogoAnt.casa} ${jogoAnt.placarCasa} x ${jogoAnt.placarFora} ${jogoAnt.fora}`
      : "Rodada anterior sem ganhador";
    bannerAcum.style.display = "block";
    avisoRegra.style.display = "block";
    if (regraEl) regraEl.style.display = "none";

    if (tabelaBox && palpites.length > 0) {
      const corpo2 = document.getElementById("corpoValoresPalpitantes");
      if (corpo2) {
        corpo2.innerHTML = "";
        const vistos = new Set();
        palpites.forEach(p => {
          const n = normalizarNome(p.nome);
          if (vistos.has(n)) return;
          vistos.add(n);
          const valor      = typeof p.valor === "number" ? p.valor : VALOR_BASE;
          const jogouAntes = valor <= VALOR_BASE;
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
        tabelaBox.style.display = "block";
      }
    }
  } else {
    bannerAcum.style.display = "none";
    avisoRegra.style.display = "none";
    if (tabelaBox) tabelaBox.style.display = "none";
    if (regraEl)   regraEl.style.display = "block";
  }

  if (palpites.length === 0) {
    vazio.style.display = "block";
    return;
  }

  const flagCasa = bandeiraIMG(jogoAtual.casa);
  const flagFora = bandeiraIMG(jogoAtual.fora);

  const filtroInput = document.getElementById("filtroPalpitesTexto");
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

  const ordemSelect = document.getElementById("ordemPalpites");
  const ordem = ordemSelect ? ordemSelect.value : "data_desc";

  listaFiltrada = [...listaFiltrada].sort((a, b) => {
    if (ordem === "nome_asc")  return a.nome.localeCompare(b.nome, "pt-BR");
    if (ordem === "nome_desc") return b.nome.localeCompare(a.nome, "pt-BR");
    if (ordem === "data_asc")  return _parseDataEnvio(a.enviadoEm) - _parseDataEnvio(b.enviadoEm);
    return _parseDataEnvio(b.enviadoEm) - _parseDataEnvio(a.enviadoEm);
  });

  if (listaFiltrada.length === 0) {
    vazio.style.display = "block";
    vazio.textContent = "Nenhum palpite encontrado para essa busca.";
    return;
  }
  vazio.style.display = "none";

  const totalApostasPorNome = {};
  palpites.forEach(p => {
    const chaveNome = normalizarNome(p.nome);
    totalApostasPorNome[chaveNome] = (totalApostasPorNome[chaveNome] || 0) + 1;
  });

  const numeracaoPorChave = {};
  const ordenadosPorData = [...palpites].sort((a, b) => _parseDataEnvio(a.enviadoEm) - _parseDataEnvio(b.enviadoEm));
  const contadorPorNome = {};
  ordenadosPorData.forEach(p => {
    const chaveNome = normalizarNome(p.nome);
    contadorPorNome[chaveNome] = (contadorPorNome[chaveNome] || 0) + 1;
    numeracaoPorChave[p._chave] = contadorPorNome[chaveNome];
  });

  listaFiltrada.forEach(p => {
    const chaveNome       = normalizarNome(p.nome);
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

// ── Contador PIX / pagamento ───────────────────────────────

let _intervaloContador = null;

function iniciarContadorPix(nome, placarCasa, placarFora, pixJogador) {
  const valor = window._valorAposta || VALOR_BASE;
  window._pixAtual = valor >= VALOR_NOVO ? PIX_10 : PIX_5;

  document.getElementById("infovalorPalpiteContador").innerHTML =
    `<strong>${sanitize(nome)}</strong>: ${placarCasa} x ${placarFora}<br>Valor: <strong>R$ ${valor.toFixed(2).replace(".",",")}</strong>`;
  document.getElementById("pixParaCopiar").textContent = window._pixAtual;
  document.getElementById("lembreteConfirmar").style.display = "none";
  document.getElementById("btnConfirmeiPix").style.display = "block";
  document.getElementById("btnAvisarWhats").style.display = "none";
  document.getElementById("btnFecharContador").style.display = "none";
  document.getElementById("statusPix").textContent = "⏳ Aguardando pagamento...";

  let segundos = 60;
  const anel  = document.getElementById("anelProgContador");
  const texto = document.getElementById("textoContador");
  const circ  = document.getElementById("circuloContador");
  const PERIMETRO = 314;

  function atualizar() {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    if (texto) texto.textContent = `${mins}:${String(secs).padStart(2,"0")}`;
    const fracao = segundos / 60;
    if (anel) anel.style.strokeDashoffset = PERIMETRO * (1 - fracao);
    const urgente = segundos <= 15;
    if (anel) anel.classList.toggle("urgente", urgente);
    if (circ) circ.classList.toggle("urgente", urgente);
  }

  atualizar();
  if (_intervaloContador) clearInterval(_intervaloContador);
  _intervaloContador = setInterval(() => {
    segundos--;
    if (segundos <= 0) {
      clearInterval(_intervaloContador);
      document.getElementById("statusPix").textContent = "⏰ Tempo esgotado — você ainda pode confirmar manualmente.";
    } else {
      atualizar();
    }
  }, 1000);

  abrirModal("modalContador");
  dispararConvitesPosPalpite();
}

function confirmarPagamentoPix() {
  if (_intervaloContador) clearInterval(_intervaloContador);
  document.getElementById("btnConfirmeiPix").style.display = "none";
  document.getElementById("btnAvisarWhats").style.display = "block";
  document.getElementById("btnFecharContador").style.display = "block";
  document.getElementById("statusPix").textContent = "✅ Obrigado! Avise o organizador no WhatsApp para finalizar.";
}

function abrirWhatsAppPalpite() {
  const msg = `Olá! Acabei de fazer meu pagamento do Bolão Copa 2026 (Tradicional). 🇧🇷⚽`;
  abrirLinkWhatsApp(`https://wa.me/${WHATSAPP_ORGANIZADOR}?text=${encodeURIComponent(msg)}`);
}

function fecharModalContador() {
  fecharModal("modalContador");
  limparFormularioPalpite();
  renderAreaJogoAtual();
}

// ── Expõe globalmente ──────────────────────────────────────

window.abrirModalPix                  = abrirModalPix;
window.fecharModalConfirmaPlacar      = fecharModalConfirmaPlacar;
window.confirmarPlacarCorreto         = confirmarPlacarCorreto;
window.editarDadosConfirmadosAberto   = editarDadosConfirmadosAberto;
window.copiarPix                      = copiarPix;
window.resolverDuplicado              = resolverDuplicado;
window.fecharModalPix                 = fecharModalPix;
window.abrirModalEditarPalpite        = abrirModalEditarPalpite;
window.fecharModalEditarPalpite       = fecharModalEditarPalpite;
window.buscarPalpiteParaEditar        = buscarPalpiteParaEditar;
window.selecionarPalpiteParaEditar    = selecionarPalpiteParaEditar;
window.salvarEdicaoPalpite            = salvarEdicaoPalpite;
window.confirmarEnvioPalpite          = confirmarEnvioPalpite;
window.filtrarPalpitesComDebounce     = filtrarPalpitesComDebounce;
window.renderPalpites                 = renderPalpites;
window.renderDistribuicao             = renderDistribuicao;
window.confirmarPagamentoPix          = confirmarPagamentoPix;
window.abrirWhatsAppPalpite           = abrirWhatsAppPalpite;
window.fecharModalContador            = fecharModalContador;
