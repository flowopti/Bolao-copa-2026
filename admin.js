/* =========================================================
   ADMIN.JS — Painel do organizador: visão geral, meu desempenho,
   geração de imagens (poster/vitória), WhatsApp, confirmações,
   correção de placar e exclusão de palpites (Tradicional).

   NOTA: Algumas funções abaixo (abrirVisaoGeralAdmin, abrirMeuDesempenho,
   gerarImagemDistribuicao) referenciam elementos HTML (ex: vgTituloJogo,
   mdNomeJogador, mdDistTitulo) que existiam no index.html legado mas não
   foram incluídos no index.html simplificado da Fase 1. Para essas
   funções operarem foi necessário adicionar os elementos correspondentes
   nos modais modalVisaoGeral, modalMeuDesempenho e modalDistribuicao.
   ========================================================= */

// ── Login do organizador ──────────────────────────────────

async function toggleAdmin(details) {
  if (details.open && !_adminLogado) {
    const senha = prompt("Digite a senha do organizador:");
    if (!senha) { details.open = false; return; }
    const senhaHash = await sha256(senha);
    if (senhaHash !== SENHA_ADMIN_HASH) {
      alert("Senha incorreta.");
      details.open = false;
      return;
    }
    _adminLogado = true;
  }
  if (!details.open) {
    ["areaExclusao", "cardImagem"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  }
}

// ── Visão geral (Tradicional + Premium) ───────────────────

async function abrirVisaoGeralAdmin() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }

  const elTitulo = document.getElementById("vgTituloJogo");
  if (elTitulo) elTitulo.textContent = `${jogoAtual.casa} x ${jogoAtual.fora} — ${jogoAtual.fase}`;

  try {
    const [palpitesAberto, palpitesPremium] = await Promise.all([
      obterPalpitesDoJogo(jogoAtual.id),
      obterPalpitesPremiumDoJogo(jogoAtual.id)
    ]);

    const arrecadadoAberto = calcularArrecadacao(palpitesAberto);
    const arrecadadoPremium = calcularArrecadacaoPremium(palpitesPremium);

    const s = id => document.getElementById(id);
    if (s("vgArrecadadoAberto"))  s("vgArrecadadoAberto").textContent  = "R$ " + arrecadadoAberto.toFixed(2).replace(".", ",");
    if (s("vgArrecadadoPremium")) s("vgArrecadadoPremium").textContent = "R$ " + arrecadadoPremium.toFixed(2).replace(".", ",");
    if (s("vgParticipantesAberto"))  s("vgParticipantesAberto").textContent  = `${palpitesAberto.length} participantes`;
    if (s("vgParticipantesPremium")) s("vgParticipantesPremium").textContent = `${palpitesPremium.length} participantes`;
    if (s("vgTotalGeral")) s("vgTotalGeral").textContent = "R$ " + (arrecadadoAberto + arrecadadoPremium).toFixed(2).replace(".", ",");

    const pendentesAberto  = palpitesAberto.filter(p => p.pago !== true).length;
    const pendentesPremium = palpitesPremium.filter(p => p.pago !== true).length;
    if (s("vgPendentesAberto"))  s("vgPendentesAberto").textContent  = String(pendentesAberto);
    if (s("vgPendentesPremium")) s("vgPendentesPremium").textContent = String(pendentesPremium);

    const nomesUnicosAberto  = new Set(palpitesAberto.map(p => normalizarNome(p.nome)));
    const nomesUnicosPremium = new Set(palpitesPremium.map(p => normalizarNome(p.nome)));
    let migraram = 0;
    nomesUnicosAberto.forEach(n => { if (nomesUnicosPremium.has(n)) migraram++; });
    const taxa = nomesUnicosAberto.size > 0 ? Math.round((migraram / nomesUnicosAberto.size) * 100) : 0;
    if (s("vgTaxaConversao")) s("vgTaxaConversao").textContent = `${taxa}% (${migraram}/${nomesUnicosAberto.size})`;

    // Rodada anterior (comparação)
    const idxAtual = jogos.findIndex(j => j.id === jogoAtual.id);
    const jogoAnterior = idxAtual > 0 ? jogos[idxAtual - 1] : null;
    const boxAnterior = s("vgRodadaAnteriorBox");
    if (jogoAnterior && jogoAnterior.placarCasa !== null && boxAnterior) {
      const [pAntAberto, pAntPremium] = await Promise.all([
        obterPalpitesDoJogo(jogoAnterior.id),
        obterPalpitesPremiumDoJogo(jogoAnterior.id)
      ]);
      const rA = calcularArrecadacao(pAntAberto);
      const rP = calcularArrecadacaoPremium(pAntPremium);
      const diffAberto = palpitesAberto.length - pAntAberto.length;
      const sinal = diffAberto >= 0 ? "+" : "";
      if (s("vgRodadaAnteriorConteudo")) {
        s("vgRodadaAnteriorConteudo").innerHTML =
          `<strong>${sanitize(jogoAnterior.casa)} x ${sanitize(jogoAnterior.fora)}</strong><br>` +
          `Tradicional: ${pAntAberto.length} participantes • R$ ${rA.toFixed(2).replace(".",",")}<br>` +
          `Premium: ${pAntPremium.length} participantes • R$ ${rP.toFixed(2).replace(".",",")}<br>` +
          `<span style="color:${diffAberto >= 0 ? 'var(--verde)' : '#c0392b'}">Variação Tradicional: ${sinal}${diffAberto} participantes vs rodada atual</span>`;
      }
      boxAnterior.style.display = "block";
    } else if (boxAnterior) {
      boxAnterior.style.display = "none";
    }

    // Volumetria por hora
    function parseHora(str) {
      const m = (str || "").match(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2})/);
      if (!m) return null;
      const [, dd, mm, yyyy, hh, mi] = m;
      return { hora: parseInt(hh), dia: `${dd}/${mm}`, ts: new Date(yyyy, mm - 1, dd, hh, mi).getTime() };
    }

    const todosPalpites = [
      ...palpitesAberto.map(p => ({ ...p, _tipo: "T" })),
      ...palpitesPremium.map(p => ({ ...p, _tipo: "P" }))
    ];
    const porHora = {};
    todosPalpites.forEach(p => {
      const parsed = parseHora(p.enviadoEm);
      if (!parsed) return;
      const chave = `${parsed.dia} ${String(parsed.hora).padStart(2, "0")}h`;
      if (!porHora[chave]) porHora[chave] = { total: 0, T: 0, P: 0 };
      porHora[chave].total++;
      porHora[chave][p._tipo]++;
    });

    const boxVol = s("vgVolumetriaBox");
    if (boxVol) {
      if (Object.keys(porHora).length > 0) {
        const maxVal = Math.max(...Object.values(porHora).map(v => v.total));
        const barras = Object.entries(porHora).sort(([a], [b]) => a.localeCompare(b)).map(([hora, dados]) => {
          const pct = Math.round((dados.total / maxVal) * 100);
          const cor = pct >= 80 ? "var(--verde)" : pct >= 40 ? "var(--azul)" : "#aaa";
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="font-size:.72rem;width:80px;flex-shrink:0;">${hora}</span>
            <div style="flex:1;background:#e8e8e8;border-radius:4px;height:14px;">
              <div style="width:${pct}%;background:${cor};height:100%;border-radius:4px;"></div>
            </div>
            <span style="font-size:.72rem;width:38px;text-align:right;">${dados.total} (T:${dados.T} P:${dados.P})</span>
          </div>`;
        }).join("");
        if (s("vgVolumetriaConteudo")) s("vgVolumetriaConteudo").innerHTML = barras;
        boxVol.style.display = "block";
      } else {
        boxVol.style.display = "none";
      }
    }

    // Volumetria comparativa da rodada anterior
    const boxVolAnt = s("vgVolumetriaAnteriorBox");
    if (jogoAnterior && jogoAnterior.placarCasa !== null && boxVolAnt) {
      const [pAntAberto2, pAntPremium2] = await Promise.all([
        obterPalpitesDoJogo(jogoAnterior.id),
        obterPalpitesPremiumDoJogo(jogoAnterior.id)
      ]);
      const todosAnt = [
        ...pAntAberto2.map(p => ({ ...p, _tipo: "T" })),
        ...pAntPremium2.map(p => ({ ...p, _tipo: "P" }))
      ];
      const porDiaHoraAnt = {};
      todosAnt.forEach(p => {
        const parsed = parseHora(p.enviadoEm);
        if (!parsed) return;
        const chave = `${parsed.dia} ${String(parsed.hora).padStart(2, "0")}h`;
        if (!porDiaHoraAnt[chave]) porDiaHoraAnt[chave] = { total: 0, T: 0, P: 0 };
        porDiaHoraAnt[chave].total++;
        porDiaHoraAnt[chave][p._tipo]++;
      });
      if (Object.keys(porDiaHoraAnt).length > 0) {
        const maxAnt = Math.max(...Object.values(porDiaHoraAnt).map(v => v.total));
        const barrasAnt = Object.entries(porDiaHoraAnt)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([hora, dados]) => {
            const pct = Math.round((dados.total / maxAnt) * 100);
            const cor = pct >= 80 ? "#c0392b" : pct >= 40 ? "#e67e22" : "#aaa";
            return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <span style="font-size:.72rem;width:80px;flex-shrink:0;">${hora}</span>
              <div style="flex:1;background:#e8e8e8;border-radius:4px;height:14px;">
                <div style="width:${pct}%;background:${cor};height:100%;border-radius:4px;"></div>
              </div>
              <span style="font-size:.72rem;width:38px;text-align:right;">${dados.total} (T:${dados.T} P:${dados.P})</span>
            </div>`;
          }).join("");
        if (s("vgVolumetriaAnteriorConteudo")) {
          s("vgVolumetriaAnteriorConteudo").innerHTML =
            `<p style="font-size:.76rem;color:#888;margin-bottom:8px;">${sanitize(jogoAnterior.casa)} x ${sanitize(jogoAnterior.fora)}</p>` + barrasAnt;
        }
        boxVolAnt.style.display = "block";
      } else {
        boxVolAnt.style.display = "none";
      }
    } else if (boxVolAnt) {
      boxVolAnt.style.display = "none";
    }

    document.body.classList.add("modal-aberto");
    abrirModal("modalVisaoGeral");
  } catch (e) {
    alert("Erro ao carregar visão geral: " + e.message);
  }
}

