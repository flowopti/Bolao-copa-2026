/* =========================================================
   RANKING.JS — Ranking, resumo de rodadas, histórico e pódio
   (Tradicional + Premium)
   ========================================================= */

// ── Ranking Tradicional ───────────────────────────────────

async function renderRanking() {
  const corpo = document.getElementById("corpoRanking");
  const vazio = document.getElementById("vazioRanking");
  if (!corpo) return;
  corpo.innerHTML = "";

  const jogosComPlacar = jogos.filter(j => j.placarCasa !== null && j.placarFora !== null);

  if (jogosComPlacar.length === 0) {
    vazio.style.display = "block";
    vazio.textContent = "Nenhum jogo com placar oficial registrado ainda.";
    corpo.innerHTML = "";
    return;
  }
  vazio.style.display = "none";

  const pontuacao = {};

  for (const jogo of jogosComPlacar) {
    const palpites = await obterPalpitesDoJogo(jogo.id);
    const rC = Number(jogo.placarCasa), rF = Number(jogo.placarFora);

    for (const p of palpites) {
      const nome = p.nome;
      if (!pontuacao[nome]) pontuacao[nome] = { pts: 0, acertos: 0 };
      const pC = Number(p.placarCasa), pF = Number(p.placarFora);
      if (pC === rC && pF === rF) {
        pontuacao[nome].pts += 10;
        pontuacao[nome].acertos += 1;
      }
    }
  }

  const lista = Object.entries(pontuacao)
    .map(([nome, d]) => ({ nome, ...d }))
    .sort((a, b) => b.pts - a.pts || b.acertos - a.acertos);

  if (lista.length === 0) {
    vazio.style.display = "block";
    return;
  }

  lista.forEach((p, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}º`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${medal}</td>
      <td style="text-align:left;padding-left:10px;">🇧🇷 ${sanitize(p.nome)}</td>
      <td><strong>${p.pts}</strong></td>
      <td>${p.acertos}</td>
    `;
    corpo.appendChild(tr);
  });

  renderPodio(lista, "podioRanking");
}

// ── Ranking Premium ───────────────────────────────────────

async function renderRankingPremium() {
  const corpo = document.getElementById("corpoRankingPremium");
  const vazio = document.getElementById("vazioRankingPremium");
  if (!corpo) return;
  corpo.innerHTML = "";

  const jogosComPlacar = jogos.filter(j => j.placarCasa !== null && j.placarFora !== null);

  if (jogosComPlacar.length === 0) {
    vazio.style.display = "block";
    return;
  }

  const pontuacao = {};
  for (const jogo of jogosComPlacar) {
    const palpites = await obterPalpitesPremiumDoJogo(jogo.id);
    const rC = Number(jogo.placarCasa), rF = Number(jogo.placarFora);

    for (const p of palpites) {
      const nome = p.nome;
      if (!pontuacao[nome]) pontuacao[nome] = { pts: 0, acertos: 0 };
      const pC = Number(p.placarCasa), pF = Number(p.placarFora);
      if (pC === rC && pF === rF) {
        pontuacao[nome].pts += 10;
        pontuacao[nome].acertos += 1;
      }
    }
  }

  const lista = Object.entries(pontuacao)
    .map(([nome, d]) => ({ nome, ...d }))
    .sort((a, b) => b.pts - a.pts || b.acertos - a.acertos);

  if (lista.length === 0) {
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  lista.forEach((p, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}º`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${medal}</td>
      <td style="text-align:left;padding-left:10px;">⭐ ${sanitize(p.nome)}</td>
      <td><strong>${p.pts}</strong></td>
      <td>${p.acertos}</td>
    `;
    corpo.appendChild(tr);
  });

  // Nota: corrige bug do original (usava variável inexistente `listaPremium`)
  renderPodio(lista, "podioPremium");
}

// ── Pódio visual ───────────────────────────────────────────

