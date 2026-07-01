/* =========================================================
   CONFIG.JS — Firebase, constantes, dados dos jogos, bandeiras
   ========================================================= */

// ── Firebase ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyARhoTzyM6hQ4mqoj2nJTVhHSiLTbttYIM",
  authDomain:        "bolao-copa-2026-62ce2.firebaseapp.com",
  databaseURL:       "https://bolao-copa-2026-62ce2-default-rtdb.firebaseio.com",
  projectId:         "bolao-copa-2026-62ce2",
  storageBucket:     "bolao-copa-2026-62ce2.firebasestorage.app",
  messagingSenderId: "786905311142",
  appId:             "1:786905311142:web:613640614a54f310ded167"
};

let db        = null;
let firebaseOk = false;

try {
  if (typeof firebase !== "undefined") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    firebaseOk = true;
  }
} catch (e) {
  console.error("Erro ao iniciar Firebase:", e);
  firebaseOk = false;
}

// ── Regras financeiras ────────────────────────────────────
const VALOR_BASE          = 5;    // R$ palpite Trad (rodada normal)
const VALOR_NOVO          = 10;   // R$ palpite Trad (acúmulo ou 2ª aposta)
const VALOR_PREMIUM_BASE  = 10;   // R$ palpite Premium (sem acúmulo)
const VALOR_PREMIUM_NOVO  = 20;   // R$ palpite Premium (com acúmulo ou extra)
const LIMITE_PALPITES_IGUAIS = 999; // sem limite global no Tradicional
const LIMITE_PESSOAS_POR_PLACAR_PREMIUM = 2;

// ── Chaves PIX (QR codes estáticos) ──────────────────────
const PIX_5           = "00020101021126550014br.gov.bcb.pix0114+55719966440390215Bolao COPA 202652040000530398654045.005802BR5923CAIQUE A V V DA S ELEUT6008SALVADOR62070503***6304D4A0";
const PIX_10          = "00020101021126550014br.gov.bcb.pix0114+55719966440390215Bolao COPA 2026520400005303986540510.005802BR5923CAIQUE A V V DA S ELEUT6008SALVADOR62070503***63044FA1";
const PIX_PREMIUM_10  = "00020101021126530014br.gov.bcb.pix0114+55719966440390213Bolao premium520400005303986540510.005802BR5923CAIQUE A V V DA S ELEUT6008SALVADOR62070503***630423AF";
const PIX_PREMIUM_20  = "00020101021126630014br.gov.bcb.pix0114+55719966440390223Bolao premium acumulado520400005303986540520.005802BR5923CAIQUE A V V DA S ELEUT6008SALVADOR62070503***6304395F";

// ── Segurança / admin ─────────────────────────────────────
// SHA-256 da senha do organizador (a senha original não fica exposta no código)
const SENHA_ADMIN_HASH = "28f1bc44f01ff58f63bf85b66e6ba16b51d748433681808ad63ba169af0b2428";
let _adminLogado = false;

// ── Links externos ────────────────────────────────────────
const LINK_GRUPO_WHATSAPP = "https://chat.whatsapp.com/HT3yhvnm60k5Ma3gB9kt9n?mode=gi_t";
const WHATSAPP_ORGANIZADOR = "5571996644039";

// ── API de futebol ────────────────────────────────────────
const FOOTBALL_API_TOKEN      = "743ae839e04d44d9bcdf18203b6f01c0";
const FOOTBALL_API_COMPETICAO = 2000; // FIFA World Cup
const FOOTBALL_API_PROXY      = "https://corsproxy.io/?url=";

// ── Janelas de tempo ──────────────────────────────────────
const HORAS_ESPERA_APOS_CONFIRMACAO = 12 * 60 * 60 * 1000; // 12h em ms

// ── Dados dos jogos do Brasil ─────────────────────────────
const jogos = [
  {
    id:              "j1",
    fase:            "Grupo C - 1ª rodada",
    dataISO:         "2026-06-13T19:00:00-03:00",
    dataLabel:       "13/06/2026 às 19h (Brasília)",
    casa:            "Brasil",
    fora:            "Marrocos",
    placarCasa:      1,
    placarFora:      1,
    dataConfirmada:  true
  },
  {
    id:              "j2",
    fase:            "Grupo C - 2ª rodada",
    dataISO:         "2026-06-19T21:30:00-03:00",
    dataLabel:       "19/06/2026 às 21h30 (Brasília)",
    casa:            "Brasil",
    fora:            "Haiti",
    placarCasa:      3,
    placarFora:      0,
    dataConfirmada:  true
  },
  {
    id:              "j3",
    fase:            "Grupo C - 3ª rodada",
    dataISO:         "2026-06-24T19:00:00-03:00",
    dataLabel:       "24/06/2026 às 19h (Brasília)",
    casa:            "Brasil",
    fora:            "Escócia",
    placarCasa:      3,
    placarFora:      0,
    dataConfirmada:  true
  },
  {
    id:              "j4",
    fase:            "16avos de Final",
    dataISO:         "2026-06-29T14:00:00-03:00",
    dataLabel:       "29/06/2026 às 14h (Brasília) · Houston",
    casa:            "Brasil",
    fora:            "Japão",
    placarCasa:      null,
    placarFora:      null,
    dataConfirmada:  true
  }
];