function fecharVisaoGeralAdmin() {
  fecharModal("modalVisaoGeral");
  document.body.classList.remove("modal-aberto");
}

// ── Meu Desempenho ─────────────────────────────────────────

async function abrirMeuDesempenho() {
  const aviso = document.getElementById("avisoMeuDesempenho");
  const ident = document.getElementById("identMeuDesempenho").value.trim();

  if (!ident) {
    mostrarAviso(aviso, "Digite sua chave PIX ou telefone para ver seu desempenho.", "erro");
    return;
  }

  abrirModal("modalMeuDesempenho");
  aviso.style.display = "none";

  const identTelefone = ident.replace(/\D/g, "");
  const identPix = ident.trim();

  function bateIdentificacao(p) {
    const pixBate = identPix && (p.pix || "").trim() === identPix;
    const telBate = identTelefone && identTelefone.length >= 8 && (p.telefone || "") === identTelefone;
    return pixBate || telBate;
  }

  const jogosComPlacar = jogos.filter(j => j.placarCasa !== null && j.placarFora !== null);

  let rodadasJogadas = new Set();
  let totalApostas = 0;
  let acertos = 0;
  let totalGasto = 0;
  let totalGanho = 0;
  let encontrouAlgumaAposta = false;
  let nomeEncontrado = "";
  const historicoPessoal = [];

  for (const jogo of jogosComPlacar) {
    const rC = Number(jogo.placarCasa), rF = Number(jogo.placarFora);

    // Tradicional
    const palpitesAberto = await obterPalpitesDoJogo(jogo.id);
    const minhasApostasAberto = palpitesAberto.filter(bateIdentificacao);
    if (minhasApostasAberto.length > 0) {
      encontrouAlgumaAposta = true;
      if (!nomeEncontrado && minhasApostasAberto[0].nome) nomeEncontrado = minhasApostasAberto[0].nome;
      rodadasJogadas.add(jogo.id);
      const ganhadoresAberto = palpitesAberto.filter(p => Number(p.placarCasa) === rC && Number(p.placarFora) === rF);
      const premioTotalAberto = calcularArrecadacao(palpitesAberto);
      minhasApostasAberto.forEach(p => {
        totalApostas++;
        totalGasto += (typeof p.valor === "number" ? p.valor : VALOR_BASE);
        const acertou = Number(p.placarCasa) === rC && Number(p.placarFora) === rF;
        const diff = Math.abs(Number(p.placarCasa) - rC) + Math.abs(Number(p.placarFora) - rF);
        const mvP = (Number(p.placarCasa) > Number(p.placarFora) && rC > rF) ||
                    (Number(p.placarCasa) < Number(p.placarFora) && rC < rF) ||
                    (Number(p.placarCasa) === Number(p.placarFora) && rC === rF);
        const quase = !acertou && (diff === 1 || (diff === 2 && mvP));
        if (acertou) {
          acertos++;
          if (ganhadoresAberto.length > 0) totalGanho += premioTotalAberto / ganhadoresAberto.length;
        }
        historicoPessoal.push({
          jogo: `${jogo.casa} x ${jogo.fora}`,
          palpite: `${p.placarCasa} x ${p.placarFora} (T)`,
          acertou, quase
        });
      });
    }

    // Premium
    const palpitesPremium = await obterPalpitesPremiumDoJogo(jogo.id);
    const minhasApostasPremium = palpitesPremium.filter(bateIdentificacao);
    if (minhasApostasPremium.length > 0) {
      encontrouAlgumaAposta = true;
      rodadasJogadas.add(jogo.id);
      const ganhadoresPremium = palpitesPremium.filter(p => Number(p.placarCasa) === rC && Number(p.placarFora) === rF);
      const premioTotalPremium = calcularArrecadacaoPremium(palpitesPremium);
      minhasApostasPremium.forEach(p => {
        totalApostas++;
        totalGasto += (typeof p.valor === "number" ? p.valor : VALOR_PREMIUM_BASE);
        const acertouP = Number(p.placarCasa) === rC && Number(p.placarFora) === rF;
        const diffP = Math.abs(Number(p.placarCasa) - rC) + Math.abs(Number(p.placarFora) - rF);
        const mvPP = (Number(p.placarCasa) > Number(p.placarFora) && rC > rF) ||
                     (Number(p.placarCasa) < Number(p.placarFora) && rC < rF) ||
                     (Number(p.placarCasa) === Number(p.placarFora) && rC === rF);
        const quaseP = !acertouP && (diffP === 1 || (diffP === 2 && mvPP));
        if (acertouP) {
          acertos++;
          if (ganhadoresPremium.length > 0) totalGanho += premioTotalPremium / ganhadoresPremium.length;
        }
        historicoPessoal.push({
          jogo: `${jogo.casa} x ${jogo.fora}`,
          palpite: `${p.placarCasa} x ${p.placarFora} (P)`,
          acertou: acertouP, quase: quaseP
        });
      });
    }
  }

  if (!encontrouAlgumaAposta) {
    mostrarAviso(aviso, "Nenhuma aposta encontrada com essa chave PIX ou telefone em rodadas já encerradas.", "erro");
    return;
  }

  mostrarAviso(aviso, "✅ Desempenho carregado!", "sucesso");

  const s = id => document.getElementById(id);
  if (s("mdNomeJogador"))     s("mdNomeJogador").textContent = nomeEncontrado || identPix;
  if (s("mdRodadasJogadas"))  s("mdRodadasJogadas").textContent = String(rodadasJogadas.size);
  if (s("mdAcertos"))         s("mdAcertos").textContent = String(acertos);
  if (s("mdTotalApostas"))    s("mdTotalApostas").textContent = String(totalApostas);
  const taxa = totalApostas > 0 ? Math.round((acertos / totalApostas) * 100) : 0;
  if (s("mdTaxaAcerto"))      s("mdTaxaAcerto").textContent = `${taxa}%`;
  if (s("mdTotalGasto"))      s("mdTotalGasto").textContent = "R$ " + totalGasto.toFixed(2).replace(".", ",");
  if (s("mdTotalGanho"))      s("mdTotalGanho").textContent = "R$ " + totalGanho.toFixed(2).replace(".", ",");
  const saldo = totalGanho - totalGasto;
  const saldoEl = s("mdSaldoLiquido");
  if (saldoEl) {
    saldoEl.textContent = (saldo >= 0 ? "+ " : "− ") + "R$ " + Math.abs(saldo).toFixed(2).replace(".", ",");
    saldoEl.style.color = saldo >= 0 ? "var(--verde)" : "#c0392b";
  }

  renderHistoricoPessoal(historicoPessoal);
}

