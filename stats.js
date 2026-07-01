/* =========================================================
   STATS.JS — Dashboard de estatísticas (Tradicional + Premium)
   ========================================================= */

let _statsFiltroAtual = 'ambos';

function filtrarStats(filtro) {
  _statsFiltroAtual = filtro;
  const estiloAtivo   = 'padding:6px 14px;border-radius:20px;border:2px solid #ffd700;background:#ffd700;color:#0a3d20;font-size:.78rem;font-weight:800;cursor:pointer;';
  const estiloInativo = 'padding:6px 14px;border-radius:20px;border:2px solid rgba(255,255,255,.4);background:transparent;color:rgba(255,255,255,.7);font-size:.78rem;font-weight:700;cursor:pointer;';
  document.getElementById('statsFiltroAmbos').style.cssText = filtro === 'ambos' ? estiloAtivo : estiloInativo;
  document.getElementById('statsFiltroTrad').style.cssText  = filtro === 'trad'  ? estiloAtivo : estiloInativo;
  document.getElementById('statsFiltroPrem').style.cssText  = filtro === 'prem'  ? estiloAtivo : estiloInativo;
  renderDashboardStats();
}

let _statsCarregando = false;

async function renderDashboardStats() {
  if (_statsCarregando) return;
  _statsCarregando = true;
  try {
    await _renderDashboardStatsInterno();
  } catch (e) {
    console.error("renderDashboardStats:", e);
  } finally {
    _statsCarregando = false;
  }
}