function renderPodio(lista, elId) {
  const el = document.getElementById(elId);
  if (!el || lista.length === 0) { if (el) el.style.display = "none"; return; }

  const ordem = [1, 0, 2]; // visual: prata-esq, ouro-centro, bronze-dir
  const alturasVisuais = ["70px", "90px", "55px"];
  const medalhas = ["🥇", "🥈", "🥉"];
  const cores = ["#c9b400", "#c0c0c0", "#cd7f32"];
  const top3 = lista.slice(0, 3);

  el.style.cssText = "display:flex;justify-content:center;align-items:flex-end;gap:8px;margin:16px 0;";
  el.innerHTML = ordem.map((pos, visualIdx) => {
    if (!top3[pos]) return "";
    const p = top3[pos];
    const inicial = p.nome.charAt(0).toUpperCase();
    const altura = alturasVisuais[visualIdx];
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
      <div style="width:44px;height:44px;border-radius:50%;background:${cores[pos]};
        display:flex;align-items:center;justify-content:center;
        font-size:1.1rem;font-weight:900;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2);">${inicial}</div>
      <div style="font-size:.72rem;font-weight:700;text-align:center;max-width:60px;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.nome.split(" ")[0]}</div>
      <div style="font-size:.68rem;color:#888;">${p.pts}pts</div>
      <div style="width:60px;height:${altura};background:${cores[pos]};
        border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:center;
        font-size:1.4rem;box-shadow:0 -2px 6px rgba(0,0,0,.1);">${medalhas[pos]}</div>
    </div>`;
  }).join("");
}

// ── Resumo geral de rodadas (Tradicional) ────────────────

async function renderResumoGeral() {
  const lista = document.getElementById("listaResumoGeral");
  const vazio = document.getElementById("vazioResumoGeral");
  if (!lista) return;
  lista.innerHTML = "";

  const jogosComPlacar = jogos.filter(j => j.placarCasa !== null && j.placarFora !== null);

  if (jogosComPlacar.length === 0) {
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  let acumuladoCorrente = 0;
  window._dadosGanhadoresPorJogo = {};

  for (const jogo of jogosComPlacar) {
    const palpites = await obterPalpitesDoJogo(jogo.id);
    const total = palpites.length;
    const arrecadado = calcularArrecadacao(palpites);
    const premioRodada = arrecadado + acumuladoCorrente;

    const rC = Number(jogo.placarCasa), rF = Number(jogo.placarFora);
    const ganhadores = palpites.filter(p => Number(p.placarCasa) === rC && Number(p.placarFora) === rF);

    const flagC = bandeiraIMG(jogo.casa);
    const flagF = bandeiraIMG(jogo.fora);
    const siglaC = abreviarSelecao(jogo.casa);
    const siglaF = abreviarSelecao(jogo.fora);

    let qtdGanhadoresTexto, premioPorGanhador;
    if (ganhadores.length > 0) {
      qtdGanhadoresTexto = String(ganhadores.length);
      premioPorGanhador = "R$ " + (premioRodada / ganhadores.length).toFixed(2).replace(".", ",");
      acumuladoCorrente = 0;
    } else {
      qtdGanhadoresTexto = "0";
      premioPorGanhador = "—";
      acumuladoCorrente = premioRodada;
    }

    window._dadosGanhadoresPorJogo[jogo.id] = {
      tituloJogo: `${flagC} ${jogo.casa} ${rC} x ${rF} ${jogo.fora} ${flagF}`,
      ganhadores: ganhadores.map(g => g.nome),
      premioPorGanhador
    };

    const div = document.createElement("div");
    div.className = "card-resumo-rodada";
    div.innerHTML = `
      <div class="titulo-confronto" title="${jogo.casa} x ${jogo.fora}">${flagC} ${siglaC} ${rC} x ${rF} ${siglaF} ${flagF}</div>
      <div class="linhas-info">
        <div><span class="rotulo">Apostadores</span><span class="valor">${total}</span></div>
        <div><span class="rotulo">Arrecadado</span><span class="valor">R$ ${arrecadado.toFixed(2).replace(".",",")}</span></div>
        <div><span class="rotulo">Ganhadores</span><span class="valor">${qtdGanhadoresTexto}</span></div>
        <div><span class="rotulo">Prêmio/cada um</span><span class="valor destaque">${premioPorGanhador}</span></div>
      </div>
      <button class="btn-filtro" style="width:100%;padding:6px;font-size:.78rem;" onclick="abrirModalGanhadoresRodada('${jogo.id}')">👁️ Ver ganhadores</button>
    `;
    lista.appendChild(div);
  }
}

function abrirModalGanhadoresRodada(jogoId) {
  const dados = (window._dadosGanhadoresPorJogo || {})[jogoId];
  if (!dados) return;

  document.getElementById("tituloGanhadoresRodada").innerHTML = dados.tituloJogo;
  const lista = document.getElementById("conteudoGanhadoresRodada");
  if (dados.ganhadores.length === 0) {
    lista.innerHTML = `<p style="text-align:center;color:#999;">Ninguém acertou o placar exato — o prêmio acumulou para a próxima rodada!</p>`;
  } else {
    lista.innerHTML = dados.ganhadores.map(nome =>
      `<div>🏆 <strong>${sanitize(nome)}</strong> — ${dados.premioPorGanhador}</div>`
    ).join("");
  }

  abrirModal("modalGanhadoresRodada");
}

function fecharModalGanhadoresRodada() {
  fecharModal("modalGanhadoresRodada");
  fecharModal("modalGanhadoresRodadaPremium");
}

// ── Resumo geral de rodadas (Premium) ─────────────────────

async function renderResumoGeralPremium() {
  const lista = document.getElementById("listaResumoGeralPremium");
  const vazio = document.getElementById("vazioResumoGeralPremium");
  if (!lista) return;
  lista.innerHTML = "";

  const jogosComPlacar = jogos.filter(j => j.placarCasa !== null && j.placarFora !== null);

  if (jogosComPlacar.length === 0) {
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  let acumuladoCorrente = 0;
  window._dadosGanhadoresPorJogoPremium = {};
  let teveAlgumPalpitePremium = false;

  for (const jogo of jogosComPlacar) {
    const palpites = await obterPalpitesPremiumDoJogo(jogo.id);
    if (palpites.length > 0) teveAlgumPalpitePremium = true;
    const total = palpites.length;
    const arrecadado = calcularArrecadacaoPremium(palpites);
    const premioRodada = arrecadado + acumuladoCorrente;

    const rC = Number(jogo.placarCasa), rF = Number(jogo.placarFora);
    const ganhadores = palpites.filter(p => Number(p.placarCasa) === rC && Number(p.placarFora) === rF);

    const flagC = bandeiraIMG(jogo.casa);
    const flagF = bandeiraIMG(jogo.fora);
    const siglaC = abreviarSelecao(jogo.casa);
    const siglaF = abreviarSelecao(jogo.fora);

    let qtdGanhadoresTexto, premioPorGanhador;
    if (ganhadores.length > 0) {
      qtdGanhadoresTexto = String(ganhadores.length);
      premioPorGanhador = "R$ " + (premioRodada / ganhadores.length).toFixed(2).replace(".", ",");
      acumuladoCorrente = 0;
    } else {
      qtdGanhadoresTexto = "0";
      premioPorGanhador = "—";
      acumuladoCorrente = premioRodada;
    }

    window._dadosGanhadoresPorJogoPremium[jogo.id] = {
      tituloJogo: `${flagC} ${jogo.casa} ${rC} x ${rF} ${jogo.fora} ${flagF}`,
      ganhadores: ganhadores.map(g => g.nome),
      premioPorGanhador
    };

    if (total === 0) continue;

    const div = document.createElement("div");
    div.className = "card-resumo-rodada";
    div.innerHTML = `
      <div class="titulo-confronto" title="${jogo.casa} x ${jogo.fora}">${flagC} ${siglaC} ${rC} x ${rF} ${siglaF} ${flagF}</div>
      <div class="linhas-info">
        <div><span class="rotulo">Apostadores</span><span class="valor">${total}</span></div>
        <div><span class="rotulo">Arrecadado</span><span class="valor">R$ ${arrecadado.toFixed(2).replace(".",",")}</span></div>
        <div><span class="rotulo">Ganhadores</span><span class="valor">${qtdGanhadoresTexto}</span></div>
        <div><span class="rotulo">Prêmio/cada um</span><span class="valor destaque">${premioPorGanhador}</span></div>
      </div>
      <button class="btn-filtro" style="width:100%;padding:6px;font-size:.78rem;" onclick="abrirModalGanhadoresRodadaPremium('${jogo.id}')">👁️ Ver ganhadores</button>
    `;
    lista.appendChild(div);
  }

  if (!teveAlgumPalpitePremium) vazio.style.display = "block";
}

function abrirModalGanhadoresRodadaPremium(jogoId) {
  const dados = (window._dadosGanhadoresPorJogoPremium || {})[jogoId];
  if (!dados) return;

  document.getElementById("tituloGanhadoresRodadaPremium").innerHTML = dados.tituloJogo + " ⭐";
  const lista = document.getElementById("conteudoGanhadoresRodadaPremium");
  if (dados.ganhadores.length === 0) {
    lista.innerHTML = `<p style="text-align:center;color:#999;">Ninguém acertou o placar exato no Premium — o prêmio acumulou para a próxima rodada!</p>`;
  } else {
    lista.innerHTML = dados.ganhadores.map(nome =>
      `<div>🏆 <strong>${sanitize(nome)}</strong> — ${dados.premioPorGanhador}</div>`
    ).join("");
  }

  abrirModal("modalGanhadoresRodadaPremium");
}

// ── Histórico de palpites por rodada ──────────────────────

let _histPagina = 0;
const _histPageSize = 20;
let _histJogoAtual = null;
let _histDados = [];

async function renderHistorico() {
  const seletor = document.getElementById("seletorHistorico");
  const tabela  = document.getElementById("tabelaHistorico");
  if (!seletor) return;

  const jogosComPlacar = jogos.filter(j => j.placarCasa !== null && j.placarFora !== null);

  if (jogosComPlacar.length === 0) {
    document.getElementById("areaHistorico").innerHTML = '<p class="status-msg">Nenhuma rodada encerrada ainda.</p>';
    return;
  }

  document.getElementById("areaHistorico").innerHTML = '<p class="status-msg">Selecione uma rodada:</p>';
  seletor.innerHTML = "";

  jogosComPlacar.forEach((j, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn-filtro" + (idx === jogosComPlacar.length - 1 ? " ativo" : "");
    btn.textContent = `${j.casa} x ${j.fora}`;
    btn.onclick = () => {
      seletor.querySelectorAll(".btn-filtro").forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      carregarHistoricoJogo(j);
    };
    seletor.appendChild(btn);
  });

  await carregarHistoricoJogo(jogosComPlacar[jogosComPlacar.length - 1]);
}

async function carregarHistoricoJogo(jogo) {
  const tabela = document.getElementById("tabelaHistorico");
  const corpo  = document.getElementById("corpoHistorico");
  corpo.innerHTML = "";

  const palpites = await obterPalpitesDoJogo(jogo.id);
  const rC = Number(jogo.placarCasa), rF = Number(jogo.placarFora);

  if (palpites.length === 0) {
    corpo.innerHTML = `<tr><td colspan="3" class="vazio">Nenhum palpite registrado.</td></tr>`;
    tabela.style.display = "block";
    return;
  }

  const comPontos = palpites.map(p => {
    const pC = Number(p.placarCasa), pF = Number(p.placarFora);
    const pts = (pC === rC && pF === rF) ? 10 : 0;
    return { ...p, pts };
  }).sort((a, b) => b.pts - a.pts);

  const flagC = bandeiraIMG(jogo.casa);
  const flagF = bandeiraIMG(jogo.fora);

  document.getElementById("areaHistorico").innerHTML =
    `<p class="status-msg">Resultado oficial: <strong>${flagC} ${jogo.casa} ${rC} x ${rF} ${jogo.fora} ${flagF}</strong></p>`;

  // Estado para paginação (lista pode ser longa em rodadas com muitos palpites)
  _histJogoAtual = jogo;
  _histDados     = comPontos;
  _histPagina    = 0;

  _renderHistPagina();
  tabela.style.display = "block";
}

/**
 * Renderiza a página atual da tabela de histórico (20 palpites por página)
 * e os controles de navegação, quando há mais de uma página.
 */
function _renderHistPagina() {
  const tabela = document.getElementById("tabelaHistorico");
  const corpo  = document.getElementById("corpoHistorico");
  if (!corpo || !_histJogoAtual) return;

  const jogo  = _histJogoAtual;
  const flagC = bandeiraIMG(jogo.casa);
  const flagF = bandeiraIMG(jogo.fora);

  const total     = _histDados.length;
  const totalPags = Math.ceil(total / _histPageSize);
  const inicio    = _histPagina * _histPageSize;
  const pagina    = _histDados.slice(inicio, inicio + _histPageSize);

  corpo.innerHTML = "";
  pagina.forEach(p => {
    const medal = p.pts === 10 ? "🏆" : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align:left;padding-left:8px;">${medal} ${sanitize(p.nome)}</td>
      <td class="placar">${flagC} ${p.placarCasa} x ${p.placarFora} ${flagF}</td>
      <td><strong style="color:${p.pts > 0 ? 'var(--verde)' : '#999'}">${p.pts} pts</strong></td>
    `;
    corpo.appendChild(tr);
  });

  if (totalPags > 1) {
    const pagCtrl = document.createElement("tr");
    pagCtrl.innerHTML = `<td colspan="3" style="text-align:center;padding:10px;border-top:2px solid var(--borda);">
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
        <button class="btn-filtro" onclick="_histPagina=Math.max(0,_histPagina-1);_renderHistPagina();"
          style="padding:5px 14px;font-size:.8rem;${_histPagina === 0 ? "opacity:.4;pointer-events:none;" : ""}">‹ Anterior</button>
        <span style="font-size:.8rem;color:#888;">Página ${_histPagina + 1} de ${totalPags} · ${total} palpites</span>
        <button class="btn-filtro" onclick="_histPagina=Math.min(${totalPags - 1},_histPagina+1);_renderHistPagina();"
          style="padding:5px 14px;font-size:.8rem;${_histPagina === totalPags - 1 ? "opacity:.4;pointer-events:none;" : ""}">Próxima ›</button>
      </div>
    </td>`;
    corpo.appendChild(pagCtrl);
  }

  if (tabela) tabela.style.display = "block";
}