function fecharMeuDesempenho() {
  fecharModal("modalMeuDesempenho");
}

// ── Geração de imagem (poster de palpites) ────────────────

async function gerarImagemPalpites() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }

  const jogoId = jogoAtual.id;
  const palpites = await obterPalpitesDoJogo(jogoId);
  const canvas = document.getElementById("posterPalpites");
  const ctx = canvas.getContext("2d");

  const total = palpites.length;
  const arrecadado = calcularArrecadacao(palpites);

  const W = 1000;
  const linhaAltura = 64;
  const topoTabela = 320;
  const alturaTabelaHeader = 70;
  const numLinhas = Math.max(palpites.length, 1);
  const alturaTabela = alturaTabelaHeader + numLinhas * linhaAltura;
  const rodapeAltura = 190;
  const H = topoTabela + alturaTabela + rodapeAltura;

  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = "#06241a";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.02)";
  ctx.lineWidth = 30;
  for (let x = -H; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
    ctx.stroke();
  }

  ctx.strokeStyle = "#ffcc29";
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  const logoImg = await carregarImagem("./missao-hexa.jpg");
  const logoSize = 130;
  const logoX = 40;
  const logoY = 35;

  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    ctx.restore();
    ctx.strokeStyle = "#ffcc29";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  const bandeiraCasa = bandeirasTexto[jogoAtual.casa] || "🏳️";
  const bandeiraFora = bandeirasTexto[jogoAtual.fora] || "🏳️";

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 46px Arial";
  ctx.fillText("BOLÃO", logoX + logoSize + 30, logoY + 50);

  ctx.fillStyle = "#ffcc29";
  ctx.font = "bold 52px Arial";
  ctx.fillText(`${jogoAtual.casa.toUpperCase()} ${bandeiraCasa}  X  ${bandeiraFora} ${jogoAtual.fora.toUpperCase()}`, logoX + logoSize + 30, logoY + 105);

  ctx.font = "22px Arial";
  ctx.fillStyle = "#cfe8da";
  ctx.fillText(`${jogoAtual.fase} — ${jogoAtual.dataLabel}`, logoX + logoSize + 30, logoY + 145);

  const tabX = 50;
  const tabW = W - 100;
  const colNumW = 90;
  const colNomeW = tabW * 0.45;
  const colPalpiteW = tabW - colNumW - colNomeW;

  ctx.fillStyle = "#ffcc29";
  ctx.fillRect(tabX, topoTabela, tabW, alturaTabelaHeader);
  ctx.fillStyle = "#0b1f3a";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "left";
  ctx.fillText("👥 PARTICIPANTE", tabX + colNumW + 20, topoTabela + 45);
  ctx.textAlign = "center";
  ctx.fillText("⚽ PALPITE", tabX + colNumW + colNomeW + colPalpiteW / 2, topoTabela + 45);
  ctx.fillText("Nº", tabX + colNumW / 2, topoTabela + 45);

  if (palpites.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(tabX, topoTabela + alturaTabelaHeader, tabW, linhaAltura);
    ctx.fillStyle = "#555";
    ctx.font = "26px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Nenhum palpite enviado ainda", tabX + tabW / 2, topoTabela + alturaTabelaHeader + 40);
  } else {
    palpites.forEach((p, i) => {
      const y = topoTabela + alturaTabelaHeader + i * linhaAltura;
      const corLinha = i % 2 === 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.80)";

      ctx.fillStyle = "#06241a";
      ctx.fillRect(tabX, y, colNumW, linhaAltura);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px Arial";
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), tabX + colNumW / 2, y + linhaAltura / 2 + 10);

      ctx.fillStyle = corLinha;
      ctx.fillRect(tabX + colNumW, y, colNomeW, linhaAltura);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 26px Arial";
      ctx.textAlign = "left";
      let nomeExibido = `🇧🇷 ${sanitize(p.nome)}`;
      while (ctx.measureText(nomeExibido).width > colNomeW - 40 && nomeExibido.length > 3) {
        nomeExibido = nomeExibido.slice(0, -1);
      }
      ctx.fillText(nomeExibido, tabX + colNumW + 20, y + linhaAltura / 2 + 9);

      ctx.fillStyle = corLinha;
      ctx.fillRect(tabX + colNumW + colNomeW, y, colPalpiteW, linhaAltura);
      ctx.fillStyle = "#0a6847";
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        `${bandeiraCasa} ${p.placarCasa} x ${p.placarFora} ${bandeiraFora}`,
        tabX + colNumW + colNomeW + colPalpiteW / 2, y + linhaAltura / 2 + 9
      );

      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tabX, y + linhaAltura);
      ctx.lineTo(tabX + tabW, y + linhaAltura);
      ctx.stroke();
    });
  }

  ctx.strokeStyle = "#ffcc29";
  ctx.lineWidth = 4;
  ctx.strokeRect(tabX, topoTabela, tabW, alturaTabela);

  const rodapeY = topoTabela + alturaTabela + 30;

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(tabX, rodapeY, tabW, 80);
  ctx.strokeStyle = "#ffcc29";
  ctx.lineWidth = 2;
  ctx.strokeRect(tabX, rodapeY, tabW, 80);

  const colRodapeW = tabW / 3;

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcc29";
  ctx.font = "bold 20px Arial";
  ctx.fillText("👥 PARTICIPANTES", tabX + colRodapeW * 0.5, rodapeY + 32);
  ctx.fillText("💰 VALOR/APOSTA", tabX + colRodapeW * 1.5, rodapeY + 32);
  ctx.fillText("🏆 PRÊMIO TOTAL", tabX + colRodapeW * 2.5, rodapeY + 32);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px Arial";
  ctx.fillText(String(total), tabX + colRodapeW * 0.5, rodapeY + 65);
  ctx.fillText(`R$ ${VALOR_BASE.toFixed(2).replace(".",",")}`, tabX + colRodapeW * 1.5, rodapeY + 65);
  ctx.fillText(`R$ ${arrecadado.toFixed(2).replace(".",",")}`, tabX + colRodapeW * 2.5, rodapeY + 65);

  ctx.strokeStyle = "rgba(255,204,41,0.4)";
  ctx.lineWidth = 1;
  [1, 2].forEach(i => {
    ctx.beginPath();
    ctx.moveTo(tabX + colRodapeW * i, rodapeY);
    ctx.lineTo(tabX + colRodapeW * i, rodapeY + 80);
    ctx.stroke();
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcc29";
  ctx.font = "bold 30px Arial";
  ctx.fillText("⚽ JUNTOS PELO HEXA! 🏆", W / 2, rodapeY + 125);

  ctx.font = "22px Arial";
  ctx.fillStyle = "#cfe8da";
  ctx.fillText("Se ninguém acertar, o prêmio acumula para a próxima rodada!", W / 2, rodapeY + 160);

  document.getElementById("cardImagem").style.display = "block";
}

function carregarImagem(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function baixarImagem() {
  const canvas = document.getElementById("posterPalpites");
  const link = document.createElement("a");
  link.download = `palpites-${jogoAtual.casa}-x-${jogoAtual.fora}.png`.replace(/\s+/g, "-");
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ── Imagem de distribuição com vagas (Tradicional + Premium) ──

async function gerarImagemDistribuicao() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }

  const [palpitesT, palpitesP] = await Promise.all([
    obterPalpitesDoJogo(jogoAtual.id),
    obterPalpitesPremiumDoJogo(jogoAtual.id)
  ]);

  const contagemT = {};
  palpitesT.forEach(p => {
    const k = `${Number(p.placarCasa)}x${Number(p.placarFora)}`;
    contagemT[k] = (contagemT[k] || 0) + 1;
  });
  const contagemP = {};
  palpitesP.forEach(p => {
    const k = `${Number(p.placarCasa)}x${Number(p.placarFora)}`;
    contagemP[k] = (contagemP[k] || 0) + 1;
  });

  const todosPlacares = [...new Set([...Object.keys(contagemT), ...Object.keys(contagemP)])];
  todosPlacares.sort((a, b) => {
    const totalA = (contagemT[a] || 0) + (contagemP[a] || 0);
    const totalB = (contagemT[b] || 0) + (contagemP[b] || 0);
    return totalB - totalA;
  });

  const premioT = calcularArrecadacao(palpitesT) + premioAcumulado;
  const premioP = calcularArrecadacaoPremium(palpitesP) + premioAcumuladoPremium;
  const LIMITE = LIMITE_PESSOAS_POR_PLACAR_PREMIUM;

  const linhasT = todosPlacares.map(k => {
    const [c, f] = k.split("x");
    const qtd = contagemT[k] || 0;
    const premioAcerto = qtd > 0 ? `R$ ${(premioT / qtd).toFixed(2).replace(".",",")}` : "—";
    return `<tr>
      <td style="text-align:center;font-weight:700;font-size:.95rem;">${c} x ${f}</td>
      <td style="text-align:center;">${qtd > 0 ? `<strong>${qtd}</strong>` : "<span style='color:#aaa;'>—</span>"}</td>
      <td style="text-align:center;color:var(--verde);font-weight:700;">${premioAcerto}</td>
    </tr>`;
  }).join("");

  const linhasP = todosPlacares.map(k => {
    const [c, f] = k.split("x");
    const qtd = contagemP[k] || 0;
    const vagasLivres = Math.max(0, LIMITE - qtd);
    const cheio = vagasLivres === 0;
    const premioAcerto = qtd > 0 ? `R$ ${(premioP / qtd).toFixed(2).replace(".",",")}` : "—";
    const vagaTag = cheio
      ? `<span style="background:#fdecec;color:#c0392b;border:1px solid #e74c3c;border-radius:4px;font-size:.7rem;font-weight:700;padding:1px 6px;">🔒 LOTADO</span>`
      : `<span style="background:#e3f7ed;color:var(--verde);border:1px solid var(--verde-claro);border-radius:4px;font-size:.7rem;font-weight:700;padding:1px 6px;">${vagasLivres}/${LIMITE} vaga${vagasLivres !== 1 ? "s" : ""}</span>`;
    return `<tr>
      <td style="text-align:center;font-weight:700;font-size:.95rem;">${c} x ${f}</td>
      <td style="text-align:center;">${qtd > 0 ? `<strong>${qtd}</strong>` : "<span style='color:#aaa;'>—</span>"}</td>
      <td style="text-align:center;">${vagaTag}</td>
      <td style="text-align:center;color:var(--verde);font-weight:700;">${premioAcerto}</td>
    </tr>`;
  }).join("");

  const vazio = `<tr><td colspan="4" style="text-align:center;color:#aaa;padding:16px;">Nenhum palpite ainda</td></tr>`;

  const s = id => document.getElementById(id);
  if (s("mdDistTitulo"))   s("mdDistTitulo").textContent = `${jogoAtual.casa} x ${jogoAtual.fora} — ${jogoAtual.fase}`;
  if (s("mdDistPremioT"))  s("mdDistPremioT").textContent = `R$ ${premioT.toFixed(2).replace(".",",")}`;
  if (s("mdDistPremioP"))  s("mdDistPremioP").textContent = `R$ ${premioP.toFixed(2).replace(".",",")}`;
  if (s("mdDistCorpoT"))   s("mdDistCorpoT").innerHTML = linhasT || vazio;
  if (s("mdDistCorpoP"))   s("mdDistCorpoP").innerHTML = linhasP || vazio;

  document.body.classList.add("modal-aberto");
  abrirModal("modalDistribuicao");
}

function fecharModalDistribuicao() {
  fecharModal("modalDistribuicao");
  document.body.classList.remove("modal-aberto");
}

// ── Imagem de vitória (compartilhamento social) ───────────

async function gerarImagemVitoria(nome, premio, ehPremium) {
  const area = document.getElementById(ehPremium ? "areaImagemVitoriaPremium" : "areaImagemVitoria");
  const canvas = document.getElementById(ehPremium ? "posterVitoriaPremium" : "posterVitoria");
  if (!area || !canvas || !jogoAtual) return;
  const ctx = canvas.getContext("2d");

  const W = 1080, H = 1920;
  canvas.width = W; canvas.height = H;
  ctx.textAlign = "center";

  const codigoCasa = codigosISOSelecoes[jogoAtual.casa] || "";
  const codigoFora = codigosISOSelecoes[jogoAtual.fora] || "";
  const carregarImg = (url) => new Promise(res => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = url;
  });
  const [imgCasa, imgFora] = await Promise.all([
    codigoCasa ? carregarImg(`https://flagcdn.com/160x120/${codigoCasa}.png`) : Promise.resolve(null),
    codigoFora ? carregarImg(`https://flagcdn.com/160x120/${codigoFora}.png`) : Promise.resolve(null),
  ]);

  const P = ehPremium
    ? { bg1:"#0d0221", bg2:"#1a0b3d", bg3:"#3b1270", ac:"#ffd700", ac2:"#ff6b9d", glow:"rgba(255,215,0,0.5)" }
    : { bg1:"#002918", bg2:"#004d25", bg3:"#007a35", ac:"#ffdc2e", ac2:"#4ade80", glow:"rgba(255,220,46,0.5)" };

  const gradBg = ctx.createRadialGradient(W/2, H*0.28, 60, W/2, H*0.28, H);
  gradBg.addColorStop(0, P.bg3); gradBg.addColorStop(0.5, P.bg2); gradBg.addColorStop(1, P.bg1);
  ctx.fillStyle = gradBg; ctx.fillRect(0, 0, W, H);

  ctx.save(); ctx.translate(W/2, H*0.30);
  for (let i = 0; i < 20; i++) {
    ctx.rotate(Math.PI*2/20);
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.048)" : "rgba(255,255,255,0.018)";
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,H*1.1,0,0.1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  const cores = [P.ac, P.ac2, "#ffffff", "#60a5fa", "#f472b6", "#34d399"];
  [[72,112,20,0.5,0],[185,78,14,1.2,1],[952,148,22,0.8,2],[1012,248,16,2.1,3],
   [52,308,18,1.7,4],[918,398,14,0.3,5],[38,492,22,2.4,0],[978,512,18,1.1,1],
   [92,612,16,0.6,2],[948,668,20,1.9,3],[68,1478,18,1.0,4],[1002,1528,14,0.4,5],
   [128,1638,22,2.2,0],[928,1688,16,0.9,1],[52,1768,20,1.5,2],[978,1808,18,0.2,3],
   [148,1838,14,1.8,4],[898,1868,22,1.3,5],[308,188,12,2.8,0],[782,168,12,0.7,1],
   [218,1748,10,3.1,2],[862,1738,10,1.6,3],[460,140,16,0.4,4],[620,162,14,2.5,5]
  ].forEach(([x,y,s,r,c]) => {
    ctx.save(); ctx.translate(x,y); ctx.rotate(r);
    ctx.fillStyle = cores[c]; ctx.globalAlpha = 0.88;
    ctx.fillRect(-s/2,-s/3,s,s*0.6); ctx.restore();
  });
  [[192,192,16],[878,170,12],[136,748,14],[940,756,18],[196,1448,13],[868,1476,15],
   [420,200,10],[660,178,11]].forEach(([x,y,s]) => {
    ctx.save(); ctx.translate(x,y); ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI/2); ctx.moveTo(0,0); ctx.quadraticCurveTo(s*.18,s*.18,s,0); ctx.quadraticCurveTo(s*.18,-s*.18,0,0); }
    ctx.fill(); ctx.restore();
  });

  const rW = 680, rH = 100, rY = 50;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 7;
  ctx.fillStyle = P.ac;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(W/2-rW/2,rY,rW,rH,10) : ctx.rect(W/2-rW/2,rY,rW,rH); ctx.fill();
  [[W/2-rW/2,-1],[W/2+rW/2,1]].forEach(([px,dir]) => {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath(); ctx.moveTo(px,rY); ctx.lineTo(px+dir*42,rY); ctx.lineTo(px,rY+rH); ctx.lineTo(px+dir*42,rY+rH); ctx.closePath(); ctx.fill();
  });
  ctx.restore();
  ctx.fillStyle = "#111"; ctx.font = "900 38px Arial";
  ctx.fillText(ehPremium ? "⭐  BOLÃO PREMIUM  ⭐" : "🇧🇷  BOLÃO COPA 2026  🇧🇷", W/2, rY+66);

  ctx.save(); ctx.shadowColor = P.glow; ctx.shadowBlur = 100;
  ctx.font = "210px Arial"; ctx.fillText("🏆", W/2, 418); ctx.restore();

  ctx.save(); ctx.translate(W/2, 556); ctx.rotate(-0.032);
  ctx.font = "900 126px Arial"; ctx.lineWidth = 18; ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.strokeText("EU GANHEI!", 0, 0);
  const gT = ctx.createLinearGradient(-330,0,330,0);
  gT.addColorStop(0,P.ac); gT.addColorStop(0.45,"#ffffff"); gT.addColorStop(1,P.ac);
  ctx.fillStyle = gT; ctx.fillText("EU GANHEI!", 0, 0); ctx.restore();

  const cY = 626, cH = 148, cW = 880, cX = (W-cW)/2;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  const gC = ctx.createLinearGradient(cX,0,cX+cW,0);
  gC.addColorStop(0,"rgba(255,255,255,0.2)"); gC.addColorStop(1,"rgba(255,255,255,0.07)");
  ctx.fillStyle = gC;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cX,cY,cW,cH,32) : ctx.rect(cX,cY,cW,cH); ctx.fill(); ctx.restore();
  ctx.strokeStyle = P.ac; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cX,cY,cW,cH,32) : ctx.rect(cX,cY,cW,cH); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "700 25px Arial";
  ctx.fillText("ACERTOU O PLACAR EXATO!", W/2, cY+42);
  ctx.fillStyle = "#ffffff"; ctx.font = "900 56px Arial";
  ctx.fillText(sanitize(nome).toUpperCase(), W/2, cY+106);

  ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(120,836); ctx.lineTo(W-120,836); ctx.stroke();

  const bFlagW = 168, bFlagH = 126, bFlagY = 856;
  const nomeCasa = jogoAtual.casa, nomeFora = jogoAtual.fora;
  const flagEsqX = W/2-bFlagW-148, flagDirX = W/2+148;
  const drawBandeira = (img, emoji, x, y, w, h) => {
    if (img) {
      ctx.save();
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x,y,w,h,12) : ctx.rect(x,y,w,h); ctx.clip();
      ctx.drawImage(img,x,y,w,h); ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.38)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x,y,w,h,12) : ctx.rect(x,y,w,h); ctx.stroke();
    } else {
      ctx.font = `${h*0.78}px Arial`; ctx.fillText(emoji,x+w/2,y+h*0.78);
    }
  };
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
  drawBandeira(imgCasa, bandeirasTexto[nomeCasa] || "🏳️", flagEsqX, bFlagY, bFlagW, bFlagH);
  drawBandeira(imgFora, bandeirasTexto[nomeFora] || "🏳️", flagDirX, bFlagY, bFlagW, bFlagH);
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.88)"; ctx.font = "700 36px Arial";
  ctx.fillText(nomeCasa, flagEsqX+bFlagW/2, bFlagY+bFlagH+44);
  ctx.fillText(nomeFora, flagDirX+bFlagW/2, bFlagY+bFlagH+44);
  ctx.save(); ctx.font = "900 52px Arial"; ctx.fillStyle = P.ac;
  ctx.shadowColor = P.glow; ctx.shadowBlur = 30;
  ctx.fillText("VS", W/2, bFlagY+bFlagH/2+18); ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(120,bFlagY+bFlagH+62); ctx.lineTo(W-120,bFlagY+bFlagH+62); ctx.stroke();

  const pY = 1096, pH = 240, pW = 238, gap = 60, pStartX = W/2-pW-gap/2;
  const drawBox = (x, gols) => {
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    const g = ctx.createLinearGradient(x,pY,x,pY+pH);
    g.addColorStop(0,"rgba(255,255,255,0.28)"); g.addColorStop(1,"rgba(255,255,255,0.06)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x,pY,pW,pH,28) : ctx.rect(x,pY,pW,pH); ctx.fill(); ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x,pY,pW,pH,28) : ctx.rect(x,pY,pW,pH); ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.font = "900 128px Arial";
    ctx.fillText(String(gols), x+pW/2, pY+pH*0.76);
  };
  drawBox(pStartX, jogoAtual.placarCasa);
  drawBox(pStartX+pW+gap, jogoAtual.placarFora);
  ctx.save(); ctx.shadowColor = P.glow; ctx.shadowBlur = 35;
  ctx.fillStyle = P.ac; ctx.font = "900 76px Arial";
  ctx.fillText("X", W/2, pY+pH*0.72); ctx.restore();

  const bY = 1426, bH = 290, bW = 860, bX = (W-bW)/2;
  ctx.save(); ctx.shadowColor = P.glow; ctx.shadowBlur = 70;
  const gP = ctx.createLinearGradient(bX,bY,bX,bY+bH);
  gP.addColorStop(0,"rgba(255,255,255,0.18)"); gP.addColorStop(1,"rgba(255,255,255,0.04)");
  ctx.fillStyle = gP;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bX,bY,bW,bH,36) : ctx.rect(bX,bY,bW,bH); ctx.fill(); ctx.restore();
  ctx.strokeStyle = P.ac; ctx.lineWidth = 4; ctx.setLineDash([16,10]);
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bX+14,bY+14,bW-28,bH-28,26) : ctx.rect(bX+14,bY+14,bW-28,bH-28); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.font = "700 32px Arial";
  ctx.fillText("💰  PRÊMIO CONQUISTADO  💰", W/2, bY+72);
  ctx.save(); ctx.shadowColor = P.glow; ctx.shadowBlur = 55;
  ctx.fillStyle = P.ac; ctx.font = "900 136px Arial";
  ctx.fillText(`R$ ${premio.toFixed(2).replace(".",",")}`, W/2, bY+222); ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "600 30px Arial";
  ctx.fillText("⚽  Missão Hexa — Bolão Copa 2026  ⚽", W/2, H-96);
  ctx.strokeStyle = P.ac; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(W/2-170,H-68); ctx.lineTo(W/2+170,H-68); ctx.stroke();

  area.style.display = "block";
  area.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function baixarImagemVitoria(ehPremium) {
  const canvas = document.getElementById(ehPremium ? "posterVitoriaPremium" : "posterVitoria");
  const link = document.createElement("a");
  link.download = `minha-vitoria-${jogoAtual.casa}-x-${jogoAtual.fora}.png`.replace(/\s+/g, "-");
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ── Envio WhatsApp (Tradicional, admin) ───────────────────

async function enviarPalpitesWhatsApp() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }

  const palpites = await obterPalpitesDoJogo(jogoAtual.id);

  let msg = `*BOLAO COPA 2026 - MISSAO HEXA*\n\n`;
  msg += `*${jogoAtual.fase.toUpperCase()}*\n`;
  msg += `*${jogoAtual.casa} x ${jogoAtual.fora}*\n`;
  msg += `Data: ${jogoAtual.dataLabel}\n`;
  msg += `------------------------------\n\n`;
  msg += `*PALPITES DA TURMA:*\n\n`;

  if (palpites.length === 0) {
    msg += `_Nenhum palpite registrado ainda._\n`;
  } else {
    palpites.forEach((p, i) => { msg += `${i+1}. *${sanitize(p.nome)}*: ${p.placarCasa} x ${p.placarFora}\n`; });
  }

  const premioTotal = calcularArrecadacao(palpites) + premioAcumulado;
  msg += `\n------------------------------\n`;
  msg += `Participantes: *${palpites.length}*\n`;
  msg += `Premio acumulado: *R$ ${premioTotal.toFixed(2).replace(".",",")}*\n\n`;
  msg += `_Faca seu palpite tambem!_`;

  abrirLinkWhatsApp(`https://wa.me/${WHATSAPP_ORGANIZADOR}?text=${encodeURIComponent(msg)}`);
}