async function _renderDashboardStatsInterno() {
  const filtro = _statsFiltroAtual || 'ambos';
  const todosJogos = jogos.filter(j => j.id);
  let totalApostas = 0, totalArrecadado = 0, totalAcertos = 0;
  const apostadoresMap = {}, placarGlobal = {}, evolucao = [];

  for (const jogo of todosJogos) {
    const [palpites, palpitesPrem] = await Promise.all([
      obterPalpitesDoJogo(jogo.id),
      obterPalpitesPremiumDoJogo(jogo.id)
    ]);

    const usaTrad = filtro === 'ambos' || filtro === 'trad';
    const usaPrem = filtro === 'ambos' || filtro === 'prem';
    const todosPalpites = [
      ...(usaTrad ? palpites.map(p => ({ ...p, _mod: "T" })) : []),
      ...(usaPrem ? palpitesPrem.map(p => ({ ...p, _mod: "P" })) : [])
    ];
    if (!todosPalpites.length) continue;

    const rC = Number(jogo.placarCasa ?? -1), rF = Number(jogo.placarFora ?? -1);
    const arrecadado = (usaTrad ? calcularArrecadacao(palpites) : 0) + (usaPrem ? calcularArrecadacaoPremium(palpitesPrem) : 0);
    let ganhadoresRodada = 0;
    totalApostas += todosPalpites.length;
    totalArrecadado += arrecadado;

    todosPalpites.forEach(p => {
      const nome = (p.nome || "?").trim();
      const pix = (p.pix || "").trim();
      const tel = (p.telefone || "").replace(/\D/g, "");
      const chaveId = pix || tel || nome;
      const chave = `${chaveId}|${nome}`;
      if (!apostadoresMap[chave]) apostadoresMap[chave] = { nome, acertos: 0, quase: 0, total: 0 };
      apostadoresMap[chave].total++;

      const pC = Number(p.placarCasa), pF = Number(p.placarFora);
      placarGlobal[`${pC} x ${pF}`] = (placarGlobal[`${pC} x ${pF}`] || 0) + 1;

      if (jogo.placarCasa !== null) {
        const acertou = pC === rC && pF === rF;
        const quase = !acertou && (pC === rC || pF === rF || Math.abs(pC - rC) + Math.abs(pF - rF) === 1);
        if (acertou) { apostadoresMap[chave].acertos++; totalAcertos++; ganhadoresRodada++; }
        else if (quase) { apostadoresMap[chave].quase++; }
      }
    });

    evolucao.push({
      jogo, apostadores: todosPalpites.length,
      trad: usaTrad ? palpites.length : 0,
      prem: usaPrem ? palpitesPrem.length : 0,
      arrecadado, ganhadores: ganhadoresRodada,
      flagC: bandeiraIMG(jogo.casa), flagF: bandeiraIMG(jogo.fora)
    });
  }

  const apostadoresUnicos = Object.keys(apostadoresMap).length;
  const taxaAcerto = totalApostas > 0 ? (totalAcertos / totalApostas * 100).toFixed(1) : "0.0";
  const s = id => document.getElementById(id);

  const rodadasEncerradas = evolucao.filter(e => e.jogo.placarCasa !== null);
  const rodadasComGanhador = evolucao.filter(e => e.ganhadores > 0);

  const totalArrecadadoComGanhador = rodadasComGanhador.reduce((acc, e) => acc + e.arrecadado, 0);
  const premioMedio = rodadasComGanhador.length > 0
    ? totalArrecadadoComGanhador / rodadasComGanhador.length
    : 0;
  const premioMedioSub = rodadasComGanhador.length > 0
    ? `${rodadasComGanhador.length} de ${rodadasEncerradas.length} rodada${rodadasEncerradas.length !== 1 ? "s" : ""} com ganhador`
    : "nenhuma rodada com ganhador ainda";

  const totalGanhadores = rodadasComGanhador.reduce((acc, e) => acc + e.ganhadores, 0);
  const ganhadoresMedios = rodadasComGanhador.length > 0
    ? (totalGanhadores / rodadasComGanhador.length).toFixed(1)
    : "—";

  const valorPorGanhador = totalGanhadores > 0
    ? totalArrecadadoComGanhador / totalGanhadores
    : 0;

  if (s("statsPremioMedio"))        s("statsPremioMedio").textContent = premioMedio > 0 ? `R$ ${premioMedio.toFixed(2).replace(".",",")}` : "R$ —";
  if (s("statsPremioMedioSub"))     s("statsPremioMedioSub").textContent = premioMedioSub;
  if (s("statsGanhadoresMedios"))   s("statsGanhadoresMedios").textContent = ganhadoresMedios;
  if (s("statsGanhadoresMediosSub")) s("statsGanhadoresMediosSub").textContent = `${totalGanhadores} ganhador${totalGanhadores !== 1 ? "es" : ""} no total`;
  if (s("statsValorPorGanhador"))   s("statsValorPorGanhador").textContent = valorPorGanhador > 0 ? `R$ ${valorPorGanhador.toFixed(2).replace(".",",")}` : "R$ —";
  if (s("statsTotalApostas"))       s("statsTotalApostas").textContent = String(totalApostas);
  if (s("statsApostadoresUnicos"))  s("statsApostadoresUnicos").textContent = String(apostadoresUnicos);
  if (s("statsTaxaAcerto"))         s("statsTaxaAcerto").textContent = `${taxaAcerto}%`;

  const rankAp = Object.entries(apostadoresMap).sort((a, b) => b[1].acertos - a[1].acertos || b[1].total - a[1].total);
  const cardTop = s("statsTopApostador"), contTop = s("statsTopApostadorConteudo");
  if (rankAp.length > 0 && cardTop && contTop) {
    cardTop.style.display = "block";
    contTop.innerHTML = rankAp.slice(0, 3).map(([, d], i) =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--borda);">
        <span style="font-weight:700;">${["🥇","🥈","🥉"][i]} ${sanitize(d.nome)}</span>
        <div style="text-align:right;font-size:.82rem;">
          <span style="color:var(--verde);font-weight:700;">${d.acertos} acerto${d.acertos !== 1 ? "s" : ""}</span>
          <span style="color:#888;margin-left:8px;">${d.quase} quase</span>
          <span style="color:#aaa;margin-left:8px;">${d.total} aposta${d.total !== 1 ? "s" : ""}</span>
        </div>
      </div>`
    ).join("");
  }

  const elPl = s("statsPlacaresMaisApostados");
  if (elPl) {
    const top = Object.entries(placarGlobal).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = top[0]?.[1] || 1;
    elPl.innerHTML = top.length === 0
      ? '<p class="status-msg">Nenhum dado ainda.</p>'
      : top.map(([k, n]) =>
          `<div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:3px;">
              <span style="font-weight:700;">${k}</span>
              <span style="color:#888;">${n} aposta${n !== 1 ? "s" : ""}</span>
            </div>
            <div style="height:8px;background:#e9ecef;border-radius:4px;overflow:hidden;">
              <div style="width:${Math.round(n / max * 100)}%;height:100%;background:var(--verde);border-radius:4px;"></div>
            </div>
          </div>`
        ).join("");
  }

  const topQ = Object.entries(apostadoresMap)
    .filter(([, d]) => d.acertos === 0 && d.quase > 0)
    .sort((a, b) => b[1].quase - a[1].quase)
    .slice(0, 5);
  const cQ = s("statsQuaseCard"), cQc = s("statsQuaseConteudo");
  if (topQ.length > 0 && cQ && cQc) {
    cQ.style.display = "block";
    cQc.innerHTML = topQ.map(([, d], i) =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--borda);">
        <span style="font-weight:700;">#${i+1} ${sanitize(d.nome)}</span>
        <span style="color:#e67e22;font-weight:700;">🔥 ${d.quase} vez${d.quase !== 1 ? "es" : ""}</span>
      </div>`
    ).join("");
  }

  const elEv = s("statsEvolucaoPremio");
  if (elEv && evolucao.length > 0) {
    elEv.innerHTML = evolucao.map(e =>
      `<div style="padding:10px 0;border-bottom:1px solid var(--borda);">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:.82rem;font-weight:700;">${e.flagC} ${e.jogo.casa} × ${e.jogo.fora} ${e.flagF}</div>
          <div style="font-size:.9rem;font-weight:800;color:${e.ganhadores > 0 ? 'var(--verde)' : '#e67e22'};">R$ ${e.arrecadado.toFixed(2).replace('.',',')}</div>
        </div>
        <div style="font-size:.72rem;color:#888;margin-top:3px;">⚽ Trad: ${e.trad || 0} apostas &nbsp;⭐ Prem: ${e.prem || 0} apostas &nbsp;${e.ganhadores > 0 ? '✅ Distribuído' : '🔁 Acumulado'}</div>
      </div>`
    ).join("");
  } else if (elEv) {
    elEv.innerHTML = '<p class="status-msg">Nenhuma rodada encerrada ainda.</p>';
  }
}

// ── Expõe globalmente ──────────────────────────────────────

window.filtrarStats         = filtrarStats;
window.renderDashboardStats = renderDashboardStats;