// Rastreia quando cada data foi confirmada via API
let _dataConfirmacaoJogos = {}; // { jogoId: timestamp }

// ── Bandeiras (emoji) ─────────────────────────────────────
const bandeiras = {
  "Brasil":"🇧🇷","Marrocos":"🇲🇦","Haiti":"🇭🇹",
  "Escócia":'<span class="bandeira-css bandeira-escocia" title="Escócia"></span>',
  "Argentina":"🇦🇷","Espanha":"🇪🇸","França":"🇫🇷","Alemanha":"🇩🇪",
  "Inglaterra":'<span class="bandeira-css bandeira-inglaterra" title="Inglaterra"></span>',
  "Portugal":"🇵🇹","Itália":"🇮🇹","Uruguai":"🇺🇾","México":"🇲🇽",
  "Estados Unidos":"🇺🇸","Canadá":"🇨🇦","Holanda":"🇳🇱","Bélgica":"🇧🇪",
  "Croácia":"🇭🇷","Japão":"🇯🇵","Coreia do Sul":"🇰🇷","Senegal":"🇸🇳",
  "Colômbia":"🇨🇴","Equador":"🇪🇨","Chile":"🇨🇱","Peru":"🇵🇪",
  "Paraguai":"🇵🇾","Suíça":"🇨🇭","Polônia":"🇵🇱","Áustria":"🇦🇹",
  "Dinamarca":"🇩🇰","Suécia":"🇸🇪","Noruega":"🇳🇴","Sérvia":"🇷🇸",
  "País de Gales":'<span class="bandeira-css bandeira-gales" title="País de Gales"></span>',
  "Ucrânia":"🇺🇦","Turquia":"🇹🇷","Grécia":"🇬🇷","Romênia":"🇷🇴",
  "Tchéquia":"🇨🇿","Eslováquia":"🇸🇰","Eslovênia":"🇸🇮","Hungria":"🇭🇺",
  "Finlândia":"🇫🇮","Irlanda":"🇮🇪",
  "Irlanda do Norte":'<span class="bandeira-css bandeira-inglaterra" title="Irlanda do Norte"></span>',
  "Islândia":"🇮🇸","Arábia Saudita":"🇸🇦","Irã":"🇮🇷","Iraque":"🇮🇶",
  "Catar":"🇶🇦","Emirados Árabes":"🇦🇪","Jordânia":"🇯🇴","Uzbequistão":"🇺🇿",
  "Austrália":"🇦🇺","Nova Zelândia":"🇳🇿","Nigéria":"🇳🇬","Egito":"🇪🇬",
  "Argélia":"🇩🇿","Tunísia":"🇹🇳","Gana":"🇬🇭","Camarões":"🇨🇲",
  "Costa do Marfim":"🇨🇮","África do Sul":"🇿🇦","Cabo Verde":"🇨🇻","Mali":"🇲🇱",
  "RD Congo":"🇨🇩","Jamaica":"🇯🇲","Costa Rica":"🇨🇷","Panamá":"🇵🇦",
  "Honduras":"🇭🇳","Bolívia":"🇧🇴","Venezuela":"🇻🇪","Curaçao":"🇨🇼",
  "China":"🇨🇳","Índia":"🇮🇳","Tailândia":"🇹🇭","Vietnã":"🇻🇳",
  "A definir":"🏳️"
};

// Versão texto-puro para canvas
const bandeirasTexto = {
  ...bandeiras,
  "Escócia":"(ESC)", "Inglaterra":"(ENG)",
  "País de Gales":"(GAL)", "Irlanda do Norte":"(IRN)"
};