// ── Corrigir placar incorreto (Tradicional) ───────────────

async function corrigirPlacarIncorreto() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  const aviso = document.getElementById("avisoCorrigirPlacar");

  const jogosComPlacar = jogos.filter(j => j.placarCasa !== null);
  if (jogosComPlacar.length === 0) {
    mostrarAviso(aviso, "Nenhum jogo com placar salvo no momento.", "info");
    return;
  }

  const lista = jogosComPlacar.map((j, i) => `${i+1}. ${j.casa} ${j.placarCasa} x ${j.placarFora} ${j.fora} (${j.fase})`).join("\n");
  const escolha = prompt(`Qual jogo deseja apagar o placar?\n\n${lista}\n\nDigite o número:`);
  if (!escolha) return;
  const idx = parseInt(escolha) - 1;
  const jogoAlvo = jogosComPlacar[idx];
  if (!jogoAlvo) { alert("Opção inválida."); return; }

  if (!confirm(`Confirma apagar o placar de ${jogoAlvo.casa} x ${jogoAlvo.fora}?\nIsso vai reativar os palpites se o jogo ainda não tiver começado, ou reiniciar a busca automática se já passou do horário.`)) return;

  try {
    await db.ref(`placares/${jogoAlvo.id}`).remove();
    jogoAlvo.placarCasa = null;
    jogoAlvo.placarFora = null;
    mostrarAviso(aviso, `✅ Placar de ${jogoAlvo.casa} x ${jogoAlvo.fora} apagado com sucesso!`, "sucesso");

    await calcularPremioAcumulado();
    jogoAtual = obterProximoJogo();
    renderAreaJogoAtual();
    renderDistribuicao();
    renderPalpites();
    renderRanking();
    renderHistorico();
    iniciarVerificacaoPlacarAutomatica();
  } catch (e) {
    mostrarAviso(aviso, "Erro ao apagar placar: " + e.message, "erro");
  }
}

