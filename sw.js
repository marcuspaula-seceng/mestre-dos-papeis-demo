/* Gerado por scripts/montar-demo.js — não editar à mão. Demonstração: dados fictícios no navegador. */

importScripts("/mestre-dos-papeis-demo/vendor/sql-wasm.js");

/*
 * Substitutos dos módulos do Node para rodar o MESMO servidor dentro do navegador (service worker).
 * Usado só pela demonstração estática do GitHub Pages. Nada aqui é proteção real:
 * a "senha" é um resumo simples e os dados ficam no navegador de quem abre a demonstração.
 */
/* global SQL */

/* ── Buffer mínimo (só o que o servidor usa) ───────────── */
class Buffer extends Uint8Array {
  static from(x, enc) {
    if (typeof x === 'string') {
      if (enc === 'base64' || enc === 'base64url') {
        const s = x.replace(/[\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
        let bin;
        try { bin = atob(s + '==='.slice((s.length + 3) % 4)); } catch { bin = ''; }
        const b = new Buffer(bin.length);
        for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
        return b;
      }
      if (enc === 'latin1' || enc === 'binary') { const b = new Buffer(x.length); for (let i = 0; i < x.length; i++) b[i] = x.charCodeAt(i) & 255; return b; }
      if (enc === 'hex') { const b = new Buffer(x.length >> 1); for (let i = 0; i < b.length; i++) b[i] = parseInt(x.substr(i * 2, 2), 16); return b; }
      const u = new TextEncoder().encode(x); const b = new Buffer(u.length); b.set(u); return b;
    }
    if (x instanceof ArrayBuffer) return new Buffer(x);
    const b = new Buffer(x.length); b.set(x); return b;
  }
  static concat(lista) { const t = lista.reduce((a, x) => a + x.length, 0); const b = new Buffer(t); let o = 0; for (const x of lista) { b.set(x, o); o += x.length; } return b; }
  static isBuffer(x) { return x instanceof Buffer; }
  equals(o) { if (o.length !== this.length) return false; for (let i = 0; i < o.length; i++) if (o[i] !== this[i]) return false; return true; }
  toString(enc) {
    if (enc === 'hex') return Array.from(this, (v) => v.toString(16).padStart(2, '0')).join('');
    if (enc === 'latin1' || enc === 'binary') { let s = ''; for (let i = 0; i < this.length; i++) s += String.fromCharCode(this[i]); return s; }
    if (enc === 'base64' || enc === 'base64url') {
      let s = ''; for (let i = 0; i < this.length; i += 0x8000) s += String.fromCharCode.apply(null, this.subarray(i, i + 0x8000));
      const r = btoa(s);
      return enc === 'base64' ? r : r.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return new TextDecoder().decode(this);
  }
}

/* ── SHA-256 síncrono ──────────────────────────────────── */
const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d,
  0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
function sha256bytes(msg) {
  const l = msg.length; const n = ((l + 9 + 63) >> 6) << 6; const m = new Uint8Array(n); m.set(msg); m[l] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(n - 4, (l * 8) >>> 0); dv.setUint32(n - 8, Math.floor(l / 0x20000000));
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rot = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rot(W[i - 15], 7) ^ rot(W[i - 15], 18) ^ (W[i - 15] >>> 3); const s1 = rot(W[i - 2], 17) ^ rot(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Buffer(32); const ov = new DataView(out.buffer); H.forEach((v, i) => ov.setUint32(i * 4, v)); return out;
}
const bytes = (x) => (typeof x === 'string' ? Buffer.from(x) : x);

/* ── node:crypto ───────────────────────────────────────── */
const cryptoShim = {
  randomBytes(n) { const b = new Buffer(n); self.crypto.getRandomValues(b); return b; },
  randomUUID: () => self.crypto.randomUUID(),
  createHash() { const partes = []; return { update(x) { partes.push(bytes(x)); return this; }, digest(enc) { const r = sha256bytes(Buffer.concat(partes)); return enc ? r.toString(enc) : r; } }; },
  createHmac(_alg, chave) { const partes = [bytes(chave)]; return { update(x) { partes.push(bytes(x)); return this; }, digest(enc) { return sha256bytes(Buffer.concat(partes)).toString(enc); } }; },
  /* DEMONSTRAÇÃO: não é scrypt. Serve só para o login de mentira funcionar. */
  scryptSync(senha, sal) { const a = sha256bytes(Buffer.concat([bytes(sal), bytes(String(senha))])); return Buffer.concat([a, sha256bytes(a)]); },
  timingSafeEqual(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]); },
};

/* ── node:path (sempre "/") ────────────────────────────── */
const pathShim = {
  sep: '/',
  join: (...p) => p.filter(Boolean).join('/').replace(/\/+/g, '/'),
  resolve: (...p) => pathShim.join(...p),
  basename: (p) => String(p).split(/[\\/]/).pop(),
  dirname: (p) => String(p).split('/').slice(0, -1).join('/') || '/',
  extname: (p) => { const m = String(p).match(/\.[^./\\]*$/); return m ? m[0] : ''; },
};

/* ── node:fs em memória (gravado no IndexedDB pelo service worker) ── */
const ARQS = new Map();
const fsShim = {
  ARQS,
  mkdirSync() {},
  existsSync: (p) => ARQS.has(p),
  writeFileSync(p, dado, opc) {
    if (opc && opc.flag === 'wx' && ARQS.has(p)) throw new Error('EEXIST');
    ARQS.set(p, Buffer.from(typeof dado === 'string' ? Buffer.from(dado) : dado));
  },
  readFileSync(p) { if (!ARQS.has(p)) throw new Error('ENOENT'); return ARQS.get(p); },
  createReadStream(p) { return { pipe(res) { res.end(ARQS.get(p)); } }; },
  copyFileSync(a, b) { ARQS.set(b, ARQS.get(a)); },
  readdirSync() { return []; },
  constants: { COPYFILE_EXCL: 1 },
};

/* ── node:sqlite sobre sql.js ──────────────────────────── */
class Instrucao {
  constructor(db, sql) { this.db = db; this.sql = sql; }
  _ligar(st, a) {
    if (!a.length) return;
    if (a.length === 1 && a[0] && typeof a[0] === 'object' && !(a[0] instanceof Uint8Array)) {
      const o = {};
      for (const [k, v] of Object.entries(a[0])) o[/^[:$@]/.test(k) ? k : ':' + k] = v === undefined ? null : v;
      st.bind(o);
    } else st.bind(a.map((v) => (v === undefined ? null : v)));
  }
  get(...a) { const st = this.db.prepare(this.sql); try { this._ligar(st, a); return st.step() ? st.getAsObject() : undefined; } finally { st.free(); } }
  all(...a) { const st = this.db.prepare(this.sql); try { this._ligar(st, a); const r = []; while (st.step()) r.push(st.getAsObject()); return r; } finally { st.free(); } }
  run(...a) {
    const st = this.db.prepare(this.sql);
    try { this._ligar(st, a); st.step(); } finally { st.free(); }
    return { changes: this.db.getRowsModified(), lastInsertRowid: this.db.exec('SELECT last_insert_rowid()')[0].values[0][0] };
  }
}
class DatabaseSync {
  constructor() { this.db = new SQL.Database(self.__MDP_BANCO || undefined); DatabaseSync.atual = this.db; }
  exec(sql) { this.db.exec(sql); }
  prepare(sql) { return new Instrucao(this.db, sql); }
  close() {}
}

self.Buffer = Buffer;
self.process = self.process || { env: {} };
const SHIMS = { 'node:fs': fsShim, 'node:path': pathShim, 'node:crypto': cryptoShim, 'node:sqlite': { DatabaseSync } };



const MODULOS = {}; const CACHE = {};
for (const k of Object.keys(SHIMS)) CACHE[k] = { exports: SHIMS[k] };
function resolver(de, n) {
  if (n.startsWith('node:')) return n;
  const partes = de.split('/').slice(0, -1);
  for (const p of n.split('/')) { if (p === '..') partes.pop(); else if (p !== '.') partes.push(p); }
  return partes.join('/').replace(/\.js$/, '');
}
function exigir(id) {
  if (CACHE[id]) return CACHE[id].exports;
  if (!MODULOS[id]) throw new Error('módulo ausente na demonstração: ' + id);
  const m = { exports: {} }; CACHE[id] = m;
  MODULOS[id](m, m.exports, (n) => exigir(resolver(id, n)));
  return m.exports;
}

MODULOS["src/util"] = function (module, exports, require) {
'use strict';
/* Utilitários sem dependência: datas no fuso de Asunción, validação e senha. */
const crypto = require('node:crypto');

const FUSO = 'America/Asuncion';
const MOEDAS = ['PYG', 'BRL', 'USD'];

class ErroHttp extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

const fmtData = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false });

function hoje(agora) { return fmtData.format(agora || new Date()); }
function horaAgora(agora) { return fmtHora.format(agora || new Date()); }
function agoraIso() { return new Date().toISOString(); }

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
function dataValida(s) {
  if (typeof s !== 'string' || !RE_DATA.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
function addDias(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function addMeses(s, n) {
  const [a, m, dia] = s.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString().slice(0, 10);
}
/* b − a, em dias */
function difDias(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

/* ── validação de entrada ─────────────────────────────── */
function texto(v, rotulo, { obrigatorio = false, max = 500 } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') v = String(v);
  v = v.trim();
  if (obrigatorio && !v) throw new ErroHttp(400, `Preencha: ${rotulo}.`);
  if (v.length > max) throw new ErroHttp(400, `${rotulo}: texto longo demais (máximo ${max}).`);
  return v || null;
}
function data(v, rotulo, { obrigatorio = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (obrigatorio) throw new ErroHttp(400, `Informe a data: ${rotulo}.`);
    return null;
  }
  if (!dataValida(v)) throw new ErroHttp(400, `Data inválida: ${rotulo}.`);
  return v;
}
function inteiro(v, rotulo, { obrigatorio = false, min = 0, max = 1e12 } = {}) {
  if (v === undefined || v === null || v === '') {
    if (obrigatorio) throw new ErroHttp(400, `Informe: ${rotulo}.`);
    return null;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ErroHttp(400, `Valor inválido: ${rotulo}.`);
  return n;
}
function bool(v) { return v === true || v === 1 || v === '1' || v === 'sim' ? 1 : 0; }
function umDe(v, lista, rotulo, { obrigatorio = true } = {}) {
  if ((v === undefined || v === null || v === '') && !obrigatorio) return null;
  if (!lista.includes(v)) throw new ErroHttp(400, `Opção inválida: ${rotulo}.`);
  return v;
}
function moeda(v) { return umDe(v, MOEDAS, 'moeda'); }
function hora(v) {
  if (!v) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new ErroHttp(400, 'Hora inválida.');
  return v;
}
function whatsapp(v) {
  const t = texto(v, 'WhatsApp', { obrigatorio: true, max: 30 });
  const digitos = t.replace(/\D/g, '');
  if (!t.startsWith('+') || digitos.length < 8 || digitos.length > 15) {
    throw new ErroHttp(400, 'WhatsApp deve começar com + e o código do país (ex.: +55 45 99999-0000).');
  }
  return '+' + digitos;
}
function email(v) {
  const t = texto(v, 'E-mail', { max: 200 });
  if (t && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw new ErroHttp(400, 'E-mail inválido.');
  return t;
}
function json(v, padrao) { try { return v ? JSON.parse(v) : padrao; } catch { return padrao; } }

/* ── senha e token ────────────────────────────────────── */
function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(senha, sal, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${sal.toString('hex')}$${h.toString('hex')}`;
}
function conferirSenha(senha, guardado) {
  const [alg, salHex, hHex] = String(guardado || '').split('$');
  if (alg !== 'scrypt' || !salHex || !hHex) return false;
  const h = crypto.scryptSync(String(senha), Buffer.from(salHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const esperado = Buffer.from(hHex, 'hex');
  return esperado.length === h.length && crypto.timingSafeEqual(esperado, h);
}
function validarSenhaNova(s) {
  if (typeof s !== 'string' || s.length < 10) throw new ErroHttp(400, 'A senha precisa ter pelo menos 10 caracteres.');
  return s;
}
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const tokenAleatorio = () => crypto.randomBytes(32).toString('base64url');

module.exports = {
  FUSO, MOEDAS, ErroHttp, hoje, horaAgora, agoraIso, dataValida, addDias, addMeses, difDias,
  texto, data, inteiro, bool, umDe, moeda, hora, whatsapp, email, json,
  hashSenha, conferirSenha, validarSenhaNova, sha256, tokenAleatorio,
};

};

MODULOS["src/catalogo"] = function (module, exports, require) {
'use strict';
/*
 * Modelos iniciais, todos editáveis em Configurações.
 * Vêm da rotina descrita por Daniel em áudio (23/10/2026). Isso é rotina de trabalho,
 * não texto de lei: nenhum prazo de validade de certidão foi inventado, e o único prazo
 * pré-preenchido é a estimativa de 90 dias da residência, marcada como estimativa.
 */
const { agoraIso } = require('./util');

const CIDADES = ['Ciudad del Este', 'Pedro Juan Caballero', 'Santa Rita', 'Encarnación', 'Asunción'];

const TIPOS = [
  ['foto_rosto', 'Foto do rosto', 0, null],
  ['rg', 'RG', 0, null],
  ['passaporte', 'Passaporte', 1, null],
  ['cert_nascimento', 'Certidão de nascimento', 0, 'Validade não é pré-definida. Alguns órgãos pedem emissão recente: configure no serviço.'],
  ['cert_casamento', 'Certidão de casamento', 0, 'Quando o estado civil exigir.'],
  ['cert_divorcio', 'Certidão de divórcio', 0, 'Quando o estado civil exigir.'],
  ['ant_pf', 'Antecedentes da Polícia Federal (Brasil)', 0, 'Apostilado no Brasil.'],
  ['ant_interpol', 'Antecedentes da Interpol', 0, null],
  ['ant_pn', 'Antecedentes da Polícia Nacional (Paraguai)', 0, null],
  ['entrada_pais', 'Comprovante de entrada no país', 0, null],
  ['vacina', 'Certificado de vacinação (febre amarela)', 0, 'Quando aplicável.'],
  ['registro_estrangeiro', 'Registro de Estrangeiro', 0, null],
  ['residencia', 'Documento de residência', 1, 'Emitido pela Migração.'],
  ['radicacion', 'Radicación', 0, 'Entregue pela Migração junto com a residência.'],
  ['cedula', 'Cédula de identidade paraguaia', 1, null],
  ['cnh_origem', 'Carteira de motorista do país de origem', 1, 'Quando aplicável.'],
  ['carteira_py', 'Carteira de motorista paraguaia', 1, null],
  ['ruc', 'Comprovante de RUC', 0, null],
];

/* [nome, marco, explicação simples para o cliente] */
const ET = (nomes) => nomes.map((n) => {
  const [nome, marco = null, descricao = null] = Array.isArray(n) ? n : [n];
  return { nome, marco, descricao };
});

const ETAPAS_RESIDENCIA = ET([
  ['Contato', null, 'Conversa inicial para entender o seu caso.'],
  ['Pagamento inicial', null, 'Confirmação do início do serviço.'],
  ['Coleta de documentos', null, 'Reunião dos documentos pessoais e certidões.'],
  ['Preparação, apostilamento e autenticação', null, 'A equipe prepara, apostila e autentica o que for necessário.'],
  ['Agendamento', null, 'Marcação da ida à Migração.'],
  ['Protocolo na Migração', 'protocolo', 'Entrega do pedido na Migração.'],
  ['Aguardando emissão', null, 'O órgão analisa e emite o documento. O prazo é uma estimativa.'],
  ['Recebido', 'recebido', 'O documento foi emitido e está com a equipe.'],
  ['Entregue ao cliente', 'entregue', 'Documento entregue a você.'],
]);

const ETAPAS_CEDULA = ET([
  'Contato', 'Pagamento inicial', 'Atualização de documentos', 'Registro de Estrangeiro',
  ['Protocolo da cédula', 'protocolo'], 'Aguardando emissão', ['Recebido', 'recebido'], ['Entregue ao cliente', 'entregue'],
]);

const ETAPAS_EMPRESA = ET([
  'Contato', 'Pagamento inicial', 'Coleta de documentos', 'Preparação',
  ['Protocolo', 'protocolo'], 'Aguardando emissão', ['Recebido', 'recebido'], ['Entregue ao cliente', 'entregue'],
]);

const ETAPAS_CARTEIRA = ET([
  'Contato', 'Pagamento inicial', 'Documentos', ['Atendimento no órgão', 'protocolo'],
  ['Recebido', 'recebido'], ['Entregue ao cliente', 'entregue'],
]);

/* [codigo do tipo, opcional] */
const CK_RESIDENCIA = [
  ['foto_rosto'], ['rg'], ['passaporte', 1], ['cert_nascimento'], ['ant_pf'], ['ant_interpol'],
  ['ant_pn'], ['entrada_pais'], ['vacina', 1],
];

const SERVICOS = [
  { codigo: 'res_temp', nome: 'Residência temporária', grupo: 'Residência', prazo: 90,
    modalidades: ['Padrão', 'Investidor (somente Asunción)'], etapas: ETAPAS_RESIDENCIA, ck: CK_RESIDENCIA,
    resultante: 'residencia', segue: ['cedula'],
    nota: 'A taxa da Migração muda conforme a modalidade. Prazo de 90 dias é estimativa inicial.' },
  { codigo: 'res_perm', nome: 'Residência permanente', grupo: 'Residência', prazo: 90,
    modalidades: ['Padrão', 'Investidor (somente Asunción)'], etapas: ETAPAS_RESIDENCIA,
    ck: [...CK_RESIDENCIA, ['residencia']], resultante: 'residencia', segue: ['cedula'],
    nota: 'Requisitos devem ser conferidos na fonte oficial da Migração.' },
  { codigo: 'res_renov', nome: 'Renovação de residência', grupo: 'Residência', prazo: 90,
    modalidades: ['Padrão'], etapas: ETAPAS_RESIDENCIA, ck: [['rg'], ['residencia'], ['ant_interpol'], ['ant_pn']],
    resultante: 'residencia', segue: [],
    nota: 'Lista inicial; confirme os requisitos de renovação na fonte oficial.' },
  { codigo: 'cedula', nome: 'Cédula de identidade paraguaia', grupo: 'Identidade', prazo: null,
    modalidades: ['Padrão'], etapas: ETAPAS_CEDULA,
    ck: [['rg'], ['passaporte', 1], ['cert_nascimento'], ['ant_pf'], ['ant_interpol'], ['ant_pn'],
      ['registro_estrangeiro'], ['residencia'], ['radicacion']],
    resultante: 'cedula', segue: [],
    nota: 'Antecedentes vencidos ou antigos devem ser pedidos de novo. Prazo de emissão não pré-definido: informe por cidade.' },
  { codigo: 'empresa', nome: 'RUC e abertura de empresa', grupo: 'Empresa', prazo: null,
    modalidades: ['Somente RUC', 'Empresa unipersonal', 'Sociedade Anônima (SA)', 'Outro tipo'],
    etapas: ETAPAS_EMPRESA, ck: [['cedula'], ['rg', 1]], resultante: 'ruc', segue: [], nota: null },
  { codigo: 'cnh_temp', nome: 'Carteira de motorista temporária', grupo: 'Carteira de motorista', prazo: null,
    modalidades: ['Carro e moto (temporária)'], etapas: ETAPAS_CARTEIRA,
    ck: [['residencia'], ['cnh_origem']], resultante: 'carteira_py', segue: [],
    nota: 'Rotina relatada: feita com a residência e a carteira do país de origem. Confirme validade e categorias na fonte oficial.' },
  { codigo: 'cnh', nome: 'Carteira de motorista', grupo: 'Carteira de motorista', prazo: null,
    modalidades: ['Carro', 'Moto', 'Carro e moto'], etapas: ETAPAS_CARTEIRA,
    ck: [['cedula']], resultante: 'carteira_py', segue: [],
    nota: 'Rotina relatada: feita com a cédula. Confirme validade e categorias na fonte oficial.' },
];

const MODELOS_MSG = [
  ['aniversario', 'Aniversário', 'Olá, {nome}! A equipe Mestre dos Papéis deseja um feliz aniversário.'],
  ['vencimento', 'Documento perto do vencimento', 'Olá, {nome}. O seu documento {documento} vence em {data}. Fale conosco para organizarmos a renovação com antecedência.'],
  ['agendamento', 'Agendamento', 'Olá, {nome}. Confirmamos o seu atendimento em {data}{hora}{local}. Qualquer mudança, avise por aqui.'],
  ['documento', 'Documento disponível', 'Olá, {nome}. O seu documento {documento} já está disponível. Vamos combinar a entrega?'],
];

const CONFIG = {
  alertas_documento_dias: '120,90,30',
  alertas_assinatura_dias: '30,7',
  alerta_parcela_dias: '3',
  hora_envio: '09:00',
  janela_vencimentos_dias: '120',
};

function semearCatalogo(b) {
  for (const c of CIDADES) b.exec('INSERT OR IGNORE INTO cidades (nome) VALUES (:n)', { n: c });
  const idTipo = {};
  for (const [codigo, nome, val, nota] of TIPOS) {
    b.exec('INSERT OR IGNORE INTO doc_tipos (codigo, nome, tem_validade, nota) VALUES (:c, :n, :v, :o)',
      { c: codigo, n: nome, v: val, o: nota });
    idTipo[codigo] = b.um('SELECT id FROM doc_tipos WHERE codigo = :c', { c: codigo }).id;
  }
  for (const s of SERVICOS) {
    const checklist = s.ck.map(([t, opc]) => ({ tipo_id: idTipo[t], opcional: opc ? 1 : 0, exige_recente_dias: null, nota: null }));
    b.exec(`INSERT OR IGNORE INTO servicos (codigo, nome, grupo, modalidades, etapas, checklist, prazo_dias, doc_resultante_id, segue_para, nota)
            VALUES (:codigo, :nome, :grupo, :mod, :et, :ck, :prazo, :res, :segue, :nota)`, {
      codigo: s.codigo, nome: s.nome, grupo: s.grupo, mod: JSON.stringify(s.modalidades), et: JSON.stringify(s.etapas),
      ck: JSON.stringify(checklist), prazo: s.prazo, res: idTipo[s.resultante] || null,
      segue: JSON.stringify(s.segue), nota: s.nota,
    });
  }
  for (const [codigo, nome, texto] of MODELOS_MSG) {
    b.exec('INSERT OR IGNORE INTO modelos_mensagem (codigo, nome, texto) VALUES (:c, :n, :t)', { c: codigo, n: nome, t: texto });
  }
  for (const [k, v] of Object.entries(CONFIG)) b.exec('INSERT OR IGNORE INTO config (chave, valor) VALUES (:k, :v)', { k, v });
  b.meta('catalogo_semeado_em', agoraIso());
}

/*
 * Perguntas frequentes iniciais: só sobre o atendimento e a plataforma, sem prometer prazo,
 * resultado ou requisito legal. Editáveis em Configurações → Site.
 */
const FAQ = [
  ['Como recebo acesso à Área do cliente?', 'Depois do primeiro atendimento, a equipe cadastra você e envia um convite para ativar o acesso. No convite, você cria a sua senha.'],
  ['O que aparece na Área do cliente?', 'Os seus processos, a etapa em que cada um está, o que ainda falta, o próximo passo, as datas registradas pela equipe e os documentos que a equipe liberou para você.'],
  ['As informações são atualizadas em tempo real?', 'A Área do cliente mostra as atualizações registradas pela equipe. Ela não tem ligação automática com os sistemas dos órgãos públicos. Quando a equipe registra uma novidade, ela aparece para você.'],
  ['A previsão de conclusão é garantida?', 'Não. A previsão é uma estimativa e pode mudar conforme o órgão, a cidade e o caso. Datas confirmadas aparecem identificadas como confirmadas.'],
  ['Como tiro uma dúvida sobre o meu processo?', 'Na Área do cliente, abra "Dúvidas", escolha o processo ou "Dúvida geral" e escreva a sua mensagem. A equipe responde no horário de atendimento.'],
  ['Esqueci a minha senha. O que faço?', 'Na tela de entrada, use "Esqueci a senha". A equipe recebe o pedido e envia um novo link de acesso pelo contato cadastrado.'],
  ['Os meus documentos ficam públicos?', 'Não. Cada cliente vê apenas os próprios processos e os arquivos que a equipe liberou para ele.'],
];

const CONFIG_SITE = {
  site_whatsapp: '', site_telefone: '', site_email: '', site_endereco: '', site_instagram: '', site_youtube: '',
  site_dominio: '', site_mascote: '', horario_atendimento: '',
};

function semearPortal(b) {
  if (!b.um('SELECT 1 AS x FROM faq LIMIT 1')) {
    FAQ.forEach(([p, r], i) => b.exec('INSERT INTO faq (pergunta, resposta, ordem) VALUES (:p, :r, :o)', { p, r, o: i + 1 }));
  }
  for (const [k, v] of Object.entries(CONFIG_SITE)) b.exec('INSERT OR IGNORE INTO config (chave, valor) VALUES (:k, :v)', { k, v });
  b.meta('portal_semeado_em', agoraIso());
}

module.exports = { semearCatalogo, semearPortal };

};

MODULOS["src/db"] = function (module, exports, require) {
'use strict';
/* Banco SQLite (node:sqlite, embutido no Node). Um arquivo por instalação. */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { semearCatalogo, semearPortal } = require('./catalogo');

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash TEXT NOT NULL, perfil TEXT NOT NULL CHECK (perfil IN ('admin','atendente')),
  ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS sessoes (
  token_hash TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  expira_em TEXT NOT NULL, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS cidades (id INTEGER PRIMARY KEY, nome TEXT NOT NULL UNIQUE, ativo INTEGER NOT NULL DEFAULT 1);

CREATE TABLE IF NOT EXISTS doc_tipos (
  id INTEGER PRIMARY KEY, codigo TEXT UNIQUE, nome TEXT NOT NULL,
  tem_validade INTEGER NOT NULL DEFAULT 0, nota TEXT, ativo INTEGER NOT NULL DEFAULT 1);

CREATE TABLE IF NOT EXISTS servicos (
  id INTEGER PRIMARY KEY, codigo TEXT UNIQUE, nome TEXT NOT NULL, grupo TEXT,
  modalidades TEXT NOT NULL DEFAULT '[]',   -- ["Padrão", ...]
  etapas TEXT NOT NULL DEFAULT '[]',        -- [{nome, marco}] marco: protocolo|recebido|entregue|null
  checklist TEXT NOT NULL DEFAULT '[]',     -- [{tipo_id, opcional, exige_recente_dias, nota}]
  prazo_dias INTEGER, prazos_cidade TEXT NOT NULL DEFAULT '{}',
  doc_resultante_id INTEGER REFERENCES doc_tipos(id),
  segue_para TEXT NOT NULL DEFAULT '[]',    -- códigos de serviço sugeridos depois do recebimento
  nota TEXT, ativo INTEGER NOT NULL DEFAULT 1);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL, whatsapp TEXT NOT NULL, email TEXT, nascimento TEXT,
  nacionalidade TEXT, documento_tipo TEXT, documento_numero TEXT, estado_civil TEXT,
  perfil_comercial TEXT, responsavel_id INTEGER REFERENCES usuarios(id), cidade_id INTEGER REFERENCES cidades(id),
  observacoes TEXT, aceita_mensagens INTEGER NOT NULL DEFAULT 0, mensagens_tipos TEXT NOT NULL DEFAULT '[]',
  preferencias TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS arquivos (
  id INTEGER PRIMARY KEY, chave TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, mime TEXT NOT NULL,
  tamanho INTEGER NOT NULL, sha256 TEXT NOT NULL, cliente_id INTEGER REFERENCES clientes(id),
  criado_por INTEGER REFERENCES usuarios(id), criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS documentos (
  id INTEGER PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  tipo_id INTEGER NOT NULL REFERENCES doc_tipos(id), versao INTEGER NOT NULL,
  emissao TEXT, validade TEXT, original INTEGER NOT NULL DEFAULT 0, copia INTEGER NOT NULL DEFAULT 0,
  apostilado INTEGER NOT NULL DEFAULT 0, autenticado INTEGER NOT NULL DEFAULT 0,
  arquivo_id INTEGER REFERENCES arquivos(id), observacoes TEXT, substituido_em TEXT,
  criado_por INTEGER, criado_em TEXT NOT NULL, UNIQUE (cliente_id, tipo_id, versao));

CREATE TABLE IF NOT EXISTS processos (
  id INTEGER PRIMARY KEY, numero TEXT NOT NULL UNIQUE, cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  servico_id INTEGER NOT NULL REFERENCES servicos(id), modalidade TEXT, cidade_id INTEGER REFERENCES cidades(id),
  responsavel_id INTEGER REFERENCES usuarios(id), etapas TEXT NOT NULL, etapa_idx INTEGER NOT NULL DEFAULT 0,
  proxima_acao TEXT, protocolo_numero TEXT, protocolo_data TEXT, prazo_dias INTEGER, previsao TEXT,
  recebido_em TEXT, entregue_em TEXT, documento_resultado_id INTEGER REFERENCES documentos(id),
  situacao TEXT NOT NULL DEFAULT 'andamento' CHECK (situacao IN ('andamento','concluido','cancelado')),
  origem_id INTEGER REFERENCES processos(id), vinculo TEXT,
  prioridade_justificativa TEXT, prioridade_arquivo_id INTEGER REFERENCES arquivos(id),
  observacoes TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS checklist (
  id INTEGER PRIMARY KEY, processo_id INTEGER NOT NULL REFERENCES processos(id),
  tipo_id INTEGER NOT NULL REFERENCES doc_tipos(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','solicitado','recebido','nao_aplicavel')),
  documento_id INTEGER REFERENCES documentos(id), exige_recente_dias INTEGER, opcional INTEGER NOT NULL DEFAULT 0,
  nota TEXT, responsavel_id INTEGER REFERENCES usuarios(id), solicitado_em TEXT, observacoes TEXT,
  UNIQUE (processo_id, tipo_id));

CREATE TABLE IF NOT EXISTS pacotes (
  id INTEGER PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id), nome TEXT NOT NULL,
  servicos TEXT NOT NULL DEFAULT '[]', observacoes TEXT, anulado INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS parcelas (
  id INTEGER PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id), processo_id INTEGER REFERENCES processos(id),
  descricao TEXT NOT NULL, moeda TEXT NOT NULL, valor INTEGER NOT NULL CHECK (valor > 0), vencimento TEXT NOT NULL,
  anulada INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS lancamentos (
  id INTEGER PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id), processo_id INTEGER REFERENCES processos(id),
  pacote_id INTEGER REFERENCES pacotes(id), parcela_id INTEGER REFERENCES parcelas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('honorario','taxa','custo','desconto','pagamento')),
  descricao TEXT NOT NULL, moeda TEXT NOT NULL, valor INTEGER NOT NULL CHECK (valor > 0), data TEXT NOT NULL,
  forma TEXT, arquivo_id INTEGER REFERENCES arquivos(id), moeda_original TEXT, valor_original INTEGER, cambio_nota TEXT,
  adicional_justificativa TEXT, prioridade_oficial INTEGER NOT NULL DEFAULT 0,
  anulado_em TEXT, anulado_motivo TEXT, criado_por INTEGER, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS agenda (
  id INTEGER PRIMARY KEY, tipo TEXT NOT NULL CHECK (tipo IN ('atendimento','tarefa')), titulo TEXT NOT NULL,
  data TEXT NOT NULL, hora TEXT, local TEXT, cliente_id INTEGER REFERENCES clientes(id), processo_id INTEGER REFERENCES processos(id),
  responsavel_id INTEGER REFERENCES usuarios(id), concluido_em TEXT, cancelado INTEGER NOT NULL DEFAULT 0,
  avisar_cliente INTEGER NOT NULL DEFAULT 0, observacoes TEXT, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS assinaturas (
  id INTEGER PRIMARY KEY, tipo TEXT NOT NULL CHECK (tipo IN ('dominio','assinatura','outro')), nome TEXT NOT NULL,
  fornecedor TEXT, vencimento TEXT NOT NULL, periodicidade TEXT NOT NULL CHECK (periodicidade IN ('mensal','anual','unica')),
  moeda TEXT, valor INTEGER, responsavel_id INTEGER REFERENCES usuarios(id), confirmado INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT, ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS lembretes (
  id INTEGER PRIMARY KEY, chave TEXT NOT NULL UNIQUE, tipo TEXT NOT NULL, titulo TEXT NOT NULL, detalhe TEXT,
  data_aviso TEXT NOT NULL, data_alvo TEXT, cliente_id INTEGER, processo_id INTEGER, ref TEXT NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','visto','cancelado')),
  criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS modelos_mensagem (
  id INTEGER PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, texto TEXT NOT NULL,
  modelo_aprovado TEXT, idioma TEXT NOT NULL DEFAULT 'pt_BR');

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY, chave TEXT NOT NULL UNIQUE, cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  modelo_codigo TEXT NOT NULL, texto TEXT NOT NULL, parametros TEXT NOT NULL DEFAULT '[]', destino TEXT NOT NULL,
  enviar_em TEXT NOT NULL, ref TEXT NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'pendente' CHECK (situacao IN
    ('pendente','aberta_manual','manual_informado','aceita','entregue','lida','falhou','cancelada')),
  tentativas INTEGER NOT NULL DEFAULT 0, proxima_tentativa TEXT, ultimo_erro TEXT, id_externo TEXT,
  criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS mensagem_eventos (
  id INTEGER PRIMARY KEY, mensagem_id INTEGER NOT NULL REFERENCES mensagens(id), em TEXT NOT NULL,
  evento TEXT NOT NULL, detalhe TEXT, usuario_id INTEGER);

CREATE TABLE IF NOT EXISTS historico (
  id INTEGER PRIMARY KEY, em TEXT NOT NULL, usuario_id INTEGER, entidade TEXT NOT NULL, entidade_id INTEGER,
  cliente_id INTEGER, acao TEXT NOT NULL, detalhe TEXT);

CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);

/* ── área do cliente ── */
CREATE TABLE IF NOT EXISTS contas_cliente (
  id INTEGER PRIMARY KEY, cliente_id INTEGER NOT NULL UNIQUE REFERENCES clientes(id), email TEXT UNIQUE COLLATE NOCASE,
  senha_hash TEXT, ativo INTEGER NOT NULL DEFAULT 1, ativado_em TEXT, ultimo_acesso TEXT,
  preferencias TEXT NOT NULL DEFAULT '{}', criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS tokens_cliente (
  id INTEGER PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('ativacao','recuperacao')), token_hash TEXT NOT NULL UNIQUE,
  expira_em TEXT NOT NULL, usado_em TEXT, cancelado_em TEXT, criado_por INTEGER, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS sessoes_cliente (
  token_hash TEXT PRIMARY KEY, conta_id INTEGER NOT NULL REFERENCES contas_cliente(id), expira_em TEXT NOT NULL, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS pedidos_cliente (
  id INTEGER PRIMARY KEY, cliente_id INTEGER REFERENCES clientes(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('recuperacao','contato')), campo TEXT, valor TEXT,
  situacao TEXT NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente','atendido','recusado')),
  decidido_por INTEGER, decidido_em TEXT, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS publicacoes (
  id INTEGER PRIMARY KEY, processo_id INTEGER NOT NULL REFERENCES processos(id), cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  texto TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'automatica' CHECK (tipo IN ('automatica','manual')),
  criado_por INTEGER, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS liberacoes (
  id INTEGER PRIMARY KEY, arquivo_id INTEGER NOT NULL REFERENCES arquivos(id), cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  processo_id INTEGER REFERENCES processos(id), titulo TEXT NOT NULL, liberado_por INTEGER, liberado_em TEXT NOT NULL,
  revogado_em TEXT, revogado_por INTEGER);

CREATE TABLE IF NOT EXISTS duvidas (
  id INTEGER PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id), processo_id INTEGER REFERENCES processos(id),
  assunto TEXT NOT NULL, categoria TEXT,
  situacao TEXT NOT NULL DEFAULT 'enviada' CHECK (situacao IN ('enviada','em_atendimento','respondida','encerrada')),
  lida_cliente_em TEXT, lida_equipe_em TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS duvida_mensagens (
  id INTEGER PRIMARY KEY, duvida_id INTEGER NOT NULL REFERENCES duvidas(id),
  autor TEXT NOT NULL CHECK (autor IN ('cliente','equipe')), usuario_id INTEGER, texto TEXT NOT NULL,
  chave TEXT UNIQUE, criado_em TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS notificacoes_cliente (
  id INTEGER PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id), tipo TEXT NOT NULL, titulo TEXT NOT NULL,
  link TEXT, chave TEXT UNIQUE, criado_em TEXT NOT NULL, lida_em TEXT);

CREATE TABLE IF NOT EXISTS faq (
  id INTEGER PRIMARY KEY, pergunta TEXT NOT NULL, resposta TEXT NOT NULL, ordem INTEGER NOT NULL DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1);

CREATE INDEX IF NOT EXISTS ix_pub_proc ON publicacoes(processo_id);
CREATE INDEX IF NOT EXISTS ix_lib_cliente ON liberacoes(cliente_id);
CREATE INDEX IF NOT EXISTS ix_duv_cliente ON duvidas(cliente_id);
CREATE INDEX IF NOT EXISTS ix_dmsg ON duvida_mensagens(duvida_id);
CREATE INDEX IF NOT EXISTS ix_notif ON notificacoes_cliente(cliente_id, lida_em);

CREATE INDEX IF NOT EXISTS ix_proc_cliente ON processos(cliente_id);
CREATE INDEX IF NOT EXISTS ix_doc_cliente ON documentos(cliente_id, tipo_id);
CREATE INDEX IF NOT EXISTS ix_check_proc ON checklist(processo_id);
CREATE INDEX IF NOT EXISTS ix_lanc_cliente ON lancamentos(cliente_id);
CREATE INDEX IF NOT EXISTS ix_hist_cliente ON historico(cliente_id, em);
CREATE INDEX IF NOT EXISTS ix_lemb ON lembretes(situacao, data_aviso);
CREATE INDEX IF NOT EXISTS ix_msg ON mensagens(situacao, enviar_em);
CREATE INDEX IF NOT EXISTS ix_agenda ON agenda(data);
`;

function abrirBanco(pasta) {
  fs.mkdirSync(path.join(pasta, 'arquivos'), { recursive: true });
  const db = new DatabaseSync(path.join(pasta, 'mestre-dos-papeis.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(ESQUEMA);
  /* colunas acrescentadas depois da primeira versão: só ADD COLUMN, nunca remove */
  const NOVAS = [
    ['processos', 'cliente_proximo_passo', 'TEXT'], ['processos', 'cliente_quem', 'TEXT'], ['processos', 'cliente_orientacoes', 'TEXT'],
    ['processos', 'mostrar_responsavel', 'INTEGER NOT NULL DEFAULT 0'], ['processos', 'etapas_datas', "TEXT NOT NULL DEFAULT '{}'"],
    ['processos', 'atualizado_cliente_em', 'TEXT'], ['checklist', 'orientacao_cliente', 'TEXT'],
    ['agenda', 'visivel_cliente', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [t, c, def] of NOVAS) {
    if (!db.prepare(`PRAGMA table_info(${t})`).all().some((x) => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`);
  }

  const b = {
    raw: db,
    pasta,
    um: (sql, p = {}) => db.prepare(sql).get(p),
    todos: (sql, p = {}) => db.prepare(sql).all(p),
    exec: (sql, p = {}) => db.prepare(sql).run(p),
    tx(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const r = fn(); db.exec('COMMIT'); return r; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    meta(chave, valor) {
      if (valor === undefined) return db.prepare('SELECT valor FROM meta WHERE chave = ?').get(chave)?.valor;
      db.prepare('INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').run(chave, String(valor));
    },
    config(chave) { return db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave)?.valor; },
    fechar() { db.close(); },
  };
  if (!b.um('SELECT 1 AS x FROM servicos LIMIT 1')) b.tx(() => semearCatalogo(b));
  if (!b.meta('portal_semeado_em')) b.tx(() => semearPortal(b));
  return b;
}

module.exports = { abrirBanco };

};

MODULOS["src/regras"] = function (module, exports, require) {
'use strict';
/* Cálculos derivados: nada aqui grava no banco. */
const { addDias, difDias, json } = require('./util');

const br = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');

function catalogo(b) {
  const servicos = new Map(b.todos('SELECT * FROM servicos ORDER BY grupo, nome').map((s) => [s.id, {
    ...s, modalidades: json(s.modalidades, []), etapas: json(s.etapas, []), checklist: json(s.checklist, []),
    prazos_cidade: json(s.prazos_cidade, {}), segue_para: json(s.segue_para, []),
  }]));
  const tipos = new Map(b.todos('SELECT * FROM doc_tipos ORDER BY nome').map((t) => [t.id, t]));
  const cidades = new Map(b.todos('SELECT * FROM cidades ORDER BY nome').map((c) => [c.id, c]));
  const usuarios = new Map(b.todos('SELECT id, nome, perfil, ativo FROM usuarios').map((u) => [u.id, u]));
  return { servicos, tipos, cidades, usuarios };
}

function prazoSugerido(serv, cidadeId) {
  const porCidade = serv.prazos_cidade?.[String(cidadeId)];
  if (Number.isInteger(porCidade) && porCidade > 0) return porCidade;
  return serv.prazo_dias || null;
}

/*
 * Situação de um item do checklist. "Vencido" separa os dois casos:
 * validade do documento terminou, ou o processo exige emissão recente e a emissão é antiga.
 * A data de referência é a do protocolo (o que foi entregue valeu naquele dia), senão hoje.
 */
function statusItem(item, doc, dataRef) {
  if (item.status === 'nao_aplicavel') return { codigo: 'nao_aplicavel', rotulo: 'Não se aplica' };
  if (doc) {
    if (doc.validade && doc.validade < dataRef) {
      return { codigo: 'vencido', rotulo: 'Vencido', motivo: `Validade terminou em ${br(doc.validade)}` };
    }
    if (item.exige_recente_dias) {
      if (!doc.emissao) {
        return { codigo: 'recebido', rotulo: 'Recebido', motivo: 'Falta a data de emissão para conferir se é recente', aviso: true };
      }
      if (addDias(doc.emissao, item.exige_recente_dias) < dataRef) {
        return { codigo: 'vencido', rotulo: 'Emissão antiga',
          motivo: `Este processo pede emissão de até ${item.exige_recente_dias} dias; emitido em ${br(doc.emissao)}` };
      }
    }
    return { codigo: 'recebido', rotulo: 'Recebido' };
  }
  if (item.status === 'solicitado') {
    return { codigo: 'solicitado', rotulo: 'Solicitado', motivo: item.solicitado_em ? `Pedido em ${br(item.solicitado_em)}` : null };
  }
  return { codigo: 'pendente', rotulo: item.opcional ? 'Pendente (se aplicável)' : 'Pendente' };
}

function proximaAutomatica(p, faltam, atrasado) {
  if (p.situacao === 'cancelado') return 'Processo cancelado';
  if (p.situacao === 'concluido') return 'Concluído';
  if (p.recebido_em && !p.entregue_em) return 'Entregar o documento ao cliente';
  if (p.protocolo_data) {
    return atrasado ? 'Previsão ultrapassada: pedir posição ao órgão'
      : `Aguardar emissão${p.previsao ? ` (previsão ${br(p.previsao)})` : ''}`;
  }
  if (faltam.length) {
    const f = faltam[0];
    const verbo = f.st.codigo === 'solicitado' ? 'Cobrar' : f.st.codigo === 'vencido' ? 'Pedir novo' : 'Obter';
    return `${verbo}: ${f.tipo_nome}${faltam.length > 1 ? ` e mais ${faltam.length - 1}` : ''}`;
  }
  return 'Agendar e registrar o protocolo';
}

function montarProcessos(b, cat, procs, hj) {
  if (!procs.length) return [];
  const ids = procs.map((p) => Number(p.id)).join(',');
  const itens = b.todos(`SELECT * FROM checklist WHERE processo_id IN (${ids}) ORDER BY id`);
  const docIds = [...new Set(itens.map((i) => i.documento_id).concat(procs.map((p) => p.documento_resultado_id)).filter(Boolean))];
  const docs = new Map(docIds.length ? b.todos(`SELECT * FROM documentos WHERE id IN (${docIds.map(Number).join(',')})`).map((d) => [d.id, d]) : []);
  return procs.map((p) => montarProcesso(p, cat, itens.filter((i) => i.processo_id === p.id), docs, hj));
}

function montarProcesso(p, cat, itens, docs, hj) {
  const serv = cat.servicos.get(p.servico_id) || { nome: '(serviço removido)', segue_para: [] };
  const etapas = json(p.etapas, []);
  const dataRef = p.protocolo_data || hj;
  const lista = itens.map((i) => {
    const doc = i.documento_id ? docs.get(i.documento_id) || null : null;
    return { ...i, tipo_nome: cat.tipos.get(i.tipo_id)?.nome || '(tipo removido)', doc, st: statusItem(i, doc, dataRef) };
  });
  const aberto = p.situacao === 'andamento' && !p.recebido_em;
  const faltam = aberto ? lista.filter((i) => !i.opcional && ['pendente', 'solicitado', 'vencido'].includes(i.st.codigo)) : [];
  const atrasado = p.situacao === 'andamento' && !!p.previsao && !p.recebido_em && p.previsao < hj;
  const auto = proximaAutomatica(p, faltam, atrasado);
  return {
    ...p,
    etapas,
    etapa_nome: etapas[p.etapa_idx]?.nome || '',
    servico_nome: serv.nome,
    servico_grupo: serv.grupo,
    cidade_nome: cat.cidades.get(p.cidade_id)?.nome || '',
    responsavel_nome: cat.usuarios.get(p.responsavel_id)?.nome || '',
    itens: lista,
    faltam: faltam.map((f) => ({ id: f.id, nome: f.tipo_nome, situacao: f.st.rotulo })),
    atrasado,
    dias_para_previsao: p.previsao && !p.recebido_em ? difDias(hj, p.previsao) : null,
    proxima: p.situacao === 'andamento' && p.proxima_acao ? p.proxima_acao : auto,
    proxima_automatica: auto,
    documento_resultado: p.documento_resultado_id ? docs.get(p.documento_resultado_id) || null : null,
    segue_para: (serv.segue_para || []).map((codigo) => [...cat.servicos.values()].find((s) => s.codigo === codigo)).filter(Boolean)
      .map((s) => ({ id: s.id, nome: s.nome })),
  };
}

function financeiroCliente(b, clienteId, hj) {
  const lancamentos = b.todos('SELECT * FROM lancamentos WHERE cliente_id = :c ORDER BY data, id', { c: clienteId });
  const parcelas = b.todos('SELECT * FROM parcelas WHERE cliente_id = :c ORDER BY vencimento, id', { c: clienteId });
  const pacotes = b.todos('SELECT * FROM pacotes WHERE cliente_id = :c ORDER BY id', { c: clienteId })
    .map((p) => ({ ...p, servicos: json(p.servicos, []) }));
  const saldos = {};
  for (const l of lancamentos) {
    if (l.anulado_em) continue;
    const s = (saldos[l.moeda] ||= { honorarios: 0, taxas: 0, custos: 0, descontos: 0, recebido: 0 });
    if (l.tipo === 'honorario') s.honorarios += l.valor;
    else if (l.tipo === 'taxa') s.taxas += l.valor;
    else if (l.tipo === 'custo') s.custos += l.valor;
    else if (l.tipo === 'desconto') s.descontos += l.valor;
    else if (l.tipo === 'pagamento') s.recebido += l.valor;
  }
  for (const s of Object.values(saldos)) {
    s.cobrado = s.honorarios + s.taxas + s.custos - s.descontos;
    s.saldo = s.cobrado - s.recebido;
  }
  const parcelasOut = parcelas.map((p) => {
    const pago = lancamentos.filter((l) => l.parcela_id === p.id && l.tipo === 'pagamento' && !l.anulado_em)
      .reduce((a, l) => a + l.valor, 0);
    let situacao;
    if (p.anulada) situacao = 'Anulada';
    else if (pago >= p.valor) situacao = 'Paga';
    else if (p.vencimento < hj) situacao = pago ? 'Vencida (paga em parte)' : 'Vencida';
    else situacao = pago ? 'Paga em parte' : 'A vencer';
    return { ...p, pago, falta: Math.max(0, p.valor - pago), situacao };
  });
  return { lancamentos, parcelas: parcelasOut, pacotes, saldos };
}

module.exports = { br, catalogo, prazoSugerido, statusItem, montarProcessos, financeiroCliente };

};

MODULOS["src/arquivos"] = function (module, exports, require) {
'use strict';
/*
 * Anexos privados. Ficam em <dados>/arquivos com nome aleatório e sem extensão,
 * fora da pasta pública. Só saem por /api/arquivos/:id, que exige sessão válida.
 * O tipo é decidido pelos primeiros bytes do arquivo, não pelo nome nem pelo que o navegador diz.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ErroHttp, agoraIso, sha256 } = require('./util');

const LIMITE = 8 * 1024 * 1024;

function detectarTipo(buf) {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

function limparNome(nome) {
  const base = path.basename(String(nome || 'arquivo')).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').trim();
  return (base || 'arquivo').slice(0, 120);
}

/* arquivo = { nome, base64 } vindo do formulário */
function salvarArquivo(b, arquivo, clienteId, usuarioId) {
  if (!arquivo || typeof arquivo.base64 !== 'string') throw new ErroHttp(400, 'Arquivo ausente.');
  const buf = Buffer.from(arquivo.base64.replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length) throw new ErroHttp(400, 'Arquivo vazio.');
  if (buf.length > LIMITE) throw new ErroHttp(413, 'Arquivo maior que 8 MB.');
  const mime = detectarTipo(buf);
  if (!mime) throw new ErroHttp(415, 'Envie PDF ou imagem (JPG, PNG ou WEBP).');
  const chave = crypto.randomBytes(18).toString('hex');
  fs.writeFileSync(path.join(b.pasta, 'arquivos', chave), buf, { flag: 'wx' });
  const r = b.exec(`INSERT INTO arquivos (chave, nome, mime, tamanho, sha256, cliente_id, criado_por, criado_em)
    VALUES (:chave, :nome, :mime, :tam, :sha, :cli, :u, :em)`, {
    chave, nome: limparNome(arquivo.nome), mime, tam: buf.length, sha: sha256(buf), cli: clienteId ?? null, u: usuarioId ?? null, em: agoraIso(),
  });
  return Number(r.lastInsertRowid);
}

function caminhoArquivo(b, chave) {
  if (!/^[0-9a-f]{36}$/.test(chave)) return null;
  return path.join(b.pasta, 'arquivos', chave);
}

module.exports = { salvarArquivo, caminhoArquivo, detectarTipo, LIMITE };

};

MODULOS["src/lembretes"] = function (module, exports, require) {
'use strict';
/*
 * Lembretes internos e mensagens ao cliente.
 *
 * Cada aviso tem uma CHAVE que inclui a data de que ele depende (ex.: a validade).
 * Recalcular é idempotente: chave existente não é recriada, então não há aviso duplicado;
 * chave que deixou de valer (validade mudou, parcela paga, documento substituído) é
 * marcada "cancelado" — nunca apagada. Mensagens já enviadas não são tocadas.
 */
const { hoje, horaAgora, addDias, agoraIso, json } = require('./util');
const { br } = require('./regras');

function listaDias(txt, padrao) {
  const v = String(txt || padrao).split(',').map((x) => parseInt(x, 10)).filter((n) => n > 0 && n < 3650);
  return [...new Set(v)].sort((a, b) => b - a);
}

function aniversarioProximo(nasc, hj) {
  const ano = Number(hj.slice(0, 4));
  const mmdd = nasc.slice(5);
  const em = (a) => {
    if (mmdd === '02-29' && !((a % 4 === 0 && a % 100 !== 0) || a % 400 === 0)) return `${a}-02-28`;
    return `${a}-${mmdd}`;
  };
  return em(ano) >= hj ? em(ano) : em(ano + 1);
}

function aceita(c, tipo) {
  return c.aceita_mensagens === 1 && json(c.mensagens_tipos, []).includes(tipo) && !!c.whatsapp;
}

function renderizar(modelo, vars) {
  return modelo.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

/* Avisos escalonados (ex.: 120, 90 e 30 dias antes). Mantém os futuros e só o mais recente já devido. */
function escalonar(alvo, offsets, hj) {
  const datas = offsets.map((o) => ({ o, aviso: addDias(alvo, -o) }));
  const devidos = datas.filter((x) => x.aviso <= hj);
  const atual = devidos.length ? devidos.reduce((a, x) => (x.o < a.o ? x : a)) : null;
  return { futuros: datas.filter((x) => x.aviso > hj), atual };
}

function gerar(b, agora = new Date()) {
  const hj = hoje(agora);
  const L = new Map();
  const M = new Map();
  const offDoc = listaDias(b.config('alertas_documento_dias'), '120,90,30');
  const offAss = listaDias(b.config('alertas_assinatura_dias'), '30,7');
  const diasParc = parseInt(b.config('alerta_parcela_dias') || '3', 10) || 0;
  const modelos = new Map(b.todos('SELECT * FROM modelos_mensagem').map((m) => [m.codigo, m]));

  const msg = (chave, c, codigo, vars, enviar_em, ref) => {
    const m = modelos.get(codigo);
    if (!m) return;
    const v = { nome: c.nome, ...vars };
    M.set(chave, { cliente_id: c.id, modelo_codigo: codigo, texto: renderizar(m.texto, v),
      parametros: JSON.stringify(PARAMETROS[codigo].map((k) => v[k + '_param'] ?? v[k] ?? '')),
      destino: c.whatsapp, enviar_em, ref });
  };

  /* documentos (só a versão atual de cada tipo) */
  const docs = b.todos(`SELECT d.id, d.validade, d.cliente_id, t.nome AS tipo_nome, c.nome, c.whatsapp, c.aceita_mensagens, c.mensagens_tipos
      FROM documentos d JOIN doc_tipos t ON t.id = d.tipo_id JOIN clientes c ON c.id = d.cliente_id
      WHERE d.substituido_em IS NULL AND d.validade IS NOT NULL`);
  for (const d of docs) {
    const ref = `doc:${d.id}`;
    if (d.validade < hj) {
      if (d.validade >= addDias(hj, -90)) {
        L.set(`vencido:doc:${d.id}:${d.validade}`, { tipo: 'vencimento', ref, cliente_id: d.cliente_id,
          titulo: `${d.tipo_nome} de ${d.nome} venceu em ${br(d.validade)}`, data_aviso: d.validade, data_alvo: d.validade,
          detalhe: 'Documento vencido.' });
      }
      continue;
    }
    const { futuros, atual } = escalonar(d.validade, offDoc, hj);
    for (const x of [...futuros, ...(atual ? [atual] : [])]) {
      L.set(`venc:doc:${d.id}:${d.validade}:${x.o}`, { tipo: 'vencimento', ref, cliente_id: d.cliente_id,
        titulo: `${d.tipo_nome} de ${d.nome} vence em ${br(d.validade)}`, data_aviso: x.aviso, data_alvo: d.validade,
        detalhe: `Aviso de ${x.o} dias. Este aviso não significa que a renovação já esteja legalmente disponível.` });
    }
    if (atual && aceita(d, 'vencimento')) {
      msg(`venc:doc:${d.id}:${d.validade}:${atual.o}`, { id: d.cliente_id, nome: d.nome, whatsapp: d.whatsapp }, 'vencimento',
        { documento: d.tipo_nome, data: br(d.validade) }, atual.aviso, ref);
    }
  }

  /* previsão de conclusão */
  for (const p of b.todos(`SELECT p.id, p.numero, p.previsao, p.cliente_id, c.nome, s.nome AS servico FROM processos p
      JOIN clientes c ON c.id = p.cliente_id JOIN servicos s ON s.id = p.servico_id
      WHERE p.situacao = 'andamento' AND p.previsao IS NOT NULL AND p.recebido_em IS NULL`)) {
    L.set(`prev:proc:${p.id}:${p.previsao}`, { tipo: 'previsao', ref: `proc:${p.id}`, cliente_id: p.cliente_id, processo_id: p.id,
      titulo: `Previsão de ${p.servico} de ${p.nome} (${p.numero}): ${br(p.previsao)}`, data_aviso: p.previsao, data_alvo: p.previsao,
      detalhe: 'Previsão é estimativa, não garantia.' });
  }

  /* aniversários */
  for (const c of b.todos('SELECT id, nome, nascimento, whatsapp, aceita_mensagens, mensagens_tipos FROM clientes WHERE nascimento IS NOT NULL')) {
    const dia = aniversarioProximo(c.nascimento, hj);
    const chave = `aniv:cli:${c.id}:${dia}`;
    L.set(chave, { tipo: 'aniversario', ref: `cli:${c.id}`, cliente_id: c.id, titulo: `Aniversário de ${c.nome}`,
      data_aviso: dia, data_alvo: dia, detalhe: null });
    if (dia === hj && aceita(c, 'aniversario')) msg(chave, c, 'aniversario', {}, hj, `cli:${c.id}`);
  }

  /* parcelas em aberto */
  for (const p of b.todos(`SELECT p.*, c.nome, (SELECT COALESCE(SUM(valor),0) FROM lancamentos l
        WHERE l.parcela_id = p.id AND l.tipo = 'pagamento' AND l.anulado_em IS NULL) AS pago
      FROM parcelas p JOIN clientes c ON c.id = p.cliente_id WHERE p.anulada = 0`)) {
    if (p.pago >= p.valor) continue;
    L.set(`parc:${p.id}:${p.vencimento}`, { tipo: 'parcela', ref: `parc:${p.id}`, cliente_id: p.cliente_id,
      titulo: `Parcela de ${p.nome}: ${p.descricao} — vence ${br(p.vencimento)}`, data_aviso: addDias(p.vencimento, -diasParc),
      data_alvo: p.vencimento, detalhe: null });
  }

  /* domínio e assinaturas do negócio */
  for (const a of b.todos('SELECT * FROM assinaturas WHERE ativo = 1')) {
    const nome = `${a.nome}${a.confirmado ? '' : ' (dado a confirmar)'}`;
    const ref = `ass:${a.id}`;
    if (a.vencimento < hj) {
      L.set(`assvencida:${a.id}:${a.vencimento}`, { tipo: 'assinatura', ref, titulo: `${nome} venceu em ${br(a.vencimento)}`,
        data_aviso: a.vencimento, data_alvo: a.vencimento, detalhe: 'Renove ou desative o cadastro.' });
      continue;
    }
    const { futuros, atual } = escalonar(a.vencimento, offAss, hj);
    for (const x of [...futuros, ...(atual ? [atual] : [])]) {
      L.set(`ass:${a.id}:${a.vencimento}:${x.o}`, { tipo: 'assinatura', ref, titulo: `${nome} vence em ${br(a.vencimento)}`,
        data_aviso: x.aviso, data_alvo: a.vencimento, detalhe: a.fornecedor ? `Fornecedor: ${a.fornecedor}` : null });
    }
  }

  /* mensagens de agendamento e de documento disponível */
  for (const g of b.todos(`SELECT g.*, c.nome, c.whatsapp, c.aceita_mensagens, c.mensagens_tipos FROM agenda g
      JOIN clientes c ON c.id = g.cliente_id WHERE g.cancelado = 0 AND g.concluido_em IS NULL AND g.avisar_cliente = 1 AND g.data >= :hj`, { hj })) {
    if (!aceita(g, 'agendamento')) continue;
    msg(`ag:${g.id}:${g.data}:${g.hora || ''}`, { id: g.cliente_id, nome: g.nome, whatsapp: g.whatsapp }, 'agendamento',
      { data: br(g.data), hora: g.hora ? ` às ${g.hora}` : '', local: g.local ? `, em ${g.local}` : '',
        data_param: br(g.data), hora_param: g.hora || '', local_param: g.local || '' }, hj, `ag:${g.id}`);
  }
  for (const p of b.todos(`SELECT p.id, p.recebido_em, p.cliente_id, c.nome, c.whatsapp, c.aceita_mensagens, c.mensagens_tipos,
        COALESCE(t.nome, s.nome) AS documento
      FROM processos p JOIN clientes c ON c.id = p.cliente_id JOIN servicos s ON s.id = p.servico_id
      LEFT JOIN doc_tipos t ON t.id = s.doc_resultante_id
      WHERE p.situacao = 'andamento' AND p.recebido_em IS NOT NULL AND p.entregue_em IS NULL AND p.recebido_em >= :lim`,
  { lim: addDias(hj, -7) })) {
    if (aceita(p, 'documento')) {
      msg(`disp:proc:${p.id}`, { id: p.cliente_id, nome: p.nome, whatsapp: p.whatsapp }, 'documento',
        { documento: p.documento }, p.recebido_em, `proc:${p.id}`);
    }
  }

  return aplicar(b, L, M);
}

/* ordem dos parâmetros enviados ao modelo aprovado no WhatsApp */
const PARAMETROS = {
  aniversario: ['nome'],
  vencimento: ['nome', 'documento', 'data'],
  agendamento: ['nome', 'data', 'hora', 'local'],
  documento: ['nome', 'documento'],
};

function aplicar(b, L, M) {
  const agora = agoraIso();
  const r = { lembretes_novos: 0, lembretes_cancelados: 0, mensagens_novas: 0, mensagens_canceladas: 0 };
  b.tx(() => {
    for (const [chave, l] of L) {
      const ex = b.um('SELECT id, situacao FROM lembretes WHERE chave = :chave', { chave });
      if (!ex) {
        b.exec(`INSERT INTO lembretes (chave, tipo, titulo, detalhe, data_aviso, data_alvo, cliente_id, processo_id, ref, criado_em, atualizado_em)
          VALUES (:chave, :tipo, :titulo, :detalhe, :data_aviso, :data_alvo, :cliente_id, :processo_id, :ref, :agora, :agora)`,
        { chave, tipo: l.tipo, titulo: l.titulo, detalhe: l.detalhe ?? null, data_aviso: l.data_aviso, data_alvo: l.data_alvo ?? null,
          cliente_id: l.cliente_id ?? null, processo_id: l.processo_id ?? null, ref: l.ref, agora });
        r.lembretes_novos++;
      } else {
        b.exec(`UPDATE lembretes SET titulo = :titulo, detalhe = :detalhe, atualizado_em = :agora,
          situacao = CASE WHEN situacao = 'cancelado' THEN 'ativo' ELSE situacao END WHERE id = :id`,
        { id: ex.id, titulo: l.titulo, detalhe: l.detalhe ?? null, agora });
      }
    }
    for (const x of b.todos("SELECT id, chave FROM lembretes WHERE situacao = 'ativo'")) {
      if (!L.has(x.chave)) {
        b.exec("UPDATE lembretes SET situacao = 'cancelado', atualizado_em = :agora WHERE id = :id", { id: x.id, agora });
        r.lembretes_cancelados++;
      }
    }
    for (const [chave, m] of M) {
      const ins = b.exec(`INSERT OR IGNORE INTO mensagens (chave, cliente_id, modelo_codigo, texto, parametros, destino, enviar_em, ref, criado_em, atualizado_em)
        VALUES (:chave, :cliente_id, :modelo_codigo, :texto, :parametros, :destino, :enviar_em, :ref, :agora, :agora)`, { chave, ...m, agora });
      if (ins.changes) {
        r.mensagens_novas++;
        b.exec("INSERT INTO mensagem_eventos (mensagem_id, em, evento) VALUES (:id, :agora, 'criada')", { id: Number(ins.lastInsertRowid), agora });
      }
    }
    for (const x of b.todos("SELECT id, chave FROM mensagens WHERE situacao = 'pendente' AND chave NOT LIKE 'avulsa:%'")) {
      if (!M.has(x.chave)) {
        b.exec("UPDATE mensagens SET situacao = 'cancelada', atualizado_em = :agora WHERE id = :id", { id: x.id, agora });
        b.exec("INSERT INTO mensagem_eventos (mensagem_id, em, evento, detalhe) VALUES (:id, :agora, 'cancelada', 'O motivo deixou de valer (data alterada, documento substituído ou fora do prazo).')",
          { id: x.id, agora });
        r.mensagens_canceladas++;
      }
    }
  });
  return r;
}

/* Envio automático. Só roda com o WhatsApp configurado; a mensagem só muda para "aceita" com o identificador devolvido pelo serviço. */
let ocupado = false;
async function enviarPendentes(b, wa, agora = new Date()) {
  if (!wa.configurado() || ocupado) return { enviadas: 0, falhas: 0 };
  if (horaAgora(agora) < (b.config('hora_envio') || '09:00')) return { enviadas: 0, falhas: 0 };
  ocupado = true;
  const r = { enviadas: 0, falhas: 0 };
  try {
    const iso = agora.toISOString();
    const fila = b.todos(`SELECT m.*, mm.modelo_aprovado, mm.idioma FROM mensagens m LEFT JOIN modelos_mensagem mm ON mm.codigo = m.modelo_codigo
      WHERE m.situacao = 'pendente' AND m.enviar_em <= :hj AND (m.proxima_tentativa IS NULL OR m.proxima_tentativa <= :iso) LIMIT 20`,
    { hj: hoje(agora), iso });
    for (const m of fila) {
      const tent = m.tentativas + 1;
      try {
        const id = await wa.enviar({ destino: m.destino, texto: m.texto, modelo_aprovado: m.modelo_aprovado,
          idioma: m.idioma || 'pt_BR', parametros: json(m.parametros, []) });
        b.exec(`UPDATE mensagens SET situacao = 'aceita', tentativas = :t, id_externo = :id, ultimo_erro = NULL, atualizado_em = :iso WHERE id = :m`,
          { t: tent, id, iso, m: m.id });
        b.exec("INSERT INTO mensagem_eventos (mensagem_id, em, evento, detalhe) VALUES (:m, :iso, 'aceita', :d)",
          { m: m.id, iso, d: `Aceita pelo WhatsApp (id ${id}). Entrega confirmada depois, pelo retorno do serviço.` });
        r.enviadas++;
      } catch (e) {
        const erro = String(e.message || e).slice(0, 300);
        const final = tent >= 3;
        b.exec(`UPDATE mensagens SET situacao = :s, tentativas = :t, ultimo_erro = :erro, proxima_tentativa = :prox, atualizado_em = :iso WHERE id = :m`,
          { s: final ? 'falhou' : 'pendente', t: tent, erro, prox: new Date(agora.getTime() + 30 * 60000).toISOString(), iso, m: m.id });
        b.exec("INSERT INTO mensagem_eventos (mensagem_id, em, evento, detalhe) VALUES (:m, :iso, 'falha', :d)",
          { m: m.id, iso, d: `Tentativa ${tent}: ${erro}` });
        r.falhas++;
      }
    }
  } finally { ocupado = false; }
  return r;
}

module.exports = { gerar, enviarPendentes, aniversarioProximo, listaDias };

};

MODULOS["src/whatsapp"] = function (module, exports, require) {
'use strict';
/*
 * WhatsApp Cloud API (oficial, Meta). Sem as variáveis de ambiente, fica "Não configurada"
 * e o sistema usa só o envio manual (link wa.me com a mensagem pronta).
 *
 *   WHATSAPP_TOKEN            token de acesso permanente do app
 *   WHATSAPP_PHONE_NUMBER_ID  identificador do número remetente
 *   WHATSAPP_API_VERSAO       opcional, padrão v21.0
 *   WHATSAPP_VERIFY_TOKEN     para validar o webhook de status
 *   WHATSAPP_APP_SECRET       para conferir a assinatura do webhook
 */
const crypto = require('node:crypto');

function criarWhatsApp(env = process.env) {
  const token = env.WHATSAPP_TOKEN;
  const telefone = env.WHATSAPP_PHONE_NUMBER_ID;
  const versao = env.WHATSAPP_API_VERSAO || 'v21.0';
  return {
    configurado: () => Boolean(token && telefone),
    webhookConfigurado: () => Boolean(env.WHATSAPP_VERIFY_TOKEN && env.WHATSAPP_APP_SECRET),
    tokenVerificacao: () => env.WHATSAPP_VERIFY_TOKEN,

    async enviar({ destino, texto, modelo_aprovado, idioma, parametros }) {
      const para = String(destino).replace(/\D/g, '');
      const corpo = modelo_aprovado
        ? { messaging_product: 'whatsapp', to: para, type: 'template', template: {
          name: modelo_aprovado, language: { code: idioma || 'pt_BR' },
          components: parametros?.length ? [{ type: 'body', parameters: parametros.map((t) => ({ type: 'text', text: String(t || '-') })) }] : [] } }
        : { messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } };
      const r = await fetch(`https://graph.facebook.com/${versao}/${encodeURIComponent(telefone)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(15000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || `Serviço respondeu ${r.status}`);
      const id = j?.messages?.[0]?.id;
      if (!id) throw new Error('O serviço não devolveu o identificador da mensagem.');
      return id;
    },

    assinaturaValida(bruto, cabecalho) {
      if (!env.WHATSAPP_APP_SECRET || !cabecalho?.startsWith('sha256=')) return false;
      const esperado = Buffer.from('sha256=' + crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(bruto).digest('hex'));
      const recebido = Buffer.from(cabecalho);
      return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
    },
  };
}

module.exports = { criarWhatsApp };

};

MODULOS["src/backup"] = function (module, exports, require) {
'use strict';
/* Na demonstração não há disco: a cópia de segurança fica indisponível. */
const { ErroHttp } = require('./util');
module.exports = {
  fazerBackup() { throw new ErroHttp(400, 'Cópia de segurança indisponível no ambiente de demonstração.'); },
  pastaBackups: () => '',
};

};

MODULOS["src/portal"] = function (module, exports, require) {
'use strict';
/*
 * Site público e Área do cliente, sobre o mesmo banco do painel.
 *
 * Regra de ouro: tudo que sai para o cliente passa por um serializador com lista explícita
 * de campos (cartaoCliente, detalheCliente, ...). Nenhuma linha do banco é devolvida inteira,
 * então observações internas (processos.observacoes, proxima_acao, checklist.observacoes,
 * clientes.observacoes, financeiro) não têm caminho até a resposta.
 * Toda consulta do cliente filtra por cliente_id da SESSÃO, nunca por um id vindo do pedido.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const U = require('./util');
const { ErroHttp, hoje, agoraIso, json } = U;
const R = require('./regras');
const { caminhoArquivo, detectarTipo, salvarArquivo } = require('./arquivos');

const COOKIE = 'mdp_cliente';
const DIAS_SESSAO = 14;
const CATEGORIAS = ['Documentos', 'Andamento', 'Agendamento', 'Entrega', 'Outro'];
const SITUACOES = { enviada: 'Enviada', em_atendimento: 'Em atendimento', respondida: 'Respondida', encerrada: 'Encerrada' };
const TIPOS_NOTIF = ['atualizacao', 'resposta', 'documento', 'agenda'];
const QUEM = { cliente: 'Você', equipe: 'Equipe Mestre dos Papéis', orgao: 'Órgão responsável' };
const CHAVES_SITE = ['site_whatsapp', 'site_telefone', 'site_email', 'site_endereco', 'site_instagram', 'site_youtube', 'site_dominio', 'horario_atendimento'];
const RE_CHAVE = /^[A-Za-z0-9-]{8,64}$/;

function criarPortal({ b, hist, cookieSeguro, demo }) {
  const emailConfigurado = () => false; /* não há servidor de e-mail configurado nesta versão */
  const linkBase = (req) => process.env.MDP_URL_PUBLICA?.replace(/\/$/, '') ||
    `${req.headers['x-forwarded-proto'] === 'https' || cookieSeguro ? 'https' : 'http'}://${req.headers.host}`;

  /* ── avisos e publicações (usados pelo painel) ───────── */
  const PREFS = { atualizacao: true, resposta: true, documento: true, agenda: true };
  function prefs(clienteId) {
    const c = b.um('SELECT preferencias FROM contas_cliente WHERE cliente_id = :c', { c: clienteId });
    return { ...PREFS, ...json(c?.preferencias, {}) };
  }
  function notificar(clienteId, tipo, titulo, link, chave) {
    if (!prefs(clienteId)[tipo]) return;
    b.exec(`INSERT OR IGNORE INTO notificacoes_cliente (cliente_id, tipo, titulo, link, chave, criado_em)
      VALUES (:c, :t, :ti, :l, :k, :a)`, { c: clienteId, t: tipo, ti: String(titulo).slice(0, 220), l: link || null, k: chave || null, a: agoraIso() });
  }
  function tocar(processoId) {
    if (processoId) b.exec('UPDATE processos SET atualizado_cliente_em = :a WHERE id = :id', { a: agoraIso(), id: Number(processoId) });
  }
  function publicar(u, pr, texto, { tipo = 'automatica', avisar = true } = {}) {
    const r = b.exec(`INSERT INTO publicacoes (processo_id, cliente_id, texto, tipo, criado_por, criado_em)
      VALUES (:p, :c, :t, :tipo, :u, :a)`, { p: pr.id, c: pr.cliente_id, t: texto, tipo, u: u?.id ?? null, a: agoraIso() });
    tocar(pr.id);
    if (avisar) {
      const s = b.um('SELECT nome FROM servicos WHERE id = :id', { id: pr.servico_id });
      notificar(pr.cliente_id, 'atualizacao', `${s?.nome || 'Processo'}: ${texto}`, `#/processo/${pr.id}`, `pub:${r.lastInsertRowid}`);
    }
  }
  /* data em que cada etapa foi alcançada; voltar de etapa limpa as datas das seguintes */
  function marcarEtapa(processoId, idx) {
    const p = b.um('SELECT etapas_datas FROM processos WHERE id = :id', { id: processoId });
    const d = json(p?.etapas_datas, {});
    for (const k of Object.keys(d)) if (Number(k) > idx) delete d[k];
    if (!d[idx]) d[idx] = hoje();
    b.exec('UPDATE processos SET etapas_datas = :d WHERE id = :id', { d: JSON.stringify(d), id: processoId });
  }

  /* ── sessão do cliente (cookie e tabela próprios, separados do painel) ── */
  const falhas = new Map();
  function limitar(req, chave, max = 8) {
    const k = `${chave}:${req.socket.remoteAddress}`;
    const f = falhas.get(k);
    if (f && f.n >= max && Date.now() - f.desde < 15 * 60e3) throw new ErroHttp(429, 'Muitas tentativas. Aguarde 15 minutos.');
  }
  function falhou(req, chave) {
    const k = `${chave}:${req.socket.remoteAddress}`;
    const f = falhas.get(k);
    const atual = f && Date.now() - f.desde < 15 * 60e3 ? f : { n: 0, desde: Date.now() };
    atual.n++; falhas.set(k, atual);
  }
  const cookie = (v, s) => `${COOKIE}=${v}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${s}${cookieSeguro ? '; Secure' : ''}`;
  function contaDaSessao(req) {
    const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
    if (!m) return null;
    const s = b.um(`SELECT s.token_hash, s.expira_em, k.id AS conta_id, k.cliente_id, k.email, c.nome
      FROM sessoes_cliente s JOIN contas_cliente k ON k.id = s.conta_id JOIN clientes c ON c.id = k.cliente_id
      WHERE s.token_hash = :h AND k.ativo = 1 AND k.senha_hash IS NOT NULL`, { h: U.sha256(m[1]) });
    if (!s || s.expira_em < agoraIso()) return null;
    if (new Date(s.expira_em) - Date.now() < (DIAS_SESSAO / 2) * 86400e3) {
      b.exec('UPDATE sessoes_cliente SET expira_em = :e WHERE token_hash = :h', { e: new Date(Date.now() + DIAS_SESSAO * 86400e3).toISOString(), h: s.token_hash });
    }
    return s;
  }
  function abrirSessao(res, contaId) {
    const t = U.tokenAleatorio();
    b.exec('DELETE FROM sessoes_cliente WHERE expira_em < :a', { a: agoraIso() });
    b.exec('INSERT INTO sessoes_cliente (token_hash, conta_id, expira_em, criado_em) VALUES (:h, :c, :e, :a)',
      { h: U.sha256(t), c: contaId, e: new Date(Date.now() + DIAS_SESSAO * 86400e3).toISOString(), a: agoraIso() });
    b.exec('UPDATE contas_cliente SET ultimo_acesso = :a WHERE id = :c', { a: agoraIso(), c: contaId });
    res.setHeader('Set-Cookie', cookie(t, DIAS_SESSAO * 86400));
  }

  /* convites e recuperação: o token só existe no link; o banco guarda o hash */
  function criarToken(clienteId, tipo, u, horas) {
    const agora = agoraIso();
    b.exec(`UPDATE tokens_cliente SET cancelado_em = :a WHERE cliente_id = :c AND tipo = :t AND usado_em IS NULL AND cancelado_em IS NULL`,
      { a: agora, c: clienteId, t: tipo });
    const t = U.tokenAleatorio();
    b.exec(`INSERT INTO tokens_cliente (cliente_id, tipo, token_hash, expira_em, criado_por, criado_em) VALUES (:c, :t, :h, :e, :u, :a)`,
      { c: clienteId, t: tipo, h: U.sha256(t), e: new Date(Date.now() + horas * 3600e3).toISOString(), u: u?.id ?? null, a: agora });
    return t;
  }
  function tokenValido(token, tipo) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    const r = b.um(`SELECT * FROM tokens_cliente WHERE token_hash = :h AND tipo = :t AND usado_em IS NULL AND cancelado_em IS NULL`,
      { h: U.sha256(token), t: tipo });
    return r && r.expira_em > agoraIso() ? r : null;
  }

  /* ── serializadores do cliente (lista fechada de campos) ── */
  const situacaoCliente = (p) => (p.situacao === 'concluido' ? 'Concluído' : p.recebido_em ? 'Documento pronto para entrega'
    : p.protocolo_data ? 'Aguardando emissão' : 'Em andamento');
  function proximoCliente(p) {
    if (p.situacao === 'andamento' && p.cliente_proximo_passo) return { texto: p.cliente_proximo_passo, quem: p.cliente_quem || null };
    if (p.situacao === 'concluido') return { texto: 'Processo concluído. Guarde o seu documento em local seguro.', quem: null };
    if (p.recebido_em) return { texto: 'O documento está pronto. A equipe vai combinar a entrega com você.', quem: 'equipe' };
    if (p.protocolo_data) return { texto: 'Aguardar a emissão pelo órgão responsável. A equipe acompanha e registra aqui cada novidade.', quem: 'orgao' };
    if (p.faltam.length) return { texto: 'Reunir os documentos que faltam. Veja a lista em "O que falta" e as orientações da equipe.', quem: 'equipe' };
    return { texto: 'A equipe está preparando o protocolo.', quem: 'equipe' };
  }
  const cartaoCliente = (p) => ({
    id: p.id, numero: p.numero, servico: p.servico_nome, etapa_atual: p.etapa_nome, etapa_numero: p.etapa_idx + 1, total_etapas: p.etapas.length,
    situacao: situacaoCliente(p), concluido: p.situacao === 'concluido', atualizado_em: p.atualizado_cliente_em || p.criado_em,
    proximo_passo: proximoCliente(p).texto,
  });
  function detalheCliente(p, clienteId) {
    const datas = json(p.etapas_datas, {});
    const prox = proximoCliente(p);
    const res = p.documento_resultado;
    return {
      ...cartaoCliente(p),
      cidade: p.cidade_nome || null,
      responsavel: p.mostrar_responsavel ? (p.responsavel_nome || null) : null,
      linha_do_tempo: p.etapas.map((e, i) => ({
        nome: e.nome, descricao: e.descricao || null, data: datas[i] || null,
        estado: i < p.etapa_idx || (p.situacao === 'concluido' && i <= p.etapa_idx) ? 'concluida' : i === p.etapa_idx ? 'atual' : 'proxima',
      })),
      falta: p.faltam.map((f) => {
        const it = p.itens.find((i) => i.id === f.id);
        return { documento: f.nome, situacao: f.situacao, orientacao: it?.orientacao_cliente || null };
      }),
      orientacoes: p.situacao === 'andamento' ? p.cliente_orientacoes || null : null,
      proximo_passo: { texto: prox.texto, quem: prox.quem ? QUEM[prox.quem] : null },
      datas: {
        agendamentos: b.todos(`SELECT data, hora, local, titulo, concluido_em FROM agenda WHERE cliente_id = :c AND processo_id = :p
            AND visivel_cliente = 1 AND cancelado = 0 ORDER BY data, hora`, { c: clienteId, p: p.id })
          .map((g) => ({ titulo: g.titulo, data: g.data, hora: g.hora, local: g.local, realizado: !!g.concluido_em })),
        protocolo: p.protocolo_data, numero_protocolo: p.protocolo_numero || null,
        previsao: p.recebido_em ? null : p.previsao, previsao_passou: !!p.atrasado,
        recebido_em: p.recebido_em, entregue_em: p.entregue_em,
        emissao: res?.emissao || null, validade: res?.validade || null,
      },
      documentos: documentosCliente(clienteId, p.id),
      historico: b.todos(`SELECT texto, tipo, criado_em FROM publicacoes WHERE processo_id = :p AND cliente_id = :c ORDER BY id DESC LIMIT 100`,
        { p: p.id, c: clienteId }).map((h) => ({ texto: h.texto, da_equipe: h.tipo === 'manual', em: h.criado_em })),
    };
  }
  function documentosCliente(clienteId, processoId) {
    const filtro = processoId === undefined ? '' : processoId === null ? 'AND l.processo_id IS NULL' : 'AND l.processo_id = :p';
    return b.todos(`SELECT l.id, l.titulo, l.liberado_em, a.mime, a.tamanho FROM liberacoes l JOIN arquivos a ON a.id = l.arquivo_id
      WHERE l.cliente_id = :c AND l.revogado_em IS NULL ${filtro} ORDER BY l.id DESC`, processoId ? { c: clienteId, p: processoId } : { c: clienteId })
      .map((d) => ({ id: d.id, titulo: d.titulo, liberado_em: d.liberado_em, tipo: d.mime === 'application/pdf' ? 'PDF' : 'Imagem', tamanho: d.tamanho }));
  }
  function processosDoCliente(clienteId, id) {
    const sql = `SELECT * FROM processos WHERE cliente_id = :c AND situacao <> 'cancelado'${id ? ' AND id = :id' : ''} ORDER BY id DESC`;
    return R.montarProcessos(b, R.catalogo(b), b.todos(sql, id ? { c: clienteId, id: Number(id) } : { c: clienteId }), hoje());
  }

  const ultimaMsg = `(SELECT autor FROM duvida_mensagens WHERE duvida_id = d.id ORDER BY id DESC LIMIT 1) AS ultimo_autor,
    (SELECT criado_em FROM duvida_mensagens WHERE duvida_id = d.id ORDER BY id DESC LIMIT 1) AS ultima_em`;
  function duvidasDoCliente(clienteId) {
    return b.todos(`SELECT d.*, p.numero, s.nome AS servico, ${ultimaMsg} FROM duvidas d
      LEFT JOIN processos p ON p.id = d.processo_id LEFT JOIN servicos s ON s.id = p.servico_id
      WHERE d.cliente_id = :c ORDER BY d.atualizado_em DESC`, { c: clienteId }).map((d) => ({
      id: d.id, assunto: d.assunto, categoria: d.categoria, processo: d.processo_id ? `${d.servico} · ${d.numero}` : 'Dúvida geral',
      processo_id: d.processo_id, situacao: d.situacao, situacao_rotulo: SITUACOES[d.situacao], atualizado_em: d.atualizado_em,
      nao_lida: d.ultimo_autor === 'equipe' && (!d.lida_cliente_em || d.ultima_em > d.lida_cliente_em),
    }));
  }
  const mensagensDa = (duvidaId) => b.todos(`SELECT m.id, m.autor, m.texto, m.criado_em, u.nome AS usuario FROM duvida_mensagens m
    LEFT JOIN usuarios u ON u.id = m.usuario_id WHERE m.duvida_id = :d ORDER BY m.id`, { d: duvidaId });
  const msgCliente = (m) => ({ id: m.id, autor: m.autor, autor_nome: m.autor === 'cliente' ? 'Você' : `Equipe Mestre dos Papéis${m.usuario ? ' · ' + m.usuario : ''}`,
    texto: m.texto, criado_em: m.criado_em });
  function duvidaDoCliente(clienteId, id) {
    const d = b.um('SELECT * FROM duvidas WHERE id = :id AND cliente_id = :c', { id: Number(id), c: clienteId });
    if (!d) throw new ErroHttp(404, 'Conversa não encontrada.');
    return d;
  }
  function inserirMensagem(duvidaId, autor, usuarioId, texto, chave) {
    if (chave) {
      const ja = b.um('SELECT id, duvida_id FROM duvida_mensagens WHERE chave = :k', { k: chave });
      if (ja) {
        if (ja.duvida_id !== duvidaId) throw new ErroHttp(409, 'Envio repetido com identificador de outra conversa.');
        return { id: ja.id, repetida: true };
      }
    }
    const r = b.exec(`INSERT INTO duvida_mensagens (duvida_id, autor, usuario_id, texto, chave, criado_em) VALUES (:d, :a, :u, :t, :k, :em)`,
      { d: duvidaId, a: autor, u: usuarioId ?? null, t: texto, k: chave || null, em: agoraIso() });
    return { id: Number(r.lastInsertRowid), repetida: false };
  }

  function servirArquivo(res, arquivoId, baixar) {
    const a = b.um('SELECT * FROM arquivos WHERE id = :id', { id: arquivoId });
    const cam = a && caminhoArquivo(b, a.chave);
    if (!cam || !fs.existsSync(cam)) throw new ErroHttp(404, 'Arquivo não encontrado.');
    res.writeHead(200, { 'Content-Type': a.mime, 'Content-Length': a.tamanho,
      'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      ...(a.mime.startsWith('image/') ? { 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" } : {}) });
    fs.createReadStream(cam).pipe(res);
  }

  function configSite() {
    return Object.fromEntries(b.todos(`SELECT chave, valor FROM config WHERE chave LIKE 'site_%' OR chave = 'horario_atendimento'`).map((x) => [x.chave, x.valor]));
  }

  /* ── resumo para a ficha no painel ───────────────────── */
  function resumoAdmin(clienteId) {
    const conta = b.um('SELECT id, email, ativo, ativado_em, ultimo_acesso, senha_hash IS NOT NULL AS tem_senha, criado_em FROM contas_cliente WHERE cliente_id = :c', { c: clienteId });
    const convite = b.um(`SELECT tipo, expira_em, criado_em FROM tokens_cliente WHERE cliente_id = :c AND usado_em IS NULL AND cancelado_em IS NULL
      AND expira_em > :a ORDER BY id DESC LIMIT 1`, { c: clienteId, a: agoraIso() });
    return {
      email_configurado: emailConfigurado(),
      conta: conta ? { ...conta, tem_senha: !!conta.tem_senha } : null,
      link_pendente: convite || null,
      pedidos: b.todos(`SELECT * FROM pedidos_cliente WHERE cliente_id = :c AND situacao = 'pendente' ORDER BY id`, { c: clienteId }),
      liberacoes: b.todos(`SELECT l.*, a.nome AS arquivo_nome, a.mime, p.numero, u.nome AS liberado_por_nome FROM liberacoes l
        JOIN arquivos a ON a.id = l.arquivo_id LEFT JOIN processos p ON p.id = l.processo_id LEFT JOIN usuarios u ON u.id = l.liberado_por
        WHERE l.cliente_id = :c ORDER BY l.id DESC`, { c: clienteId }),
      publicacoes: b.todos(`SELECT pu.*, u.nome AS usuario FROM publicacoes pu LEFT JOIN usuarios u ON u.id = pu.criado_por
        WHERE pu.cliente_id = :c ORDER BY pu.id DESC LIMIT 200`, { c: clienteId }),
      duvidas: b.todos(`SELECT d.*, ${ultimaMsg} FROM duvidas d WHERE d.cliente_id = :c ORDER BY d.atualizado_em DESC`, { c: clienteId })
        .map((d) => ({ ...d, nao_lida: d.ultimo_autor === 'cliente' && (!d.lida_equipe_em || d.ultima_em > d.lida_equipe_em) })),
    };
  }
  const contagemEquipe = () => ({
    duvidas_nao_lidas: b.todos(`SELECT d.lida_equipe_em, ${ultimaMsg} FROM duvidas d WHERE d.situacao <> 'encerrada'`)
      .filter((d) => d.ultimo_autor === 'cliente' && (!d.lida_equipe_em || d.ultima_em > d.lida_equipe_em)).length,
    pedidos: b.todos(`SELECT pc.*, c.nome AS cliente_nome FROM pedidos_cliente pc LEFT JOIN clientes c ON c.id = pc.cliente_id
      WHERE pc.situacao = 'pendente' ORDER BY pc.id`),
  });

  /* ══════════════════ ROTAS ══════════════════ */
  function rotas(rota, H) {
    /* ── público ── */
    rota('GET', '/api/publico/site', () => {
      const c = configSite();
      const contato = {};
      for (const k of ['whatsapp', 'telefone', 'email', 'endereco', 'instagram', 'youtube']) if (c[`site_${k}`]) contato[k] = c[`site_${k}`];
      return {
        contato, horario: c.horario_atendimento || null,
        mascote: c.site_mascote ? `/site-arquivo/${c.site_mascote}` : null,
        faq: b.todos('SELECT pergunta, resposta FROM faq WHERE ativo = 1 ORDER BY ordem, id'),
      };
    }, { publico: true });

    /* ── entrada do cliente ── */
    rota('GET', '/api/cliente/estado', ({ req }) => {
      const s = contaDaSessao(req);
      return { logado: !!s, nome: s ? s.nome : null, demo: !!demo, horario: configSite().horario_atendimento || null,
        canais: { email: emailConfigurado(), push: false } };
    }, { publico: true });

    rota('POST', '/api/cliente/entrar', ({ req, res, corpo }) => {
      limitar(req, 'login');
      const k = b.um('SELECT * FROM contas_cliente WHERE email = :e AND ativo = 1 AND senha_hash IS NOT NULL', { e: String(corpo.email || '').trim() });
      if (!k || !U.conferirSenha(corpo.senha || '', k.senha_hash)) { falhou(req, 'login'); throw new ErroHttp(401, 'E-mail ou senha incorretos.'); }
      abrirSessao(res, k.id);
      return { ok: true };
    }, { publico: true });

    rota('POST', '/api/cliente/sair', ({ req, res }) => {
      const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
      if (m) b.exec('DELETE FROM sessoes_cliente WHERE token_hash = :h', { h: U.sha256(m[1]) });
      res.setHeader('Set-Cookie', cookie('', 0));
      return { ok: true };
    }, { publico: true });

    rota('POST', '/api/cliente/link', ({ req, corpo }) => {
      limitar(req, 'token', 20);
      const tipo = corpo.tipo === 'recuperacao' ? 'recuperacao' : 'ativacao';
      const t = tokenValido(corpo.token, tipo);
      if (!t) { falhou(req, 'token'); throw new ErroHttp(400, 'Este link não vale mais. Peça um novo à equipe.'); }
      const k = b.um('SELECT k.email, c.nome FROM contas_cliente k JOIN clientes c ON c.id = k.cliente_id WHERE k.cliente_id = :c', { c: t.cliente_id });
      return { nome: (k?.nome || '').split(' ')[0], email: k?.email || null };
    }, { publico: true });

    /* ativação (primeira senha) e redefinição usam o mesmo caminho, com tipos de token diferentes */
    rota('POST', '/api/cliente/definir-senha', ({ req, res, corpo }) => b.tx(() => {
      limitar(req, 'token', 20);
      const tipo = corpo.tipo === 'recuperacao' ? 'recuperacao' : 'ativacao';
      const t = tokenValido(corpo.token, tipo);
      if (!t) { falhou(req, 'token'); throw new ErroHttp(400, 'Este link não vale mais. Peça um novo à equipe.'); }
      U.validarSenhaNova(corpo.senha);
      const k = b.um('SELECT * FROM contas_cliente WHERE cliente_id = :c', { c: t.cliente_id });
      if (!k || !k.ativo) throw new ErroHttp(400, 'Acesso desativado. Fale com a equipe.');
      const agora = agoraIso();
      b.exec('UPDATE tokens_cliente SET usado_em = :a WHERE id = :id', { a: agora, id: t.id });
      b.exec('UPDATE contas_cliente SET senha_hash = :h, ativado_em = COALESCE(ativado_em, :a) WHERE id = :id', { h: U.hashSenha(corpo.senha), a: agora, id: k.id });
      b.exec('DELETE FROM sessoes_cliente WHERE conta_id = :id', { id: k.id });
      hist(null, 'acesso', k.id, t.cliente_id, tipo === 'ativacao' ? 'Cliente ativou o acesso' : 'Cliente redefiniu a senha', null);
      abrirSessao(res, k.id);
      return { ok: true };
    }), { publico: true });

    rota('POST', '/api/cliente/recuperar', ({ req, corpo }) => {
      limitar(req, 'recuperar', 5);
      falhou(req, 'recuperar');
      const k = b.um('SELECT * FROM contas_cliente WHERE email = :e AND ativo = 1', { e: String(corpo.email || '').trim() });
      if (k && !b.um(`SELECT id FROM pedidos_cliente WHERE cliente_id = :c AND tipo = 'recuperacao' AND situacao = 'pendente'`, { c: k.cliente_id })) {
        b.exec(`INSERT INTO pedidos_cliente (cliente_id, tipo, criado_em) VALUES (:c, 'recuperacao', :a)`, { c: k.cliente_id, a: agoraIso() });
        hist(null, 'acesso', k.id, k.cliente_id, 'Cliente pediu recuperação de acesso', null);
      }
      /* mesma resposta exista ou não a conta, para não revelar quem é cliente */
      return { ok: true, mensagem: emailConfigurado()
        ? 'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.'
        : 'Pedido registrado. Se o e-mail estiver cadastrado, a equipe vai enviar um novo link de acesso pelo contato que você informou no atendimento.' };
    }, { publico: true });

    /* ── meus processos ── */
    rota('GET', '/api/cliente/processos', ({ cc }) => ({
      processos: processosDoCliente(cc.cliente_id).map(cartaoCliente),
      documentos_gerais: documentosCliente(cc.cliente_id, null),
    }), { cliente: true });

    rota('GET', '/api/cliente/processos/:id', ({ cc, p }) => {
      const [pr] = processosDoCliente(cc.cliente_id, p.id);
      if (!pr) throw new ErroHttp(404, 'Processo não encontrado.');
      return detalheCliente(pr, cc.cliente_id);
    }, { cliente: true });

    rota('GET', '/api/cliente/arquivos/:id', ({ cc, p, q, res }) => {
      const l = b.um('SELECT * FROM liberacoes WHERE id = :id AND cliente_id = :c AND revogado_em IS NULL', { id: Number(p.id), c: cc.cliente_id });
      if (!l) throw new ErroHttp(404, 'Arquivo não encontrado.');
      servirArquivo(res, l.arquivo_id, !!q.get('baixar'));
      return undefined;
    }, { cliente: true });

    rota('GET', '/api/cliente/novidades', ({ cc }) => {
      const c = { c: cc.cliente_id };
      const v = b.um(`SELECT (SELECT MAX(atualizado_cliente_em) FROM processos WHERE cliente_id = :c) AS a,
        (SELECT MAX(m.id) FROM duvida_mensagens m JOIN duvidas d ON d.id = m.duvida_id WHERE d.cliente_id = :c) AS m,
        (SELECT MAX(atualizado_em) FROM duvidas WHERE cliente_id = :c) AS d,
        (SELECT MAX(id) FROM notificacoes_cliente WHERE cliente_id = :c) AS n,
        (SELECT COUNT(*) FROM liberacoes WHERE cliente_id = :c AND revogado_em IS NULL) AS l`, c);
      return {
        versao: U.sha256(JSON.stringify(v)).slice(0, 16),
        avisos_nao_lidos: b.um('SELECT COUNT(*) AS n FROM notificacoes_cliente WHERE cliente_id = :c AND lida_em IS NULL', c).n,
        duvidas_nao_lidas: duvidasDoCliente(cc.cliente_id).filter((d) => d.nao_lida).length,
        verificado_em: agoraIso(),
      };
    }, { cliente: true });

    rota('GET', '/api/cliente/avisos', ({ cc }) => ({
      avisos: b.todos('SELECT id, tipo, titulo, link, criado_em, lida_em FROM notificacoes_cliente WHERE cliente_id = :c ORDER BY id DESC LIMIT 60',
        { c: cc.cliente_id }).map((n) => ({ ...n, lida: !!n.lida_em, lida_em: undefined })),
    }), { cliente: true });
    rota('POST', '/api/cliente/avisos/lidos', ({ cc }) => {
      b.exec('UPDATE notificacoes_cliente SET lida_em = :a WHERE cliente_id = :c AND lida_em IS NULL', { a: agoraIso(), c: cc.cliente_id });
      return { ok: true };
    }, { cliente: true });

    /* ── dúvidas ── */
    rota('GET', '/api/cliente/duvidas', ({ cc }) => ({
      duvidas: duvidasDoCliente(cc.cliente_id), categorias: CATEGORIAS, horario: configSite().horario_atendimento || null,
      processos: processosDoCliente(cc.cliente_id).map((x) => ({ id: x.id, nome: `${x.servico_nome} · ${x.numero}` })),
    }), { cliente: true });

    rota('POST', '/api/cliente/duvidas', ({ cc, corpo }) => b.tx(() => {
      const chave = String(corpo.chave || '');
      if (!RE_CHAVE.test(chave)) throw new ErroHttp(400, 'Envio inválido. Recarregue a página.');
      const ja = b.um('SELECT duvida_id FROM duvida_mensagens WHERE chave = :k', { k: chave });
      if (ja) {
        duvidaDoCliente(cc.cliente_id, ja.duvida_id);
        return { id: ja.duvida_id, repetida: true };
      }
      let processoId = null;
      if (corpo.processo_id) {
        const pr = b.um(`SELECT id FROM processos WHERE id = :id AND cliente_id = :c AND situacao <> 'cancelado'`, { id: Number(corpo.processo_id), c: cc.cliente_id });
        if (!pr) throw new ErroHttp(400, 'Processo inválido.');
        processoId = pr.id;
      }
      const categoria = U.umDe(corpo.categoria, CATEGORIAS, 'assunto sugerido');
      const assunto = U.texto(corpo.assunto, 'assunto', { obrigatorio: true, max: 120 });
      const texto = U.texto(corpo.texto, 'mensagem', { obrigatorio: true, max: 4000 });
      const agora = agoraIso();
      const id = Number(b.exec(`INSERT INTO duvidas (cliente_id, processo_id, assunto, categoria, lida_cliente_em, criado_em, atualizado_em)
        VALUES (:c, :p, :as, :cat, :a, :a, :a)`, { c: cc.cliente_id, p: processoId, as: assunto, cat: categoria, a: agora }).lastInsertRowid);
      inserirMensagem(id, 'cliente', null, texto, chave);
      hist(null, 'duvida', id, cc.cliente_id, 'Cliente abriu uma dúvida', { assunto });
      return { id, repetida: false };
    }), { cliente: true });

    rota('GET', '/api/cliente/duvidas/:id', ({ cc, p }) => {
      const d = duvidaDoCliente(cc.cliente_id, p.id);
      b.exec('UPDATE duvidas SET lida_cliente_em = :a WHERE id = :id', { a: agoraIso(), id: d.id });
      const resumo = duvidasDoCliente(cc.cliente_id).find((x) => x.id === d.id);
      return { ...resumo, nao_lida: false, mensagens: mensagensDa(d.id).map(msgCliente), horario: configSite().horario_atendimento || null };
    }, { cliente: true });

    rota('POST', '/api/cliente/duvidas/:id/mensagens', ({ cc, p, corpo }) => b.tx(() => {
      const d = duvidaDoCliente(cc.cliente_id, p.id);
      const chave = String(corpo.chave || '');
      if (!RE_CHAVE.test(chave)) throw new ErroHttp(400, 'Envio inválido. Recarregue a página.');
      const texto = U.texto(corpo.texto, 'mensagem', { obrigatorio: true, max: 4000 });
      const r = inserirMensagem(d.id, 'cliente', null, texto, chave);
      if (!r.repetida) {
        const nova = d.situacao === 'em_atendimento' ? 'em_atendimento' : 'enviada';
        b.exec('UPDATE duvidas SET situacao = :s, atualizado_em = :a, lida_cliente_em = :a WHERE id = :id', { s: nova, a: agoraIso(), id: d.id });
        if (d.situacao === 'encerrada') hist(null, 'duvida', d.id, cc.cliente_id, 'Cliente reabriu a dúvida', { assunto: d.assunto });
      }
      const m = b.um('SELECT id, autor, texto, criado_em, NULL AS usuario FROM duvida_mensagens WHERE id = :id', { id: r.id });
      return { mensagem: msgCliente(m), repetida: r.repetida };
    }), { cliente: true });

    rota('POST', '/api/cliente/duvidas/:id/encerrar', ({ cc, p }) => {
      const d = duvidaDoCliente(cc.cliente_id, p.id);
      b.exec("UPDATE duvidas SET situacao = 'encerrada', atualizado_em = :a WHERE id = :id", { a: agoraIso(), id: d.id });
      return { ok: true };
    }, { cliente: true });

    /* ── perfil ── */
    rota('GET', '/api/cliente/perfil', ({ cc }) => {
      const c = b.um(`SELECT c.nome, c.whatsapp, c.nacionalidade, ci.nome AS cidade FROM clientes c LEFT JOIN cidades ci ON ci.id = c.cidade_id WHERE c.id = :c`, { c: cc.cliente_id });
      return {
        nome: c.nome, whatsapp: c.whatsapp, email: cc.email, nacionalidade: c.nacionalidade, cidade: c.cidade,
        pedidos: b.todos(`SELECT campo, valor, criado_em FROM pedidos_cliente WHERE cliente_id = :c AND tipo = 'contato' AND situacao = 'pendente'`, { c: cc.cliente_id }),
        preferencias: prefs(cc.cliente_id), canais: { email: emailConfigurado(), push: false },
      };
    }, { cliente: true });

    rota('POST', '/api/cliente/perfil/contato', ({ cc, corpo }) => {
      const campo = U.umDe(corpo.campo, ['whatsapp', 'email'], 'contato');
      const valor = campo === 'whatsapp' ? U.whatsapp(corpo.valor) : U.email(corpo.valor);
      if (!valor) throw new ErroHttp(400, 'Informe o novo contato.');
      b.exec(`UPDATE pedidos_cliente SET situacao = 'recusado', decidido_em = :a WHERE cliente_id = :c AND tipo = 'contato' AND campo = :f AND situacao = 'pendente'`,
        { a: agoraIso(), c: cc.cliente_id, f: campo });
      b.exec(`INSERT INTO pedidos_cliente (cliente_id, tipo, campo, valor, criado_em) VALUES (:c, 'contato', :f, :v, :a)`,
        { c: cc.cliente_id, f: campo, v: valor, a: agoraIso() });
      hist(null, 'cliente', cc.cliente_id, cc.cliente_id, 'Cliente pediu alteração de contato', { campo, valor });
      return { ok: true };
    }, { cliente: true });

    rota('POST', '/api/cliente/perfil/senha', ({ cc, corpo }) => {
      const k = b.um('SELECT senha_hash FROM contas_cliente WHERE id = :id', { id: cc.conta_id });
      if (!U.conferirSenha(corpo.atual || '', k.senha_hash)) throw new ErroHttp(400, 'A senha atual não confere.');
      U.validarSenhaNova(corpo.nova);
      b.exec('UPDATE contas_cliente SET senha_hash = :h WHERE id = :id', { h: U.hashSenha(corpo.nova), id: cc.conta_id });
      b.exec('DELETE FROM sessoes_cliente WHERE conta_id = :id AND token_hash <> :t', { id: cc.conta_id, t: cc.token_hash });
      return { ok: true };
    }, { cliente: true });

    rota('PUT', '/api/cliente/perfil/preferencias', ({ cc, corpo }) => {
      const v = Object.fromEntries(TIPOS_NOTIF.map((t) => [t, corpo[t] === undefined ? true : !!corpo[t]]));
      b.exec('UPDATE contas_cliente SET preferencias = :p WHERE id = :id', { p: JSON.stringify(v), id: cc.conta_id });
      return { preferencias: v };
    }, { cliente: true });

    /* ══ painel: acesso, publicações, liberações, dúvidas, site ══ */
    rota('POST', '/api/clientes/:id/convite', ({ u, p, corpo, req }) => b.tx(() => {
      const c = H.cliente(p.id);
      const email = U.email(corpo.email || c.email);
      if (!email) throw new ErroHttp(400, 'Informe o e-mail que o cliente vai usar para entrar.');
      const outro = b.um('SELECT cliente_id FROM contas_cliente WHERE email = :e AND cliente_id <> :c', { e: email, c: c.id });
      if (outro) throw new ErroHttp(409, 'Este e-mail já é usado por outro cliente.');
      const k = b.um('SELECT * FROM contas_cliente WHERE cliente_id = :c', { c: c.id });
      if (k?.senha_hash) throw new ErroHttp(409, 'Este cliente já ativou o acesso. Use "Link para nova senha" se ele esqueceu a senha.');
      if (k) b.exec('UPDATE contas_cliente SET email = :e, ativo = 1 WHERE id = :id', { e: email, id: k.id });
      else b.exec('INSERT INTO contas_cliente (cliente_id, email, criado_em) VALUES (:c, :e, :a)', { c: c.id, e: email, a: agoraIso() });
      if (!c.email) b.exec('UPDATE clientes SET email = :e WHERE id = :id', { e: email, id: c.id });
      const token = criarToken(c.id, 'ativacao', u, 7 * 24);
      const link = `${linkBase(req)}/cliente/#/ativar/${token}`;
      hist(u, 'acesso', c.id, c.id, 'Convite de acesso gerado', { email, valido_ate: new Date(Date.now() + 7 * 86400e3).toISOString().slice(0, 10) });
      return { link, validade_dias: 7, email_enviado: false,
        whatsapp: `https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, ${c.nome.split(' ')[0]}. Este é o seu convite para a Área do cliente do Mestre dos Papéis. Entre com o e-mail ${email} e crie a sua senha: ${link}`)}` };
    }));

    rota('POST', '/api/clientes/:id/link-senha', ({ u, p, req }) => b.tx(() => {
      const c = H.cliente(p.id);
      const k = b.um('SELECT * FROM contas_cliente WHERE cliente_id = :c', { c: c.id });
      if (!k?.senha_hash) throw new ErroHttp(400, 'O cliente ainda não ativou o acesso. Gere um convite.');
      if (!k.ativo) throw new ErroHttp(400, 'O acesso está desativado. Reative antes.');
      const token = criarToken(c.id, 'recuperacao', u, 24);
      const link = `${linkBase(req)}/cliente/#/nova-senha/${token}`;
      b.exec(`UPDATE pedidos_cliente SET situacao = 'atendido', decidido_por = :u, decidido_em = :a WHERE cliente_id = :c AND tipo = 'recuperacao' AND situacao = 'pendente'`,
        { u: u.id, a: agoraIso(), c: c.id });
      hist(u, 'acesso', c.id, c.id, 'Link para nova senha gerado', null);
      return { link, validade_horas: 24, email_enviado: false,
        whatsapp: `https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, ${c.nome.split(' ')[0]}. Use este link para criar uma nova senha na Área do cliente do Mestre dos Papéis (vale por 24 horas): ${link}`)}` };
    }));

    rota('POST', '/api/clientes/:id/acesso', ({ u, p, corpo }) => {
      const c = H.cliente(p.id);
      const k = b.um('SELECT * FROM contas_cliente WHERE cliente_id = :c', { c: c.id });
      if (!k) throw new ErroHttp(400, 'Este cliente ainda não tem acesso.');
      const ativo = U.bool(corpo.ativo);
      b.exec('UPDATE contas_cliente SET ativo = :a WHERE id = :id', { a: ativo, id: k.id });
      if (!ativo) {
        b.exec('DELETE FROM sessoes_cliente WHERE conta_id = :id', { id: k.id });
        b.exec('UPDATE tokens_cliente SET cancelado_em = :a WHERE cliente_id = :c AND usado_em IS NULL AND cancelado_em IS NULL', { a: agoraIso(), c: c.id });
      }
      hist(u, 'acesso', c.id, c.id, ativo ? 'Acesso do cliente reativado' : 'Acesso do cliente desativado', null);
      return { ok: true };
    });

    rota('POST', '/api/pedidos-cliente/:id', ({ u, p, corpo }) => b.tx(() => {
      const pd = b.um("SELECT * FROM pedidos_cliente WHERE id = :id AND situacao = 'pendente'", { id: Number(p.id) });
      if (!pd) throw new ErroHttp(404, 'Pedido não encontrado ou já decidido.');
      const decisao = U.umDe(corpo.decisao, ['atendido', 'recusado'], 'decisão');
      if (decisao === 'atendido' && pd.tipo === 'contato') {
        if (pd.campo === 'whatsapp') b.exec('UPDATE clientes SET whatsapp = :v, atualizado_em = :a WHERE id = :c', { v: pd.valor, a: agoraIso(), c: pd.cliente_id });
        if (pd.campo === 'email') {
          if (b.um('SELECT id FROM contas_cliente WHERE email = :e AND cliente_id <> :c', { e: pd.valor, c: pd.cliente_id })) throw new ErroHttp(409, 'Este e-mail já é usado por outro cliente.');
          b.exec('UPDATE clientes SET email = :v, atualizado_em = :a WHERE id = :c', { v: pd.valor, a: agoraIso(), c: pd.cliente_id });
          b.exec('UPDATE contas_cliente SET email = :v WHERE cliente_id = :c', { v: pd.valor, c: pd.cliente_id });
        }
      }
      b.exec('UPDATE pedidos_cliente SET situacao = :s, decidido_por = :u, decidido_em = :a WHERE id = :id', { s: decisao, u: u.id, a: agoraIso(), id: pd.id });
      hist(u, 'cliente', pd.cliente_id, pd.cliente_id, pd.tipo === 'contato' ? `Alteração de contato ${decisao === 'atendido' ? 'aprovada' : 'recusada'}` : 'Pedido de recuperação encerrado',
        pd.tipo === 'contato' ? { campo: pd.campo, valor: pd.valor } : null);
      return { ok: true };
    }));

    rota('POST', '/api/processos/:id/publicar', ({ u, p, corpo }) => {
      const pr = H.processo(p.id);
      const texto = U.texto(corpo.texto, 'texto para o cliente', { obrigatorio: true, max: 2000 });
      publicar(u, pr, texto, { tipo: 'manual' });
      hist(u, 'processo', pr.id, pr.cliente_id, 'Atualização publicada para o cliente', { texto });
      return { ok: true };
    });

    function liberar(u, arquivoId, processoId, titulo) {
      const a = b.um('SELECT * FROM arquivos WHERE id = :id', { id: Number(arquivoId) });
      if (!a || !a.cliente_id) throw new ErroHttp(400, 'Arquivo inválido ou sem cliente.');
      let pid = null;
      if (processoId) {
        const pr = H.processo(processoId);
        if (pr.cliente_id !== a.cliente_id) throw new ErroHttp(400, 'O processo é de outro cliente.');
        pid = pr.id;
      }
      if (b.um(`SELECT id FROM liberacoes WHERE arquivo_id = :a AND cliente_id = :c AND revogado_em IS NULL AND COALESCE(processo_id, 0) = :p`,
        { a: a.id, c: a.cliente_id, p: pid || 0 })) throw new ErroHttp(409, 'Este arquivo já está liberado para o cliente.');
      const t = U.texto(titulo, 'nome que o cliente vai ver', { obrigatorio: true, max: 160 });
      const id = Number(b.exec(`INSERT INTO liberacoes (arquivo_id, cliente_id, processo_id, titulo, liberado_por, liberado_em)
        VALUES (:a, :c, :p, :t, :u, :em)`, { a: a.id, c: a.cliente_id, p: pid, t, u: u.id, em: agoraIso() }).lastInsertRowid);
      tocar(pid);
      notificar(a.cliente_id, 'documento', `Novo documento disponível: ${t}`, pid ? `#/processo/${pid}` : '#/processos', `lib:${id}`);
      const nome = b.um('SELECT nome FROM clientes WHERE id = :c', { c: a.cliente_id }).nome;
      hist(u, 'liberacao', id, a.cliente_id, 'Arquivo liberado ao cliente', { titulo: t, arquivo: a.nome, visivel_para: nome });
      return id;
    }
    rota('POST', '/api/liberacoes', ({ u, corpo }) => b.tx(() => ({ id: liberar(u, corpo.arquivo_id, corpo.processo_id, corpo.titulo) })));
    rota('POST', '/api/clientes/:id/liberar-arquivo', ({ u, p, corpo }) => b.tx(() => {
      const c = H.cliente(p.id);
      if (!corpo.arquivo?.base64) throw new ErroHttp(400, 'Escolha o arquivo.');
      const arq = salvarArquivo(b, corpo.arquivo, c.id, u.id);
      return { id: liberar(u, arq, corpo.processo_id, corpo.titulo) };
    }));
    rota('POST', '/api/liberacoes/:id/revogar', ({ u, p }) => {
      const l = b.um('SELECT * FROM liberacoes WHERE id = :id AND revogado_em IS NULL', { id: Number(p.id) });
      if (!l) throw new ErroHttp(404, 'Liberação não encontrada.');
      b.exec('UPDATE liberacoes SET revogado_em = :a, revogado_por = :u WHERE id = :id', { a: agoraIso(), u: u.id, id: l.id });
      tocar(l.processo_id);
      hist(u, 'liberacao', l.id, l.cliente_id, 'Liberação do arquivo retirada', { titulo: l.titulo });
      return { ok: true };
    });

    /* dúvidas no painel */
    rota('GET', '/api/duvidas', () => ({
      duvidas: b.todos(`SELECT d.*, c.nome AS cliente_nome, p.numero, s.nome AS servico, ${ultimaMsg} FROM duvidas d
        JOIN clientes c ON c.id = d.cliente_id LEFT JOIN processos p ON p.id = d.processo_id LEFT JOIN servicos s ON s.id = p.servico_id
        ORDER BY d.situacao = 'encerrada', d.atualizado_em DESC LIMIT 300`)
        .map((d) => ({ ...d, nao_lida: d.ultimo_autor === 'cliente' && (!d.lida_equipe_em || d.ultima_em > d.lida_equipe_em) })),
    }));
    rota('GET', '/api/duvidas/:id', ({ p }) => {
      const d = b.um(`SELECT d.*, c.nome AS cliente_nome, p.numero, s.nome AS servico FROM duvidas d JOIN clientes c ON c.id = d.cliente_id
        LEFT JOIN processos p ON p.id = d.processo_id LEFT JOIN servicos s ON s.id = p.servico_id WHERE d.id = :id`, { id: Number(p.id) });
      if (!d) throw new ErroHttp(404, 'Dúvida não encontrada.');
      b.exec('UPDATE duvidas SET lida_equipe_em = :a WHERE id = :id', { a: agoraIso(), id: d.id });
      return { ...d, mensagens: mensagensDa(d.id) };
    });
    rota('POST', '/api/duvidas/:id/responder', ({ u, p, corpo }) => b.tx(() => {
      const d = b.um('SELECT * FROM duvidas WHERE id = :id', { id: Number(p.id) });
      if (!d) throw new ErroHttp(404, 'Dúvida não encontrada.');
      const texto = U.texto(corpo.texto, 'resposta', { obrigatorio: true, max: 4000 });
      const chave = corpo.chave && RE_CHAVE.test(String(corpo.chave)) ? `eq-${corpo.chave}` : null;
      const r = inserirMensagem(d.id, 'equipe', u.id, texto, chave);
      if (!r.repetida) {
        const agora = agoraIso();
        b.exec("UPDATE duvidas SET situacao = 'respondida', atualizado_em = :a, lida_equipe_em = :a WHERE id = :id", { a: agora, id: d.id });
        notificar(d.cliente_id, 'resposta', `Resposta da equipe: ${d.assunto}`, `#/duvida/${d.id}`, `resp:${r.id}`);
        hist(u, 'duvida', d.id, d.cliente_id, 'Dúvida respondida', { assunto: d.assunto });
      }
      return { id: r.id, repetida: r.repetida };
    }));
    rota('POST', '/api/duvidas/:id/situacao', ({ u, p, corpo }) => {
      const d = b.um('SELECT * FROM duvidas WHERE id = :id', { id: Number(p.id) });
      if (!d) throw new ErroHttp(404, 'Dúvida não encontrada.');
      const s = U.umDe(corpo.situacao, ['em_atendimento', 'encerrada', 'enviada'], 'situação');
      b.exec('UPDATE duvidas SET situacao = :s, atualizado_em = :a, lida_equipe_em = :a WHERE id = :id', { s, a: agoraIso(), id: d.id });
      hist(u, 'duvida', d.id, d.cliente_id, `Dúvida: ${SITUACOES[s]}`, { assunto: d.assunto });
      return { ok: true };
    });

    /* site */
    rota('GET', '/api/site-admin', () => ({ config: configSite(), faq: b.todos('SELECT * FROM faq ORDER BY ordem, id'), email_configurado: emailConfigurado() }), { admin: true });
    rota('PUT', '/api/site-admin', ({ u, corpo }) => {
      const v = {};
      for (const k of CHAVES_SITE) {
        if (corpo[k] === undefined) continue;
        let x = U.texto(corpo[k], k.replace('site_', ''), { max: 300 }) || '';
        if (x && k === 'site_whatsapp') x = U.whatsapp(x);
        if (x && k === 'site_email') x = U.email(x);
        if (x && ['site_instagram', 'site_youtube'].includes(k) && !/^https:\/\//.test(x)) throw new ErroHttp(400, 'Informe o endereço completo, começando por https://');
        v[k] = x;
        b.exec('INSERT INTO config (chave, valor) VALUES (:k, :v) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor', { k, v: x });
      }
      hist(u, 'site', null, null, 'Dados do site alterados', v);
      return { ok: true };
    }, { admin: true });
    rota('POST', '/api/faq', ({ u, corpo }) => {
      const r = b.exec('INSERT INTO faq (pergunta, resposta, ordem) VALUES (:p, :r, :o)', {
        p: U.texto(corpo.pergunta, 'pergunta', { obrigatorio: true, max: 200 }), r: U.texto(corpo.resposta, 'resposta', { obrigatorio: true, max: 2000 }),
        o: U.inteiro(corpo.ordem, 'ordem', { min: 0, max: 999 }) ?? 99 });
      hist(u, 'site', null, null, 'Pergunta frequente criada', { pergunta: corpo.pergunta });
      return { id: Number(r.lastInsertRowid) };
    }, { admin: true });
    rota('PUT', '/api/faq/:id', ({ u, p, corpo }) => {
      b.exec('UPDATE faq SET pergunta = :p, resposta = :r, ordem = :o, ativo = :a WHERE id = :id', {
        p: U.texto(corpo.pergunta, 'pergunta', { obrigatorio: true, max: 200 }), r: U.texto(corpo.resposta, 'resposta', { obrigatorio: true, max: 2000 }),
        o: U.inteiro(corpo.ordem, 'ordem', { min: 0, max: 999 }) ?? 99, a: U.bool(corpo.ativo), id: Number(p.id) });
      hist(u, 'site', null, null, 'Pergunta frequente alterada', { pergunta: corpo.pergunta, ativo: U.bool(corpo.ativo) });
      return { ok: true };
    }, { admin: true });
    rota('POST', '/api/site-admin/mascote', ({ u, corpo }) => {
      const buf = Buffer.from(String(corpo.arquivo?.base64 || ''), 'base64');
      if (!buf.length || buf.length > 2 * 1024 * 1024) throw new ErroHttp(400, 'Envie uma imagem de até 2 MB.');
      const mime = detectarTipo(buf);
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mime];
      if (!ext) throw new ErroHttp(415, 'Envie PNG, JPG ou WEBP.');
      const nome = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
      fs.mkdirSync(path.join(b.pasta, 'site'), { recursive: true });
      fs.writeFileSync(path.join(b.pasta, 'site', nome), buf, { flag: 'wx' });
      b.exec("INSERT INTO config (chave, valor) VALUES ('site_mascote', :v) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor", { v: nome });
      hist(u, 'site', null, null, 'Mascote do site enviado', { arquivo: corpo.arquivo?.nome || nome });
      return { url: `/site-arquivo/${nome}` };
    }, { admin: true });
  }

  return { contaDaSessao, notificar, tocar, publicar, marcarEtapa, resumoAdmin, contagemEquipe, rotas };
}

module.exports = { criarPortal };

};

MODULOS["src/api"] = function (module, exports, require) {
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const U = require('./util');
const { ErroHttp, hoje, agoraIso, addDias, addMeses, json } = U;
const R = require('./regras');
const { salvarArquivo, caminhoArquivo } = require('./arquivos');
const lembretes = require('./lembretes');
const { fazerBackup } = require('./backup');
const { criarPortal } = require('./portal');

const COOKIE = 'mdp_sessao';
const HORAS_SESSAO = 12;
const TIPOS_MSG = ['aniversario', 'vencimento', 'agendamento', 'documento'];
const PERFIS_COMERCIAIS = ['Estudante', 'Empresário', 'Outro'];
const TIPOS_LANC = ['honorario', 'taxa', 'custo', 'desconto', 'pagamento'];

function criarApi({ b, wa, demo, cookieSeguro }) {
  const rotas = [];
  const rota = (metodo, padrao, fn, opc = {}) => rotas.push({
    metodo, fn, opc, re: new RegExp('^' + padrao.replace(/:(\w+)/g, '(?<$1>\\d+)') + '$'),
  });

  /* ── apoio ─────────────────────────────────────────── */
  const hist = (u, entidade, id, clienteId, acao, detalhe) => b.exec(
    `INSERT INTO historico (em, usuario_id, entidade, entidade_id, cliente_id, acao, detalhe)
     VALUES (:em, :u, :e, :id, :c, :a, :d)`,
    { em: agoraIso(), u: u?.id ?? null, e: entidade, id: id ?? null, c: clienteId ?? null, a: acao,
      d: detalhe == null ? null : typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe) });

  const P = criarPortal({ b, hist, cookieSeguro, demo });

  const cliente = (id) => {
    const c = b.um('SELECT * FROM clientes WHERE id = :id', { id: Number(id) });
    if (!c) throw new ErroHttp(404, 'Cliente não encontrado.');
    return c;
  };
  const processo = (id) => {
    const p = b.um('SELECT * FROM processos WHERE id = :id', { id: Number(id) });
    if (!p) throw new ErroHttp(404, 'Processo não encontrado.');
    return p;
  };
  const usuarioValido = (id) => {
    if (id == null || id === '') return null;
    if (!b.um('SELECT id FROM usuarios WHERE id = :id AND ativo = 1', { id: Number(id) })) throw new ErroHttp(400, 'Responsável inválido.');
    return Number(id);
  };
  const cidadeValida = (id, obrig = false) => {
    if (id == null || id === '') { if (obrig) throw new ErroHttp(400, 'Escolha a cidade.'); return null; }
    if (!b.um('SELECT id FROM cidades WHERE id = :id', { id: Number(id) })) throw new ErroHttp(400, 'Cidade inválida.');
    return Number(id);
  };
  const anexo = (arq, clienteId, u) => (arq && arq.base64 ? salvarArquivo(b, arq, clienteId, u.id) : null);

  function proximoNumero() {
    const ano = hoje().slice(0, 4);
    const ult = b.um("SELECT numero FROM processos WHERE numero LIKE :p ORDER BY numero DESC LIMIT 1", { p: `MDP-${ano}-%` });
    const seq = ult ? parseInt(ult.numero.split('-')[2], 10) + 1 : 1;
    return `MDP-${ano}-${String(seq).padStart(4, '0')}`;
  }

  function docAtual(clienteId, tipoId) {
    return b.um('SELECT * FROM documentos WHERE cliente_id = :c AND tipo_id = :t AND substituido_em IS NULL', { c: clienteId, t: tipoId });
  }

  function criarProcesso(u, d) {
    const cat = R.catalogo(b);
    const servicoId = U.inteiro(d.servico_id, 'serviço', { obrigatorio: true });
    const serv = cat.servicos.get(servicoId);
    if (!serv || !serv.ativo) throw new ErroHttp(400, 'Serviço inválido.');
    const c = cliente(d.cliente_id);
    const cidadeId = cidadeValida(d.cidade_id ?? c.cidade_id);
    const modalidade = U.texto(d.modalidade, 'modalidade', { max: 120 }) || serv.modalidades[0] || null;
    const agora = agoraIso();
    const numero = proximoNumero();
    const r = b.exec(`INSERT INTO processos (numero, cliente_id, servico_id, modalidade, cidade_id, responsavel_id, etapas, prazo_dias,
        origem_id, vinculo, observacoes, criado_em, atualizado_em)
      VALUES (:numero, :c, :s, :m, :cid, :resp, :et, :prazo, :orig, :vinc, :obs, :agora, :agora)`, {
      numero, c: c.id, s: serv.id, m: modalidade, cid: cidadeId, resp: usuarioValido(d.responsavel_id ?? c.responsavel_id ?? u.id),
      et: JSON.stringify(serv.etapas), prazo: R.prazoSugerido(serv, cidadeId), orig: d.origem_id ?? null, vinc: d.vinculo ?? null,
      obs: U.texto(d.observacoes, 'observações', { max: 2000 }), agora,
    });
    const pid = Number(r.lastInsertRowid);
    const hj = hoje();
    const reaproveitados = [];
    for (const it of serv.checklist) {
      if (!cat.tipos.get(it.tipo_id)) continue;
      const doc = docAtual(c.id, it.tipo_id);
      const valido = doc && (!doc.validade || doc.validade >= hj) &&
        (!it.exige_recente_dias || (doc.emissao && addDias(doc.emissao, it.exige_recente_dias) >= hj));
      b.exec(`INSERT INTO checklist (processo_id, tipo_id, status, documento_id, exige_recente_dias, opcional, nota)
        VALUES (:p, :t, :s, :d, :rec, :opc, :nota)`, {
        p: pid, t: it.tipo_id, s: valido ? 'recebido' : 'pendente', d: valido ? doc.id : null,
        rec: it.exige_recente_dias || null, opc: it.opcional ? 1 : 0, nota: it.nota || null,
      });
      if (valido) reaproveitados.push(cat.tipos.get(it.tipo_id).nome);
    }
    P.marcarEtapa(pid, 0);
    P.publicar(u, { id: pid, cliente_id: c.id, servico_id: serv.id }, d.vinculo === 'renovacao' ? 'Processo de renovação aberto.' : 'Processo aberto.');
    hist(u, 'processo', pid, c.id, 'Processo aberto', { numero, servico: serv.nome, modalidade, reaproveitados,
      origem: d.origem_id ? b.um('SELECT numero FROM processos WHERE id = :id', { id: d.origem_id })?.numero : null, vinculo: d.vinculo ?? null });
    return pid;
  }

  /* Nova versão de documento: a anterior fica guardada e marcada como substituída.
     Processos ainda sem protocolo passam a usar a nova; os já protocolados mantêm a que foi entregue. */
  function novaVersao(u, clienteId, tipoId, d) {
    const tipo = b.um('SELECT * FROM doc_tipos WHERE id = :id', { id: Number(tipoId) });
    if (!tipo) throw new ErroHttp(400, 'Tipo de documento inválido.');
    const emissao = U.data(d.emissao, 'emissão');
    const validade = U.data(d.validade, 'validade');
    if (emissao && validade && validade < emissao) throw new ErroHttp(400, 'A validade não pode ser anterior à emissão.');
    const anterior = docAtual(clienteId, tipo.id);
    const versao = (b.um('SELECT MAX(versao) AS v FROM documentos WHERE cliente_id = :c AND tipo_id = :t', { c: clienteId, t: tipo.id }).v || 0) + 1;
    const agora = agoraIso();
    const arquivoId = anexo(d.arquivo, clienteId, u);
    if (anterior) b.exec('UPDATE documentos SET substituido_em = :agora WHERE id = :id', { agora, id: anterior.id });
    const r = b.exec(`INSERT INTO documentos (cliente_id, tipo_id, versao, emissao, validade, original, copia, apostilado, autenticado,
        arquivo_id, observacoes, criado_por, criado_em)
      VALUES (:c, :t, :v, :em, :val, :o, :cp, :ap, :au, :arq, :obs, :u, :agora)`, {
      c: clienteId, t: tipo.id, v: versao, em: emissao, val: validade, o: U.bool(d.original), cp: U.bool(d.copia),
      ap: U.bool(d.apostilado), au: U.bool(d.autenticado), arq: arquivoId, obs: U.texto(d.observacoes, 'observações', { max: 1000 }), u: u.id, agora,
    });
    const novo = Number(r.lastInsertRowid);
    b.exec(`UPDATE checklist SET documento_id = :novo, status = 'recebido'
      WHERE tipo_id = :t AND processo_id IN (SELECT id FROM processos WHERE cliente_id = :c AND situacao = 'andamento'
        AND protocolo_data IS NULL AND recebido_em IS NULL)
      AND ((documento_id IS NULL AND status IN ('pendente','solicitado')) OR documento_id = :ant)`,
    { novo, t: tipo.id, c: clienteId, ant: anterior?.id ?? -1 });
    hist(u, 'documento', novo, clienteId, anterior ? 'Nova versão de documento' : 'Documento registrado',
      { tipo: tipo.nome, versao, emissao, validade, anexo: !!arquivoId });
    return novo;
  }

  function moverParaMarco(p, marco, avancarUm = false) {
    const etapas = json(p.etapas, []);
    let idx = etapas.findIndex((e) => e.marco === marco);
    if (idx < 0) return p.etapa_idx;
    if (avancarUm && etapas[idx + 1] && !etapas[idx + 1].marco) idx += 1;
    return Math.max(idx, p.etapa_idx);
  }

  function ficha(id) {
    const c = cliente(id);
    const cat = R.catalogo(b);
    const hj = hoje();
    const procs = R.montarProcessos(b, cat, b.todos('SELECT * FROM processos WHERE cliente_id = :c ORDER BY id DESC', { c: c.id }), hj);
    const docs = b.todos(`SELECT d.*, t.nome AS tipo_nome, a.nome AS arquivo_nome, a.mime AS arquivo_mime
      FROM documentos d JOIN doc_tipos t ON t.id = d.tipo_id LEFT JOIN arquivos a ON a.id = d.arquivo_id
      WHERE d.cliente_id = :c ORDER BY t.nome, d.versao DESC`, { c: c.id });
    const fin = R.financeiroCliente(b, c.id, hj);
    const historico = b.todos(`SELECT h.*, u.nome AS usuario FROM historico h LEFT JOIN usuarios u ON u.id = h.usuario_id
      WHERE h.cliente_id = :c ORDER BY h.id DESC LIMIT 300`, { c: c.id });
    const mensagens = b.todos('SELECT * FROM mensagens WHERE cliente_id = :c ORDER BY id DESC LIMIT 100', { c: c.id });
    const agenda = b.todos(`SELECT * FROM agenda WHERE cliente_id = :c AND cancelado = 0 ORDER BY data DESC, hora DESC LIMIT 50`, { c: c.id });
    const avisos = b.todos(`SELECT * FROM lembretes WHERE cliente_id = :c AND situacao = 'ativo' ORDER BY data_aviso LIMIT 30`, { c: c.id });
    return {
      cliente: { ...c, mensagens_tipos: json(c.mensagens_tipos, []), responsavel_nome: cat.usuarios.get(c.responsavel_id)?.nome || '',
        cidade_nome: cat.cidades.get(c.cidade_id)?.nome || '' },
      processos: procs, documentos: docs, financeiro: fin, historico, mensagens, agenda, avisos,
      portal: P.resumoAdmin(c.id),
    };
  }

  function linhasProcessos(where = "p.situacao = 'andamento'", params = {}) {
    const cat = R.catalogo(b);
    const procs = b.todos(`SELECT p.*, c.nome AS cliente_nome, c.whatsapp AS cliente_whatsapp FROM processos p
      JOIN clientes c ON c.id = p.cliente_id WHERE ${where} ORDER BY p.atualizado_em DESC`, params);
    return R.montarProcessos(b, cat, procs, hoje()).map((p) => ({
      id: p.id, numero: p.numero, cliente_id: p.cliente_id, cliente_nome: p.cliente_nome, cliente_whatsapp: p.cliente_whatsapp,
      servico_nome: p.servico_nome, modalidade: p.modalidade, cidade_nome: p.cidade_nome, etapa_nome: p.etapa_nome,
      etapa_idx: p.etapa_idx, total_etapas: p.etapas.length, faltam: p.faltam, proxima: p.proxima, atrasado: p.atrasado,
      previsao: p.previsao, protocolo_numero: p.protocolo_numero, situacao: p.situacao, recebido_em: p.recebido_em,
    }));
  }

  /* ── sessão ─────────────────────────────────────────── */
  const falhasLogin = new Map();
  function lerCookie(req) {
    const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
    return m ? m[1] : null;
  }
  function usuarioDaSessao(req) {
    const t = lerCookie(req);
    if (!t) return null;
    const s = b.um(`SELECT s.token_hash, s.expira_em, u.id, u.nome, u.email, u.perfil FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = :h AND u.ativo = 1`, { h: U.sha256(t) });
    if (!s || s.expira_em < agoraIso()) return null;
    if (new Date(s.expira_em) - Date.now() < (HORAS_SESSAO / 2) * 3600e3) {
      b.exec('UPDATE sessoes SET expira_em = :e WHERE token_hash = :h', { e: new Date(Date.now() + HORAS_SESSAO * 3600e3).toISOString(), h: s.token_hash });
    }
    return { id: s.id, nome: s.nome, email: s.email, perfil: s.perfil, token_hash: s.token_hash };
  }
  const cookie = (valor, maxAge) => `${COOKIE}=${valor}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${cookieSeguro ? '; Secure' : ''}`;

  rota('GET', '/api/estado', ({ req }) => ({
    precisa_configurar: !b.um('SELECT 1 AS x FROM usuarios LIMIT 1'), demo, usuario: usuarioDaSessao(req) ? true : false,
  }), { publico: true });

  rota('POST', '/api/configurar', ({ corpo, req }) => {
    if (b.um('SELECT 1 AS x FROM usuarios LIMIT 1')) throw new ErroHttp(409, 'O sistema já foi configurado.');
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const tok = process.env.MDP_TOKEN_CONFIGURACAO;
    if (!local && !(tok && corpo.token === tok)) throw new ErroHttp(403, 'A primeira configuração só pode ser feita no próprio computador.');
    const nome = U.texto(corpo.nome, 'nome', { obrigatorio: true, max: 120 });
    const email = U.email(corpo.email);
    if (!email) throw new ErroHttp(400, 'Informe o e-mail.');
    U.validarSenhaNova(corpo.senha);
    b.exec("INSERT INTO usuarios (nome, email, senha_hash, perfil, criado_em) VALUES (:n, :e, :h, 'admin', :em)",
      { n: nome, e: email, h: U.hashSenha(corpo.senha), em: agoraIso() });
    hist(null, 'usuario', null, null, 'Primeiro administrador criado', { email });
    return { ok: true };
  }, { publico: true });

  rota('POST', '/api/entrar', ({ corpo, req, res }) => {
    const ip = req.socket.remoteAddress || '?';
    const f = falhasLogin.get(ip);
    if (f && f.n >= 8 && Date.now() - f.desde < 15 * 60e3) throw new ErroHttp(429, 'Muitas tentativas. Aguarde 15 minutos.');
    const u = b.um('SELECT * FROM usuarios WHERE email = :e AND ativo = 1', { e: String(corpo.email || '').trim() });
    if (!u || !U.conferirSenha(corpo.senha || '', u.senha_hash)) {
      const atual = f && Date.now() - f.desde < 15 * 60e3 ? f : { n: 0, desde: Date.now() };
      atual.n++; falhasLogin.set(ip, atual);
      throw new ErroHttp(401, 'E-mail ou senha incorretos.');
    }
    falhasLogin.delete(ip);
    const t = U.tokenAleatorio();
    b.exec('DELETE FROM sessoes WHERE expira_em < :agora', { agora: agoraIso() });
    b.exec('INSERT INTO sessoes (token_hash, usuario_id, expira_em, criado_em) VALUES (:h, :u, :e, :c)',
      { h: U.sha256(t), u: u.id, e: new Date(Date.now() + HORAS_SESSAO * 3600e3).toISOString(), c: agoraIso() });
    res.setHeader('Set-Cookie', cookie(t, HORAS_SESSAO * 3600));
    return { ok: true };
  }, { publico: true });

  rota('POST', '/api/sair', ({ u, res }) => {
    b.exec('DELETE FROM sessoes WHERE token_hash = :h', { h: u.token_hash });
    res.setHeader('Set-Cookie', cookie('', 0));
    return { ok: true };
  });

  rota('POST', '/api/minha-senha', ({ u, corpo }) => {
    const reg = b.um('SELECT senha_hash FROM usuarios WHERE id = :id', { id: u.id });
    if (!U.conferirSenha(corpo.atual || '', reg.senha_hash)) throw new ErroHttp(400, 'A senha atual não confere.');
    U.validarSenhaNova(corpo.nova);
    b.exec('UPDATE usuarios SET senha_hash = :h WHERE id = :id', { h: U.hashSenha(corpo.nova), id: u.id });
    b.exec('DELETE FROM sessoes WHERE usuario_id = :id AND token_hash <> :t', { id: u.id, t: u.token_hash });
    hist(u, 'usuario', u.id, null, 'Senha alterada', null);
    return { ok: true };
  });

  /* ── catálogo e tela Hoje ───────────────────────────── */
  rota('GET', '/api/catalogo', ({ u }) => {
    const cat = R.catalogo(b);
    return {
      eu: { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil },
      demo,
      hoje: hoje(),
      servicos: [...cat.servicos.values()],
      tipos: [...cat.tipos.values()],
      cidades: [...cat.cidades.values()],
      usuarios: [...cat.usuarios.values()].filter((x) => x.ativo).map(({ id, nome, perfil }) => ({ id, nome, perfil })),
      modelos: b.todos('SELECT * FROM modelos_mensagem ORDER BY id'),
      config: Object.fromEntries(b.todos('SELECT chave, valor FROM config').map((x) => [x.chave, x.valor])),
      whatsapp: { configurado: wa.configurado(), webhook: wa.webhookConfigurado() },
      moedas: U.MOEDAS, perfis_comerciais: PERFIS_COMERCIAIS, tipos_mensagem: TIPOS_MSG,
    };
  });

  rota('GET', '/api/hoje', () => {
    const hj = hoje();
    const janela = parseInt(b.config('janela_vencimentos_dias') || '120', 10);
    const linhas = linhasProcessos();
    const agenda = b.todos(`SELECT g.*, c.nome AS cliente_nome FROM agenda g LEFT JOIN clientes c ON c.id = g.cliente_id
      WHERE g.data = :hj AND g.cancelado = 0 ORDER BY g.concluido_em IS NOT NULL, g.hora`, { hj });
    const atrasadas = b.todos(`SELECT g.*, c.nome AS cliente_nome FROM agenda g LEFT JOIN clientes c ON c.id = g.cliente_id
      WHERE g.data < :hj AND g.cancelado = 0 AND g.concluido_em IS NULL AND g.tipo = 'tarefa' ORDER BY g.data`, { hj });
    const avisos = b.todos(`SELECT * FROM lembretes WHERE situacao = 'ativo' AND data_aviso <= :hj AND tipo <> 'previsao'
      ORDER BY data_alvo, id LIMIT 100`, { hj });
    const vencendo = b.todos(`SELECT d.id, d.validade, d.cliente_id, t.nome AS tipo_nome, c.nome AS cliente_nome FROM documentos d
      JOIN doc_tipos t ON t.id = d.tipo_id JOIN clientes c ON c.id = d.cliente_id
      WHERE d.substituido_em IS NULL AND d.validade IS NOT NULL AND d.validade BETWEEN :de AND :ate ORDER BY d.validade`,
    { de: addDias(hj, -30), ate: addDias(hj, janela) });
    const manuais = b.todos(`SELECT m.*, c.nome AS cliente_nome FROM mensagens m JOIN clientes c ON c.id = m.cliente_id
      WHERE (m.situacao IN ('pendente','falhou') AND m.enviar_em <= :hj)
         OR (m.situacao = 'aberta_manual' AND m.modelo_codigo <> 'avulsa' AND substr(m.atualizado_em, 1, 10) >= :ontem)
      ORDER BY m.enviar_em LIMIT 50`, { hj, ontem: addDias(hj, -1) });
    const eq = P.contagemEquipe();
    return {
      hoje: hj, processos: linhas, agenda, tarefas_atrasadas: atrasadas, avisos, vencendo,
      duvidas_nao_lidas: eq.duvidas_nao_lidas, pedidos_cliente: eq.pedidos,
      mensagens: wa.configurado() ? manuais.filter((m) => m.situacao === 'falhou') : manuais,
      contagem: {
        atendimentos: agenda.filter((g) => !g.concluido_em).length,
        pendencias: linhas.filter((l) => l.faltam.length).length,
        atrasados: linhas.filter((l) => l.atrasado).length,
        vencendo: vencendo.length,
      },
    };
  });

  rota('GET', '/api/busca', ({ q }) => {
    const termo = String(q.get('q') || '').trim();
    if (termo.length < 2) return { clientes: [] };
    const like = `%${termo.replace(/[%_]/g, '')}%`;
    const dig = termo.replace(/\D/g, '');
    const ids = b.todos(`SELECT DISTINCT c.id FROM clientes c LEFT JOIN processos p ON p.cliente_id = c.id
      WHERE c.nome LIKE :l OR c.documento_numero LIKE :l OR p.numero LIKE :l OR p.protocolo_numero LIKE :l
        OR (:d <> '' AND length(:d) >= 4 AND c.whatsapp LIKE :ld) LIMIT 30`, { l: like, d: dig, ld: `%${dig}%` }).map((x) => x.id);
    return { clientes: listarClientes(ids) };
  });

  function listarClientes(ids) {
    if (ids && !ids.length) return [];
    const filtro = ids ? `WHERE c.id IN (${ids.map(Number).join(',')})` : '';
    const cs = b.todos(`SELECT c.id, c.nome, c.whatsapp, c.perfil_comercial, ci.nome AS cidade_nome FROM clientes c
      LEFT JOIN cidades ci ON ci.id = c.cidade_id ${filtro} ORDER BY c.nome`);
    const linhas = linhasProcessos("p.situacao <> 'cancelado'");
    const hj = hoje();
    return cs.map((c) => {
      const ps = linhas.filter((l) => l.cliente_id === c.id);
      const ativos = ps.filter((l) => l.situacao === 'andamento');
      const fin = R.financeiroCliente(b, c.id, hj);
      return { ...c, processos: ps.map((p) => ({ id: p.id, numero: p.numero, servico_nome: p.servico_nome, situacao: p.situacao })),
        proxima: ativos[0]?.proxima || (ps.length ? 'Sem processo em andamento' : 'Abrir o primeiro processo'),
        pendencias: ativos.reduce((a, p) => a + p.faltam.length, 0),
        saldos: Object.fromEntries(Object.entries(fin.saldos).filter(([, s]) => s.saldo !== 0).map(([m, s]) => [m, s.saldo])) };
    });
  }

  /* ── clientes ───────────────────────────────────────── */
  rota('GET', '/api/clientes', () => ({ clientes: listarClientes(null) }));
  rota('GET', '/api/clientes/:id', ({ p }) => ficha(p.id));

  rota('POST', '/api/clientes', ({ u, corpo }) => {
    const nome = U.texto(corpo.nome, 'nome', { obrigatorio: true, max: 160 });
    const whatsapp = U.whatsapp(corpo.whatsapp);
    const cidadeId = cidadeValida(corpo.cidade_id);
    const igual = b.um('SELECT id, nome FROM clientes WHERE whatsapp = :w', { w: whatsapp });
    if (igual && !corpo.confirmar_mesmo_whatsapp) {
      throw Object.assign(new ErroHttp(409, `Já existe a ficha de ${igual.nome} com este WhatsApp. Abra a ficha existente para acrescentar o serviço, ou confirme que é outra pessoa.`),
        { extra: { cliente_existente: igual.id } });
    }
    return b.tx(() => {
      const agora = agoraIso();
      const r = b.exec(`INSERT INTO clientes (nome, whatsapp, cidade_id, responsavel_id, criado_em, atualizado_em)
        VALUES (:n, :w, :c, :r, :a, :a)`, { n: nome, w: whatsapp, c: cidadeId, r: u.id, a: agora });
      const id = Number(r.lastInsertRowid);
      hist(u, 'cliente', id, id, 'Cliente cadastrado', { nome, whatsapp });
      let processo_id = null;
      if (corpo.servico_id) processo_id = criarProcesso(u, { cliente_id: id, servico_id: corpo.servico_id, cidade_id: cidadeId, modalidade: corpo.modalidade });
      return { id, processo_id };
    });
  });

  rota('PUT', '/api/clientes/:id', ({ u, p, corpo }) => {
    const c = cliente(p.id);
    const novo = {
      nome: U.texto(corpo.nome, 'nome', { obrigatorio: true, max: 160 }),
      whatsapp: U.whatsapp(corpo.whatsapp),
      email: U.email(corpo.email),
      nascimento: U.data(corpo.nascimento, 'data de nascimento'),
      nacionalidade: U.texto(corpo.nacionalidade, 'nacionalidade', { max: 80 }),
      documento_tipo: U.umDe(corpo.documento_tipo || null, ['RG', 'Passaporte', 'RG e passaporte', null], 'tipo de documento', { obrigatorio: false }),
      documento_numero: U.texto(corpo.documento_numero, 'número do documento', { max: 60 }),
      estado_civil: U.texto(corpo.estado_civil, 'estado civil', { max: 40 }),
      perfil_comercial: U.umDe(corpo.perfil_comercial || null, [...PERFIS_COMERCIAIS, null], 'perfil comercial', { obrigatorio: false }),
      responsavel_id: usuarioValido(corpo.responsavel_id),
      cidade_id: cidadeValida(corpo.cidade_id),
      observacoes: U.texto(corpo.observacoes, 'observações', { max: 4000 }),
      aceita_mensagens: U.bool(corpo.aceita_mensagens),
      mensagens_tipos: JSON.stringify((Array.isArray(corpo.mensagens_tipos) ? corpo.mensagens_tipos : []).filter((t) => TIPOS_MSG.includes(t))),
      preferencias: U.texto(corpo.preferencias, 'preferências', { max: 1000 }),
    };
    if (novo.nascimento && novo.nascimento > hoje()) throw new ErroHttp(400, 'Data de nascimento no futuro.');
    const mudou = Object.keys(novo).filter((k) => String(c[k] ?? '') !== String(novo[k] ?? ''));
    b.exec(`UPDATE clientes SET nome=:nome, whatsapp=:whatsapp, email=:email, nascimento=:nascimento, nacionalidade=:nacionalidade,
      documento_tipo=:documento_tipo, documento_numero=:documento_numero, estado_civil=:estado_civil, perfil_comercial=:perfil_comercial,
      responsavel_id=:responsavel_id, cidade_id=:cidade_id, observacoes=:observacoes, aceita_mensagens=:aceita_mensagens,
      mensagens_tipos=:mensagens_tipos, preferencias=:preferencias, atualizado_em=:agora WHERE id=:id`, { ...novo, agora: agoraIso(), id: c.id });
    if (mudou.length) {
      const detalhe = Object.fromEntries(mudou.map((k) => [k, { antes: c[k] ?? null, depois: novo[k] ?? null }]));
      if (c.aceita_mensagens !== novo.aceita_mensagens) {
        hist(u, 'cliente', c.id, c.id, novo.aceita_mensagens ? 'Cliente autorizou mensagens' : 'Cliente retirou autorização de mensagens', null);
      }
      hist(u, 'cliente', c.id, c.id, 'Dados do cliente alterados', detalhe);
    }
    return { ok: true };
  });

  /* ── processos ──────────────────────────────────────── */
  rota('POST', '/api/processos', ({ u, corpo }) => b.tx(() => ({ id: criarProcesso(u, corpo) })));

  rota('PUT', '/api/processos/:id', ({ u, p, corpo }) => {
    const pr = processo(p.id);
    const etapas = json(pr.etapas, []);
    /* atualização parcial: campo ausente mantém o valor atual */
    const ou = (k, fn) => (corpo[k] === undefined ? pr[k] : fn(corpo[k]));
    const novo = {
      modalidade: ou('modalidade', (v) => U.texto(v, 'modalidade', { max: 120 })),
      cidade_id: ou('cidade_id', (v) => cidadeValida(v)),
      responsavel_id: ou('responsavel_id', (v) => usuarioValido(v)),
      proxima_acao: ou('proxima_acao', (v) => U.texto(v, 'próximo passo', { max: 300 })),
      observacoes: ou('observacoes', (v) => U.texto(v, 'observações', { max: 4000 })),
      etapa_idx: ou('etapa_idx', (v) => U.inteiro(v, 'etapa', { obrigatorio: true, min: 0, max: Math.max(0, etapas.length - 1) })),
      prazo_dias: ou('prazo_dias', (v) => U.inteiro(v, 'prazo', { min: 1, max: 3650 })),
      protocolo_numero: ou('protocolo_numero', (v) => U.texto(v, 'número do protocolo', { max: 80 })),
      cliente_proximo_passo: ou('cliente_proximo_passo', (v) => U.texto(v, 'próximo passo para o cliente', { max: 500 })),
      cliente_quem: ou('cliente_quem', (v) => U.umDe(v || null, ['cliente', 'equipe', 'orgao', null], 'quem faz', { obrigatorio: false })),
      cliente_orientacoes: ou('cliente_orientacoes', (v) => U.texto(v, 'orientações para o cliente', { max: 3000 })),
      mostrar_responsavel: ou('mostrar_responsavel', (v) => U.bool(v)),
    };
    /* ao mudar de etapa, um próximo passo escrito à mão deixa de valer */
    if (novo.etapa_idx !== pr.etapa_idx && corpo.proxima_acao === undefined) novo.proxima_acao = null;
    const previsao = pr.protocolo_data && novo.prazo_dias ? addDias(pr.protocolo_data, novo.prazo_dias) : pr.previsao;
    const mudou = Object.keys(novo).filter((k) => String(pr[k] ?? '') !== String(novo[k] ?? ''));
    b.exec(`UPDATE processos SET modalidade=:modalidade, cidade_id=:cidade_id, responsavel_id=:responsavel_id, proxima_acao=:proxima_acao,
      observacoes=:observacoes, etapa_idx=:etapa_idx, prazo_dias=:prazo_dias, protocolo_numero=:protocolo_numero, previsao=:previsao,
      cliente_proximo_passo=:cliente_proximo_passo, cliente_quem=:cliente_quem, cliente_orientacoes=:cliente_orientacoes,
      mostrar_responsavel=:mostrar_responsavel, atualizado_em=:agora WHERE id=:id`, { ...novo, previsao, agora: agoraIso(), id: pr.id });
    /* o que o cliente vê: etapa, previsão e orientações publicadas */
    if (novo.etapa_idx !== pr.etapa_idx) {
      P.marcarEtapa(pr.id, novo.etapa_idx);
      P.publicar(u, pr, `Etapa atual: ${etapas[novo.etapa_idx]?.nome}.`);
    }
    if (previsao !== pr.previsao && previsao) P.publicar(u, pr, `Nova previsão estimada: ${R.br(previsao)}. É uma estimativa, não uma data confirmada.`);
    if (['cliente_proximo_passo', 'cliente_quem', 'cliente_orientacoes'].some((k) => mudou.includes(k)) &&
      (novo.cliente_proximo_passo || novo.cliente_orientacoes)) P.publicar(u, pr, 'A equipe atualizou o próximo passo e as orientações deste processo.');
    else if (['mostrar_responsavel', 'cidade_id', 'cliente_proximo_passo', 'cliente_orientacoes'].some((k) => mudou.includes(k))) P.tocar(pr.id);
    if (mudou.length) {
      const d = Object.fromEntries(mudou.map((k) => [k, { antes: pr[k] ?? null, depois: novo[k] ?? null }]));
      if (d.etapa_idx) d.etapa_idx = { antes: etapas[pr.etapa_idx]?.nome, depois: etapas[novo.etapa_idx]?.nome };
      if (previsao !== pr.previsao) d.previsao = { antes: pr.previsao, depois: previsao };
      hist(u, 'processo', pr.id, pr.cliente_id, mudou.length === 1 && mudou[0] === 'etapa_idx' ? 'Etapa alterada' : 'Processo alterado', d);
    }
    return { ok: true };
  });

  rota('POST', '/api/processos/:id/protocolo', ({ u, p, corpo }) => {
    const pr = processo(p.id);
    if (pr.situacao !== 'andamento') throw new ErroHttp(400, 'Processo não está em andamento.');
    const dataP = U.data(corpo.data, 'data do protocolo', { obrigatorio: true });
    const prazo = U.inteiro(corpo.prazo_dias, 'prazo estimado em dias', { obrigatorio: true, min: 1, max: 3650 });
    const numero = U.texto(corpo.numero, 'número do protocolo', { max: 80 });
    const previsao = addDias(dataP, prazo);
    const idx = moverParaMarco(pr, 'protocolo', true);
    b.exec(`UPDATE processos SET protocolo_numero=:n, protocolo_data=:d, prazo_dias=:pz, previsao=:pv, etapa_idx=:i, proxima_acao=NULL,
      atualizado_em=:a WHERE id=:id`, { n: numero, d: dataP, pz: prazo, pv: previsao, i: idx, a: agoraIso(), id: pr.id });
    hist(u, 'processo', pr.id, pr.cliente_id, 'Protocolo registrado', { numero, data: dataP, prazo_dias: prazo, previsao });
    P.marcarEtapa(pr.id, idx);
    P.publicar(u, pr, `Protocolo registrado em ${R.br(dataP)}. Previsão estimada: ${R.br(previsao)} (estimativa, não é data confirmada).`);
    return { ok: true, previsao };
  });

  rota('POST', '/api/processos/:id/recebido', ({ u, p, corpo }) => b.tx(() => {
    const pr = processo(p.id);
    if (pr.situacao !== 'andamento') throw new ErroHttp(400, 'Processo não está em andamento.');
    const dataR = U.data(corpo.data, 'data do recebimento', { obrigatorio: true });
    if (pr.protocolo_data && dataR < pr.protocolo_data) throw new ErroHttp(400, 'O recebimento não pode ser antes do protocolo.');
    const serv = R.catalogo(b).servicos.get(pr.servico_id);
    let docId = null;
    if (serv?.doc_resultante_id && corpo.registrar_documento !== false) {
      docId = novaVersao(u, pr.cliente_id, serv.doc_resultante_id, {
        emissao: corpo.emissao, validade: corpo.validade, original: 1, arquivo: corpo.arquivo,
        observacoes: `Recebido no processo ${pr.numero}`,
      });
    }
    b.exec(`UPDATE processos SET recebido_em=:d, documento_resultado_id=COALESCE(:doc, documento_resultado_id), etapa_idx=:i,
      proxima_acao=NULL, atualizado_em=:a WHERE id=:id`, { d: dataR, doc: docId, i: moverParaMarco(pr, 'recebido'), a: agoraIso(), id: pr.id });
    hist(u, 'processo', pr.id, pr.cliente_id, 'Documento recebido do órgão',
      { data: dataR, emissao: corpo.emissao || null, validade: corpo.validade || null });
    P.marcarEtapa(pr.id, moverParaMarco(pr, 'recebido'));
    P.publicar(u, pr, `O documento foi emitido e recebido pela equipe em ${R.br(dataR)}. A entrega será combinada com você.`);
    return { ok: true };
  }));

  rota('POST', '/api/processos/:id/entregue', ({ u, p, corpo }) => {
    const pr = processo(p.id);
    if (pr.situacao !== 'andamento') throw new ErroHttp(400, 'Processo não está em andamento.');
    if (!pr.recebido_em) throw new ErroHttp(400, 'Registre primeiro o recebimento do documento.');
    const dataE = U.data(corpo.data, 'data da entrega', { obrigatorio: true });
    if (dataE < pr.recebido_em) throw new ErroHttp(400, 'A entrega não pode ser antes do recebimento.');
    b.exec(`UPDATE processos SET entregue_em=:d, situacao='concluido', etapa_idx=:i, proxima_acao=NULL, atualizado_em=:a WHERE id=:id`,
      { d: dataE, i: moverParaMarco(pr, 'entregue'), a: agoraIso(), id: pr.id });
    hist(u, 'processo', pr.id, pr.cliente_id, 'Entregue ao cliente — processo concluído', { data: dataE });
    P.marcarEtapa(pr.id, moverParaMarco(pr, 'entregue'));
    P.publicar(u, pr, `Documento entregue em ${R.br(dataE)}. Processo concluído.`);
    return { ok: true };
  });

  rota('POST', '/api/processos/:id/cancelar', ({ u, p, corpo }) => {
    const pr = processo(p.id);
    const motivo = U.texto(corpo.motivo, 'motivo do cancelamento', { obrigatorio: true, max: 500 });
    if (pr.situacao !== 'andamento') throw new ErroHttp(400, 'Processo não está em andamento.');
    b.exec("UPDATE processos SET situacao='cancelado', atualizado_em=:a WHERE id=:id", { a: agoraIso(), id: pr.id });
    hist(u, 'processo', pr.id, pr.cliente_id, 'Processo cancelado', { motivo });
    P.tocar(pr.id);
    return { ok: true };
  });

  /* processo seguinte (ex.: cédula depois da residência) ou renovação; o anterior fica intacto */
  rota('POST', '/api/processos/:id/derivar', ({ u, p, corpo }) => b.tx(() => {
    const pr = processo(p.id);
    const vinculo = U.umDe(corpo.vinculo, ['seguinte', 'renovacao'], 'tipo de vínculo');
    if (vinculo === 'seguinte' && !pr.recebido_em) throw new ErroHttp(400, 'Registre o recebimento antes de abrir o processo seguinte.');
    const id = criarProcesso(u, { cliente_id: pr.cliente_id, servico_id: corpo.servico_id || pr.servico_id, cidade_id: corpo.cidade_id ?? pr.cidade_id,
      modalidade: corpo.modalidade, responsavel_id: pr.responsavel_id, origem_id: pr.id, vinculo });
    hist(u, 'processo', pr.id, pr.cliente_id, vinculo === 'renovacao' ? 'Renovação aberta a partir deste processo' : 'Processo seguinte aberto',
      { novo: b.um('SELECT numero FROM processos WHERE id = :id', { id }).numero });
    return { id };
  }));

  rota('POST', '/api/processos/:id/prioridade', ({ u, p, corpo }) => b.tx(() => {
    const pr = processo(p.id);
    const just = U.texto(corpo.justificativa, 'qual é o procedimento oficial e onde ele está publicado', { obrigatorio: true, max: 1000 });
    if (!corpo.arquivo?.base64) throw new ErroHttp(400, 'Anexe o comprovante oficial do trâmite prioritário (boleta ou resolução).');
    const arq = anexo(corpo.arquivo, pr.cliente_id, u);
    b.exec('UPDATE processos SET prioridade_justificativa=:j, prioridade_arquivo_id=:a, atualizado_em=:agora WHERE id=:id',
      { j: just, a: arq, agora: agoraIso(), id: pr.id });
    hist(u, 'processo', pr.id, pr.cliente_id, 'Trâmite prioritário oficial registrado', { justificativa: just });
    return { ok: true };
  }));

  rota('POST', '/api/processos/:id/checklist', ({ u, p, corpo }) => {
    const pr = processo(p.id);
    const tipo = b.um('SELECT * FROM doc_tipos WHERE id = :id', { id: Number(corpo.tipo_id) });
    if (!tipo) throw new ErroHttp(400, 'Tipo de documento inválido.');
    if (b.um('SELECT id FROM checklist WHERE processo_id = :p AND tipo_id = :t', { p: pr.id, t: tipo.id })) throw new ErroHttp(409, 'Este documento já está na lista.');
    const doc = docAtual(pr.cliente_id, tipo.id);
    const valido = doc && (!doc.validade || doc.validade >= hoje());
    b.exec(`INSERT INTO checklist (processo_id, tipo_id, status, documento_id, opcional, exige_recente_dias)
      VALUES (:p, :t, :s, :d, :o, :r)`, { p: pr.id, t: tipo.id, s: valido ? 'recebido' : 'pendente', d: valido ? doc.id : null,
      o: U.bool(corpo.opcional), r: U.inteiro(corpo.exige_recente_dias, 'dias de emissão', { min: 1, max: 3650 }) });
    hist(u, 'processo', pr.id, pr.cliente_id, 'Documento acrescentado à lista', { tipo: tipo.nome });
    return { ok: true };
  });

  /* ── checklist e documentos ─────────────────────────── */
  const itemCk = (id) => {
    const it = b.um(`SELECT k.*, p.cliente_id, p.numero, t.nome AS tipo_nome FROM checklist k JOIN processos p ON p.id = k.processo_id
      JOIN doc_tipos t ON t.id = k.tipo_id WHERE k.id = :id`, { id: Number(id) });
    if (!it) throw new ErroHttp(404, 'Item não encontrado.');
    return it;
  };

  rota('PUT', '/api/checklist/:id', ({ u, p, corpo }) => {
    const it = itemCk(p.id);
    const status = U.umDe(corpo.status, ['pendente', 'solicitado', 'recebido', 'nao_aplicavel'], 'situação');
    if (status === 'recebido' && !it.documento_id) throw new ErroHttp(400, 'Para marcar como recebido, registre o documento.');
    const novo = {
      status,
      documento_id: status === 'recebido' ? it.documento_id : null,
      responsavel_id: usuarioValido(corpo.responsavel_id),
      solicitado_em: status === 'solicitado' ? (U.data(corpo.solicitado_em, 'data da solicitação') || hoje()) : U.data(corpo.solicitado_em, 'data da solicitação'),
      observacoes: U.texto(corpo.observacoes, 'observações', { max: 1000 }),
      exige_recente_dias: U.inteiro(corpo.exige_recente_dias, 'dias de emissão', { min: 1, max: 3650 }),
      orientacao_cliente: corpo.orientacao_cliente === undefined ? it.orientacao_cliente : U.texto(corpo.orientacao_cliente, 'orientação para o cliente', { max: 1000 }),
    };
    b.exec(`UPDATE checklist SET status=:status, documento_id=:documento_id, responsavel_id=:responsavel_id, solicitado_em=:solicitado_em,
      observacoes=:observacoes, exige_recente_dias=:exige_recente_dias, orientacao_cliente=:orientacao_cliente WHERE id=:id`, { ...novo, id: it.id });
    P.tocar(it.processo_id);
    const rot = { pendente: 'Pendente', solicitado: 'Solicitado', recebido: 'Recebido', nao_aplicavel: 'Não se aplica' };
    hist(u, 'processo', it.processo_id, it.cliente_id, `${it.tipo_nome}: ${rot[status]}`,
      { antes: rot[it.status], depois: rot[status], solicitado_em: novo.solicitado_em, observacoes: novo.observacoes });
    return { ok: true };
  });

  rota('POST', '/api/checklist/:id/documento', ({ u, p, corpo }) => b.tx(() => {
    const it = itemCk(p.id);
    const docId = novaVersao(u, it.cliente_id, it.tipo_id, corpo);
    b.exec("UPDATE checklist SET documento_id = :d, status = 'recebido' WHERE id = :id", { d: docId, id: it.id });
    P.tocar(it.processo_id);
    return { id: docId };
  }));

  rota('POST', '/api/checklist/:id/reusar', ({ u, p, corpo }) => {
    const it = itemCk(p.id);
    const doc = b.um('SELECT * FROM documentos WHERE id = :id', { id: Number(corpo.documento_id) });
    if (!doc || doc.cliente_id !== it.cliente_id || doc.tipo_id !== it.tipo_id) throw new ErroHttp(400, 'Documento não pertence a este cliente ou não é deste tipo.');
    b.exec("UPDATE checklist SET documento_id = :d, status = 'recebido' WHERE id = :id", { d: doc.id, id: it.id });
    hist(u, 'processo', it.processo_id, it.cliente_id, `${it.tipo_nome}: documento já existente reaproveitado`, { versao: doc.versao });
    P.tocar(it.processo_id);
    return { ok: true };
  });

  rota('POST', '/api/clientes/:id/documentos', ({ u, p, corpo }) => b.tx(() => {
    const c = cliente(p.id);
    return { id: novaVersao(u, c.id, corpo.tipo_id, corpo) };
  }));

  rota('PUT', '/api/documentos/:id', ({ u, p, corpo }) => b.tx(() => {
    const d = b.um('SELECT d.*, t.nome AS tipo_nome FROM documentos d JOIN doc_tipos t ON t.id = d.tipo_id WHERE d.id = :id', { id: Number(p.id) });
    if (!d) throw new ErroHttp(404, 'Documento não encontrado.');
    const novo = {
      emissao: U.data(corpo.emissao, 'emissão'), validade: U.data(corpo.validade, 'validade'),
      original: U.bool(corpo.original), copia: U.bool(corpo.copia), apostilado: U.bool(corpo.apostilado), autenticado: U.bool(corpo.autenticado),
      observacoes: U.texto(corpo.observacoes, 'observações', { max: 1000 }),
    };
    if (novo.emissao && novo.validade && novo.validade < novo.emissao) throw new ErroHttp(400, 'A validade não pode ser anterior à emissão.');
    let arquivoId = d.arquivo_id;
    if (corpo.arquivo?.base64) {
      if (d.arquivo_id) throw new ErroHttp(409, 'Esta versão já tem anexo. Para trocar o arquivo, registre uma nova versão.');
      arquivoId = anexo(corpo.arquivo, d.cliente_id, u);
    }
    b.exec(`UPDATE documentos SET emissao=:emissao, validade=:validade, original=:original, copia=:copia, apostilado=:apostilado,
      autenticado=:autenticado, observacoes=:observacoes, arquivo_id=:arq WHERE id=:id`, { ...novo, arq: arquivoId, id: d.id });
    const mudou = Object.keys(novo).filter((k) => String(d[k] ?? '') !== String(novo[k] ?? ''));
    if (mudou.length || arquivoId !== d.arquivo_id) {
      hist(u, 'documento', d.id, d.cliente_id, `${d.tipo_nome} (versão ${d.versao}) corrigido`,
        { ...Object.fromEntries(mudou.map((k) => [k, { antes: d[k], depois: novo[k] }])), anexo_incluido: arquivoId !== d.arquivo_id });
    }
    return { ok: true };
  }));

  rota('GET', '/api/arquivos/:id', ({ p, q, res }) => {
    const a = b.um('SELECT * FROM arquivos WHERE id = :id', { id: Number(p.id) });
    const caminho = a && caminhoArquivo(b, a.chave);
    if (!caminho || !fs.existsSync(caminho)) throw new ErroHttp(404, 'Arquivo não encontrado.');
    const disp = q.get('baixar') ? 'attachment' : 'inline';
    res.writeHead(200, {
      'Content-Type': a.mime, 'Content-Length': a.tamanho,
      'Content-Disposition': `${disp}; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      ...(a.mime.startsWith('image/') ? { 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" } : {}),
    });
    fs.createReadStream(caminho).pipe(res);
    return undefined;
  });

  /* ── financeiro ─────────────────────────────────────── */
  rota('POST', '/api/lancamentos', ({ u, corpo }) => b.tx(() => {
    const c = cliente(corpo.cliente_id);
    const tipo = U.umDe(corpo.tipo, TIPOS_LANC, 'tipo de lançamento');
    const moeda = U.moeda(corpo.moeda);
    const valor = U.inteiro(corpo.valor, 'valor', { obrigatorio: true, min: 1 });
    const dataL = U.data(corpo.data, 'data', { obrigatorio: true });
    const descricao = U.texto(corpo.descricao, 'descrição', { obrigatorio: true, max: 300 });
    let processoId = null;
    if (corpo.processo_id) {
      const pr = processo(corpo.processo_id);
      if (pr.cliente_id !== c.id) throw new ErroHttp(400, 'O processo não é deste cliente.');
      processoId = pr.id;
    }
    let parcelaId = null;
    if (corpo.parcela_id) {
      if (tipo !== 'pagamento') throw new ErroHttp(400, 'Só pagamentos se ligam a parcelas.');
      const pc = b.um('SELECT * FROM parcelas WHERE id = :id AND cliente_id = :c AND anulada = 0', { id: Number(corpo.parcela_id), c: c.id });
      if (!pc) throw new ErroHttp(400, 'Parcela inválida.');
      if (pc.moeda !== moeda) throw new ErroHttp(400, `Esta parcela é em ${pc.moeda}. Registre o pagamento em ${pc.moeda}, com a conversão documentada.`);
      parcelaId = pc.id;
    }
    let moedaOriginal = null; let valorOriginal = null; let cambio = null;
    if (corpo.moeda_original && corpo.moeda_original !== moeda) {
      moedaOriginal = U.moeda(corpo.moeda_original);
      valorOriginal = U.inteiro(corpo.valor_original, 'valor recebido na outra moeda', { obrigatorio: true, min: 1 });
      cambio = U.texto(corpo.cambio_nota, 'cotação usada e a fonte', { obrigatorio: true, max: 300 });
    }
    let adicional = null;
    if (tipo === 'honorario' && processoId) {
      const pr = processo(processoId);
      const pac = b.todos('SELECT * FROM pacotes WHERE cliente_id = :c AND anulado = 0', { c: c.id })
        .find((x) => json(x.servicos, []).includes(pr.servico_id));
      if (pac) {
        adicional = U.texto(corpo.adicional_justificativa, 'justificativa', { max: 500 });
        if (!adicional) {
          throw Object.assign(new ErroHttp(409, `Este serviço já está incluído no pacote "${pac.nome}". Para cobrar à parte, informe o motivo da cobrança adicional.`),
            { extra: { pede_justificativa: true } });
        }
      }
    }
    const prioridade = U.bool(corpo.prioridade_oficial);
    if (prioridade && (tipo !== 'taxa' || !corpo.arquivo?.base64)) {
      throw new ErroHttp(400, 'Prioridade só como taxa oficial, com o comprovante oficial anexado.');
    }
    const arq = anexo(corpo.arquivo, c.id, u);
    const r = b.exec(`INSERT INTO lancamentos (cliente_id, processo_id, pacote_id, parcela_id, tipo, descricao, moeda, valor, data, forma, arquivo_id,
        moeda_original, valor_original, cambio_nota, adicional_justificativa, prioridade_oficial, criado_por, criado_em)
      VALUES (:c, :p, NULL, :pc, :t, :d, :m, :v, :dt, :f, :a, :mo, :vo, :cn, :ad, :pr, :u, :em)`, {
      c: c.id, p: processoId, pc: parcelaId, t: tipo, d: descricao, m: moeda, v: valor, dt: dataL,
      f: U.texto(corpo.forma, 'forma de pagamento', { max: 60 }), a: arq, mo: moedaOriginal, vo: valorOriginal, cn: cambio,
      ad: adicional, pr: prioridade, u: u.id, em: agoraIso(),
    });
    const ROT = { honorario: 'Honorário lançado', taxa: 'Taxa oficial lançada', custo: 'Custo documental lançado', desconto: 'Desconto concedido', pagamento: 'Pagamento recebido' };
    hist(u, 'lancamento', Number(r.lastInsertRowid), c.id, ROT[tipo], { descricao, moeda, valor, data: dataL, comprovante: !!arq, adicional });
    return { id: Number(r.lastInsertRowid) };
  }));

  rota('POST', '/api/lancamentos/:id/anular', ({ u, p, corpo }) => {
    const l = b.um('SELECT * FROM lancamentos WHERE id = :id', { id: Number(p.id) });
    if (!l) throw new ErroHttp(404, 'Lançamento não encontrado.');
    if (l.anulado_em) throw new ErroHttp(400, 'Já anulado.');
    const motivo = U.texto(corpo.motivo, 'motivo', { obrigatorio: true, max: 300 });
    b.exec('UPDATE lancamentos SET anulado_em = :a, anulado_motivo = :m WHERE id = :id', { a: agoraIso(), m: motivo, id: l.id });
    hist(u, 'lancamento', l.id, l.cliente_id, 'Lançamento anulado', { descricao: l.descricao, moeda: l.moeda, valor: l.valor, motivo });
    return { ok: true };
  }, { admin: true });

  rota('POST', '/api/parcelas', ({ u, corpo }) => b.tx(() => {
    const c = cliente(corpo.cliente_id);
    const lista = Array.isArray(corpo.parcelas) ? corpo.parcelas : [corpo];
    if (!lista.length || lista.length > 60) throw new ErroHttp(400, 'Informe de 1 a 60 parcelas.');
    let processoId = null;
    if (corpo.processo_id) { const pr = processo(corpo.processo_id); if (pr.cliente_id !== c.id) throw new ErroHttp(400, 'Processo de outro cliente.'); processoId = pr.id; }
    const ids = lista.map((x) => Number(b.exec(`INSERT INTO parcelas (cliente_id, processo_id, descricao, moeda, valor, vencimento, criado_em)
      VALUES (:c, :p, :d, :m, :v, :ven, :em)`, {
      c: c.id, p: processoId, d: U.texto(x.descricao, 'descrição', { obrigatorio: true, max: 200 }), m: U.moeda(x.moeda),
      v: U.inteiro(x.valor, 'valor', { obrigatorio: true, min: 1 }), ven: U.data(x.vencimento, 'vencimento', { obrigatorio: true }), em: agoraIso(),
    }).lastInsertRowid));
    hist(u, 'parcela', null, c.id, `${ids.length} parcela(s) programada(s)`, lista.map((x) => ({ descricao: x.descricao, moeda: x.moeda, valor: x.valor, vencimento: x.vencimento })));
    return { ids };
  }));

  rota('POST', '/api/parcelas/:id/anular', ({ u, p, corpo }) => {
    const pc = b.um('SELECT * FROM parcelas WHERE id = :id', { id: Number(p.id) });
    if (!pc) throw new ErroHttp(404, 'Parcela não encontrada.');
    const motivo = U.texto(corpo.motivo, 'motivo', { obrigatorio: true, max: 300 });
    b.exec('UPDATE parcelas SET anulada = 1 WHERE id = :id', { id: pc.id });
    hist(u, 'parcela', pc.id, pc.cliente_id, 'Parcela anulada', { descricao: pc.descricao, motivo });
    return { ok: true };
  }, { admin: true });

  rota('POST', '/api/pacotes', ({ u, corpo }) => b.tx(() => {
    const c = cliente(corpo.cliente_id);
    const nome = U.texto(corpo.nome, 'nome do pacote', { obrigatorio: true, max: 120 });
    const cat = R.catalogo(b);
    const servs = (Array.isArray(corpo.servicos) ? corpo.servicos : []).map(Number).filter((id) => cat.servicos.has(id));
    if (servs.length < 1) throw new ErroHttp(400, 'Escolha os serviços incluídos no pacote.');
    const moeda = U.moeda(corpo.moeda);
    const valor = U.inteiro(corpo.valor, 'valor do pacote', { obrigatorio: true, min: 1 });
    const dataL = U.data(corpo.data, 'data', { obrigatorio: true });
    const agora = agoraIso();
    const pid = Number(b.exec('INSERT INTO pacotes (cliente_id, nome, servicos, observacoes, criado_em) VALUES (:c, :n, :s, :o, :a)',
      { c: c.id, n: nome, s: JSON.stringify(servs), o: U.texto(corpo.observacoes, 'observações', { max: 500 }), a: agora }).lastInsertRowid);
    b.exec(`INSERT INTO lancamentos (cliente_id, pacote_id, tipo, descricao, moeda, valor, data, criado_por, criado_em)
      VALUES (:c, :p, 'honorario', :d, :m, :v, :dt, :u, :a)`, { c: c.id, p: pid, d: `Pacote: ${nome}`, m: moeda, v: valor, dt: dataL, u: u.id, a: agora });
    hist(u, 'pacote', pid, c.id, 'Pacote contratado', { nome, servicos: servs.map((id) => cat.servicos.get(id).nome), moeda, valor });
    return { id: pid };
  }));

  rota('GET', '/api/financeiro', () => {
    const hj = hoje();
    const mes = hj.slice(0, 7);
    const clientes = b.todos('SELECT id, nome FROM clientes ORDER BY nome');
    const aReceber = [];
    const parcelas = [];
    for (const c of clientes) {
      const f = R.financeiroCliente(b, c.id, hj);
      for (const [m, s] of Object.entries(f.saldos)) if (s.saldo !== 0) aReceber.push({ cliente_id: c.id, cliente_nome: c.nome, moeda: m, ...s });
      for (const p of f.parcelas) {
        if (p.anulada || p.falta === 0) continue;
        if (p.vencimento <= addDias(hj, 30)) parcelas.push({ ...p, cliente_nome: c.nome });
      }
    }
    const recebidoMes = b.todos(`SELECT moeda, SUM(valor) AS total, COUNT(*) AS n FROM lancamentos
      WHERE tipo = 'pagamento' AND anulado_em IS NULL AND substr(data, 1, 7) = :m GROUP BY moeda`, { m: mes });
    const assinaturas = b.todos(`SELECT a.*, u.nome AS responsavel_nome FROM assinaturas a LEFT JOIN usuarios u ON u.id = a.responsavel_id
      ORDER BY a.ativo DESC, a.vencimento`);
    return { hoje: hj, a_receber: aReceber, parcelas: parcelas.sort((a, x) => a.vencimento.localeCompare(x.vencimento)), recebido_mes: recebidoMes, assinaturas };
  });

  /* ── agenda ─────────────────────────────────────────── */
  rota('GET', '/api/agenda', ({ q }) => {
    const hj = hoje();
    const de = U.data(q.get('de'), 'início') || addDias(hj, -7);
    const ate = U.data(q.get('ate'), 'fim') || addDias(hj, 60);
    return {
      de, ate,
      eventos: b.todos(`SELECT g.*, c.nome AS cliente_nome, p.numero AS processo_numero, u.nome AS responsavel_nome FROM agenda g
        LEFT JOIN clientes c ON c.id = g.cliente_id LEFT JOIN processos p ON p.id = g.processo_id LEFT JOIN usuarios u ON u.id = g.responsavel_id
        WHERE g.data BETWEEN :de AND :ate AND g.cancelado = 0 ORDER BY g.data, g.hora`, { de, ate }),
      avisos: b.todos(`SELECT * FROM lembretes WHERE situacao = 'ativo' AND data_aviso BETWEEN :de AND :ate ORDER BY data_aviso`, { de, ate }),
    };
  });

  function lerAgenda(corpo) {
    const v = {
      tipo: U.umDe(corpo.tipo, ['atendimento', 'tarefa'], 'tipo'),
      titulo: U.texto(corpo.titulo, 'título', { obrigatorio: true, max: 200 }),
      data: U.data(corpo.data, 'data', { obrigatorio: true }),
      hora: U.hora(corpo.hora),
      local: U.texto(corpo.local, 'local', { max: 200 }),
      cliente_id: corpo.cliente_id ? cliente(corpo.cliente_id).id : null,
      processo_id: null,
      responsavel_id: usuarioValido(corpo.responsavel_id),
      avisar_cliente: U.bool(corpo.avisar_cliente),
      visivel_cliente: U.bool(corpo.visivel_cliente),
      observacoes: U.texto(corpo.observacoes, 'observações', { max: 1000 }),
    };
    if (corpo.processo_id) {
      const pr = processo(corpo.processo_id);
      if (v.cliente_id && pr.cliente_id !== v.cliente_id) throw new ErroHttp(400, 'Processo de outro cliente.');
      v.processo_id = pr.id; v.cliente_id = pr.cliente_id;
    }
    if ((v.avisar_cliente || v.visivel_cliente) && !v.cliente_id) throw new ErroHttp(400, 'Escolha o cliente.');
    if (v.visivel_cliente && !v.processo_id) throw new ErroHttp(400, 'Para mostrar na Área do cliente, ligue o compromisso a um processo.');
    return v;
  }
  function avisarAgenda(id, v) {
    if (!v.visivel_cliente) return;
    P.tocar(v.processo_id);
    P.notificar(v.cliente_id, 'agenda', `Agendamento: ${v.titulo} em ${R.br(v.data)}${v.hora ? ' às ' + v.hora : ''}`,
      `#/processo/${v.processo_id}`, `ag:${id}:${v.data}:${v.hora || ''}`);
  }

  rota('POST', '/api/agenda', ({ u, corpo }) => {
    const v = lerAgenda(corpo);
    const r = b.exec(`INSERT INTO agenda (tipo, titulo, data, hora, local, cliente_id, processo_id, responsavel_id, avisar_cliente, visivel_cliente, observacoes, criado_em)
      VALUES (:tipo, :titulo, :data, :hora, :local, :cliente_id, :processo_id, :responsavel_id, :avisar_cliente, :visivel_cliente, :observacoes, :em)`, { ...v, em: agoraIso() });
    avisarAgenda(Number(r.lastInsertRowid), v);
    hist(u, 'agenda', Number(r.lastInsertRowid), v.cliente_id, v.tipo === 'atendimento' ? 'Atendimento agendado' : 'Tarefa criada',
      { titulo: v.titulo, data: v.data, hora: v.hora, local: v.local });
    return { id: Number(r.lastInsertRowid) };
  });

  rota('PUT', '/api/agenda/:id', ({ u, p, corpo }) => {
    const g = b.um('SELECT * FROM agenda WHERE id = :id', { id: Number(p.id) });
    if (!g) throw new ErroHttp(404, 'Compromisso não encontrado.');
    if (corpo.acao === 'concluir' || corpo.acao === 'reabrir' || corpo.acao === 'cancelar') {
      const sets = { concluir: "concluido_em = :a", reabrir: 'concluido_em = NULL', cancelar: 'cancelado = 1' }[corpo.acao];
      b.exec(`UPDATE agenda SET ${sets} WHERE id = :id`, corpo.acao === 'concluir' ? { a: agoraIso(), id: g.id } : { id: g.id });
      hist(u, 'agenda', g.id, g.cliente_id, { concluir: 'Compromisso concluído', reabrir: 'Compromisso reaberto', cancelar: 'Compromisso cancelado' }[corpo.acao], { titulo: g.titulo });
      return { ok: true };
    }
    const v = lerAgenda(corpo);
    b.exec(`UPDATE agenda SET tipo=:tipo, titulo=:titulo, data=:data, hora=:hora, local=:local, cliente_id=:cliente_id, processo_id=:processo_id,
      responsavel_id=:responsavel_id, avisar_cliente=:avisar_cliente, visivel_cliente=:visivel_cliente, observacoes=:observacoes WHERE id=:id`, { ...v, id: g.id });
    avisarAgenda(g.id, v);
    hist(u, 'agenda', g.id, v.cliente_id, 'Compromisso alterado', { antes: { data: g.data, hora: g.hora }, depois: { data: v.data, hora: v.hora } });
    return { ok: true };
  });

  rota('POST', '/api/lembretes/:id/visto', ({ u, p }) => {
    const l = b.um('SELECT * FROM lembretes WHERE id = :id', { id: Number(p.id) });
    if (!l) throw new ErroHttp(404, 'Aviso não encontrado.');
    b.exec("UPDATE lembretes SET situacao = 'visto', atualizado_em = :a WHERE id = :id", { a: agoraIso(), id: l.id });
    if (l.cliente_id) hist(u, 'lembrete', l.id, l.cliente_id, 'Aviso marcado como visto', { titulo: l.titulo });
    return { ok: true };
  });

  /* ── mensagens ──────────────────────────────────────── */
  const evento = (id, ev, detalhe, u) => b.exec('INSERT INTO mensagem_eventos (mensagem_id, em, evento, detalhe, usuario_id) VALUES (:m, :e, :ev, :d, :u)',
    { m: id, e: agoraIso(), ev, d: detalhe ?? null, u: u?.id ?? null });
  const linkWa = (destino, texto) => `https://wa.me/${String(destino).replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
  const mensagem = (id) => {
    const m = b.um('SELECT * FROM mensagens WHERE id = :id', { id: Number(id) });
    if (!m) throw new ErroHttp(404, 'Mensagem não encontrada.');
    return m;
  };

  rota('GET', '/api/mensagens', () => ({
    whatsapp: { configurado: wa.configurado() },
    mensagens: b.todos(`SELECT m.*, c.nome AS cliente_nome, (SELECT json_group_array(json_object('em', e.em, 'evento', e.evento, 'detalhe', e.detalhe))
        FROM mensagem_eventos e WHERE e.mensagem_id = m.id) AS eventos
      FROM mensagens m JOIN clientes c ON c.id = m.cliente_id ORDER BY m.enviar_em DESC, m.id DESC LIMIT 300`)
      .map((m) => ({ ...m, eventos: json(m.eventos, []) })),
  }));

  rota('POST', '/api/mensagens/:id/abrir', ({ u, p }) => {
    const m = mensagem(p.id);
    if (['cancelada'].includes(m.situacao)) throw new ErroHttp(400, 'Mensagem cancelada.');
    if (['pendente', 'falhou'].includes(m.situacao)) {
      b.exec("UPDATE mensagens SET situacao = 'aberta_manual', atualizado_em = :a WHERE id = :id", { a: agoraIso(), id: m.id });
    }
    evento(m.id, 'aberta_manual', 'WhatsApp aberto com a mensagem pronta. O envio depende de quem está no aparelho.', u);
    return { link: linkWa(m.destino, m.texto) };
  });

  rota('POST', '/api/mensagens/:id/informar-envio', ({ u, p }) => {
    const m = mensagem(p.id);
    if (!['aberta_manual', 'pendente', 'falhou'].includes(m.situacao)) throw new ErroHttp(400, 'Situação não permite.');
    b.exec("UPDATE mensagens SET situacao = 'manual_informado', atualizado_em = :a WHERE id = :id", { a: agoraIso(), id: m.id });
    evento(m.id, 'manual_informado', `Envio manual informado por ${u.nome}. Sem confirmação do serviço.`, u);
    hist(u, 'mensagem', m.id, m.cliente_id, 'Mensagem enviada manualmente (informado)', { texto: m.texto });
    return { ok: true };
  });

  rota('POST', '/api/mensagens/:id/cancelar', ({ u, p }) => {
    const m = mensagem(p.id);
    if (!['pendente', 'falhou', 'aberta_manual'].includes(m.situacao)) throw new ErroHttp(400, 'Situação não permite.');
    b.exec("UPDATE mensagens SET situacao = 'cancelada', atualizado_em = :a WHERE id = :id", { a: agoraIso(), id: m.id });
    evento(m.id, 'cancelada', `Cancelada por ${u.nome}`, u);
    return { ok: true };
  });

  rota('POST', '/api/mensagens/:id/tentar-de-novo', ({ u, p }) => {
    const m = mensagem(p.id);
    if (m.situacao !== 'falhou') throw new ErroHttp(400, 'Só mensagens com falha.');
    if (!wa.configurado()) throw new ErroHttp(400, 'Envio automático não configurado.');
    b.exec("UPDATE mensagens SET situacao = 'pendente', tentativas = 0, proxima_tentativa = NULL, atualizado_em = :a WHERE id = :id", { a: agoraIso(), id: m.id });
    evento(m.id, 'nova_tentativa', `Pedido por ${u.nome}`, u);
    return { ok: true };
  });

  rota('POST', '/api/mensagens/avulsa', ({ u, corpo }) => {
    const c = cliente(corpo.cliente_id);
    const texto = U.texto(corpo.texto, 'mensagem', { obrigatorio: true, max: 1500 });
    const agora = agoraIso();
    const r = b.exec(`INSERT INTO mensagens (chave, cliente_id, modelo_codigo, texto, destino, enviar_em, ref, situacao, criado_em, atualizado_em)
      VALUES (:k, :c, 'avulsa', :t, :d, :hj, :ref, 'aberta_manual', :a, :a)`,
    { k: `avulsa:${crypto.randomUUID()}`, c: c.id, t: texto, d: c.whatsapp, hj: hoje(), ref: `cli:${c.id}`, a: agora });
    evento(Number(r.lastInsertRowid), 'aberta_manual', 'Mensagem avulsa aberta no WhatsApp.', u);
    return { link: linkWa(c.whatsapp, texto) };
  });

  /* ── assinaturas do negócio ─────────────────────────── */
  function lerAssinatura(corpo) {
    const temValor = corpo.valor !== undefined && corpo.valor !== null && corpo.valor !== '';
    return {
      tipo: U.umDe(corpo.tipo, ['dominio', 'assinatura', 'outro'], 'tipo'),
      nome: U.texto(corpo.nome, 'nome', { obrigatorio: true, max: 160 }),
      fornecedor: U.texto(corpo.fornecedor, 'fornecedor', { max: 160 }),
      vencimento: U.data(corpo.vencimento, 'vencimento', { obrigatorio: true }),
      periodicidade: U.umDe(corpo.periodicidade, ['mensal', 'anual', 'unica'], 'periodicidade'),
      moeda: temValor ? U.moeda(corpo.moeda) : null,
      valor: temValor ? U.inteiro(corpo.valor, 'valor', { min: 0 }) : null,
      responsavel_id: usuarioValido(corpo.responsavel_id),
      confirmado: U.bool(corpo.confirmado),
      observacoes: U.texto(corpo.observacoes, 'observações', { max: 500 }),
      ativo: corpo.ativo === undefined ? 1 : U.bool(corpo.ativo),
    };
  }
  rota('POST', '/api/assinaturas', ({ u, corpo }) => {
    const v = lerAssinatura(corpo);
    const r = b.exec(`INSERT INTO assinaturas (tipo, nome, fornecedor, vencimento, periodicidade, moeda, valor, responsavel_id, confirmado, observacoes, ativo, criado_em)
      VALUES (:tipo, :nome, :fornecedor, :vencimento, :periodicidade, :moeda, :valor, :responsavel_id, :confirmado, :observacoes, :ativo, :em)`, { ...v, em: agoraIso() });
    hist(u, 'assinatura', Number(r.lastInsertRowid), null, 'Assinatura cadastrada', v);
    return { id: Number(r.lastInsertRowid) };
  });
  rota('PUT', '/api/assinaturas/:id', ({ u, p, corpo }) => {
    const a = b.um('SELECT * FROM assinaturas WHERE id = :id', { id: Number(p.id) });
    if (!a) throw new ErroHttp(404, 'Não encontrada.');
    const v = lerAssinatura(corpo);
    b.exec(`UPDATE assinaturas SET tipo=:tipo, nome=:nome, fornecedor=:fornecedor, vencimento=:vencimento, periodicidade=:periodicidade, moeda=:moeda,
      valor=:valor, responsavel_id=:responsavel_id, confirmado=:confirmado, observacoes=:observacoes, ativo=:ativo WHERE id=:id`, { ...v, id: a.id });
    hist(u, 'assinatura', a.id, null, 'Assinatura alterada', { antes: { vencimento: a.vencimento, valor: a.valor }, depois: { vencimento: v.vencimento, valor: v.valor } });
    return { ok: true };
  });
  rota('POST', '/api/assinaturas/:id/renovada', ({ u, p }) => {
    const a = b.um('SELECT * FROM assinaturas WHERE id = :id', { id: Number(p.id) });
    if (!a) throw new ErroHttp(404, 'Não encontrada.');
    if (a.periodicidade === 'unica') throw new ErroHttp(400, 'Pagamento único: edite a data manualmente.');
    const novo = addMeses(a.vencimento, a.periodicidade === 'mensal' ? 1 : 12);
    b.exec('UPDATE assinaturas SET vencimento = :v WHERE id = :id', { v: novo, id: a.id });
    hist(u, 'assinatura', a.id, null, 'Renovação registrada', { nome: a.nome, antes: a.vencimento, depois: novo });
    return { vencimento: novo };
  });

  /* ── configurações (administrador) ──────────────────── */
  const CHAVES_CONFIG = ['alertas_documento_dias', 'alertas_assinatura_dias', 'alerta_parcela_dias', 'hora_envio', 'janela_vencimentos_dias'];
  rota('PUT', '/api/config', ({ u, corpo }) => {
    for (const k of CHAVES_CONFIG) {
      if (corpo[k] === undefined) continue;
      let v = String(corpo[k]).trim();
      if (k === 'hora_envio') v = U.hora(v) || '09:00';
      else if (k.endsWith('_dias') && k.startsWith('alertas')) {
        v = lembretes.listaDias(v, '').join(',');
        if (!v) throw new ErroHttp(400, 'Informe pelo menos um prazo de aviso.');
      } else v = String(U.inteiro(v, k, { obrigatorio: true, min: 0, max: 3650 }));
      b.exec('INSERT INTO config (chave, valor) VALUES (:k, :v) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor', { k, v });
    }
    hist(u, 'config', null, null, 'Configuração alterada', Object.fromEntries(CHAVES_CONFIG.filter((k) => corpo[k] !== undefined).map((k) => [k, corpo[k]])));
    return { ok: true };
  }, { admin: true });

  function lerServico(corpo) {
    const tipos = new Set(b.todos('SELECT id FROM doc_tipos').map((x) => x.id));
    const cidades = new Set(b.todos('SELECT id FROM cidades').map((x) => x.id));
    const etapas = (Array.isArray(corpo.etapas) ? corpo.etapas : []).map((e) => ({
      nome: U.texto(e.nome, 'nome da etapa', { obrigatorio: true, max: 120 }),
      descricao: U.texto(e.descricao, 'explicação da etapa', { max: 300 }),
      marco: ['protocolo', 'recebido', 'entregue'].includes(e.marco) ? e.marco : null,
    }));
    if (etapas.length < 2) throw new ErroHttp(400, 'O serviço precisa de pelo menos duas etapas.');
    for (const m of ['protocolo', 'recebido', 'entregue']) {
      if (etapas.filter((e) => e.marco === m).length > 1) throw new ErroHttp(400, 'Cada marcação (protocolo, recebimento, entrega) só pode aparecer uma vez.');
    }
    const checklist = (Array.isArray(corpo.checklist) ? corpo.checklist : []).filter((i) => tipos.has(Number(i.tipo_id))).map((i) => ({
      tipo_id: Number(i.tipo_id), opcional: U.bool(i.opcional),
      exige_recente_dias: U.inteiro(i.exige_recente_dias, 'dias de emissão', { min: 1, max: 3650 }),
      nota: U.texto(i.nota, 'nota', { max: 300 }),
    }));
    const prazos = {};
    for (const [cid, d] of Object.entries(corpo.prazos_cidade || {})) {
      if (cidades.has(Number(cid)) && d !== '' && d != null) prazos[cid] = U.inteiro(d, 'prazo por cidade', { min: 1, max: 3650 });
    }
    const codigosSeg = new Set(b.todos('SELECT codigo FROM servicos').map((x) => x.codigo));
    return {
      nome: U.texto(corpo.nome, 'nome', { obrigatorio: true, max: 120 }),
      grupo: U.texto(corpo.grupo, 'grupo', { max: 60 }),
      modalidades: JSON.stringify((Array.isArray(corpo.modalidades) ? corpo.modalidades : []).map((m) => U.texto(m, 'modalidade', { max: 120 })).filter(Boolean)),
      etapas: JSON.stringify(etapas), checklist: JSON.stringify(checklist),
      prazo_dias: U.inteiro(corpo.prazo_dias, 'prazo estimado', { min: 1, max: 3650 }), prazos_cidade: JSON.stringify(prazos),
      doc_resultante_id: corpo.doc_resultante_id && tipos.has(Number(corpo.doc_resultante_id)) ? Number(corpo.doc_resultante_id) : null,
      segue_para: JSON.stringify((Array.isArray(corpo.segue_para) ? corpo.segue_para : []).filter((c) => codigosSeg.has(c))),
      nota: U.texto(corpo.nota, 'nota', { max: 1000 }), ativo: corpo.ativo === undefined ? 1 : U.bool(corpo.ativo),
    };
  }
  rota('POST', '/api/servicos', ({ u, corpo }) => {
    const v = lerServico(corpo);
    const codigo = 'srv_' + crypto.randomBytes(4).toString('hex');
    const r = b.exec(`INSERT INTO servicos (codigo, nome, grupo, modalidades, etapas, checklist, prazo_dias, prazos_cidade, doc_resultante_id, segue_para, nota, ativo)
      VALUES (:codigo, :nome, :grupo, :modalidades, :etapas, :checklist, :prazo_dias, :prazos_cidade, :doc_resultante_id, :segue_para, :nota, :ativo)`, { ...v, codigo });
    hist(u, 'servico', Number(r.lastInsertRowid), null, 'Serviço criado', { nome: v.nome });
    return { id: Number(r.lastInsertRowid) };
  }, { admin: true });
  rota('PUT', '/api/servicos/:id', ({ u, p, corpo }) => {
    const s = b.um('SELECT * FROM servicos WHERE id = :id', { id: Number(p.id) });
    if (!s) throw new ErroHttp(404, 'Serviço não encontrado.');
    const v = lerServico(corpo);
    b.exec(`UPDATE servicos SET nome=:nome, grupo=:grupo, modalidades=:modalidades, etapas=:etapas, checklist=:checklist, prazo_dias=:prazo_dias,
      prazos_cidade=:prazos_cidade, doc_resultante_id=:doc_resultante_id, segue_para=:segue_para, nota=:nota, ativo=:ativo WHERE id=:id`, { ...v, id: s.id });
    hist(u, 'servico', s.id, null, 'Modelo de serviço alterado (vale para processos novos)', { nome: v.nome });
    return { ok: true };
  }, { admin: true });

  rota('POST', '/api/doc-tipos', ({ u, corpo }) => {
    const nome = U.texto(corpo.nome, 'nome', { obrigatorio: true, max: 120 });
    const r = b.exec('INSERT INTO doc_tipos (codigo, nome, tem_validade, nota) VALUES (:c, :n, :v, :o)',
      { c: 'doc_' + crypto.randomBytes(4).toString('hex'), n: nome, v: U.bool(corpo.tem_validade), o: U.texto(corpo.nota, 'nota', { max: 300 }) });
    hist(u, 'doc_tipo', Number(r.lastInsertRowid), null, 'Tipo de documento criado', { nome });
    return { id: Number(r.lastInsertRowid) };
  }, { admin: true });
  rota('PUT', '/api/doc-tipos/:id', ({ u, p, corpo }) => {
    const nome = U.texto(corpo.nome, 'nome', { obrigatorio: true, max: 120 });
    b.exec('UPDATE doc_tipos SET nome = :n, tem_validade = :v, nota = :o, ativo = :a WHERE id = :id',
      { n: nome, v: U.bool(corpo.tem_validade), o: U.texto(corpo.nota, 'nota', { max: 300 }), a: corpo.ativo === undefined ? 1 : U.bool(corpo.ativo), id: Number(p.id) });
    hist(u, 'doc_tipo', Number(p.id), null, 'Tipo de documento alterado', { nome });
    return { ok: true };
  }, { admin: true });

  rota('POST', '/api/cidades', ({ u, corpo }) => {
    const nome = U.texto(corpo.nome, 'nome da cidade', { obrigatorio: true, max: 80 });
    if (b.um('SELECT id FROM cidades WHERE nome = :n', { n: nome })) throw new ErroHttp(409, 'Cidade já cadastrada.');
    const r = b.exec('INSERT INTO cidades (nome) VALUES (:n)', { n: nome });
    hist(u, 'cidade', Number(r.lastInsertRowid), null, 'Cidade acrescentada', { nome });
    return { id: Number(r.lastInsertRowid) };
  }, { admin: true });
  rota('PUT', '/api/cidades/:id', ({ u, p, corpo }) => {
    const nome = U.texto(corpo.nome, 'nome da cidade', { obrigatorio: true, max: 80 });
    b.exec('UPDATE cidades SET nome = :n, ativo = :a WHERE id = :id', { n: nome, a: corpo.ativo === undefined ? 1 : U.bool(corpo.ativo), id: Number(p.id) });
    hist(u, 'cidade', Number(p.id), null, 'Cidade alterada', { nome });
    return { ok: true };
  }, { admin: true });

  rota('PUT', '/api/modelos/:id', ({ u, p, corpo }) => {
    const texto = U.texto(corpo.texto, 'texto', { obrigatorio: true, max: 1000 });
    const aprovado = U.texto(corpo.modelo_aprovado, 'nome do modelo aprovado', { max: 120 });
    if (aprovado && !/^[a-z0-9_]+$/.test(aprovado)) throw new ErroHttp(400, 'O nome do modelo aprovado usa só letras minúsculas, números e _.');
    b.exec('UPDATE modelos_mensagem SET texto = :t, modelo_aprovado = :m, idioma = :i WHERE id = :id',
      { t: texto, m: aprovado, i: U.texto(corpo.idioma, 'idioma', { max: 10 }) || 'pt_BR', id: Number(p.id) });
    hist(u, 'modelo', Number(p.id), null, 'Modelo de mensagem alterado', { texto });
    return { ok: true };
  }, { admin: true });

  rota('GET', '/api/usuarios', () => ({ usuarios: b.todos('SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios ORDER BY nome') }), { admin: true });
  rota('POST', '/api/usuarios', ({ u, corpo }) => {
    const nome = U.texto(corpo.nome, 'nome', { obrigatorio: true, max: 120 });
    const email = U.email(corpo.email);
    if (!email) throw new ErroHttp(400, 'Informe o e-mail.');
    if (b.um('SELECT id FROM usuarios WHERE email = :e', { e: email })) throw new ErroHttp(409, 'E-mail já cadastrado.');
    U.validarSenhaNova(corpo.senha);
    const r = b.exec('INSERT INTO usuarios (nome, email, senha_hash, perfil, criado_em) VALUES (:n, :e, :h, :p, :a)',
      { n: nome, e: email, h: U.hashSenha(corpo.senha), p: U.umDe(corpo.perfil, ['admin', 'atendente'], 'perfil'), a: agoraIso() });
    hist(u, 'usuario', Number(r.lastInsertRowid), null, 'Usuário criado', { nome, email, perfil: corpo.perfil });
    return { id: Number(r.lastInsertRowid) };
  }, { admin: true });
  rota('PUT', '/api/usuarios/:id', ({ u, p, corpo }) => {
    const alvo = b.um('SELECT * FROM usuarios WHERE id = :id', { id: Number(p.id) });
    if (!alvo) throw new ErroHttp(404, 'Usuário não encontrado.');
    const perfil = U.umDe(corpo.perfil, ['admin', 'atendente'], 'perfil');
    const ativo = U.bool(corpo.ativo);
    if (alvo.id === u.id && (perfil !== 'admin' || !ativo)) throw new ErroHttp(400, 'Você não pode tirar o seu próprio acesso de administrador.');
    b.exec('UPDATE usuarios SET nome = :n, perfil = :p, ativo = :a WHERE id = :id',
      { n: U.texto(corpo.nome, 'nome', { obrigatorio: true, max: 120 }), p: perfil, a: ativo, id: alvo.id });
    if (corpo.senha) { U.validarSenhaNova(corpo.senha); b.exec('UPDATE usuarios SET senha_hash = :h WHERE id = :id', { h: U.hashSenha(corpo.senha), id: alvo.id }); }
    if (!ativo || corpo.senha) b.exec('DELETE FROM sessoes WHERE usuario_id = :id', { id: alvo.id });
    hist(u, 'usuario', alvo.id, null, 'Usuário alterado', { perfil, ativo, senha_trocada: !!corpo.senha });
    return { ok: true };
  }, { admin: true });

  rota('POST', '/api/backup', ({ u }) => {
    const r = fazerBackup(b);
    hist(u, 'backup', null, null, 'Cópia de segurança feita', { pasta: r.pasta, arquivos: r.arquivos });
    return r;
  }, { admin: true });

  rota('GET', '/api/historico', () => ({
    historico: b.todos(`SELECT h.*, u.nome AS usuario, c.nome AS cliente_nome FROM historico h LEFT JOIN usuarios u ON u.id = h.usuario_id
      LEFT JOIN clientes c ON c.id = h.cliente_id ORDER BY h.id DESC LIMIT 500`),
  }), { admin: true });

  /* ── webhook de status do WhatsApp ──────────────────── */
  rota('GET', '/webhook/whatsapp', ({ q, res }) => {
    if (!wa.webhookConfigurado()) throw new ErroHttp(404, 'Não configurado.');
    if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === wa.tokenVerificacao()) {
      res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(String(q.get('hub.challenge') || '')); return undefined;
    }
    throw new ErroHttp(403, 'Token inválido.');
  }, { publico: true, webhook: true });

  rota('POST', '/webhook/whatsapp', ({ req, bruto }) => {
    if (!wa.webhookConfigurado()) throw new ErroHttp(404, 'Não configurado.');
    if (!wa.assinaturaValida(bruto, req.headers['x-hub-signature-256'])) throw new ErroHttp(401, 'Assinatura inválida.');
    const corpo = json(bruto.toString('utf8'), {});
    const MAPA = { sent: 'aceita', delivered: 'entregue', read: 'lida', failed: 'falhou' };
    for (const e of corpo.entry || []) for (const ch of e.changes || []) for (const st of ch.value?.statuses || []) {
      const m = b.um('SELECT id, situacao FROM mensagens WHERE id_externo = :id', { id: String(st.id || '') });
      const nova = MAPA[st.status];
      if (!m || !nova) continue;
      b.exec('UPDATE mensagens SET situacao = :s, ultimo_erro = :e, atualizado_em = :a WHERE id = :id',
        { s: nova, e: st.errors?.[0]?.title || null, a: agoraIso(), id: m.id });
      evento(m.id, nova, st.errors?.[0]?.title ? `Retorno do serviço: ${st.errors[0].title}` : 'Retorno do serviço', null);
    }
    return { ok: true };
  }, { publico: true, webhook: true });

  rota('GET', '/api/contagem-equipe', () => ({ duvidas_nao_lidas: P.contagemEquipe().duvidas_nao_lidas }));

  P.rotas(rota, { cliente, processo });

  /* ── despacho ───────────────────────────────────────── */
  return async function tratar(req, res, url, bruto) {
    const metodo = req.method;
    const caminho = url.pathname;
    let achou = null; let params = {};
    for (const r of rotas) {
      if (r.metodo !== metodo) continue;
      const m = caminho.match(r.re);
      if (m) { achou = r; params = m.groups || {}; break; }
    }
    if (!achou) throw new ErroHttp(404, 'Endereço não encontrado.');
    if (metodo !== 'GET' && !achou.opc.webhook) {
      if (req.headers['x-mdp'] !== '1') throw new ErroHttp(403, 'Pedido recusado.');
      const origem = req.headers.origin;
      if (origem && origem !== `http://${req.headers.host}` && origem !== `https://${req.headers.host}`) throw new ErroHttp(403, 'Origem recusada.');
    }
    let u = null; let cc = null;
    if (achou.opc.cliente) {
      cc = P.contaDaSessao(req);
      if (!cc) throw new ErroHttp(401, 'Sessão encerrada. Entre de novo.');
    } else if (!achou.opc.publico) {
      u = usuarioDaSessao(req);
      if (!u) throw new ErroHttp(401, 'Sessão expirada. Entre de novo.');
      if (achou.opc.admin && u.perfil !== 'admin') throw new ErroHttp(403, 'Só o administrador pode fazer isto.');
    }
    let corpo = {};
    if (metodo !== 'GET' && !achou.opc.webhook && bruto?.length) {
      try { corpo = JSON.parse(bruto.toString('utf8')); } catch { throw new ErroHttp(400, 'Dados ilegíveis.'); }
      if (!corpo || typeof corpo !== 'object') corpo = {};
    }
    const saida = await achou.fn({ req, res, u, cc, p: params, q: url.searchParams, corpo, bruto });
    if (metodo !== 'GET' && !achou.opc.publico && !achou.opc.cliente) lembretes.gerar(b);
    return saida;
  };
}

module.exports = { criarApi };

};

MODULOS["scripts/cliente-http"] = function (module, exports, require) {
'use strict';
/* Versão para o service worker de scripts/cliente-http.js: chama a API direto, sem rede, com cookie próprio por sessão. */
function sessao() {
  let cookie = '';
  return async function chamar(metodo, url, corpo) {
    const r = await self.__MDP_DESPACHAR(metodo, url, corpo ? Buffer.from(JSON.stringify(corpo)) : null, { cookie, 'x-mdp': '1' });
    const sc = r.cabecalhos['set-cookie'];
    if (sc) cookie = sc.split(';')[0];
    const tipo = r.cabecalhos['content-type'] || '';
    return { status: r.status, dados: tipo.includes('json') ? JSON.parse(Buffer.from(r.corpo).toString('utf8')) : r.corpo, headers: { get: (k) => r.cabecalhos[k.toLowerCase()] } };
  };
}

function pdfFicticio(titulo) {
  const linha = String(titulo).replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '');
  const conteudo = `BT /F1 16 Tf 60 760 Td (DOCUMENTO FICTICIO - DEMONSTRACAO) Tj 0 -28 Td (${linha}) Tj ET`;
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let s = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = s.length;
  s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(s, 'latin1').toString('base64');
}

module.exports = { sessao, pdfFicticio };

};

MODULOS["scripts/semear-demo"] = function (module, exports, require) {
'use strict';
/*
 * Base FICTÍCIA para demonstração e teste. Só roda em `npm run demo`, numa pasta separada (dados-demo).
 * Todos os nomes começam com [DEMO], os telefones são inventados e os anexos são PDFs com
 * "DOCUMENTO FICTICIO" escrito. Datas, valores e validades são inventados para mostrar o sistema.
 */
const { hashSenha, agoraIso, addDias } = require('../src/util');
const { sessao, pdfFicticio } = require('./cliente-http');

const SENHA_DEMO = 'demo-mestre-2026';

function criarUsuarios(b) {
  const em = agoraIso();
  b.exec("INSERT INTO usuarios (nome, email, senha_hash, perfil, criado_em) VALUES ('Daniel (demo)', 'daniel@demo.invalid', :h, 'admin', :em)",
    { h: hashSenha(SENHA_DEMO), em });
  b.exec("INSERT INTO usuarios (nome, email, senha_hash, perfil, criado_em) VALUES ('Atendente (demo)', 'atendente@demo.invalid', :h, 'atendente', :em)",
    { h: hashSenha(SENHA_DEMO), em });
}

async function semearViaApi(base) {
  const api = sessao(base);
  const ok = async (m, u, c) => {
    const r = await api(m, u, c);
    if (r.status !== 200) throw new Error(`${m} ${u}: ${r.status} ${JSON.stringify(r.dados)}`);
    return r.dados;
  };
  await ok('POST', '/api/entrar', { email: 'daniel@demo.invalid', senha: SENHA_DEMO });
  const cat = await ok('GET', '/api/catalogo');
  const hj = cat.hoje;
  const d = (n) => addDias(hj, n);
  const S = Object.fromEntries(cat.servicos.map((s) => [s.codigo, s.id]));
  const C = Object.fromEntries(cat.cidades.map((c) => [c.nome, c.id]));
  const T = Object.fromEntries(cat.tipos.map((t) => [t.codigo, t.id]));
  const anexo = (nome) => ({ nome: `${nome}-ficticio.pdf`, base64: pdfFicticio(nome) });

  const novo = async (nome, whatsapp, servico, cidade, extra) => {
    const r = await ok('POST', '/api/clientes', { nome, whatsapp, servico_id: servico ? S[servico] : null, cidade_id: C[cidade] });
    await ok('PUT', `/api/clientes/${r.id}`, { nome, whatsapp, cidade_id: C[cidade], responsavel_id: cat.eu.id, ...extra });
    return r;
  };
  const ficha = (id) => ok('GET', `/api/clientes/${id}`);
  const entregarTodos = async (clienteId, processoId, emissao, { pular = [] } = {}) => {
    const f = await ficha(clienteId);
    const p = f.processos.find((x) => x.id === processoId);
    for (const it of p.itens) {
      if (it.documento_id) continue;
      const tipo = cat.tipos.find((t) => t.id === it.tipo_id);
      if (pular.includes(tipo.codigo)) continue;
      if (it.opcional) { await ok('PUT', `/api/checklist/${it.id}`, { status: 'nao_aplicavel', observacoes: 'Não exigido neste caso (demo).' }); continue; }
      await ok('POST', `/api/checklist/${it.id}/documento`, { emissao, original: 1, apostilado: ['ant_pf', 'cert_nascimento'].includes(tipo.codigo) ? 1 : 0,
        autenticado: 1, arquivo: anexo(tipo.codigo) });
    }
  };
  const etapa = (pid, i) => ok('PUT', `/api/processos/${pid}`, { etapa_idx: i });
  const lanc = (c, x) => ok('POST', '/api/lancamentos', { cliente_id: c, data: hj, ...x });

  /* 1 — previsão ultrapassada, aniversário hoje */
  const carlos = await novo('[DEMO] Carlos Andrade', '+55 45 99901-0001', 'res_temp', 'Ciudad del Este', {
    nascimento: `1985-${hj.slice(5)}`, nacionalidade: 'Brasileira', documento_tipo: 'RG', documento_numero: 'DEMO-11.111.111',
    estado_civil: 'Casado', perfil_comercial: 'Empresário', aceita_mensagens: 1, mensagens_tipos: ['aniversario', 'vencimento', 'agendamento', 'documento'],
    observacoes: 'Cliente fictício.' });
  await entregarTodos(carlos.id, carlos.processo_id, d(-140), { pular: ['cert_nascimento'] });
  {
    const f = await ficha(carlos.id);
    const it = f.processos[0].itens.find((i) => i.tipo_id === T.cert_nascimento);
    await ok('POST', `/api/checklist/${it.id}/documento`, { emissao: d(-150), original: 1, apostilado: 1, arquivo: anexo('certidao') });
    const cas = await ok('POST', `/api/processos/${carlos.processo_id}/checklist`, { tipo_id: T.cert_casamento });
    void cas;
    const f2 = await ficha(carlos.id);
    const itc = f2.processos[0].itens.find((i) => i.tipo_id === T.cert_casamento);
    await ok('POST', `/api/checklist/${itc.id}/documento`, { emissao: d(-150), original: 1, apostilado: 1, arquivo: anexo('casamento') });
  }
  await etapa(carlos.processo_id, 4);
  await ok('POST', `/api/processos/${carlos.processo_id}/protocolo`, { numero: 'DEMO-MIG-000123', data: d(-100), prazo_dias: 90 });
  await lanc(carlos.id, { tipo: 'honorario', processo_id: carlos.processo_id, descricao: 'Honorários — residência temporária', moeda: 'BRL', valor: 250000 });
  await lanc(carlos.id, { tipo: 'taxa', processo_id: carlos.processo_id, descricao: 'Taxa da Migração (valor fictício)', moeda: 'PYG', valor: 120000000 });
  await lanc(carlos.id, { tipo: 'pagamento', descricao: 'Pagamento integral', moeda: 'BRL', valor: 250000, forma: 'Pix' });
  await lanc(carlos.id, { tipo: 'pagamento', descricao: 'Reembolso da taxa', moeda: 'PYG', valor: 120000000, forma: 'Dinheiro' });

  /* 2 — coleta de documentos, pagamento parcial, atendimento hoje */
  const juliana = await novo('[DEMO] Juliana Souza', '+55 11 98888-0002', 'res_temp', 'Pedro Juan Caballero', {
    nascimento: '2004-03-14', nacionalidade: 'Brasileira', documento_tipo: 'Passaporte', documento_numero: 'DEMO-FX000002',
    estado_civil: 'Solteira', perfil_comercial: 'Estudante', aceita_mensagens: 1, mensagens_tipos: ['agendamento', 'documento'] });
  {
    const f = await ficha(juliana.id);
    for (const it of f.processos[0].itens) {
      const cod = cat.tipos.find((t) => t.id === it.tipo_id).codigo;
      if (['foto_rosto', 'rg', 'passaporte', 'cert_nascimento'].includes(cod)) {
        await ok('POST', `/api/checklist/${it.id}/documento`, { emissao: d(-20), original: 1, arquivo: anexo(cod) });
      } else if (cod === 'ant_pf') {
        await ok('PUT', `/api/checklist/${it.id}`, { status: 'solicitado', solicitado_em: d(-3), observacoes: 'Pedido no site da PF; apostilar online.' });
      }
    }
  }
  await etapa(juliana.processo_id, 2);
  await lanc(juliana.id, { tipo: 'honorario', processo_id: juliana.processo_id, descricao: 'Honorários — perfil estudante', moeda: 'BRL', valor: 150000 });
  const parc = await ok('POST', '/api/parcelas', { cliente_id: juliana.id, processo_id: juliana.processo_id, parcelas: [
    { descricao: 'Entrada', moeda: 'BRL', valor: 50000, vencimento: d(-10) },
    { descricao: 'Parcela 2 de 2', moeda: 'BRL', valor: 100000, vencimento: d(5) }] });
  await lanc(juliana.id, { tipo: 'pagamento', parcela_id: parc.ids[0], descricao: 'Entrada', moeda: 'BRL', valor: 50000, forma: 'Pix', data: d(-10) });
  await ok('POST', '/api/agenda', { tipo: 'atendimento', titulo: 'Conferir documentos trazidos do Brasil', data: hj, hora: '10:00',
    local: 'Escritório', cliente_id: juliana.id, processo_id: juliana.processo_id, responsavel_id: cat.eu.id, avisar_cliente: 1 });

  /* 3 — residência concluída (documento vence em 80 dias) e cédula aberta a partir dela */
  const roberto = await novo('[DEMO] Roberto Lima', '+55 41 97777-0003', 'res_temp', 'Ciudad del Este', {
    nascimento: `1979-${d(10).slice(5)}`, nacionalidade: 'Brasileira', documento_tipo: 'RG', documento_numero: 'DEMO-33.333.333',
    estado_civil: 'Divorciado', perfil_comercial: 'Outro', aceita_mensagens: 1, mensagens_tipos: ['vencimento'] });
  await entregarTodos(roberto.id, roberto.processo_id, d(-420));
  await ok('POST', `/api/processos/${roberto.processo_id}/protocolo`, { numero: 'DEMO-MIG-000045', data: d(-400), prazo_dias: 90 });
  await ok('POST', `/api/processos/${roberto.processo_id}/recebido`, { data: d(-300), emissao: d(-302), validade: d(80), arquivo: anexo('residencia') });
  await ok('POST', `/api/processos/${roberto.processo_id}/entregue`, { data: d(-298) });
  const ced = await ok('POST', `/api/processos/${roberto.processo_id}/derivar`, { vinculo: 'seguinte', servico_id: S.cedula });
  {
    const f = await ficha(roberto.id);
    const p = f.processos.find((x) => x.id === ced.id);
    const rad = p.itens.find((i) => i.tipo_id === T.radicacion);
    await ok('POST', `/api/checklist/${rad.id}/documento`, { emissao: d(-302), original: 1, arquivo: anexo('radicacion') });
    const reg = p.itens.find((i) => i.tipo_id === T.registro_estrangeiro);
    await ok('PUT', `/api/checklist/${reg.id}`, { status: 'solicitado', solicitado_em: hj, observacoes: 'Pedir de segunda a quinta; sexta só cedo.' });
  }
  await lanc(roberto.id, { tipo: 'honorario', processo_id: ced.id, descricao: 'Honorários — cédula', moeda: 'PYG', valor: 150000000 });
  await ok('POST', '/api/agenda', { tipo: 'tarefa', titulo: 'Levar certidões ao cartório do 1º ofício', data: hj, cliente_id: roberto.id, responsavel_id: cat.eu.id });

  /* 4 — pacote em dólar */
  const mariana = await novo('[DEMO] Mariana Costa', '+55 21 96666-0004', 'res_temp', 'Asunción', {
    nacionalidade: 'Brasileira', documento_tipo: 'RG e passaporte', perfil_comercial: 'Empresário', modalidade: 'Investidor (somente Asunción)' });
  await ok('PUT', `/api/processos/${mariana.processo_id}`, { modalidade: 'Investidor (somente Asunción)' });
  await ok('POST', '/api/pacotes', { cliente_id: mariana.id, nome: 'Residência + cédula + carteira', servicos: [S.res_temp, S.cedula, S.cnh_temp],
    moeda: 'USD', valor: 120000, data: hj });
  await ok('POST', '/api/parcelas', { cliente_id: mariana.id, parcelas: [
    { descricao: 'Entrada do pacote', moeda: 'USD', valor: 40000, vencimento: d(-1) },
    { descricao: 'Segunda parte', moeda: 'USD', valor: 40000, vencimento: d(30) },
    { descricao: 'Terceira parte', moeda: 'USD', valor: 40000, vencimento: d(60) }] });
  await entregarTodos(mariana.id, mariana.processo_id, d(-15));
  await etapa(mariana.processo_id, 3);

  /* 5 — só o cadastro rápido */
  await ok('POST', '/api/clientes', { nome: '[DEMO] Pedro Alves', whatsapp: '+595 981 000005', servico_id: S.res_perm, cidade_id: C['Santa Rita'] });

  /* negócio */
  await ok('POST', '/api/assinaturas', { tipo: 'dominio', nome: 'mestredospapeis.com', vencimento: d(360), periodicidade: 'anual', confirmado: 0,
    observacoes: 'Domínio citado por Daniel em áudio. Registrador, data de vencimento e grafia a confirmar antes de qualquer publicação.' });
  await ok('POST', '/api/assinaturas', { tipo: 'assinatura', nome: 'Canva', fornecedor: 'Canva', vencimento: d(12), periodicidade: 'mensal',
    moeda: 'USD', valor: 1299, confirmado: 0, observacoes: 'Valor fictício.' });
  await ok('POST', '/api/assinaturas', { tipo: 'assinatura', nome: 'CapCut', fornecedor: 'CapCut', vencimento: d(25), periodicidade: 'mensal',
    moeda: 'USD', valor: 799, confirmado: 0, observacoes: 'Valor fictício.' });
}

/* Área do cliente fictícia: dois clientes com acesso ativo, atualização publicada, arquivo liberado e uma dúvida respondida. */
const SENHA_CLIENTE_DEMO = 'demo-cliente-2026';
async function semearPortalViaApi(base) {
  const adm = sessao(base);
  const ok = async (api, m, u, c) => {
    const r = await api(m, u, c);
    if (r.status !== 200) throw new Error(`${m} ${u}: ${r.status} ${JSON.stringify(r.dados)}`);
    return r.dados;
  };
  await ok(adm, 'POST', '/api/entrar', { email: 'daniel@demo.invalid', senha: SENHA_DEMO });
  const { clientes } = await ok(adm, 'GET', '/api/clientes');
  const achar = (n) => clientes.find((c) => c.nome.includes(n));
  const ativar = async (cliente, email) => {
    const r = await ok(adm, 'POST', `/api/clientes/${cliente.id}/convite`, { email });
    const token = r.link.split('#/ativar/')[1];
    const cli = sessao(base);
    await ok(cli, 'POST', '/api/cliente/definir-senha', { token, tipo: 'ativacao', senha: SENHA_CLIENTE_DEMO });
    return cli;
  };
  const juliana = achar('Juliana');
  const carlos = achar('Carlos');
  if (!juliana || !carlos) return;
  const cj = await ativar(juliana, 'juliana@demo.invalid');
  await ativar(carlos, 'carlos@demo.invalid');

  const fj = await ok(adm, 'GET', `/api/clientes/${juliana.id}`);
  const pj = fj.processos.find((p) => p.situacao === 'andamento');
  await ok(adm, 'PUT', `/api/processos/${pj.id}`, { cliente_proximo_passo: 'Aguardar os antecedentes da Polícia Federal, que já foram pedidos pela equipe. Os demais documentos serão pedidos em seguida.',
    cliente_quem: 'equipe', mostrar_responsavel: 1, cliente_orientacoes: 'Guarde o comprovante de entrada no país que recebeu na fronteira. Ele será pedido no atendimento.' });
  const itemEntrada = pj.itens.find((i) => i.tipo_nome.startsWith('Comprovante de entrada'));
  if (itemEntrada) await ok(adm, 'PUT', `/api/checklist/${itemEntrada.id}`, { status: 'pendente', orientacao_cliente: 'Traga o papel carimbado na fronteira no dia do atendimento.',
    observacoes: 'Nota interna fictícia: conferir carimbo.' });
  await ok(adm, 'POST', `/api/processos/${pj.id}/publicar`, { texto: 'Recebemos o seu RG, o passaporte e a certidão. Obrigado pelo envio rápido.' });
  const g = await ok(adm, 'POST', '/api/agenda', { tipo: 'atendimento', titulo: 'Atendimento para conferir documentos', data: addDias(fj.cliente.criado_em.slice(0, 10), 3),
    hora: '14:00', local: 'Escritório', cliente_id: juliana.id, processo_id: pj.id, visivel_cliente: 1 });
  void g;
  const nova = await ok(cj, 'POST', '/api/cliente/duvidas', { chave: 'demo-duvida-0001', processo_id: pj.id, categoria: 'Documentos',
    assunto: 'Preciso levar cópia do passaporte?', texto: 'Olá! No dia do atendimento preciso levar cópia do passaporte ou só o original?' });
  await ok(adm, 'POST', `/api/duvidas/${nova.id}/responder`, { texto: 'Olá, Juliana. Leve só o original; a equipe tira as cópias necessárias. (resposta fictícia de demonstração)', chave: 'demo-resp-0001' });

  const fc = await ok(adm, 'GET', `/api/clientes/${carlos.id}`);
  const pc = fc.processos.find((p) => p.situacao === 'andamento');
  const doc = fc.documentos.find((d) => d.arquivo_id && !d.substituido_em);
  if (doc) await ok(adm, 'POST', '/api/liberacoes', { arquivo_id: doc.arquivo_id, processo_id: pc.id, titulo: `Cópia de ${doc.tipo_nome.toLowerCase()} (fictícia)` });
}

module.exports = { criarUsuarios, semearViaApi, semearPortalViaApi, SENHA_DEMO, SENHA_CLIENTE_DEMO };

};

/*
 * Service worker da demonstração: responde /api/* com o mesmo código do servidor (src/*.js),
 * sobre SQLite em WebAssembly. Os dados ficam neste navegador (IndexedDB) e são fictícios.
 * Montado por scripts/montar-demo.js depois de shims.js e dos módulos.
 */
/* global initSqlJs, SHIMS, exigir */
const BASE = new URL('./', self.location.href).pathname;
let SQLpronto = null; let estado = null; let iniciando = null;

/* ── IndexedDB mínimo ── */
const abrirIdb = () => new Promise((ok, falha) => {
  const r = indexedDB.open('mestre-dos-papeis-demo', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error);
});
async function idb(modo, fn) { const db = await abrirIdb(); return new Promise((ok, falha) => { const t = db.transaction('kv', modo); const r = fn(t.objectStore('kv')); t.oncomplete = () => ok(r && r.result); t.onerror = () => falha(t.error); }); }
const lerIdb = (k) => idb('readonly', (s) => s.get(k));
const gravarIdb = (k, v) => idb('readwrite', (s) => s.put(v, k));
const limparIdb = () => idb('readwrite', (s) => s.clear());

async function iniciar() {
  self.SQL = await (SQLpronto ||= initSqlJs({ locateFile: (f) => `${BASE}vendor/${f}` }));
  const salvo = await lerIdb('estado');
  self.__MDP_BANCO = salvo ? salvo.banco : null;
  SHIMS['node:fs'].ARQS.clear();
  for (const [p, b] of (salvo ? salvo.arquivos : [])) SHIMS['node:fs'].ARQS.set(p, Buffer.from(b));
  self.process.env.MDP_URL_PUBLICA = self.location.origin + BASE.replace(/\/$/, '');
  const { abrirBanco } = exigir('src/db');
  const b = abrirBanco('/dados');
  if (!b.meta('modo')) b.meta('modo', 'demo');
  const api = exigir('src/api').criarApi({ b, wa: exigir('src/whatsapp').criarWhatsApp({}), demo: true, cookieSeguro: false });
  estado = { b, api, jar: salvo ? salvo.jar || {} : {} };
  if (!b.um('SELECT 1 AS x FROM usuarios LIMIT 1')) {
    const semear = exigir('scripts/semear-demo');
    semear.criarUsuarios(b);
    await semear.semearViaApi('');
    await semear.semearPortalViaApi('');
  }
  exigir('src/lembretes').gerar(b);
  await persistir();
}
const pronto = () => (iniciando ||= iniciar().catch((e) => { iniciando = null; throw e; }));

let gravando = Promise.resolve();
function persistir() {
  const { b } = estado;
  const banco = b.raw.db.export();
  b.raw.db.exec('PRAGMA foreign_keys = ON');
  const arquivos = [...SHIMS['node:fs'].ARQS.entries()].map(([p, v]) => [p, new Uint8Array(v)]);
  gravando = gravando.then(() => gravarIdb('estado', { banco, arquivos, jar: estado.jar }));
  return gravando;
}

/* chamada interna ao servidor: monta req/res parecidos com os do Node */
self.__MDP_DESPACHAR = async function despachar(metodo, caminho, bruto, cab) {
  const url = new URL(caminho, 'http://demo.local');
  const req = { method: metodo, headers: { host: self.location.host, ...cab }, socket: { remoteAddress: '127.0.0.1' } };
  const res = {
    status: 200, cabecalhos: {}, corpo: new Uint8Array(0), headersSent: false,
    setHeader(k, v) { this.cabecalhos[k.toLowerCase()] = v; },
    writeHead(s, h = {}) { this.status = s; for (const [k, v] of Object.entries(h)) this.setHeader(k, String(v)); this.headersSent = true; },
    end(c) { if (c) this.corpo = typeof c === 'string' ? Buffer.from(c) : c; },
  };
  const json = (s, o) => { res.writeHead(s, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
  const { ErroHttp } = exigir('src/util');
  try {
    const saida = await estado.api(req, res, url, bruto);
    if (saida !== undefined) json(200, saida);
  } catch (e) {
    if (e instanceof ErroHttp) json(e.status, { erro: e.message, ...(e.extra || {}) });
    else if (/constraint/i.test(String(e.message))) json(400, { erro: 'Dados inconsistentes. Confira os campos e tente de novo.' });
    else { console.error('demo', metodo, caminho, e); json(500, { erro: 'Erro interno da demonstração.' }); }
  }
  return { status: res.status, cabecalhos: res.cabecalhos, corpo: res.corpo };
};

async function responder(request, rel) {
  if (rel === '/api/__demo/reiniciar' && request.method === 'POST') {
    await limparIdb(); iniciando = null; estado = null;
    await pronto();
    return Response.json({ ok: true });
  }
  await pronto();
  if (rel === '/api/__demo/pronto') return Response.json({ ok: true });
  if (rel.startsWith('/site-arquivo/')) {
    const dado = SHIMS['node:fs'].ARQS.get(`/dados/site/${rel.split('/').pop()}`);
    return dado ? new Response(dado, { headers: { 'content-type': rel.endsWith('.png') ? 'image/png' : rel.endsWith('.webp') ? 'image/webp' : 'image/jpeg' } }) : new Response('', { status: 404 });
  }
  const bruto = request.method === 'GET' ? null : Buffer.from(new Uint8Array(await request.arrayBuffer()));
  const cookie = Object.entries(estado.jar).map(([k, v]) => `${k}=${v}`).join('; ');
  const r = await self.__MDP_DESPACHAR(request.method, rel, bruto, { cookie, 'x-mdp': request.headers.get('x-mdp') || '' });
  const sc = r.cabecalhos['set-cookie'];
  if (sc) {
    const [par] = sc.split(';'); const i = par.indexOf('=');
    const nome = par.slice(0, i); const valor = par.slice(i + 1);
    if (/Max-Age=0/i.test(sc) || !valor) delete estado.jar[nome]; else estado.jar[nome] = valor;
    delete r.cabecalhos['set-cookie'];
  }
  if (request.method !== 'GET' || sc) await persistir();
  return new Response(r.status === 204 ? null : r.corpo, { status: r.status, headers: r.cabecalhos });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || !u.pathname.startsWith(BASE)) return;
  const rel = '/' + u.pathname.slice(BASE.length);
  if (!rel.startsWith('/api/') && !rel.startsWith('/site-arquivo/')) return;
  e.respondWith(responder(e.request, rel + u.search).catch((err) => {
    console.error('demo', err);
    return Response.json({ erro: 'A demonstração não conseguiu iniciar neste navegador. Recarregue a página.' }, { status: 500 });
  }));
});