// Códigos ISO para flagcdn.com
const codigosISOSelecoes = {
  "Brasil":"br","Marrocos":"ma","Haiti":"ht","Escócia":"gb-sct","Argentina":"ar",
  "Espanha":"es","França":"fr","Alemanha":"de","Inglaterra":"gb-eng","Portugal":"pt",
  "Itália":"it","Uruguai":"uy","México":"mx","Estados Unidos":"us","Canadá":"ca",
  "Holanda":"nl","Bélgica":"be","Croácia":"hr","Japão":"jp","Coreia do Sul":"kr",
  "Senegal":"sn","Colômbia":"co","Equador":"ec","Chile":"cl","Peru":"pe",
  "Paraguai":"py","Suíça":"ch","Polônia":"pl","Áustria":"at","Dinamarca":"dk",
  "Suécia":"se","Noruega":"no","Sérvia":"rs","País de Gales":"gb-wls","Ucrânia":"ua",
  "Turquia":"tr","Grécia":"gr","Romênia":"ro","Tchéquia":"cz","Eslováquia":"sk",
  "Eslovênia":"si","Hungria":"hu","Finlândia":"fi","Irlanda":"ie",
  "Irlanda do Norte":"gb-nir","Islândia":"is","Arábia Saudita":"sa","Irã":"ir",
  "Iraque":"iq","Catar":"qa","Emirados Árabes":"ae","Jordânia":"jo",
  "Uzbequistão":"uz","Austrália":"au","Nova Zelândia":"nz","Nigéria":"ng",
  "Egito":"eg","Argélia":"dz","Tunísia":"tn","Gana":"gh","Camarões":"cm",
  "Costa do Marfim":"ci","África do Sul":"za","Cabo Verde":"cv","Mali":"ml",
  "RD Congo":"cd","Jamaica":"jm","Costa Rica":"cr","Panamá":"pa","Honduras":"hn",
  "Bolívia":"bo","Venezuela":"ve","Curaçao":"cw","China":"cn","Índia":"in",
  "Tailândia":"th","Vietnã":"vn"
};

// Siglas de 3 letras para poster/canvas
const siglasSelecoes = {
  "Brasil":"BRA","Marrocos":"MAR","Haiti":"HAI","Escócia":"ESC","Argentina":"ARG",
  "Espanha":"ESP","França":"FRA","Alemanha":"ALE","Inglaterra":"ING","Portugal":"POR",
  "Itália":"ITA","Uruguai":"URU","México":"MEX","Estados Unidos":"EUA","Canadá":"CAN",
  "Holanda":"HOL","Bélgica":"BEL","Croácia":"CRO","Japão":"JAP","Coreia do Sul":"COR",
  "Senegal":"SEN","Colômbia":"COL","Equador":"EQU","Chile":"CHI","Peru":"PER",
  "Paraguai":"PAR","Suíça":"SUI","Polônia":"POL","Áustria":"AUT","Dinamarca":"DIN",
  "Suécia":"SUE","Noruega":"NOR","Sérvia":"SER","País de Gales":"GAL","Ucrânia":"UCR",
  "Turquia":"TUR","Grécia":"GRE","Romênia":"ROM","Tchéquia":"TCH","Eslováquia":"ESV",
  "Eslovênia":"ESN","Hungria":"HUN","Finlândia":"FIN","Irlanda":"IRL",
  "Irlanda do Norte":"IRN","Islândia":"ISL","Arábia Saudita":"KSA","Irã":"IRA",
  "Iraque":"IRQ","Catar":"QAT","Emirados Árabes":"UAE","Jordânia":"JOR",
  "Uzbequistão":"UZB","Austrália":"AUS","Nova Zelândia":"NZL","Nigéria":"NIG",
  "Egito":"EGI","Argélia":"ARL","Tunísia":"TUN","Gana":"GHA","Camarões":"CAM",
  "Costa do Marfim":"CIV","África do Sul":"RSA","Cabo Verde":"CPV","Mali":"MLI",
  "RD Congo":"COD","Jamaica":"JAM","Costa Rica":"CRC","Panamá":"PAN","Honduras":"HON",
  "Bolívia":"BOL","Venezuela":"VEN","Curaçao":"CUW","China":"CHN","Índia":"IND",
  "Tailândia":"THA","Vietnã":"VIE","A definir":"---"
};

// Nomes de fase da API → português
const NOMES_FASE_API = {
  "GROUP_STAGE":      "Fase de Grupos",
  "LAST_32":          "16avos de Final",
  "LAST_16":          "Oitavas de Final",
  "QUARTER_FINALS":   "Quartas de Final",
  "SEMI_FINALS":      "Semifinal",
  "THIRD_PLACE":      "Disputa de 3º lugar",
  "FINAL":            "Final"
};

// Bandeiras para o chaveamento
const BANDEIRAS_CHAVEAMENTO = {
  "Brasil":"🇧🇷","Japão":"🇯🇵","Alemanha":"🇩🇪","Holanda":"🇳🇱",
  "Marrocos":"🇲🇦","Costa do Marfim":"🇨🇮","México":"🇲🇽","Argentina":"🇦🇷",
  "Estados Unidos":"🇺🇸","Bósnia":"🇧🇦","França":"🇫🇷","Noruega":"🇳🇴",
  "Espanha":"🇪🇸","Colômbia":"🇨🇴","Portugal":"🇵🇹","Inglaterra":"🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Suíça":"🇨🇭","Austrália":"🇦🇺","África do Sul":"🇿🇦","Canadá":"🇨🇦",
  "Uruguai":"🇺🇾","Croácia":"🇭🇷","Dinamarca":"🇩🇰","Senegal":"🇸🇳",
  "Irã":"🇮🇷","Equador":"🇪🇨","Coreia do Sul":"🇰🇷",
  "A definir":"❓","Vencedor":"❓"
};