// ── Confirmações de pagamento (Tradicional) ───────────────

async function abrirConfirmacoesPix() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  const area = document.getElementById("areaConfirmacoes");
  const jogoId = jogoAtual.id;
  const palpites = await obterPalpitesDoJogo(jogoId);
  const corpo = document.getElementById("corpoConfirmacoes");
  corpo.innerHTML = "";

  const contagemPorNome = {};

  if (palpites.length === 0) {
    corpo.innerHTML = `<tr><td colspan="6" class="vazio">Nenhum palpite registrado.</td></tr>`;
  } else {
    const ordenados = [...palpites].sort((a, b) => {
      const cmp = a.nome.localeCompare(b.nome, "pt-BR");
      return cmp !== 0 ? cmp : (a.enviadoEm || "").localeCompare(b.enviadoEm || "");
    });

    for (const p of ordenados) {
      const chave = p._chave;
      const pago = p.pago === true;
      const nomeBase = normalizarNome(p.nome);
      contagemPorNome[nomeBase] = (contagemPorNome[nomeBase] || 0) + 1;
      const numeroAposta = contagemPorNome[nomeBase];

      const valorEsperado = typeof p.valor === "number" ? p.valor : VALOR_BASE;

      const telLink = p.telefone
        ? `<a href="https://wa.me/55${p.telefone}" target="_blank" style="font-size:.72rem;">${formatarTelefoneExibicao(p.telefone)}</a>`
        : "—";

      const tr = document.createElement("tr");
      tr.id = `conf_${chave}`;
      tr.dataset.valor = valorEsperado;
      tr.dataset.pago = pago;

      const acaoHtml = !pago
        ? `<button class="btn" style="padding:4px 10px;font-size:.75rem;" onclick="confirmarPagamentoAdmin('${jogoId}','${chave}')">Confirmar</button>`
        : `<button class="btn" style="padding:4px 10px;font-size:.75rem;background:#aaa;" onclick="desfazerPagamentoAdmin('${jogoId}','${chave}')">Desfazer</button>`;

      const btnEnviarWhats = p.telefone
        ? `<button class="btn" style="padding:4px 10px;font-size:.75rem;background:#25D366;margin-top:4px;" onclick="enviarConfirmacaoIndividualWhatsApp('${jogoId}','${chave}')">📲 Enviar</button>`
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

async function enviarConfirmacaoIndividualWhatsApp(jogoId, chave) {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  try {
    const snapshot = await db.ref(`palpites/${jogoId}/${chave}`).once("value");
    const p = snapshot.val();
    if (!p) { alert("Palpite não encontrado."); return; }
    if (!p.telefone) { alert("Este jogador não tem telefone cadastrado."); return; }

    const jogo = jogos.find(j => j.id === jogoId) || jogoAtual;
    const valor = typeof p.valor === "number" ? p.valor : VALOR_BASE;
    const statusPagamento = p.pago === true ? "✅ Pagamento CONFIRMADO" : "⏳ Pagamento PENDENTE";

    let msg = `*BOLAO COPA 2026 - MISSAO HEXA*\n\n`;
    msg += `Ola, ${sanitize(p.nome)}!\n\n`;
    msg += `*Seu palpite:* ${jogo.casa} ${p.placarCasa} x ${p.placarFora} ${jogo.fora}\n`;
    msg += `*Valor da aposta:* R$ ${valor.toFixed(2).replace(".",",")}\n`;
    msg += `*Status:* ${statusPagamento}\n\n`;
    msg += p.pago === true ? `_Tudo certo, boa sorte!_ 🍀` : `_Por favor, confirme o pagamento PIX para validar seu palpite._`;

    abrirLinkWhatsApp(`https://wa.me/55${p.telefone}?text=${encodeURIComponent(msg)}`);
  } catch (e) {
    alert("Erro ao enviar: " + e.message);
  }
}

async function confirmarPagamentoAdmin(jogoId, chave) {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  try {
    await db.ref(`palpites/${jogoId}/${chave}/pago`).set(true);
    document.getElementById("areaConfirmacoes").style.display = "none";
    abrirConfirmacoesPix();
    renderPalpites();
    mostrarAviso(document.getElementById("avisoAdmin"), "✅ Pagamento confirmado!", "sucesso");
  } catch (e) { alert("Erro ao confirmar."); }
}

async function desfazerPagamentoAdmin(jogoId, chave) {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  try {
    await db.ref(`palpites/${jogoId}/${chave}/pago`).set(false);
    document.getElementById("areaConfirmacoes").style.display = "none";
    abrirConfirmacoesPix();
    mostrarAviso(document.getElementById("avisoAdmin"), "↩️ Confirmação desfeita.", "info");
  } catch (e) { alert("Erro ao desfazer."); }
}

// ── Excluir palpites (Tradicional) ────────────────────────

async function abrirExclusaoPalpites() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  const area = document.getElementById("areaExclusao");
  const jogoId = jogoAtual.id;
  const palpites = await obterPalpitesDoJogo(jogoId);
  const corpo = document.getElementById("corpoExclusao");
  corpo.innerHTML = "";
  if (palpites.length === 0) {
    corpo.innerHTML = `<tr><td colspan="3" class="vazio">Nenhum palpite.</td></tr>`;
  } else {
    for (const p of palpites) {
      const chave = p._chave;
      const tr = document.createElement("tr");
      tr.id = `exc_${chave}`;
      tr.innerHTML = `
        <td>${sanitize(p.nome)}</td>
        <td class="placar">${p.placarCasa} x ${p.placarFora}</td>
        <td><button class="btn" style="padding:4px 10px;font-size:.75rem;background:#c0392b;" onclick="excluirUmPalpite('${jogoId}','${chave}')">🗑️</button></td>`;
      corpo.appendChild(tr);
    }
  }
  area.style.display = "block";
}

async function excluirUmPalpite(jogoId, chave) {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  if (!confirm("Excluir este palpite?")) return;
  try {
    await db.ref(`palpites/${jogoId}/${chave}`).remove();
    const tr = document.getElementById(`exc_${chave}`);
    if (tr) tr.remove();
    renderPalpites();
    mostrarAviso(document.getElementById("avisoAdmin"), "✅ Palpite excluído.", "sucesso");
  } catch (e) { alert("Erro ao excluir."); }
}

async function excluirTodosPalpites() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  if (!confirm(`Excluir TODOS os palpites de ${jogoAtual.casa} x ${jogoAtual.fora}? Irreversível!`)) return;
  try {
    await db.ref(`palpites/${jogoAtual.id}`).remove();
    document.getElementById("areaExclusao").style.display = "none";
    document.getElementById("cardImagem").style.display = "none";
    renderPalpites();
    mostrarAviso(document.getElementById("avisoAdmin"), "✅ Todos os palpites foram excluídos.", "sucesso");
  } catch (e) { alert("Erro ao excluir."); }
}

