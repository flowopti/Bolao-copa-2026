/* =========================================================
   UTILS.JS — Utilitários puros (sem efeitos colaterais de DOM/Firebase)
   ========================================================= */

// ── Segurança ─────────────────────────────────────────────

/**
 * Escapa HTML para evitar XSS ao inserir dados do Firebase no DOM.
 * Deve ser aplicado a qualquer string de entrada de usuário antes de innerHTML.
 */
function sanitize(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#x27;");
}

/**
 * Calcula hash SHA-256 de uma string (usado para senha do admin).
 * @returns {Promise<string>} hex string do hash
 */
async function sha256(str) {
  const buf  = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Bandeiras ─────────────────────────────────────────────

/**
 * Retorna tag <img> da bandeira real via flagcdn.com.
 * Fallback para emoji se o país não estiver mapeado.
 */
function bandeiraIMG(nomePt, tamanhoPx) {
  const tam    = tamanhoPx || 20;
  const codigo = codigosISOSelecoes[nomePt];
  if (!codigo) return bandeiras[nomePt] || "🏳️";
  return `<img src="https://flagcdn.com/${tam}x${Math.round(tam * 0.75)}/${codigo}.png"
    alt="${nomePt}" title="${nomePt}"
    style="width:${tam}px;height:${Math.round(tam * 0.75)}px;vertical-align:middle;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.15);"
    onerror="this.outerHTML='🏳️';">`;
}

/**
 * Retorna emoji de bandeira para o chaveamento.
 */
function flagChave(nome) {
  if (!nome) return "❓";
  for (const [k, v] of Object.entries(BANDEIRAS_CHAVEAMENTO)) {
    if (nome.startsWith(k)) return v;
  }
  return "";
}

/**
 * Abrevia nome de seleção para 3 letras (ex: "Brasil" → "BRA").
 */
function abreviarSelecao(nomePt) {
  return siglasSelecoes[nomePt] || nomePt.slice(0, 3).toUpperCase();
}

/**
 * Traduz nome de time em inglês (vindo da API) para português.
 */
function traduzirNomeTime(nomeIngles) {
  const mapa = {
    "Brazil":"Brasil","Morocco":"Marrocos","Haiti":"Haiti","Scotland":"Escócia",
    "Argentina":"Argentina","Spain":"Espanha","France":"França","Germany":"Alemanha",
    "England":"Inglaterra","Portugal":"Portugal","Italy":"Itália","Uruguay":"Uruguai",
    "Mexico":"México","United States":"Estados Unidos","Canada":"Canadá",
    "Netherlands":"Holanda","Belgium":"Bélgica","Croatia":"Croácia","Japan":"Japão",
    "South Korea":"Coreia do Sul","Senegal":"Senegal","Colombia":"Colômbia",
    "Ecuador":"Equador","Chile":"Chile","Peru":"Peru","Paraguay":"Paraguai",
    "Switzerland":"Suíça","Poland":"Polônia","Austria":"Áustria","Denmark":"Dinamarca",
    "Sweden":"Suécia","Norway":"Noruega","Serbia":"Sérvia","Wales":"País de Gales",
    "Ukraine":"Ucrânia","Turkey":"Turquia","Greece":"Grécia","Romania":"Romênia",
    "Czech Republic":"Tchéquia","Slovakia":"Eslováquia","Slovenia":"Eslovênia",
    "Hungary":"Hungria","Finland":"Finlândia","Ireland":"Irlanda",
    "Northern Ireland":"Irlanda do Norte","Iceland":"Islândia",
    "Saudi Arabia":"Arábia Saudita","Iran":"Irã","Iraq":"Iraque","Qatar":"Catar",
    "United Arab Emirates":"Emirados Árabes","Jordan":"Jordânia","Uzbekistan":"Uzbequistão",
    "Australia":"Austrália","New Zealand":"Nova Zelândia",
    "Nigeria":"Nigéria","Egypt":"Egito","Algeria":"Argélia","Tunisia":"Tunísia",
    "Ghana":"Gana","Cameroon":"Camarões","Ivory Coast":"Costa do Marfim",
    "South Africa":"África do Sul","Cape Verde":"Cabo Verde","Mali":"Mali",
    "DR Congo":"RD Congo","Jamaica":"Jamaica","Costa Rica":"Costa Rica",
    "Panama":"Panamá","Honduras":"Honduras","Bolivia":"Bolívia","Venezuela":"Venezuela",
    "Curaçao":"Curaçao","China":"China","India":"Índia","Thailand":"Tailândia","Vietnam":"Vietnã"
  };
  return mapa[nomeIngles] || nomeIngles;
}

// ── Formatação ────────────────────────────────────────────

/**
 * Formata telefone para exibição: 71999998888 → (71) 99999-8888
 */
function formatarTelefoneExibicao(tel) {
  if (!tel) return "";
  const d = tel.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return tel;
}

/**
 * Formata string de data de envio de palpite para exibição na tabela.
 * Aceita ISO 8601 ou formato legado "DD/MM/YYYY HH:MM".
 */
function formatarDataTabela(str) {
  if (!str) return "";
  try {
    const d = new Date(str);
    if (!isNaN(d)) {
      return d.toLocaleString("pt-BR", {
        day:"2-digit", month:"2-digit",
        hour:"2-digit", minute:"2-digit",
        timeZone:"America/Sao_Paulo"
      });
    }
  } catch (_) {}
  return str;
}

// ── Lógica de jogo ────────────────────────────────────────

/**
 * Normaliza nome para comparações (remove acentos, maiúsculas, espaços extras).
 */
function normalizarNome(nome) {
  if (!nome) return "";
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Calcula o "selo de proximidade" de um palpite em relação ao placar real.
 * Retorna objeto { tipo: 'acerto'|'quase'|null, label: string }
 */
function calcularSeloProximidade(palpiteCasa, palpiteFora, realCasa, realFora) {
  const pC = Number(palpiteCasa), pF = Number(palpiteFora);
  const rC = Number(realCasa),    rF = Number(realFora);
  if (isNaN(pC) || isNaN(pF) || isNaN(rC) || isNaN(rF)) return { tipo: null };

  if (pC === rC && pF === rF) return { tipo: "acerto", label: "✅ Acertou!" };

  const diff = Math.abs(pC - rC) + Math.abs(pF - rF);
  if (diff <= 1) return { tipo: "quase", label: "🔥 Quase!" };
  if (diff === 2) return { tipo: "quase", label: "😅 Perto" };
  return { tipo: null };
}

/**
 * Estima minuto do jogo quando a API gratuita não retorna o campo minute.
 * Compensa o atraso de ~10min do plano free da football-data.org.
 */
function estimarMinutoJogo(minutoAPI, dataInicioISO, status) {
  if (minutoAPI !== null && minutoAPI !== undefined) {
    return Math.max(0, minutoAPI - 10);
  }
  if (!dataInicioISO) return null;
  if (status !== "IN_PLAY" && status !== "PAUSED") return null;
  const minutosDecorridos = Math.floor((Date.now() - new Date(dataInicioISO).getTime()) / 60000);
  if (minutosDecorridos < 0 || minutosDecorridos > 130) return null;
  let estimado = minutosDecorridos > 60 ? Math.max(46, minutosDecorridos - 15) : minutosDecorridos;
  if (status === "PAUSED") return 45;
  return Math.min(estimado, 90);
}

/**
 * Formata o status do jogo para exibição (ex: "⚽ 40' 2º tempo").
 */
function formatarStatusTempoJogo(status, minuto, duracaoTempo) {
  if (status === "FINISHED") return "🏁 Encerrado";
  if (status === "PAUSED")   return "⏸️ Intervalo";
  if (status === "IN_PLAY") {
    if (minuto === null || minuto === undefined) return "🔴 Ao vivo";
    if (duracaoTempo === "EXTRA_TIME") {
      return `⚽ ${minuto}' ${minuto > 105 ? "2º tempo (prorrogação)" : "1º tempo (prorrogação)"}`;
    }
    if (duracaoTempo === "PENALTY_SHOOTOUT") return "⚽ Pênaltis";
    const tempoLabel = minuto > 45 ? "2º tempo" : "1º tempo";
    return `⚽ ${minuto}' ${tempoLabel}`;
  }
  return "🔴 Ao vivo";
}

/**
 * Valida se o time é o Brasil (comparação exata com a API).
 */
function ehTimeBrasil(time) {
  if (!time) return false;
  return (time.name || "").trim() === "Brazil";
}

/**
 * Retorna a data de hoje no fuso de Brasília (formato YYYY-MM-DD).
 */
function obterDataHojeBrasilia() {
  return new Date().toLocaleString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 10);
}

// ── Cálculo de prêmio ─────────────────────────────────────

/**
 * Calcula arrecadação total do Bolão Tradicional a partir dos palpites.
 */
function calcularArrecadacao(palpites) {
  return palpites.reduce((acc, p) => {
    const valor = typeof p.valor === "number" ? p.valor : VALOR_BASE;
    return acc + valor;
  }, 0);
}

/**
 * Calcula arrecadação total do Bolão Premium a partir dos palpites.
 */
function calcularArrecadacaoPremium(palpites) {
  return palpites.reduce((acc, p) => {
    const valor = typeof p.valor === "number" ? p.valor : VALOR_PREMIUM_BASE;
    return acc + valor;
  }, 0);
}

// ── UI helpers ─────────────────────────────────────────────

/**
 * Exibe uma mensagem de aviso em um elemento.
 * @param {HTMLElement} el - Elemento com classe .aviso
 * @param {string} msg     - Mensagem a exibir
 * @param {string} tipo    - "sucesso" | "erro" | "info"
 */
function mostrarAviso(el, msg, tipo) {
  if (!el) return;
  el.textContent = msg;
  el.className = `aviso ${tipo}`;
  el.style.display = "block";
}

/**
 * Incrementa/decrementa o valor de um input de placar via os steppers +/-,
 * respeitando min/max e disparando "input" para qualquer listener existente.
 * @param {string} id    - id do <input type="number">
 * @param {number} delta - +1 ou -1
 */
function ajustarPlacar(id, delta) {
  const el = document.getElementById(id);
  if (!el || el.disabled) return;
  const min = Number(el.min || 0);
  const max = Number(el.max || 20);
  let val = Number(el.value || 0) + delta;
  if (val < min) val = min;
  if (val > max) val = max;
  el.value = val;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
window.ajustarPlacar = ajustarPlacar;

/**
 * Abre um link do WhatsApp de forma segura (evita popup blocker).
 */
function abrirLinkWhatsApp(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 200);
}