// ── Histórico pessoal (usado no modal Meu Desempenho) ─────

function renderHistoricoPessoal(historico) {
  const el = document.getElementById("conteudoMeuDesempenho");
  if (!el) return;
  if (historico.length === 0) { return; }

  const blocoHistorico =
    `<div style="font-size:.78rem;font-weight:700;color:#555;margin-bottom:6px;border-top:1px solid var(--borda);padding-top:10px;">
      📋 Histórico de palpites por rodada
      <span style="font-weight:400;color:#aaa;font-size:.72rem;"> — T = Tradicional, P = Premium</span>
    </div>` +
    historico.map(r => {
      const resultado = r.acertou ? "Acertou" : (r.quase ? "Quase" : "Errou");
      const corResult = r.acertou ? "var(--verde)" : (r.quase ? "#e67e22" : "#c0392b");
      return `<div style="display:flex;justify-content:space-between;align-items:center;
        padding:7px 0;border-bottom:1px solid var(--borda);font-size:.83rem;">
        <span style="color:#555;flex:1;">${r.jogo}</span>
        <span style="font-weight:700;margin:0 10px;">${r.palpite}</span>
        <span style="font-size:.72rem;font-weight:700;color:${corResult};">${resultado}</span>
      </div>`;
    }).join("");

  el.innerHTML += blocoHistorico;
}

// ── Expõe globalmente ──────────────────────────────────────

window.renderRanking                  = renderRanking;
window.renderRankingPremium           = renderRankingPremium;
window.renderResumoGeral              = renderResumoGeral;
window.renderResumoGeralPremium       = renderResumoGeralPremium;
window.abrirModalGanhadoresRodada     = abrirModalGanhadoresRodada;
window.abrirModalGanhadoresRodadaPremium = abrirModalGanhadoresRodadaPremium;
window.fecharModalGanhadoresRodada    = fecharModalGanhadoresRodada;
window.renderHistorico                = renderHistorico;
window.carregarHistoricoJogo          = carregarHistoricoJogo;
window.renderHistoricoPessoal         = renderHistoricoPessoal;
window.renderPodio                    = renderPodio;