// ── Listar chaves PIX (Tradicional) ───────────────────────

async function listarChavesPix() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  const aviso = document.getElementById("avisoAdmin");
  const div = document.getElementById("listaPix");
  const corpo = document.getElementById("corpoListaPix");

  if (div.style.display === "block") { div.style.display = "none"; return; }
  if (!firebaseOk) { mostrarAviso(aviso, "Banco de dados não configurado.", "erro"); return; }

  try {
    const jogoId = jogoAtual.id;
    const palpites = await obterPalpitesDoJogo(jogoId);
    corpo.innerHTML = "";

    if (palpites.length === 0) {
      corpo.innerHTML = `<tr><td colspan="5" class="vazio">Nenhum palpite enviado ainda para este jogo.</td></tr>`;
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

// ── Lembrete de fechamento ─────────────────────────────────

async function enviarLembreteFechamento() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }
  if (!jogoAtual) { alert("Nenhum jogo ativo."); return; }

  const agora = new Date();
  const inicio = new Date(jogoAtual.dataISO);
  const diffMin = Math.round((inicio - agora) / 60000);
  if (diffMin <= 0) { alert("O jogo já começou — os palpites estão fechados."); return; }

  const horas = Math.floor(diffMin / 60);
  const min = diffMin % 60;
  const tempoTexto = horas > 0 ? `${horas}h${min > 0 ? ` e ${min}min` : ""}` : `${min} minuto${min > 1 ? "s" : ""}`;

  let msg = `*BOLAO COPA 2026 - MISSAO HEXA*\n\n`;
  msg += `Faltam *${tempoTexto}* para fechar os palpites!\n\n`;
  msg += `*${jogoAtual.casa} x ${jogoAtual.fora}*\n`;
  msg += `${jogoAtual.dataLabel}\n\n`;
  msg += `Quem ainda nao apostou, corre!\n`;
  msg += `_Tradicional: R$ 5,00 | Premium: R$ 10,00_`;

  abrirLinkWhatsApp(`https://wa.me/${WHATSAPP_ORGANIZADOR}?text=${encodeURIComponent(msg)}`);
}

// ── Mensagem individual para participantes ────────────────

const MENSAGEM_PADRAO_INDIVIDUAL = `📊 RESULTADO FINAL – BRASIL x ESCÓCIA 🇧🇷⚽

🔥 76 apostas realizadas
💰 R$ 445,00 arrecadados

🏆 Tradicional R$5,00, sem restrições.
👥 63 participantes
💰 R$ 315,00 arrecadados
🎉 6 ganhadores – R$ 52,50 para cada

⭐ Premium R$10,00, máximo de 2 apostas no mesmo placar.
👥 13 participantes
💰 R$ 130,00 arrecadados
🎉 2 ganhadores – R$ 65,00 para cada

Obrigado a todos que participaram e fizeram desse bolão um sucesso! 👏🍀

Valeu pela confiança e participação! 🚀⚽`;

let _enviosRealizados = new Set();

async function abrirEnvioMensagemIndividual() {
  if (!_adminLogado) { alert("Acesse o painel do organizador primeiro."); return; }

  const textarea = document.getElementById("textoMensagemIndividual");
  if (textarea && !textarea.value) textarea.value = MENSAGEM_PADRAO_INDIVIDUAL;

  const container = document.getElementById("listaEnvioIndividual");
  if (container) container.innerHTML = `<p class="status-msg">Carregando participantes...</p>`;
  document.body.classList.add("modal-aberto");
  abrirModal("modalEnvioMensagemIndividual");

  const participantes = {};
  try {
    for (const jogo of jogos) {
      const [pt, pp] = await Promise.all([
        obterPalpitesDoJogo(jogo.id),
        obterPalpitesPremiumDoJogo(jogo.id)
      ]);
      [...pt, ...pp].forEach(p => {
        const tel = (p.telefone || "").replace(/\D/g, "").trim();
        if (tel.length >= 10 && !participantes[tel]) {
          participantes[tel] = p.nome || "Participante";
        }
      });
    }
  } catch (e) {
    if (container) container.innerHTML = `<p style="color:#c0392b;font-size:.85rem;">Erro: ${e.message}</p>`;
    return;
  }

  const lista = Object.entries(participantes);
  _atualizarProgressoEnvio(lista.length);

  if (lista.length === 0) {
    if (container) container.innerHTML = `<p class="status-msg">Nenhum participante com telefone cadastrado.</p>`;
    return;
  }

  if (!container) return;
  container.innerHTML = "";
  lista.forEach(([tel, nome]) => {
    const jaEnviado = _enviosRealizados.has(tel);
    const div = document.createElement("div");
    div.id = `envio-${tel}`;
    div.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid var(--borda);margin-bottom:6px;background:" + (jaEnviado ? "#e3f7ed" : "#fff");
    const bgBtn = jaEnviado ? "#aaa" : "#25D366";
    const txtBtn = jaEnviado ? "✅ Enviado" : "📲 Enviar";
    const nomeEsc = sanitize(nome).replace(/'/g, "\\'");
    div.innerHTML = `
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sanitize(nome)}</div>
        <div style="font-size:.75rem;color:#888;">${tel}</div>
      </div>
      <button id="btn-${tel}" onclick="enviarParaUm('${tel}','${nomeEsc}')"
        class="btn" style="padding:6px 10px;font-size:.78rem;flex-shrink:0;width:auto;white-space:nowrap;max-width:90px;text-align:center;background:${bgBtn};">
        ${txtBtn}
      </button>
    `;
    container.appendChild(div);
  });
}

function enviarParaUm(tel, nome) {
  const msg = document.getElementById("textoMensagemIndividual").value.trim();
  if (!msg) { alert("Digite a mensagem antes de enviar."); return; }

  let telFormatado = tel.replace(/\D/g, "");
  if (!telFormatado.startsWith("55")) telFormatado = "55" + telFormatado;

  abrirLinkWhatsApp(`https://wa.me/${telFormatado}?text=${encodeURIComponent(msg)}`);

  _enviosRealizados.add(tel);
  const btn = document.getElementById(`btn-${tel}`);
  const div = document.getElementById(`envio-${tel}`);
  if (btn) { btn.textContent = "✅ Enviado"; btn.style.background = "#aaa"; }
  if (div) { div.style.background = "#e3f7ed"; }

  const totalEl = document.getElementById("totalParticipantes");
  const total = totalEl ? totalEl.textContent : "0";
  _atualizarProgressoEnvio(Number(total));
}

function _atualizarProgressoEnvio(total) {
  const el = document.getElementById("emProgresso");
  if (el) el.innerHTML = `<strong style="color:var(--verde);">${_enviosRealizados.size}</strong> enviados de <span id="totalParticipantes">${total}</span>`;
}

function resetarEnvios() {
  if (!confirm("Resetar o progresso? Os enviados voltarão para 'Pendente'.")) return;
  _enviosRealizados.clear();
  abrirEnvioMensagemIndividual();
}

function fecharEnvioMensagemIndividual() {
  fecharModal("modalEnvioMensagemIndividual");
}

// ── Expõe globalmente ──────────────────────────────────────

window.toggleAdmin                        = toggleAdmin;
window.abrirVisaoGeralAdmin               = abrirVisaoGeralAdmin;
window.fecharVisaoGeralAdmin              = fecharVisaoGeralAdmin;
window.abrirMeuDesempenho                 = abrirMeuDesempenho;
window.fecharMeuDesempenho                = fecharMeuDesempenho;
window.gerarImagemPalpites                = gerarImagemPalpites;
window.baixarImagem                       = baixarImagem;
window.gerarImagemDistribuicao            = gerarImagemDistribuicao;
window.fecharModalDistribuicao            = fecharModalDistribuicao;
window.gerarImagemVitoria                 = gerarImagemVitoria;
window.baixarImagemVitoria                = baixarImagemVitoria;
window.enviarPalpitesWhatsApp             = enviarPalpitesWhatsApp;
window.corrigirPlacarIncorreto            = corrigirPlacarIncorreto;
window.abrirConfirmacoesPix               = abrirConfirmacoesPix;
window.enviarConfirmacaoIndividualWhatsApp = enviarConfirmacaoIndividualWhatsApp;
window.confirmarPagamentoAdmin            = confirmarPagamentoAdmin;
window.desfazerPagamentoAdmin             = desfazerPagamentoAdmin;
window.abrirExclusaoPalpites              = abrirExclusaoPalpites;
window.excluirUmPalpite                   = excluirUmPalpite;
window.excluirTodosPalpites               = excluirTodosPalpites;
window.listarChavesPix                    = listarChavesPix;
window.enviarLembreteFechamento           = enviarLembreteFechamento;
window.abrirEnvioMensagemIndividual       = abrirEnvioMensagemIndividual;
window.enviarParaUm                       = enviarParaUm;
window.resetarEnvios                      = resetarEnvios;
window.fecharEnvioMensagemIndividual      = fecharEnvioMensagemIndividual;
