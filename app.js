'use strict';
/* Mestre dos Papéis — interface. Sem biblioteca: o servidor guarda tudo; aqui só se mostra e se envia. */
(() => {
  const raiz = document.getElementById('raiz');
  /* base do endereço: '/' no servidor local, '/<repositório>/' na demonstração do GitHub Pages */
  const R = (p) => (document.querySelector('meta[name="mdp-base"]')?.content || '/') + String(p).replace(/^\//, '');
  let CAT = null;
  const E = { filtroHoje: 'todos', ficha: null, buscaT: null };

  /* ── utilidades ─────────────────────────────────────── */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const br = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—');
  const dh = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Asuncion', dateStyle: 'short', timeStyle: 'short' }) : '—');
  const difDias = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
  const addDias = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const admin = () => CAT?.eu.perfil === 'admin';

  function dinheiro(v, m) {
    if (v == null) return '—';
    const dec = m === 'PYG' ? 0 : 2;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: m, minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v / 100);
  }
  /* "1.500,50" → 150050 centavos. Guaraní não tem centavos. */
  function lerDinheiro(txt, moeda) {
    let s = String(txt || '').replace(/[^\d.,]/g, '');
    if (!s) return NaN;
    if (moeda === 'PYG') s = s.replace(/[.,]/g, '');
    else if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : NaN;
  }
  const paraCampo = (v, m) => (v == null ? '' : m === 'PYG' ? String(Math.round(v / 100)) : (v / 100).toFixed(2).replace('.', ','));

  async function api(metodo, url, corpo) {
    let r;
    try {
      r = await fetch(R(url), { method: metodo, credentials: 'same-origin',
        headers: { 'X-MDP': '1', ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined });
    } catch { throw new Error('Sem conexão com o sistema. Confira se ele está ligado.'); }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && url !== '/api/entrar' && url !== '/api/minha-senha') {
      CAT = null; telaEntrada();
      throw Object.assign(new Error('Sessão expirada.'), { silencioso: true });
    }
    if (!r.ok) throw Object.assign(new Error(j.erro || 'Não foi possível concluir.'), { status: r.status, extra: j });
    return j;
  }

  function torrada(msg, tipo) {
    const t = document.createElement('div');
    t.className = 'torrada' + (tipo === 'ng' ? ' ng' : '');
    t.textContent = msg;
    document.getElementById('torradas').appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  function abrirLink(link) {
    const w = window.open('about:blank', '_blank');
    if (w) { w.opener = null; w.location.href = link; } else location.href = link;
  }

  const et = (cls, txt) => `<span class="et ${cls}">${esc(txt)}</span>`;
  const cartao = (titulo, corpo, { extra = '', sem = false, id = '' } = {}) =>
    `<section class="cartao"${id ? ` id="${id}"` : ''}><div class="cab"><h2>${esc(titulo)}</h2>${extra}</div><div class="cnt${sem ? ' sem' : ''}">${corpo}</div></section>`;
  function tabela(cols, linhas, vazio) {
    if (!linhas.length) return `<div class="vazio">${esc(vazio)}</div>`;
    const th = cols.map((c) => `<th class="${c.dir ? 'dir' : ''}">${esc(c.t)}</th>`).join('');
    const tr = linhas.map((l) => `<tr ${l.attrs || ''}>${l.cel.map((x, i) => {
      const c = cols[i] || {};
      return `<td class="${c.dir ? 'dir' : ''} ${c.num ? 'num' : ''}"${c.t ? ` data-r="${esc(c.t)}"` : ''}>${x ?? ''}</td>`;
    }).join('')}</tr>`).join('');
    return `<table class="tab"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
  }

  /* ── formulário em folha lateral ─────────────────────── */
  function campo(c) {
    const id = 'f-' + c.id;
    const v = c.val ?? '';
    const aj = c.ajuda ? `<div class="ajuda">${esc(c.ajuda)}</div>` : '';
    const cls = `campo${c.largo ? ' largo' : ''}${c.oculto ? ' oculto' : ''}`;
    const lab = `<label for="${id}">${esc(c.rot)}${c.obrig ? ' *' : ''}</label>`;
    const opt = (o) => { const [ov, ot] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}"${String(ov) === String(v) ? ' selected' : ''}>${esc(ot)}</option>`; };
    let inp;
    switch (c.tipo) {
      case 'sel': inp = `<select id="${id}">${c.opts.map(opt).join('')}</select>`; break;
      case 'area': inp = `<textarea id="${id}">${esc(v)}</textarea>`; break;
      case 'check':
        return `<div class="${cls}" data-campo="${c.id}"><div class="opcoes"><label><input type="checkbox" id="${id}"${v ? ' checked' : ''}> ${esc(c.rot)}</label></div>${aj}</div>`;
      case 'checks':
        return `<div class="${cls} largo"><span class="rotulo">${esc(c.rot)}</span><div class="opcoes" id="${id}">${c.opts.map(([ov, ot]) =>
          `<label><input type="checkbox" value="${esc(ov)}"${(v || []).map(String).includes(String(ov)) ? ' checked' : ''}> ${esc(ot)}</label>`).join('')}</div>${aj}</div>`;
      case 'arquivo': inp = `<input type="file" id="${id}" accept="application/pdf,image/jpeg,image/png,image/webp">`; break;
      case 'html': return `<div class="campo largo">${c.html}</div>`;
      default: {
        const t = { data: 'date', hora: 'time', num: 'number', tel: 'tel', email: 'email', senha: 'password' }[c.tipo] || 'text';
        inp = `<input type="${t}" id="${id}" value="${esc(v)}"${c.ph ? ` placeholder="${esc(c.ph)}"` : ''}${t === 'number' ? ' min="0" step="1"' : ''}${c.tipo === 'dinheiro' ? ' inputmode="decimal"' : ''} autocomplete="${t === 'password' ? 'new-password' : 'off'}">`;
      }
    }
    return `<div class="${cls}" data-campo="${c.id}">${lab}${inp}${aj}</div>`;
  }
  const campos = (l) => `<div class="campos">${l.map(campo).join('')}</div>`;
  function ler(id) {
    const el = document.getElementById('f-' + id);
    if (!el) return undefined;
    if (el.type === 'checkbox') return el.checked ? 1 : 0;
    if (el.classList.contains('opcoes')) return [...el.querySelectorAll('input:checked')].map((i) => i.value);
    return el.value.trim();
  }
  const lerNum = (id) => { const v = ler(id); return v === '' || v == null ? null : Number(v); };
  async function lerArquivo(id) {
    const f = document.getElementById('f-' + id)?.files?.[0];
    if (!f) return null;
    if (f.size > 8 * 1024 * 1024) throw new Error('Arquivo maior que 8 MB.');
    const b64 = await new Promise((ok, falha) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.onerror = () => falha(new Error('Não consegui ler o arquivo.'));
      r.readAsDataURL(f);
    });
    return { nome: f.name, base64: b64 };
  }

  function folha({ titulo, sub = '', corpo, botoes, larga = false }) {
    fecharFolha();
    const f = document.createElement('div');
    f.className = 'fundo';
    f.id = 'folha';
    f.innerHTML = `<div class="folha${larga ? ' larga' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="cab"><h2>${esc(titulo)}</h2>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
      <div class="corpo"><div class="erro-form oculto" id="folha-erro"></div>${corpo}</div>
      <div class="pe">${botoes.map((b, i) => `<button class="b ${b.cls || ''}" data-bt="${i}">${esc(b.txt)}</button>`).join('')}</div></div>`;
    document.body.appendChild(f);
    const ctx = {
      fechar: fecharFolha,
      erro(m) { const e = document.getElementById('folha-erro'); e.textContent = m; e.classList.remove('oculto'); e.scrollIntoView({ block: 'nearest' }); },
      mostrar(id) { f.querySelector(`[data-campo="${id}"]`)?.classList.remove('oculto'); },
    };
    f.addEventListener('click', async (ev) => {
      if (ev.target === f) return fecharFolha();
      const bt = ev.target.closest('[data-bt]');
      if (!bt) return;
      const b = botoes[Number(bt.dataset.bt)];
      if (!b.fn) return fecharFolha();
      bt.disabled = true;
      try { await b.fn(ctx); } catch (e) { if (!e.silencioso) ctx.erro(e.message); } finally { bt.disabled = false; }
    });
    setTimeout(() => f.querySelector('input:not([type=checkbox]):not([type=file]),select,textarea')?.focus(), 30);
    return ctx;
  }
  function fecharFolha() { document.getElementById('folha')?.remove(); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharFolha(); });

  /* executa, avisa e recarrega a tela */
  const salvar = async (ctx, promessa, msg) => { const r = await promessa; ctx?.fechar(); torrada(msg); await pintar(true); return r; };

  /* ── entrada e configuração inicial ──────────────────── */
  function telaEntrada(demo) {
    raiz.innerHTML = `<div class="entrada"><div class="caixa">
      <div class="marca-e">Mestre dos Papéis<small>Documentação e imigração</small></div>
      ${demo ? '<div class="faixa-demo" style="margin-top:16px"><strong>Ambiente de demonstração.</strong> Dados fictícios. Entre com <strong>daniel@demo.invalid</strong> e a senha <strong>demo-mestre-2026</strong>.</div>' : ''}
      <form id="form-entrar">
        <div class="campo"><label for="e-email">E-mail</label><input type="email" id="e-email" autocomplete="username" required></div>
        <div class="campo"><label for="e-senha">Senha</label><input type="password" id="e-senha" autocomplete="current-password" required></div>
        <div class="erro-form oculto" id="e-erro"></div>
        <button class="b p grande" type="submit">Entrar</button>
      </form></div></div>`;
    document.getElementById('form-entrar').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await api('POST', '/api/entrar', { email: document.getElementById('e-email').value, senha: document.getElementById('e-senha').value });
        await carregarCatalogo(); casca(); pintar();
      } catch (e) { const x = document.getElementById('e-erro'); x.textContent = e.message; x.classList.remove('oculto'); }
    });
    setTimeout(() => document.getElementById('e-email')?.focus(), 30);
  }

  function telaConfigurar() {
    raiz.innerHTML = `<div class="entrada"><div class="caixa">
      <div class="marca-e">Mestre dos Papéis<small>Primeira configuração</small></div>
      <p class="mut">Crie o acesso do administrador. Depois, os demais usuários são criados em Configurações.</p>
      <form id="form-conf">
        <div class="campo"><label for="c-nome">Nome</label><input type="text" id="c-nome" required></div>
        <div class="campo"><label for="c-email">E-mail</label><input type="email" id="c-email" required></div>
        <div class="campo"><label for="c-senha">Senha (mínimo 10 caracteres)</label><input type="password" id="c-senha" autocomplete="new-password" required></div>
        <div class="erro-form oculto" id="c-erro"></div>
        <button class="b p grande" type="submit">Criar acesso</button>
      </form></div></div>`;
    document.getElementById('form-conf').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const v = (id) => document.getElementById(id).value;
      try {
        await api('POST', '/api/configurar', { nome: v('c-nome'), email: v('c-email'), senha: v('c-senha') });
        await api('POST', '/api/entrar', { email: v('c-email'), senha: v('c-senha') });
        await carregarCatalogo(); casca(); pintar();
      } catch (e) { const x = document.getElementById('c-erro'); x.textContent = e.message; x.classList.remove('oculto'); }
    });
  }

  async function carregarCatalogo() {
    CAT = await api('GET', '/api/catalogo');
    CAT.serv = new Map(CAT.servicos.map((s) => [s.id, s]));
    CAT.tipo = new Map(CAT.tipos.map((t) => [t.id, t]));
    CAT.cid = new Map(CAT.cidades.map((c) => [c.id, c]));
  }
  const optsServicos = (vazio) => [...(vazio ? [['', vazio]] : []), ...CAT.servicos.filter((s) => s.ativo).map((s) => [s.id, s.nome])];
  const optsCidades = (vazio = 'Escolher depois') => [['', vazio], ...CAT.cidades.filter((c) => c.ativo).map((c) => [c.id, c.nome])];
  const optsUsuarios = () => [['', '—'], ...CAT.usuarios.map((u) => [u.id, u.nome])];
  const optsMoedas = () => CAT.moedas.map((m) => [m, { PYG: 'Guaraní (PYG)', BRL: 'Real (BRL)', USD: 'Dólar (USD)' }[m] || m]);

  /* ── casca e navegação ───────────────────────────────── */
  const ICONES = {
    hoje: '<path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"/>',
    clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c1.9.8 3 2.9 3 6"/>',
    agenda: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    financeiro: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    duvidas: '<path d="M4 5h16v11H9l-5 4z"/>',
  };
  const MENU = [['hoje', 'Hoje'], ['clientes', 'Clientes'], ['agenda', 'Agenda'], ['duvidas', 'Dúvidas'], ['financeiro', 'Financeiro'], ['config', 'Configurações']];
  function casca() {
    raiz.innerHTML = `<div class="barra-mobile"><span class="n">Mestre dos Papéis</span><button data-acao="sair">Sair</button></div>
      <div class="app"><aside class="lado"><div class="marca"><div class="n">Mestre dos Papéis</div><div class="s">Documentação e imigração</div></div>
      <nav class="menu">${MENU.map(([v, n]) => `<a class="nav" data-v="${v}" href="#/${v}"><svg viewBox="0 0 24 24">${ICONES[v]}</svg><span>${n}</span>${v === 'duvidas' ? '<span class="bd al oculto" id="bd-duvidas"></span>' : ''}</a>`).join('')}</nav>
      <div class="rodape-lado">${esc(CAT.eu.nome)}<br><span>${admin() ? 'Administrador' : 'Atendente'}</span><br><button data-acao="sair">Sair</button></div></aside>
      <main class="principal" id="principal"></main></div>`;
  }

  async function pintar(manter) {
    if (!CAT) return;
    const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const nome = TELAS[partes[0]] ? partes[0] : 'hoje';
    if (nome !== 'cliente') E.ficha = null;
    document.querySelectorAll('.nav').forEach((n) => n.classList.toggle('on', n.dataset.v === (nome === 'cliente' ? 'clientes' : nome)));
    const main = document.getElementById('principal');
    if (!main) return;
    const y = window.scrollY;
    if (!manter) main.innerHTML = '<div class="carregando">Carregando…</div>';
    api('GET', '/api/contagem-equipe').then((c) => {
      const bd = document.getElementById('bd-duvidas');
      if (bd) { bd.textContent = c.duvidas_nao_lidas; bd.classList.toggle('oculto', !c.duvidas_nao_lidas); }
    }).catch(() => {});
    try {
      const html = await TELAS[nome](...partes.slice(1));
      main.innerHTML = (CAT.demo ? '<div class="faixa-demo"><strong>Dados fictícios.</strong> Esta é a base de demonstração, separada dos dados reais.</div>' : '') + html;
      window.scrollTo(0, manter ? y : 0);
    } catch (e) { if (!e.silencioso) main.innerHTML = `<div class="alerta-l">${esc(e.message)}</div>`; }
  }
  window.addEventListener('hashchange', () => pintar());

  /* ── rótulos de situação (sempre texto, além da cor) ─── */
  const ST_ITEM = { recebido: 'ok', solicitado: 'in', pendente: 'at', vencido: 'ng', nao_aplicavel: 'nt' };
  const tagProc = (p) => (p.situacao === 'concluido' ? et('ok', 'Concluído') : p.situacao === 'cancelado' ? et('nt', 'Cancelado')
    : p.atrasado ? et('ng', 'Previsão ultrapassada') : p.recebido_em ? et('in', 'Pronto para entregar') : et('at', 'Em andamento'));
  const ST_MSG = { pendente: ['at', 'Aguardando envio'], aberta_manual: ['in', 'Aberta no WhatsApp — envio não confirmado'],
    manual_informado: ['nt', 'Envio manual informado'], aceita: ['ok', 'Aceita pelo WhatsApp'], entregue: ['ok', 'Entregue'],
    lida: ['ok', 'Lida'], falhou: ['ng', 'Falhou'], cancelada: ['nt', 'Cancelada'] };
  const tagMsg = (s) => { const [c, t] = ST_MSG[s] || ['nt', s]; return et(c, s === 'pendente' && !CAT.whatsapp.configurado ? 'Aguardando envio manual' : t); };
  const NOME_MODELO = (c) => CAT.modelos.find((m) => m.codigo === c)?.nome || (c === 'avulsa' ? 'Mensagem avulsa' : c);
  function tagAviso(l, hj) {
    const passou = l.data_alvo && l.data_alvo < hj;
    switch (l.tipo) {
      case 'vencimento': return et(passou ? 'ng' : 'at', passou ? 'Vencido' : 'Vencimento');
      case 'aniversario': return et('dr', 'Aniversário');
      case 'parcela': return et(passou ? 'ng' : 'at', passou ? 'Parcela vencida' : 'Parcela');
      case 'assinatura': return et(passou ? 'ng' : 'in', passou ? 'Assinatura vencida' : 'Assinatura');
      case 'previsao': return et(passou ? 'ng' : 'in', passou ? 'Previsão ultrapassada' : 'Previsão');
      default: return et('nt', l.tipo);
    }
  }

  /* ════════════════════ HOJE ════════════════════ */
  async function vHoje() {
    const h = await api('GET', '/api/hoje');
    const hj = h.hoje;
    const c = h.contagem;
    const chip = (f, n, rot, alerta) => `<a class="contagem${alerta && n ? ' alerta' : ''}" href="#/hoje" data-acao="filtroHoje" data-f="${f}"><div class="num">${n}</div><div class="rot">${rot}</div></a>`;

    const ag = [...h.agenda, ...h.tarefas_atrasadas].map((g) => ({ cel: [
      `<span class="num">${esc(g.hora || '—')}</span>`,
      g.data < hj ? et('ng', `Atrasada desde ${br(g.data)}`) : et(g.tipo === 'atendimento' ? 'in' : 'nt', g.tipo === 'atendimento' ? 'Atendimento' : 'Tarefa'),
      `<strong>${esc(g.titulo)}</strong>${g.cliente_nome ? `<div class="peq"><a href="#/cliente/${g.cliente_id}">${esc(g.cliente_nome)}</a></div>` : ''}${g.local ? `<div class="peq mut">${esc(g.local)}</div>` : ''}`,
      g.concluido_em ? et('ok', 'Concluído') : `<button class="b s" data-acao="agendaAcao" data-id="${g.id}" data-a="concluir">Concluir</button>`,
    ] }));

    const avisos = h.avisos.map((l) => ({ cel: [
      tagAviso(l, hj),
      `<strong>${esc(l.titulo)}</strong>${l.detalhe ? `<div class="peq mut">${esc(l.detalhe)}</div>` : ''}`,
      `<div class="linha-b">${l.cliente_id ? `<a class="b s" href="#/cliente/${l.cliente_id}">Abrir ficha</a>` : l.tipo === 'assinatura' ? '<a class="b s" href="#/financeiro">Ver</a>' : ''}
        <button class="b s" data-acao="avisoVisto" data-id="${l.id}">Visto</button></div>`,
    ] }));

    const msgs = h.mensagens.map((m) => ({ cel: [
      `<a href="#/cliente/${m.cliente_id}">${esc(m.cliente_nome)}</a><div class="peq mut">${esc(NOME_MODELO(m.modelo_codigo))}</div>`,
      `<div class="peq">${esc(m.texto)}</div>`, tagMsg(m.situacao), botoesMsg(m),
    ] }));

    const filtros = { todos: () => true, pendencia: (p) => p.faltam.length, atrasado: (p) => p.atrasado };
    const procs = h.processos.filter(filtros[E.filtroHoje] || filtros.todos);
    const linhas = procs.map((p) => ({ attrs: `class="clic" data-ir="#/cliente/${p.cliente_id}/processos"`, cel: [
      `<strong>${esc(p.cliente_nome)}</strong><div class="peq mut">${esc(p.numero)}</div>`,
      `${esc(p.servico_nome)}${p.cidade_nome ? `<div class="peq mut">${esc(p.cidade_nome)}</div>` : ''}`,
      `${esc(p.etapa_nome)}<div class="peq mut">Etapa ${p.etapa_idx + 1} de ${p.total_etapas}</div>`,
      p.faltam.length ? p.faltam.slice(0, 3).map((f) => `<div>${esc(f.nome)} <span class="peq mut">· ${esc(f.situacao)}</span></div>`).join('') +
        (p.faltam.length > 3 ? `<div class="peq mut">e mais ${p.faltam.length - 3}</div>` : '') : '<span class="mut">Nada pendente</span>',
      `${p.atrasado ? et('ng', 'Previsão ultrapassada') + '<br>' : ''}<strong>${esc(p.proxima)}</strong>`,
    ] }));

    const venc = h.vencendo.map((d) => {
      const n = difDias(hj, d.validade);
      return { attrs: `class="clic" data-ir="#/cliente/${d.cliente_id}/documentos"`, cel: [
        esc(d.tipo_nome), esc(d.cliente_nome), `<span class="num">${br(d.validade)}</span>`,
        n < 0 ? et('ng', `Vencido há ${plural(-n, 'dia', 'dias')}`) : et(n <= 30 ? 'ng' : 'at', n === 0 ? 'Vence hoje' : `Vence em ${plural(n, 'dia', 'dias')}`),
      ] };
    });

    const rotFiltro = { todos: 'Todos', pendencia: 'Com documento pendente', atrasado: 'Previsão ultrapassada' };
    return `<div class="topo-tela">
        <div class="busca"><input type="search" data-busca placeholder="Buscar por nome, WhatsApp ou número do processo" aria-label="Buscar cliente"></div>
        <button class="b p grande" data-acao="novoCliente">+ Novo cliente</button></div>
      <div id="resultado-busca"></div>
      <div class="contagens">
        ${chip('todos', c.atendimentos, 'atendimentos e tarefas hoje')}
        ${chip('pendencia', c.pendencias, 'clientes com documento pendente')}
        ${chip('atrasado', c.atrasados, 'previsões ultrapassadas', true)}
        ${chip('vencendo', c.vencendo, 'documentos perto do vencimento', true)}
        <a class="contagem${h.duvidas_nao_lidas ? ' alerta' : ''}" href="#/duvidas"><div class="num">${h.duvidas_nao_lidas}</div><div class="rot">dúvidas de clientes sem leitura</div></a>
      </div>
      ${h.pedidos_cliente.length ? cartao('Pedidos da Área do cliente', tabela([{ t: 'Cliente' }, { t: 'Pedido' }, { t: '' }], h.pedidos_cliente.map((pc) => ({ cel: [
        `<a href="#/cliente/${pc.cliente_id}">${esc(pc.cliente_nome || '—')}</a><div class="peq mut">${dh(pc.criado_em)}</div>`,
        pc.tipo === 'recuperacao' ? 'Pediu recuperação de acesso' : `Quer mudar ${pc.campo === 'email' ? 'o e-mail de acesso' : 'o WhatsApp'} para <strong>${esc(pc.valor)}</strong>`,
        `<div class="linha-b">${pc.tipo === 'recuperacao' ? `<button class="b s p" data-acao="linkSenha" data-cliente="${pc.cliente_id}">Gerar link para nova senha</button>`
          : `<button class="b s p" data-acao="decidirPedido" data-id="${pc.id}" data-d="atendido">Aprovar</button>`}
          <button class="b s" data-acao="decidirPedido" data-id="${pc.id}" data-d="recusado">${pc.tipo === 'recuperacao' ? 'Descartar' : 'Recusar'}</button></div>`] })), ''), { sem: true }) : ''}
      ${ag.length ? cartao(`Hoje, ${br(hj)}`, tabela([{ t: 'Hora' }, { t: 'Tipo' }, { t: 'O quê' }, { t: '' }], ag, ''), { sem: true,
        extra: '<button class="b s" data-acao="novoCompromisso">Agendar</button>' }) : ''}
      ${avisos.length ? cartao('Avisos', tabela([{ t: 'Tipo' }, { t: 'Aviso' }, { t: '' }], avisos, ''), { sem: true }) : ''}
      ${msgs.length ? cartao(CAT.whatsapp.configurado ? 'Mensagens com falha' : 'Mensagens para enviar pelo WhatsApp',
        (CAT.whatsapp.configurado ? '' : '<div class="info-l" style="margin:12px 16px">Envio automático: <strong>Não configurado</strong>. Abra o WhatsApp com a mensagem pronta e envie você mesmo.</div>') +
        tabela([{ t: 'Para' }, { t: 'Mensagem' }, { t: 'Situação' }, { t: '' }], msgs, ''), { sem: true }) : ''}
      ${cartao(`Processos em andamento${E.filtroHoje !== 'todos' ? ' — ' + rotFiltro[E.filtroHoje] : ''}`,
        tabela([{ t: 'Cliente' }, { t: 'Serviço' }, { t: 'Etapa' }, { t: 'O que falta' }, { t: 'Próximo passo' }], linhas,
          E.filtroHoje === 'todos' ? 'Nenhum processo em andamento.' : 'Nenhum processo neste filtro.'),
        { sem: true, id: 'cartao-processos', extra: `<div class="linha-b">${Object.entries(rotFiltro).map(([k, t]) =>
          `<button class="b s${E.filtroHoje === k ? ' p' : ''}" data-acao="filtroHoje" data-f="${k}">${t}</button>`).join('')}</div>` })}
      <div id="cartao-vencendo">${cartao('Documentos perto do vencimento', tabela([{ t: 'Documento' }, { t: 'Cliente' }, { t: 'Validade' }, { t: 'Situação' }], venc,
        'Nenhum documento vence nos próximos meses.'), { sem: true })}</div>`;
  }

  function botoesMsg(m) {
    const b = [];
    if (['pendente', 'falhou', 'aberta_manual'].includes(m.situacao)) b.push(`<button class="b s p" data-acao="msgAbrir" data-id="${m.id}">Abrir WhatsApp com mensagem pronta</button>`);
    if (['aberta_manual'].includes(m.situacao)) b.push(`<button class="b s" data-acao="msgEnviei" data-id="${m.id}">Já enviei</button>`);
    if (m.situacao === 'falhou' && CAT.whatsapp.configurado) b.push(`<button class="b s" data-acao="msgTentar" data-id="${m.id}">Tentar de novo</button>`);
    if (['pendente', 'falhou', 'aberta_manual'].includes(m.situacao)) b.push(`<button class="b s" data-acao="msgCancelar" data-id="${m.id}">Não enviar</button>`);
    return `<div class="linha-b">${b.join('')}</div>`;
  }

  async function buscar(termo) {
    const alvo = document.getElementById('resultado-busca');
    if (!alvo) return;
    if (termo.trim().length < 2) { alvo.innerHTML = ''; return; }
    const r = await api('GET', '/api/busca?q=' + encodeURIComponent(termo));
    alvo.innerHTML = cartao(`Resultado da busca (${r.clientes.length})`, tabela([{ t: 'Cliente' }, { t: 'Processos' }, { t: 'Próximo passo' }],
      r.clientes.map((c) => ({ attrs: `class="clic" data-ir="#/cliente/${c.id}"`, cel: [
        `<strong>${esc(c.nome)}</strong><div class="peq mut">${esc(c.whatsapp)}</div>`,
        c.processos.map((p) => `<div class="peq">${esc(p.numero)} · ${esc(p.servico_nome)}</div>`).join('') || '<span class="mut">—</span>',
        esc(c.proxima)] })), 'Nenhum cliente encontrado. Use "Novo cliente" para cadastrar.'), { sem: true });
  }

  /* ════════════════════ CLIENTES ════════════════════ */
  async function vClientes() {
    const r = await api('GET', '/api/clientes');
    const linhas = r.clientes.map((c) => ({
      attrs: `class="clic" data-ir="#/cliente/${c.id}" data-texto="${esc((c.nome + ' ' + c.whatsapp + ' ' + c.processos.map((p) => p.numero).join(' ')).toLowerCase())}"`,
      cel: [
        `<strong>${esc(c.nome)}</strong><div class="peq mut">${esc(c.whatsapp)}${c.cidade_nome ? ' · ' + esc(c.cidade_nome) : ''}</div>`,
        c.processos.filter((p) => p.situacao === 'andamento').map((p) => `<div class="peq">${esc(p.servico_nome)}</div>`).join('') || '<span class="mut">—</span>',
        esc(c.proxima),
        c.pendencias ? et('at', plural(c.pendencias, 'pendência', 'pendências')) : et('ok', 'Sem pendência'),
        Object.entries(c.saldos).map(([m, v]) => `<div class="num">${v > 0 ? dinheiro(v, m) : `Crédito ${dinheiro(-v, m)}`}</div>`).join('') || '<span class="mut">—</span>',
      ] }));
    return `<div class="topo-tela"><div class="titulo"><h1>Clientes</h1><div class="mut">${plural(r.clientes.length, 'cliente', 'clientes')}</div></div>
        <button class="b p grande" data-acao="novoCliente">+ Novo cliente</button></div>
      <div class="busca" style="margin-bottom:14px"><input type="search" data-filtra placeholder="Filtrar por nome, WhatsApp ou número do processo" aria-label="Filtrar clientes"></div>
      ${cartao('Todos os clientes', tabela([{ t: 'Cliente' }, { t: 'Em andamento' }, { t: 'Próximo passo' }, { t: 'Documentos' }, { t: 'Falta receber', dir: true }],
        linhas, 'Nenhum cliente cadastrado ainda.'), { sem: true })}`;
  }

  /* ════════════════════ FICHA DO CLIENTE ════════════════════ */
  const ABAS = [['resumo', 'Resumo'], ['processos', 'Processos'], ['documentos', 'Documentos'], ['financeiro', 'Financeiro'], ['historico', 'Histórico']];
  async function vCliente(id, aba = 'resumo') {
    const f = await api('GET', `/api/clientes/${Number(id)}`);
    E.ficha = f;
    const c = f.cliente;
    const ativos = f.processos.filter((p) => p.situacao === 'andamento');
    const varios = ativos.length > 1;

    const feito = [];
    for (const p of f.processos) {
      if (p.situacao === 'concluido') feito.push(`${esc(p.servico_nome)}: entregue em ${br(p.entregue_em)}`);
      if (p.situacao === 'andamento') {
        const conta = p.itens.filter((i) => i.st.codigo !== 'nao_aplicavel');
        feito.push(`${esc(p.servico_nome)}: etapa ${p.etapa_idx + 1} de ${p.etapas.length} — ${esc(p.etapa_nome)}` +
          `<div class="peq mut">${conta.filter((i) => i.st.codigo === 'recebido').length} de ${conta.length} documentos recebidos${p.protocolo_data ? ` · protocolo em ${br(p.protocolo_data)}` : ''}</div>`);
      }
    }
    const falta = ativos.flatMap((p) => [
      ...(p.atrasado ? [`<span class="et ng">Previsão ultrapassada</span> ${esc(p.servico_nome)} (${br(p.previsao)})`] : []),
      ...p.faltam.map((x) => `${esc(x.nome)} <span class="peq mut">· ${esc(x.situacao)}${varios ? ' · ' + esc(p.servico_nome) : ''}</span>`),
    ]);
    const saldos = Object.entries(f.financeiro.saldos).filter(([, s]) => s.saldo !== 0);
    const proxParc = f.financeiro.parcelas.find((p) => !p.anulada && p.falta > 0);
    const receber = saldos.map(([m, s]) => s.saldo > 0 ? `<div class="destaque">${dinheiro(s.saldo, m)}</div>` : `<div>Crédito de ${dinheiro(-s.saldo, m)}</div>`).join('') +
      (proxParc ? `<div class="peq mut">Próxima parcela: ${dinheiro(proxParc.falta, proxParc.moeda)} em ${br(proxParc.vencimento)}${proxParc.vencimento < CAT.hoje ? ' — vencida' : ''}</div>` : '');
    const proxima = ativos.map((p) => `<div class="destaque">${esc(p.proxima)}</div>${varios ? `<div class="peq mut">${esc(p.servico_nome)}</div>` : ''}`).join('');

    const visao = `<div class="visao">
      <div><div class="rot">Já feito</div>${feito.length ? `<ul>${feito.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<span class="mut">Cadastro feito. Nenhum processo ainda.</span>'}</div>
      <div><div class="rot">O que falta</div>${falta.length ? `<ul>${falta.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<span class="mut">Nada pendente.</span>'}</div>
      <div><div class="rot">Falta receber</div>${receber || '<span class="mut">Nada a receber.</span>'}</div>
      <div><div class="rot">Próxima ação</div>${proxima || `<span class="mut">Nenhum processo em andamento.</span><div><button class="b s" data-acao="novoProcesso" data-cliente="${c.id}">Abrir processo</button></div>`}</div></div>`;

    const conteudo = { resumo: abaResumo, processos: abaProcessos, documentos: abaDocumentos, financeiro: abaFinanceiro, historico: abaHistorico }[aba] || abaResumo;
    return `<a class="volta" href="#/clientes">← Clientes</a>
      <div class="ficha-cab"><div class="quem"><h1>${esc(c.nome)}</h1>
        <div class="linha-b peq mut">${esc(c.whatsapp)}${c.cidade_nome ? ' · ' + esc(c.cidade_nome) : ''}${c.perfil_comercial ? ' · ' + esc(c.perfil_comercial) : ''}
        ${c.aceita_mensagens ? et('ok', 'Aceita mensagens') : et('nt', 'Sem autorização para mensagens')}</div></div>
        <div class="linha-b"><button class="b" data-acao="whatsAvulso" data-cliente="${c.id}">Abrir WhatsApp</button>
        <button class="b" data-acao="editarCliente" data-cliente="${c.id}">Editar dados</button>
        <button class="b p" data-acao="novoProcesso" data-cliente="${c.id}">+ Novo processo</button></div></div>
      ${visao}
      <nav class="abas">${ABAS.map(([k, t]) => `<a class="aba${k === aba ? ' on' : ''}" href="#/cliente/${c.id}/${k}">${t}</a>`).join('')}</nav>
      ${conteudo(f)}`;
  }

  function abaResumo(f) {
    const c = f.cliente;
    const dado = (r, v) => `<div><dt>${r}</dt><dd>${v ? esc(v) : '<span class="mut">—</span>'}</dd></div>`;
    const tiposMsg = { aniversario: 'aniversário', vencimento: 'vencimento', agendamento: 'agendamento', documento: 'documento disponível' };
    const dados = `<dl class="dados">
      ${dado('Data de nascimento', c.nascimento && br(c.nascimento))}${dado('E-mail', c.email)}${dado('Nacionalidade', c.nacionalidade)}
      ${dado('Documento', [c.documento_tipo, c.documento_numero].filter(Boolean).join(' · '))}${dado('Estado civil', c.estado_civil)}
      ${dado('Perfil comercial', c.perfil_comercial)}${dado('Responsável', c.responsavel_nome)}${dado('Cidade', c.cidade_nome)}
      ${dado('Mensagens', c.aceita_mensagens ? 'Autorizadas: ' + (c.mensagens_tipos.map((t) => tiposMsg[t]).join(', ') || 'nenhum tipo escolhido') : 'Não autorizadas')}
      ${dado('Preferências', c.preferencias)}</dl>${c.observacoes ? `<p class="peq" style="margin-top:14px;white-space:pre-wrap">${esc(c.observacoes)}</p>` : ''}`;
    const falta = [c.nascimento ? null : 'data de nascimento', c.nacionalidade ? null : 'nacionalidade', c.documento_numero ? null : 'número do documento',
      c.perfil_comercial ? null : 'perfil comercial'].filter(Boolean);
    const ag = f.agenda.filter((g) => g.data >= CAT.hoje && !g.concluido_em).map((g) => ({ cel: [br(g.data) + (g.hora ? ' ' + esc(g.hora) : ''), esc(g.titulo), esc(g.local || '')] }));
    const avisos = f.avisos.map((l) => ({ cel: [tagAviso(l, CAT.hoje), esc(l.titulo), br(l.data_aviso)] }));
    return `${falta.length ? `<div class="nota-l">Cadastro incompleto: falta ${falta.join(', ')}. <button class="b s" data-acao="editarCliente" data-cliente="${c.id}">Completar</button></div>` : ''}
      ${cartaoAcesso(f)}
      ${cartao('Dados do cliente', dados, { extra: `<button class="b s" data-acao="editarCliente" data-cliente="${c.id}">Editar</button>` })}
      ${cartao('Próximos compromissos', tabela([{ t: 'Quando' }, { t: 'O quê' }, { t: 'Onde' }], ag, 'Nada agendado.'),
        { sem: true, extra: `<button class="b s" data-acao="novoCompromisso" data-cliente="${c.id}">Agendar</button>` })}
      ${cartao('Avisos deste cliente', tabela([{ t: 'Tipo' }, { t: 'Aviso' }, { t: 'Data' }], avisos, 'Nenhum aviso ativo.'), { sem: true })}`;
  }

  function cartaoAcesso(f) {
    const pt = f.portal;
    const k = pt.conta;
    let situ; const bts = [];
    if (!k) { situ = et('nt', 'Sem acesso'); bts.push(`<button class="b s p" data-acao="convite">Gerar convite</button>`); }
    else if (!k.ativo) { situ = et('ng', 'Acesso desativado'); bts.push(`<button class="b s" data-acao="acessoAtivo" data-a="1">Reativar acesso</button>`); }
    else if (!k.tem_senha) {
      situ = et('at', pt.link_pendente ? `Convite gerado, válido até ${dh(pt.link_pendente.expira_em)}` : 'Convite vencido');
      bts.push(`<button class="b s p" data-acao="convite">Gerar novo convite</button>`);
    } else {
      situ = et('ok', `Ativo desde ${dh(k.ativado_em)}`);
      bts.push(`<button class="b s" data-acao="linkSenha" data-cliente="${f.cliente.id}">Link para nova senha</button>`);
    }
    if (k && k.ativo) bts.push(`<button class="b s perigo" data-acao="acessoAtivo" data-a="0">Desativar acesso</button>`);
    const ped = pt.pedidos.map((pc) => `<div class="nota-l">${pc.tipo === 'recuperacao' ? 'O cliente pediu recuperação de acesso.' : `O cliente pediu para mudar ${pc.campo === 'email' ? 'o e-mail de acesso' : 'o WhatsApp'} para <strong>${esc(pc.valor)}</strong>. Confirme com ele antes de aprovar.`}
      <div class="linha-b" style="margin-top:6px">${pc.tipo === 'recuperacao' ? `<button class="b s p" data-acao="linkSenha" data-cliente="${f.cliente.id}">Gerar link para nova senha</button>`
        : `<button class="b s p" data-acao="decidirPedido" data-id="${pc.id}" data-d="atendido">Aprovar</button>`}<button class="b s" data-acao="decidirPedido" data-id="${pc.id}" data-d="recusado">${pc.tipo === 'recuperacao' ? 'Descartar' : 'Recusar'}</button></div></div>`).join('');
    const naoLidas = pt.duvidas.filter((d) => d.nao_lida).length;
    return cartao('Área do cliente', `<div class="linha-b" style="margin-bottom:8px">${situ}${k ? `<span class="peq mut">E-mail de acesso: ${esc(k.email)}</span>` : ''}
        ${k?.ultimo_acesso ? `<span class="peq mut">Último acesso: ${dh(k.ultimo_acesso)}</span>` : ''}</div>
      ${ped}${naoLidas ? `<div class="info-l">${plural(naoLidas, 'dúvida sem leitura', 'dúvidas sem leitura')}. <a href="#/duvidas">Abrir dúvidas</a></div>` : ''}
      <div class="linha-b">${bts.join('')}</div>
      <p class="peq mut" style="margin:10px 0 0">Envio de e-mail: <strong>${pt.email_configurado ? 'configurado' : 'não configurado'}</strong>. ${pt.email_configurado ? '' : 'O link do convite é mostrado aqui para você enviar pelo WhatsApp. Nada é enviado automaticamente.'}</p>`);
  }

  function abaProcessos(f) {
    if (!f.processos.length) {
      return `<div class="vazio">Nenhum processo. <button class="b p" data-acao="novoProcesso" data-cliente="${f.cliente.id}">Abrir o primeiro processo</button></div>`;
    }
    const ordem = { andamento: 0, concluido: 1, cancelado: 2 };
    return [...f.processos].sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || b.id - a.id).map((p) => cartaoProcesso(p, f)).join('');
  }

  function cartaoProcesso(p, f) {
    const and = p.situacao === 'andamento';
    const origem = p.origem_id ? f.processos.find((x) => x.id === p.origem_id) : null;
    const filhos = f.processos.filter((x) => x.origem_id === p.id);
    const etapas = `<ol class="etapas">${p.etapas.map((e, i) => `<li class="${i < p.etapa_idx || (p.situacao === 'concluido' && i <= p.etapa_idx) ? 'feita' : i === p.etapa_idx && and ? 'atual' : ''}">${esc(e.nome)}</li>`).join('')}</ol>`;
    const res = p.documento_resultado;
    const datas = `<div class="datas">
      <div><div class="r">Nº do protocolo</div>${esc(p.protocolo_numero || '—')}</div>
      <div><div class="r">Data do protocolo</div>${br(p.protocolo_data)}</div>
      <div><div class="r">Prazo estimado</div>${p.prazo_dias ? plural(p.prazo_dias, 'dia', 'dias') : '—'}</div>
      <div><div class="r">Previsão (estimativa, não garantia)</div>${br(p.previsao)}${p.dias_para_previsao != null && and ? `<div class="peq mut">${p.dias_para_previsao >= 0 ? `faltam ${plural(p.dias_para_previsao, 'dia', 'dias')}` : `passou há ${plural(-p.dias_para_previsao, 'dia', 'dias')}`}</div>` : ''}</div>
      <div><div class="r">Recebido do órgão</div>${br(p.recebido_em)}</div>
      <div><div class="r">Entregue ao cliente</div>${br(p.entregue_em)}</div>
      ${res ? `<div><div class="r">Emissão / validade do documento</div>${br(res.emissao)} / ${br(res.validade)}</div>` : ''}</div>`;

    const itens = p.itens.map((i) => {
      const d = i.doc;
      const det = d ? [d.emissao ? `Emitido ${br(d.emissao)}` : null, d.validade ? `Válido até ${br(d.validade)}` : 'Sem validade informada',
        d.original ? 'Original' : null, d.copia ? 'Cópia' : null, d.apostilado ? 'Apostilado' : null, d.autenticado ? 'Autenticado' : null, `Versão ${d.versao}`].filter(Boolean).join(' · ') : '';
      const extra = [i.st.motivo, i.observacoes ? `Interno: ${i.observacoes}` : null, i.orientacao_cliente ? `Cliente vê: ${i.orientacao_cliente}` : null,
        i.exige_recente_dias ? `Exige emissão de até ${i.exige_recente_dias} dias` : null, i.nota].filter(Boolean);
      const acoes = [];
      if (and) {
        if (!d && i.status !== 'nao_aplicavel') {
          acoes.push(`<button class="b s p" data-acao="itemDoc" data-item="${i.id}">Registrar</button>`);
          if (f.documentos.some((x) => x.tipo_id === i.tipo_id)) acoes.push(`<button class="b s" data-acao="itemReusar" data-item="${i.id}">Usar existente</button>`);
          if (i.status !== 'solicitado') acoes.push(`<button class="b s" data-acao="itemSolicitado" data-item="${i.id}">Solicitado</button>`);
          acoes.push(`<button class="b s" data-acao="itemStatus" data-item="${i.id}" data-s="nao_aplicavel">Não se aplica</button>`);
        } else if (d) {
          if (i.st.codigo === 'vencido') acoes.push(`<button class="b s p" data-acao="itemDoc" data-item="${i.id}">Registrar novo</button>`);
          else acoes.push(`<button class="b s" data-acao="itemDoc" data-item="${i.id}">Nova versão</button>`);
        } else acoes.push(`<button class="b s" data-acao="itemStatus" data-item="${i.id}" data-s="pendente">Voltar a exigir</button>`);
        acoes.push(`<button class="b s" data-acao="itemEditar" data-item="${i.id}">Ajustar</button>`);
      }
      if (d?.arquivo_id) {
        acoes.unshift(`<a class="b s" href="${R('/api/')}arquivos/${d.arquivo_id}" target="_blank" rel="noopener">Ver arquivo</a>`);
        const lib = f.portal.liberacoes.some((l) => l.arquivo_id === d.arquivo_id && !l.revogado_em);
        acoes.push(lib ? '<span class="peq" style="color:var(--ok)">Liberado ao cliente</span>'
          : `<button class="b s" data-acao="liberar" data-arquivo="${d.arquivo_id}" data-proc="${p.id}" data-titulo="${esc(i.tipo_nome)}">Liberar ao cliente</button>`);
      }
      return { cel: [`<strong>${esc(i.tipo_nome)}</strong>${i.opcional ? '<div class="peq mut">Se aplicável</div>' : ''}`,
        et(ST_ITEM[i.st.codigo], i.st.rotulo) + (i.st.aviso ? '<div class="peq" style="color:var(--atencao)">Confira</div>' : ''),
        `<div class="peq">${esc(det)}</div>${extra.map((x) => `<div class="peq mut">${esc(x)}</div>`).join('')}`,
        `<div class="linha-b">${acoes.join('')}</div>`] };
    });

    const bts = [];
    if (and) {
      if (!p.protocolo_data) {
        bts.push(`<button class="b p" data-acao="protocolo" data-proc="${p.id}">Registrar protocolo</button>`);
        if (p.etapa_idx < p.etapas.length - 1) bts.push(`<button class="b" data-acao="etapa" data-proc="${p.id}" data-d="1">Avançar etapa</button>`);
      } else if (!p.recebido_em) bts.push(`<button class="b p" data-acao="recebido" data-proc="${p.id}">Registrar recebimento</button>`);
      else bts.push(`<button class="b p" data-acao="entregue" data-proc="${p.id}">Registrar entrega ao cliente</button>`);
      if (p.etapa_idx > 0 && !p.protocolo_data) bts.push(`<button class="b" data-acao="etapa" data-proc="${p.id}" data-d="-1">Voltar etapa</button>`);
      bts.push(`<button class="b" data-acao="novoCompromisso" data-cliente="${p.cliente_id}" data-proc="${p.id}">Agendar atendimento</button>`);
    }
    if (p.recebido_em && p.situacao !== 'cancelado') {
      for (const s of p.segue_para) {
        if (!filhos.some((x) => x.servico_id === s.id)) bts.push(`<button class="b p" data-acao="derivar" data-proc="${p.id}" data-serv="${s.id}" data-v="seguinte">Abrir ${esc(s.nome)}</button>`);
      }
    }
    if (p.situacao === 'concluido') bts.push(`<button class="b" data-acao="renovar" data-proc="${p.id}">Renovar (novo processo vinculado)</button>`);
    bts.push(`<button class="b" data-acao="editarProcesso" data-proc="${p.id}">Editar</button>`);
    if (and) {
      bts.push(`<button class="b" data-acao="addItem" data-proc="${p.id}">Acrescentar documento</button>`);
      if (!p.prioridade_justificativa) bts.push(`<button class="b" data-acao="prioridade" data-proc="${p.id}">Trâmite prioritário oficial</button>`);
      bts.push(`<button class="b perigo" data-acao="cancelarProcesso" data-proc="${p.id}">Cancelar processo</button>`);
    }

    return `<article class="proc${and ? '' : ' fechado'}" id="proc-${p.id}">
      <div class="proc-cab"><div class="t"><div class="peq mut">${esc(p.numero)}${p.cidade_nome ? ' · ' + esc(p.cidade_nome) : ''}${p.modalidade ? ' · ' + esc(p.modalidade) : ''}${p.responsavel_nome ? ' · ' + esc(p.responsavel_nome) : ''}</div>
        <h3>${esc(p.servico_nome)}</h3>
        ${origem ? `<div class="peq mut">${p.vinculo === 'renovacao' ? 'Renovação de' : 'Aberto a partir de'} ${esc(origem.numero)} (${esc(origem.servico_nome)})</div>` : ''}
        ${filhos.map((x) => `<div class="peq mut">${x.vinculo === 'renovacao' ? 'Renovado em' : 'Deu origem a'} ${esc(x.numero)} (${esc(x.servico_nome)})</div>`).join('')}</div>
        <div class="linha-b">${tagProc(p)}${p.prioridade_justificativa ? et('dr', 'Trâmite prioritário oficial') : ''}</div></div>
      <div class="proc-corpo">
        ${p.atrasado ? `<div class="alerta-l">A previsão (${br(p.previsao)}) passou e o documento ainda não chegou. Previsão é estimativa, não garantia.</div>` : ''}
        ${etapas}
        ${and ? `<div class="proximo"><div class="t"><span class="peq mut">Próximo passo</span><br><strong>${esc(p.proxima)}</strong>${p.proxima_acao ? '<span class="peq mut"> (escrito à mão)</span>' : ''}</div>
          <button class="b s" data-acao="editarProcesso" data-proc="${p.id}">Mudar</button></div>` : ''}
        ${datas}
        ${p.prioridade_justificativa ? `<div class="info-l">Trâmite prioritário oficial: ${esc(p.prioridade_justificativa)}${p.prioridade_arquivo_id ? ` · <a href="${R('/api/')}arquivos/${p.prioridade_arquivo_id}" target="_blank" rel="noopener">comprovante</a>` : ''}</div>` : ''}
        <div class="visivel-cliente"><div class="rot-v">O cliente vê</div>
          <div><strong>Próximo passo:</strong> ${p.cliente_proximo_passo ? esc(p.cliente_proximo_passo) + (p.cliente_quem ? ` <span class="peq mut">(quem faz: ${{ cliente: 'o cliente', equipe: 'a equipe', orgao: 'o órgão' }[p.cliente_quem]})</span>` : '') : '<span class="mut">texto automático conforme a etapa</span>'}</div>
          ${p.cliente_orientacoes ? `<div style="white-space:pre-wrap;margin-top:4px"><strong>Orientações:</strong> ${esc(p.cliente_orientacoes)}</div>` : ''}
          <div class="peq mut" style="margin-top:4px">Responsável ${p.mostrar_responsavel ? 'visível' : 'oculto'} · última atualização vista pelo cliente: ${dh(p.atualizado_cliente_em || p.criado_em)}</div>
          ${and ? `<div class="linha-b" style="margin-top:8px"><button class="b s" data-acao="paraCliente" data-proc="${p.id}">Editar o que o cliente vê</button>
            <button class="b s p" data-acao="publicar" data-proc="${p.id}">Publicar atualização ao cliente</button></div>` : ''}</div>
        ${p.observacoes || p.proxima_acao ? `<div class="interno"><div class="rot-v">Observação interna da equipe — o cliente não vê</div>
          ${p.proxima_acao ? `<div>Próximo passo interno: ${esc(p.proxima_acao)}</div>` : ''}${p.observacoes ? `<div style="white-space:pre-wrap">${esc(p.observacoes)}</div>` : ''}</div>` : ''}
        ${tabela([{ t: 'Documento' }, { t: 'Situação' }, { t: 'Detalhes' }, { t: '' }], itens, 'Este serviço não tem lista de documentos.')}
        <div class="linha-b" style="margin-top:14px">${bts.join('')}</div></div></article>`;
  }

  function abaDocumentos(f) {
    const grupos = new Map();
    for (const d of f.documentos) { if (!grupos.has(d.tipo_id)) grupos.set(d.tipo_id, []); grupos.get(d.tipo_id).push(d); }
    const detalhe = (d) => [d.emissao ? `Emitido ${br(d.emissao)}` : 'Emissão não informada', d.validade ? `Válido até ${br(d.validade)}` : 'Sem validade informada',
      d.original ? 'Original' : null, d.copia ? 'Cópia' : null, d.apostilado ? 'Apostilado' : null, d.autenticado ? 'Autenticado' : null].filter(Boolean).join(' · ');
    const linhas = [...grupos.values()].map((vs) => {
      const atual = vs.find((d) => !d.substituido_em) || vs[0];
      const antigas = vs.filter((d) => d !== atual);
      const venc = atual.validade && atual.validade < CAT.hoje;
      return { cel: [
        `<strong>${esc(atual.tipo_nome)}</strong><div class="peq mut">Versão ${atual.versao} · registrado ${dh(atual.criado_em)}</div>`,
        venc ? et('ng', 'Vencido') : atual.validade && difDias(CAT.hoje, atual.validade) <= 120 ? et('at', `Vence em ${plural(difDias(CAT.hoje, atual.validade), 'dia', 'dias')}`) : et('ok', 'Em arquivo'),
        `<div class="peq">${esc(detalhe(atual))}</div>${atual.observacoes ? `<div class="peq mut">${esc(atual.observacoes)}</div>` : ''}
         ${antigas.length ? `<details><summary>${plural(antigas.length, 'versão anterior', 'versões anteriores')}</summary>${antigas.map((d) =>
          `<div class="peq" style="margin-top:6px">Versão ${d.versao}: ${esc(detalhe(d))} · substituída ${dh(d.substituido_em)}${d.arquivo_id ? ` · <a href="${R('/api/')}arquivos/${d.arquivo_id}" target="_blank" rel="noopener">ver</a>` : ''}</div>`).join('')}</details>` : ''}`,
        `<div class="linha-b">${atual.arquivo_id ? `<a class="b s" href="${R('/api/')}arquivos/${atual.arquivo_id}" target="_blank" rel="noopener">Ver arquivo</a>` : '<span class="peq mut">Sem anexo</span>'}
          ${atual.arquivo_id && !f.portal.liberacoes.some((l) => l.arquivo_id === atual.arquivo_id && !l.revogado_em)
    ? `<button class="b s" data-acao="liberar" data-arquivo="${atual.arquivo_id}" data-titulo="${esc(atual.tipo_nome)}">Liberar ao cliente</button>` : ''}
          <button class="b s" data-acao="docCorrigir" data-doc="${atual.id}">Corrigir dados</button>
          <button class="b s" data-acao="docNovo" data-cliente="${f.cliente.id}" data-tipo="${atual.tipo_id}">Nova versão</button></div>`] };
    });
    return `<div class="info-l">Cada documento é guardado uma vez e usado em todos os processos do cliente. Uma versão nova não apaga a anterior; processos já protocolados continuam ligados à versão que foi entregue.</div>
      ${cartao('Documentos do cliente', tabela([{ t: 'Documento' }, { t: 'Situação' }, { t: 'Detalhes' }, { t: '' }], linhas, 'Nenhum documento registrado.'),
        { sem: true, extra: `<button class="b s p" data-acao="docNovo" data-cliente="${f.cliente.id}">Registrar documento</button>` })}
      ${cartao('Arquivos liberados na Área do cliente', `<div class="info-l" style="margin:12px 16px">Todo anexo é privado. Só aparece para o cliente o que estiver liberado aqui, e só para <strong>${esc(f.cliente.nome)}</strong>.</div>` +
        tabela([{ t: 'Nome que o cliente vê' }, { t: 'Processo' }, { t: 'Liberado' }, { t: 'Situação' }, { t: '' }], f.portal.liberacoes.map((l) => ({ cel: [
          `<strong>${esc(l.titulo)}</strong><div class="peq mut">Arquivo: ${esc(l.arquivo_nome)}</div>`, esc(l.numero || 'Geral'),
          `${dh(l.liberado_em)}<div class="peq mut">${esc(l.liberado_por_nome || '')}</div>`,
          l.revogado_em ? et('nt', `Retirado em ${dh(l.revogado_em)}`) : et('ok', 'Visível ao cliente'),
          `<div class="linha-b"><a class="b s" href="${R('/api/')}arquivos/${l.arquivo_id}" target="_blank" rel="noopener">Ver</a>${l.revogado_em ? '' : `<button class="b s" data-acao="revogar" data-id="${l.id}">Retirar</button>`}</div>`] })),
        'Nenhum arquivo liberado.'), { sem: true, extra: `<button class="b s p" data-acao="enviarArquivo">Enviar arquivo ao cliente</button>` })}`;
  }

  function abaFinanceiro(f) {
    const fin = f.financeiro;
    const cid = f.cliente.id;
    const procNome = (id) => f.processos.find((p) => p.id === id)?.servico_nome || '';
    const saldos = Object.entries(fin.saldos).map(([m, s]) => `<div class="saldo"><div class="peq mut">${esc(m)} · falta receber</div>
      <div class="falta${s.saldo <= 0 ? ' zero' : ''}">${s.saldo >= 0 ? dinheiro(s.saldo, m) : 'Crédito ' + dinheiro(-s.saldo, m)}</div>
      <div class="det">Honorários ${dinheiro(s.honorarios, m)} · Taxas ${dinheiro(s.taxas, m)} · Custos ${dinheiro(s.custos, m)}${s.descontos ? ` · Descontos −${dinheiro(s.descontos, m)}` : ''}<br>
      Total cobrado ${dinheiro(s.cobrado, m)} · Recebido ${dinheiro(s.recebido, m)}</div></div>`).join('');
    const ROT = { honorario: 'Honorário', taxa: 'Taxa oficial', custo: 'Custo documental', desconto: 'Desconto', pagamento: 'Pagamento' };
    const lanc = [...fin.lancamentos].reverse().map((l) => ({ cel: [
      `<span class="num">${br(l.data)}</span>`,
      et(l.tipo === 'pagamento' ? 'ok' : l.tipo === 'desconto' ? 'dr' : 'nt', ROT[l.tipo]) + (l.prioridade_oficial ? ' ' + et('dr', 'Prioridade oficial') : ''),
      `${esc(l.descricao)}${l.processo_id ? `<div class="peq mut">${esc(procNome(l.processo_id))}</div>` : ''}${l.forma ? `<div class="peq mut">${esc(l.forma)}</div>` : ''}
       ${l.moeda_original ? `<div class="peq mut">Recebido ${dinheiro(l.valor_original, l.moeda_original)} — ${esc(l.cambio_nota)}</div>` : ''}
       ${l.adicional_justificativa ? `<div class="peq mut">Cobrança adicional ao pacote: ${esc(l.adicional_justificativa)}</div>` : ''}
       ${l.anulado_em ? `<div class="peq" style="color:var(--erro)">Anulado: ${esc(l.anulado_motivo)}</div>` : ''}`,
      `<span class="num"${l.anulado_em ? ' style="text-decoration:line-through"' : ''}>${l.tipo === 'desconto' ? '−' : ''}${dinheiro(l.valor, l.moeda)}</span>`,
      `<div class="linha-b">${l.arquivo_id ? `<a class="b s" href="${R('/api/')}arquivos/${l.arquivo_id}" target="_blank" rel="noopener">Comprovante</a>` : ''}
        ${admin() && !l.anulado_em ? `<button class="b s" data-acao="anularLanc" data-id="${l.id}">Anular</button>` : ''}</div>`] }));
    const parc = fin.parcelas.map((p) => ({ cel: [
      esc(p.descricao) + (p.processo_id ? `<div class="peq mut">${esc(procNome(p.processo_id))}</div>` : ''),
      `<span class="num">${br(p.vencimento)}</span>`, `<span class="num">${dinheiro(p.valor, p.moeda)}</span>`, `<span class="num">${dinheiro(p.pago, p.moeda)}</span>`,
      et(p.situacao === 'Paga' ? 'ok' : p.situacao.startsWith('Vencida') ? 'ng' : p.situacao === 'Anulada' ? 'nt' : 'at', p.situacao),
      `<div class="linha-b">${!p.anulada && p.falta > 0 ? `<button class="b s p" data-acao="pagamento" data-cliente="${cid}" data-parcela="${p.id}">Registrar pagamento</button>` : ''}
        ${admin() && !p.anulada && p.pago === 0 ? `<button class="b s" data-acao="anularParcela" data-id="${p.id}">Anular</button>` : ''}</div>`] }));
    const pac = fin.pacotes.map((p) => `<div class="info-l"><strong>Pacote: ${esc(p.nome)}</strong> — inclui ${p.servicos.map((id) => esc(CAT.serv.get(id)?.nome || '?')).join(', ')}.
      Honorários destes serviços já estão no pacote.</div>`).join('');
    return `<div class="linha-b" style="margin-bottom:14px">
        <button class="b p" data-acao="pagamento" data-cliente="${cid}">Registrar pagamento</button>
        <button class="b" data-acao="cobranca" data-cliente="${cid}">Lançar cobrança</button>
        <button class="b" data-acao="parcelas" data-cliente="${cid}">Programar entrada e parcelas</button>
        <button class="b" data-acao="pacote" data-cliente="${cid}">Criar pacote</button></div>
      ${saldos ? `<div class="saldos">${saldos}</div>` : '<div class="vazio">Nada lançado ainda.</div>'}
      ${Object.keys(fin.saldos).length > 1 ? '<div class="nota-l">Cada moeda tem o seu saldo. Valores em moedas diferentes não são somados.</div>' : ''}
      ${pac}
      ${cartao('Entrada e parcelas', tabela([{ t: 'Descrição' }, { t: 'Vencimento' }, { t: 'Valor', dir: true }, { t: 'Pago', dir: true }, { t: 'Situação' }, { t: '' }], parc, 'Nenhuma parcela programada.'), { sem: true })}
      ${cartao('Lançamentos', tabela([{ t: 'Data' }, { t: 'Tipo' }, { t: 'Descrição' }, { t: 'Valor', dir: true }, { t: '' }], lanc, 'Nenhum lançamento.'), { sem: true })}`;
  }

  function abaHistorico(f) {
    const fmt = (d) => {
      if (!d) return '';
      let o; try { o = JSON.parse(d); } catch { return d; }
      if (Array.isArray(o)) return o.map((x) => Object.values(x).filter(Boolean).join(' · ')).join('\n');
      return Object.entries(o).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) => {
        if (v && typeof v === 'object' && !Array.isArray(v) && ('antes' in v || 'depois' in v)) return `${k}: ${v.antes ?? '—'} → ${v.depois ?? '—'}`;
        return `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`;
      }).join('\n').replace(/_/g, ' ');
    };
    const hist = f.historico.map((h) => `<li><div class="q">${dh(h.em)} · ${esc(h.usuario || 'sistema')}</div><strong>${esc(h.acao)}</strong><div class="d">${esc(fmt(h.detalhe))}</div></li>`).join('');
    const msgs = f.mensagens.map((m) => ({ cel: [dh(m.criado_em), esc(NOME_MODELO(m.modelo_codigo)), `<div class="peq">${esc(m.texto)}</div>`, tagMsg(m.situacao), botoesMsg(m)] }));
    const pubs = f.portal.publicacoes.map((x) => `<li><div class="q">${dh(x.criado_em)} · ${x.tipo === 'manual' ? `publicado por ${esc(x.usuario || 'equipe')}` : 'automático'} · ${esc(f.processos.find((p) => p.id === x.processo_id)?.numero || '')}</div>${esc(x.texto)}</li>`).join('');
    const duv = f.portal.duvidas.map((d) => ({ attrs: `class="clic" data-acao="abrirDuvida" data-id="${d.id}"`, cel: [dh(d.atualizado_em), `<strong>${esc(d.assunto)}</strong>`,
      et({ enviada: 'at', em_atendimento: 'in', respondida: 'ok', encerrada: 'nt' }[d.situacao], { enviada: 'Enviada', em_atendimento: 'Em atendimento', respondida: 'Respondida', encerrada: 'Encerrada' }[d.situacao]) + (d.nao_lida ? ' ' + et('ng', 'Não lida') : '')] }));
    return `${cartao('Dúvidas do cliente', tabela([{ t: 'Atualizada' }, { t: 'Assunto' }, { t: 'Situação' }], duv, 'Nenhuma dúvida.'), { sem: true })}
      ${cartao('O que o cliente viu no histórico', pubs ? `<ul class="lista-hist">${pubs}</ul>` : '<div class="vazio">Nada publicado.</div>')}
      ${cartao('Mensagens ao cliente', tabela([{ t: 'Criada' }, { t: 'Tipo' }, { t: 'Texto' }, { t: 'Situação' }, { t: '' }], msgs, 'Nenhuma mensagem.'), { sem: true })}
      ${cartao('Histórico de alterações', hist ? `<ul class="lista-hist">${hist}</ul>` : '<div class="vazio">Sem registros.</div>')}`;
  }

  /* ════════════════════ AGENDA ════════════════════ */
  async function vAgenda(aba = 'proximos') {
    const abas = `<nav class="abas"><a class="aba${aba === 'proximos' ? ' on' : ''}" href="#/agenda">Próximos dias</a><a class="aba${aba === 'mensagens' ? ' on' : ''}" href="#/agenda/mensagens">Mensagens</a></nav>`;
    const topo = `<div class="topo-tela"><div class="titulo"><h1>Agenda</h1><div class="mut">Horários no fuso de Asunción</div></div>
      <button class="b p grande" data-acao="novoCompromisso">+ Agendar</button></div>${abas}`;
    if (aba === 'mensagens') return topo + await vMensagens();
    const hj = CAT.hoje;
    const r = await api('GET', '/api/agenda');
    const itens = [
      ...r.eventos.map((g) => ({ data: g.data, ordem: g.hora || '00:00', html: `<tr><td class="num" data-r="Hora">${esc(g.hora || '—')}</td>
        <td data-r="Tipo">${g.concluido_em ? et('ok', 'Concluído') : g.data < hj ? et('ng', 'Não concluído') : et(g.tipo === 'atendimento' ? 'in' : 'nt', g.tipo === 'atendimento' ? 'Atendimento' : 'Tarefa')}</td>
        <td data-r="O quê"><strong>${esc(g.titulo)}</strong>${g.cliente_nome ? `<div class="peq"><a href="#/cliente/${g.cliente_id}">${esc(g.cliente_nome)}</a>${g.processo_numero ? ' · ' + esc(g.processo_numero) : ''}</div>` : ''}
          ${g.local ? `<div class="peq mut">${esc(g.local)}</div>` : ''}${g.responsavel_nome ? `<div class="peq mut">Responsável: ${esc(g.responsavel_nome)}</div>` : ''}</td>
        <td><div class="linha-b">${g.concluido_em ? `<button class="b s" data-acao="agendaAcao" data-id="${g.id}" data-a="reabrir">Reabrir</button>`
          : `<button class="b s p" data-acao="agendaAcao" data-id="${g.id}" data-a="concluir">Concluir</button>`}
          <button class="b s" data-acao="editarCompromisso" data-id="${g.id}">Editar</button>
          <button class="b s" data-acao="agendaAcao" data-id="${g.id}" data-a="cancelar">Cancelar</button></div></td></tr>` })),
      ...r.avisos.map((l) => ({ data: l.data_aviso, ordem: '99', html: `<tr><td class="num" data-r="Hora">—</td><td data-r="Tipo">${tagAviso(l, hj)}</td>
        <td data-r="Aviso"><strong>${esc(l.titulo)}</strong>${l.detalhe ? `<div class="peq mut">${esc(l.detalhe)}</div>` : ''}</td>
        <td><div class="linha-b">${l.cliente_id ? `<a class="b s" href="#/cliente/${l.cliente_id}">Abrir ficha</a>` : ''}${l.data_aviso <= hj ? `<button class="b s" data-acao="avisoVisto" data-id="${l.id}">Visto</button>` : ''}</div></td></tr>` })),
    ].sort((a, b) => a.data.localeCompare(b.data) || a.ordem.localeCompare(b.ordem));
    const dias = new Map();
    for (const i of itens) { if (!dias.has(i.data)) dias.set(i.data, []); dias.get(i.data).push(i.html); }
    const nomeDia = (d) => {
      const n = difDias(hj, d);
      const sem = new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
      return n === 0 ? `Hoje — ${br(d)}` : n === 1 ? `Amanhã — ${br(d)}` : n === -1 ? `Ontem — ${br(d)}` : `${sem[0].toUpperCase() + sem.slice(1)}, ${br(d)}`;
    };
    const blocos = [...dias.entries()].map(([d, hs]) => cartao(nomeDia(d), `<table class="tab"><tbody>${hs.join('')}</tbody></table>`, { sem: true })).join('');
    return topo + `<p class="mut peq">De ${br(r.de)} a ${br(r.ate)}. Inclui compromissos, previsões de processos, vencimentos, aniversários, parcelas e assinaturas.</p>` +
      (blocos || '<div class="vazio">Nada na agenda neste período.</div>');
  }

  async function vMensagens() {
    const r = await api('GET', '/api/mensagens');
    const linhas = r.mensagens.map((m) => ({ cel: [
      `<a href="#/cliente/${m.cliente_id}">${esc(m.cliente_nome)}</a><div class="peq mut">${esc(m.destino)}</div>`,
      `<strong class="peq">${esc(NOME_MODELO(m.modelo_codigo))}</strong><div class="peq">${esc(m.texto)}</div>`,
      `<span class="num">${br(m.enviar_em)}</span>`,
      tagMsg(m.situacao) + (m.ultimo_erro ? `<div class="peq" style="color:var(--erro)">${esc(m.ultimo_erro)}</div>` : '') +
        (m.eventos.length ? `<details><summary>${plural(m.eventos.length, 'registro', 'registros')}</summary>${m.eventos.map((e) => `<div class="peq">${dh(e.em)} · ${esc(e.evento)}${e.detalhe ? ' — ' + esc(e.detalhe) : ''}</div>`).join('')}</details>` : ''),
      botoesMsg(m)] }));
    return `<div class="${r.whatsapp.configurado ? 'info-l' : 'nota-l'}">Envio automático pelo WhatsApp: <strong>${r.whatsapp.configurado ? 'configurado' : 'Não configurado'}</strong>.
      ${r.whatsapp.configurado ? 'As mensagens saem no horário definido em Configurações. "Aceita" só aparece quando o serviço confirma.' : 'Use "Abrir WhatsApp com mensagem pronta" e envie do seu aparelho. O sistema não marca como enviada sem confirmação.'}
      Só recebem mensagem os clientes que autorizaram, e só dos tipos autorizados.</div>
      ${cartao('Mensagens', tabela([{ t: 'Para' }, { t: 'Mensagem' }, { t: 'Data' }, { t: 'Situação' }, { t: '' }], linhas, 'Nenhuma mensagem gerada.'), { sem: true })}`;
  }

  /* ════════════════════ FINANCEIRO ════════════════════ */
  async function vFinanceiro() {
    const r = await api('GET', '/api/financeiro');
    const hj = r.hoje;
    const aRec = r.a_receber.map((x) => ({ attrs: `class="clic" data-ir="#/cliente/${x.cliente_id}/financeiro"`, cel: [
      esc(x.cliente_nome), esc(x.moeda), `<span class="num">${dinheiro(x.cobrado, x.moeda)}</span>`, `<span class="num">${dinheiro(x.recebido, x.moeda)}</span>`,
      `<strong class="num">${x.saldo > 0 ? dinheiro(x.saldo, x.moeda) : 'Crédito ' + dinheiro(-x.saldo, x.moeda)}</strong>`] }));
    const totais = {};
    for (const x of r.a_receber) if (x.saldo > 0) totais[x.moeda] = (totais[x.moeda] || 0) + x.saldo;
    const parc = r.parcelas.map((p) => ({ attrs: `class="clic" data-ir="#/cliente/${p.cliente_id}/financeiro"`, cel: [
      esc(p.cliente_nome), esc(p.descricao), `<span class="num">${br(p.vencimento)}</span>`, `<span class="num">${dinheiro(p.falta, p.moeda)}</span>`,
      et(p.vencimento < hj ? 'ng' : 'at', p.vencimento < hj ? 'Vencida' : 'A vencer')] }));
    const ass = r.assinaturas.map((a) => {
      const n = difDias(hj, a.vencimento);
      return { cel: [
        `<strong>${esc(a.nome)}</strong><div class="peq mut">${{ dominio: 'Domínio', assinatura: 'Assinatura', outro: 'Outro' }[a.tipo]}${a.fornecedor ? ' · ' + esc(a.fornecedor) : ''}</div>
         ${a.confirmado ? '' : '<div class="peq" style="color:var(--atencao)">Dados a confirmar</div>'}${a.observacoes ? `<div class="peq mut">${esc(a.observacoes)}</div>` : ''}`,
        `<span class="num">${br(a.vencimento)}</span>`,
        { mensal: 'Mensal', anual: 'Anual', unica: 'Pagamento único' }[a.periodicidade],
        a.valor != null ? `<span class="num">${dinheiro(a.valor, a.moeda)}</span>` : '—',
        !a.ativo ? et('nt', 'Desativado') : n < 0 ? et('ng', 'Vencido') : et(n <= 30 ? 'at' : 'ok', n === 0 ? 'Vence hoje' : `Vence em ${plural(n, 'dia', 'dias')}`),
        `<div class="linha-b">${a.ativo && a.periodicidade !== 'unica' ? `<button class="b s" data-acao="assRenovada" data-id="${a.id}">Paguei / renovei</button>` : ''}
          <button class="b s" data-acao="assEditar" data-id="${a.id}">Editar</button></div>`] };
    });
    return `<div class="topo-tela"><div class="titulo"><h1>Financeiro</h1><div class="mut">Cada moeda tem o seu total. Nada é somado entre moedas.</div></div></div>
      <div class="saldos">${Object.entries(totais).map(([m, v]) => `<div class="saldo"><div class="peq mut">A receber em ${esc(m)}</div><div class="falta">${dinheiro(v, m)}</div></div>`).join('') || '<div class="saldo"><div class="peq mut">A receber</div><div class="falta zero">Nada</div></div>'}
        ${r.recebido_mes.map((x) => `<div class="saldo"><div class="peq mut">Recebido este mês em ${esc(x.moeda)}</div><div class="falta zero">${dinheiro(x.total, x.moeda)}</div><div class="det">${plural(x.n, 'pagamento', 'pagamentos')}</div></div>`).join('')}</div>
      ${cartao('Parcelas vencidas e dos próximos 30 dias', tabela([{ t: 'Cliente' }, { t: 'Parcela' }, { t: 'Vencimento' }, { t: 'Falta', dir: true }, { t: 'Situação' }], parc, 'Nenhuma parcela vencida ou próxima.'), { sem: true })}
      ${cartao('A receber por cliente', tabela([{ t: 'Cliente' }, { t: 'Moeda' }, { t: 'Cobrado', dir: true }, { t: 'Recebido', dir: true }, { t: 'Falta', dir: true }], aRec, 'Ninguém deve nada.'), { sem: true })}
      ${cartao('Domínio e assinaturas do negócio', tabela([{ t: 'Nome' }, { t: 'Vencimento' }, { t: 'Período' }, { t: 'Valor', dir: true }, { t: 'Situação' }, { t: '' }], ass, 'Nenhum cadastro.'),
        { sem: true, extra: '<button class="b s p" data-acao="assNova">Cadastrar</button>' })}`;
  }

  /* ════════════════════ CONFIGURAÇÕES ════════════════════ */
  async function vConfig(aba) {
    const abasAdm = [['geral', 'Geral'], ['site', 'Site e área do cliente'], ['servicos', 'Serviços'], ['documentos', 'Documentos'], ['cidades', 'Cidades'], ['mensagens', 'Mensagens'],
      ['usuarios', 'Usuários'], ['backup', 'Cópia de segurança'], ['senha', 'Minha senha']];
    const abas = admin() ? abasAdm : [['senha', 'Minha senha']];
    if (!abas.some(([k]) => k === aba)) aba = abas[0][0];
    await carregarCatalogo();
    const nav = `<nav class="abas">${abas.map(([k, t]) => `<a class="aba${k === aba ? ' on' : ''}" href="#/config/${k}">${t}</a>`).join('')}</nav>`;
    const topo = `<div class="topo-tela"><div class="titulo"><h1>Configurações</h1></div></div>${nav}`;
    const c = CAT.config;
    if (aba === 'senha') {
      return topo + cartao('Trocar a minha senha', campos([{ id: 'atual', rot: 'Senha atual', tipo: 'senha' }, { id: 'nova', rot: 'Senha nova (mínimo 10 caracteres)', tipo: 'senha' }]) +
        '<div class="linha-b" style="margin-top:14px"><button class="b p" data-acao="minhaSenha">Trocar senha</button></div>');
    }
    if (aba === 'geral') {
      return topo + cartao('Avisos', campos([
        { id: 'alertas_documento_dias', rot: 'Avisar antes do vencimento de documentos (dias)', val: c.alertas_documento_dias, ajuda: 'Separe por vírgula. Padrão: 120, 90, 30. O aviso não significa que a renovação já esteja legalmente disponível.' },
        { id: 'alertas_assinatura_dias', rot: 'Avisar antes do vencimento de domínio e assinaturas (dias)', val: c.alertas_assinatura_dias },
        { id: 'alerta_parcela_dias', rot: 'Avisar parcelas com quantos dias de antecedência', tipo: 'num', val: c.alerta_parcela_dias },
        { id: 'janela_vencimentos_dias', rot: 'Mostrar em "Hoje" documentos que vencem nos próximos (dias)', tipo: 'num', val: c.janela_vencimentos_dias },
        { id: 'hora_envio', rot: 'Horário de envio automático das mensagens', tipo: 'hora', val: c.hora_envio, ajuda: 'Fuso America/Asuncion.' },
      ]) + '<div class="linha-b" style="margin-top:14px"><button class="b p" data-acao="salvarGeral">Salvar</button></div>') +
      cartao('Envio automático pelo WhatsApp', `<p>Situação: <strong>${CAT.whatsapp.configurado ? 'Configurado' : 'Não configurado'}</strong>${CAT.whatsapp.webhook ? ' · confirmação de entrega ativa' : ''}.</p>
        <p class="peq mut">A configuração usa a API oficial do WhatsApp (Meta) e é feita no arquivo de ambiente do servidor, não aqui — as chaves não passam pela tela nem ficam no banco. Instruções no LEIAME do sistema. Sem configuração, os avisos internos funcionam normalmente e as mensagens são enviadas à mão, pelo botão "Abrir WhatsApp com mensagem pronta".</p>`);
    }
    if (aba === 'site') {
      const s = await api('GET', '/api/site-admin');
      const c2 = s.config;
      const faq = s.faq.map((x) => ({ cel: [String(x.ordem), `<strong>${esc(x.pergunta)}</strong><div class="peq mut">${esc(x.resposta)}</div>`,
        x.ativo ? et('ok', 'Publicada') : et('nt', 'Oculta'), `<button class="b s" data-acao="faqEditar" data-id="${x.id}">Editar</button>`] }));
      E.faq = s.faq;
      return topo + `<div class="nota-l">Só aparece no site o que estiver preenchido aqui. Não preencha com dados ainda não confirmados pelo Daniel.</div>` +
        cartao('Contato e atendimento', campos([
          { id: 'site_whatsapp', rot: 'WhatsApp', val: c2.site_whatsapp, ph: '+595 …' }, { id: 'site_telefone', rot: 'Telefone', val: c2.site_telefone },
          { id: 'site_email', rot: 'E-mail', val: c2.site_email }, { id: 'site_endereco', rot: 'Endereço', val: c2.site_endereco },
          { id: 'site_instagram', rot: 'Instagram (endereço completo)', val: c2.site_instagram, ph: 'https://instagram.com/…' },
          { id: 'site_youtube', rot: 'YouTube (endereço completo)', val: c2.site_youtube, ph: 'https://youtube.com/…' },
          { id: 'horario_atendimento', rot: 'Horário de atendimento', val: c2.horario_atendimento, ph: 'Ex.: segunda a sexta, 8h às 17h', ajuda: 'Aparece no site e nas Dúvidas do cliente.' },
          { id: 'site_dominio', rot: 'Domínio confirmado', val: c2.site_dominio, ajuda: 'Só para registro. Publicar o site exige configuração à parte.' },
        ]) + '<div class="linha-b" style="margin-top:14px"><button class="b p" data-acao="salvarSite">Salvar</button></div>') +
        cartao('Mascote', `${c2.site_mascote ? `<img src="${R('/site-arquivo/')}${esc(c2.site_mascote)}" alt="Mascote atual" style="max-width:160px;margin-bottom:10px">` : '<p class="mut">Nenhum mascote enviado. O site fica sem imagem até que um seja enviado.</p>'}
          ${campos([{ id: 'mascote', rot: 'Imagem do mascote (PNG, JPG ou WEBP, até 2 MB)', tipo: 'arquivo', largo: true }])}
          <p class="peq mut">Esta imagem é pública: aparece no site para qualquer visitante.</p><div class="linha-b"><button class="b p" data-acao="enviarMascote">Enviar mascote</button></div>`) +
        cartao('Perguntas frequentes', tabela([{ t: 'Ordem' }, { t: 'Pergunta' }, { t: 'Situação' }, { t: '' }], faq, 'Nenhuma pergunta.'),
          { sem: true, extra: '<button class="b s p" data-acao="faqEditar">Nova pergunta</button>' }) +
        cartao('E-mail', `<p>Envio de e-mail: <strong>${s.email_configurado ? 'configurado' : 'não configurado'}</strong>.</p><p class="peq mut">Sem e-mail, convites e links de nova senha aparecem na ficha do cliente para você enviar pelo WhatsApp. Os avisos ao cliente ficam dentro da Área do cliente.</p>`);
    }
    if (aba === 'servicos') {
      const linhas = CAT.servicos.map((s) => ({ cel: [`<strong>${esc(s.nome)}</strong><div class="peq mut">${esc(s.grupo || '')}</div>`,
        esc(s.modalidades.join(', ') || '—'), plural(s.etapas.length, 'etapa', 'etapas'), plural(s.checklist.length, 'documento', 'documentos'),
        s.prazo_dias ? plural(s.prazo_dias, 'dia', 'dias') : '<span class="mut">a definir</span>', s.ativo ? et('ok', 'Ativo') : et('nt', 'Desativado'),
        `<button class="b s" data-acao="servEditar" data-id="${s.id}">Editar</button>`] }));
      return topo + `<div class="nota-l">Os modelos vêm da rotina descrita por Daniel e não são texto de lei. Requisitos, prazos e validades devem ser conferidos nas fontes oficiais. Mudanças valem para processos novos; processos abertos mantêm as etapas com que começaram.</div>` +
        cartao('Modelos de serviço', tabela([{ t: 'Serviço' }, { t: 'Modalidades' }, { t: 'Etapas' }, { t: 'Lista' }, { t: 'Prazo estimado' }, { t: 'Situação' }, { t: '' }], linhas, ''),
          { sem: true, extra: '<button class="b s p" data-acao="servEditar">Novo serviço</button>' });
    }
    if (aba === 'documentos') {
      const linhas = CAT.tipos.map((t) => ({ cel: [`<strong>${esc(t.nome)}</strong>`, t.tem_validade ? 'Costuma ter validade impressa' : 'Sem validade padrão',
        `<span class="peq">${esc(t.nota || '')}</span>`, t.ativo ? et('ok', 'Ativo') : et('nt', 'Desativado'), `<button class="b s" data-acao="tipoEditar" data-id="${t.id}">Editar</button>`] }));
      return topo + `<div class="info-l">Nenhuma validade é suposta pelo sistema. A validade de cada documento é a que estiver escrita nele. "Emissão recente" é configurada por serviço, em Serviços.</div>` +
        cartao('Tipos de documento', tabela([{ t: 'Documento' }, { t: 'Validade' }, { t: 'Nota' }, { t: 'Situação' }, { t: '' }], linhas, ''),
          { sem: true, extra: '<button class="b s p" data-acao="tipoEditar">Novo tipo</button>' });
    }
    if (aba === 'cidades') {
      const linhas = CAT.cidades.map((x) => ({ cel: [esc(x.nome), x.ativo ? et('ok', 'Ativa') : et('nt', 'Desativada'), `<button class="b s" data-acao="cidadeEditar" data-id="${x.id}">Editar</button>`] }));
      return topo + cartao('Cidades', tabela([{ t: 'Cidade' }, { t: 'Situação' }, { t: '' }], linhas, ''), { sem: true, extra: '<button class="b s p" data-acao="cidadeEditar">Acrescentar cidade</button>' });
    }
    if (aba === 'mensagens') {
      return topo + `<div class="info-l">Marcadores: {nome}, {documento}, {data}, {hora}, {local}. "Nome do modelo aprovado" é o nome do modelo cadastrado e aprovado na conta oficial do WhatsApp; sem ele, o envio automático tenta texto livre, que o WhatsApp só aceita se o cliente escreveu nas últimas 24 horas.</div>` +
        CAT.modelos.map((m) => cartao(m.nome, `<p style="white-space:pre-wrap">${esc(m.texto)}</p><div class="peq mut">Modelo aprovado: ${esc(m.modelo_aprovado || 'não informado')} · idioma ${esc(m.idioma)}</div>`,
          { extra: `<button class="b s" data-acao="modeloEditar" data-id="${m.id}">Editar</button>` })).join('');
    }
    if (aba === 'usuarios') {
      const r = await api('GET', '/api/usuarios');
      const linhas = r.usuarios.map((u) => ({ cel: [`<strong>${esc(u.nome)}</strong><div class="peq mut">${esc(u.email)}</div>`, u.perfil === 'admin' ? 'Administrador' : 'Atendente',
        u.ativo ? et('ok', 'Ativo') : et('nt', 'Sem acesso'), `<button class="b s" data-acao="usuarioEditar" data-id="${u.id}" data-nome="${esc(u.nome)}" data-perfil="${u.perfil}" data-ativo="${u.ativo}">Editar</button>`] }));
      return topo + `<div class="info-l">Administrador: tudo, inclusive configurações, anulação de lançamentos e cópias de segurança. Atendente: clientes, processos, documentos, agenda e pagamentos.</div>` +
        cartao('Usuários', tabela([{ t: 'Nome' }, { t: 'Perfil' }, { t: 'Acesso' }, { t: '' }], linhas, ''), { sem: true, extra: '<button class="b s p" data-acao="usuarioEditar">Novo usuário</button>' });
    }
    if (aba === 'backup') {
      return topo + cartao('Cópia de segurança', `<p>A cópia guarda o banco inteiro e todos os anexos, com um manifesto de conferência. Cópias antigas nunca são apagadas.</p>
        <p class="peq mut">Também pode ser feita pelo terminal: <code>npm run backup</code>. Para restaurar: desligar o sistema e rodar <code>npm run restaurar -- &lt;pasta da cópia&gt;</code>. Os dados atuais são guardados antes da troca.</p>
        <div class="linha-b"><button class="b p" data-acao="backup">Fazer cópia agora</button></div>`);
    }
    return topo;
  }

  /* ════════════════════ DÚVIDAS ════════════════════ */
  const SIT_D = { enviada: ['at', 'Enviada'], em_atendimento: ['in', 'Em atendimento'], respondida: ['ok', 'Respondida'], encerrada: ['nt', 'Encerrada'] };
  async function vDuvidas() {
    const r = await api('GET', '/api/duvidas');
    const linhas = r.duvidas.map((d) => ({ attrs: `class="clic" data-acao="abrirDuvida" data-id="${d.id}"`, cel: [
      d.nao_lida ? et('ng', 'Não lida') : '<span class="mut peq">Lida</span>',
      `<strong>${esc(d.assunto)}</strong><div class="peq mut">${esc(d.categoria || '')}</div>`,
      `<a href="#/cliente/${d.cliente_id}">${esc(d.cliente_nome)}</a><div class="peq mut">${d.processo_id ? esc(`${d.servico} · ${d.numero}`) : 'Dúvida geral'}</div>`,
      et(...SIT_D[d.situacao]), `<span class="num">${dh(d.atualizado_em)}</span>`] }));
    return `<div class="topo-tela"><div class="titulo"><h1>Dúvidas dos clientes</h1>
      <div class="mut">Responder aqui não muda o processo. Para mudar etapa, prazo ou pendência, use a ficha do cliente.</div></div></div>
      ${cartao('Conversas', tabela([{ t: 'Leitura' }, { t: 'Assunto' }, { t: 'Cliente' }, { t: 'Situação' }, { t: 'Atualizada' }], linhas, 'Nenhuma dúvida recebida.'), { sem: true })}`;
  }
  async function abrirDuvida(id) {
    const d = await api('GET', `/api/duvidas/${Number(id)}`);
    const conversa = d.mensagens.map((m) => `<div class="balao-p ${m.autor}"><div class="q">${m.autor === 'cliente' ? esc(d.cliente_nome) : 'Equipe · ' + esc(m.usuario || '')} · ${dh(m.criado_em)}</div><div class="t">${esc(m.texto)}</div></div>`).join('');
    const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    folha({ titulo: d.assunto, sub: `${d.cliente_nome} · ${d.processo_id ? `${d.servico} · ${d.numero}` : 'Dúvida geral'} · ${SIT_D[d.situacao][1]}`, larga: true,
      corpo: `${conversa}${campos([{ id: 'resposta', rot: 'Resposta da equipe', tipo: 'area', largo: true, ajuda: 'O cliente vê a resposta na Área do cliente e recebe um aviso. A resposta é sua: não há resposta automática.' }])}
        <p class="peq"><a href="#/cliente/${d.cliente_id}" data-fecha-folha>Abrir a ficha do cliente</a></p>`,
      botoes: [{ txt: 'Fechar', fn: (ctx) => { ctx.fechar(); pintar(true); } },
        ...(d.situacao !== 'encerrada' ? [{ txt: 'Encerrar', fn: (ctx) => salvar(ctx, api('POST', `/api/duvidas/${d.id}/situacao`, { situacao: 'encerrada' }), 'Dúvida encerrada') }]
          : [{ txt: 'Reabrir', fn: (ctx) => salvar(ctx, api('POST', `/api/duvidas/${d.id}/situacao`, { situacao: 'enviada' }), 'Dúvida reaberta') }]),
        ...(d.situacao === 'enviada' ? [{ txt: 'Marcar em atendimento', fn: (ctx) => salvar(ctx, api('POST', `/api/duvidas/${d.id}/situacao`, { situacao: 'em_atendimento' }), 'Em atendimento') }] : []),
        { txt: 'Enviar resposta', cls: 'p', fn: async (ctx) => {
          if (!ler('resposta')) throw new Error('Escreva a resposta.');
          await salvar(ctx, api('POST', `/api/duvidas/${d.id}/responder`, { texto: ler('resposta'), chave }), 'Resposta enviada ao cliente');
        } }] });
    document.querySelector('[data-fecha-folha]')?.addEventListener('click', fecharFolha);
  }

  const TELAS = { hoje: vHoje, clientes: vClientes, cliente: vCliente, agenda: vAgenda, duvidas: vDuvidas, financeiro: vFinanceiro, config: vConfig };

  /* ════════════════════ AÇÕES ════════════════════ */
  const proc = (id) => E.ficha?.processos.find((p) => p.id === Number(id));
  const item = (id) => { for (const p of E.ficha?.processos || []) { const i = p.itens.find((x) => x.id === Number(id)); if (i) return { i, p }; } return {}; };
  const camposDoc = (d = {}, tipo) => [
    { id: 'emissao', rot: 'Data de emissão', tipo: 'data', val: d.emissao },
    { id: 'validade', rot: 'Válido até', tipo: 'data', val: d.validade, ajuda: tipo?.tem_validade ? 'Copie a data escrita no documento.' : 'Deixe vazio se o documento não traz validade. O sistema não supõe validade.' },
    { id: 'original', rot: 'Original', tipo: 'check', val: d.original }, { id: 'copia', rot: 'Cópia', tipo: 'check', val: d.copia },
    { id: 'apostilado', rot: 'Apostilado', tipo: 'check', val: d.apostilado }, { id: 'autenticado', rot: 'Autenticado', tipo: 'check', val: d.autenticado },
    ...(d.arquivo_id ? [] : [{ id: 'arquivo', rot: 'Anexo (PDF ou imagem, até 8 MB)', tipo: 'arquivo', largo: true }]),
    { id: 'observacoes', rot: 'Observações', tipo: 'area', largo: true, val: d.observacoes },
  ];
  const lerDoc = async () => ({ emissao: ler('emissao') || null, validade: ler('validade') || null, original: ler('original'), copia: ler('copia'),
    apostilado: ler('apostilado'), autenticado: ler('autenticado'), observacoes: ler('observacoes'), arquivo: await lerArquivo('arquivo') });

  function mostrarLink(titulo, r, explica) {
    folha({ titulo, sub: explica, corpo: `<div class="info-l">Envio de e-mail: <strong>não configurado</strong>. Nada foi enviado ao cliente. Envie o link você mesmo.</div>
      ${campos([{ id: 'link', rot: `Link (vale ${r.validade_dias ? r.validade_dias + ' dias' : r.validade_horas + ' horas'}, uso único)`, val: r.link, largo: true }])}
      <p class="peq mut">O link só aparece agora. Se perder, gere outro: o anterior deixa de valer.</p>`,
    botoes: [{ txt: 'Fechar', fn: (ctx) => { ctx.fechar(); pintar(true); } },
      { txt: 'Copiar link', fn: async () => { await navigator.clipboard.writeText(r.link); torrada('Link copiado'); } },
      { txt: 'Abrir WhatsApp com o link', cls: 'p', fn: () => abrirLink(r.whatsapp) }] });
  }

  const ACOES = {
    sair: async () => { await api('POST', '/api/sair').catch(() => {}); CAT = null; telaEntrada(); },

    /* área do cliente */
    convite: () => {
      const c = E.ficha.cliente;
      folha({ titulo: 'Convite para a Área do cliente', sub: c.nome, corpo: campos([{ id: 'email', rot: 'E-mail que o cliente vai usar para entrar', tipo: 'email', val: c.email || E.ficha.portal.conta?.email || '', largo: true, obrig: true }]) +
        '<p class="peq mut">Gera um link de ativação de uso único, válido por 7 dias. O cliente cria a própria senha. Ele verá só os próprios processos e os arquivos que você liberar.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Gerar convite', cls: 'p', fn: async (ctx) => {
        const r = await api('POST', `/api/clientes/${c.id}/convite`, { email: ler('email') });
        ctx.fechar(); mostrarLink('Convite gerado', r, `Para ${c.nome}`);
      } }] });
    },
    linkSenha: async (d) => {
      const r = await api('POST', `/api/clientes/${d.cliente}/link-senha`);
      mostrarLink('Link para nova senha', r, 'Vale por 24 horas. A senha antiga continua valendo até o cliente criar a nova.');
    },
    acessoAtivo: async (d) => salvar(null, api('POST', `/api/clientes/${E.ficha.cliente.id}/acesso`, { ativo: d.a === '1' ? 1 : 0 }), d.a === '1' ? 'Acesso reativado' : 'Acesso desativado'),
    decidirPedido: async (d) => salvar(null, api('POST', `/api/pedidos-cliente/${d.id}`, { decisao: d.d }), d.d === 'atendido' ? 'Alteração aprovada' : 'Pedido encerrado'),
    abrirDuvida: (d) => abrirDuvida(d.id),
    paraCliente: (d) => {
      const p = proc(d.proc);
      folha({ titulo: 'O que o cliente vê', sub: `${p.numero} · ${p.servico_nome}`, corpo:
        '<div class="info-l">Tudo nesta tela aparece na Área do cliente. Para anotações da equipe, use "Editar" → Observações (interno).</div>' + campos([
          { id: 'cliente_proximo_passo', rot: 'Próximo passo (explicação para o cliente)', tipo: 'area', val: p.cliente_proximo_passo, largo: true, ajuda: 'Vazio = texto automático conforme a etapa.' },
          { id: 'cliente_quem', rot: 'Quem faz o próximo passo', tipo: 'sel', val: p.cliente_quem || '', opts: [['', 'Não informar'], ['cliente', 'O cliente'], ['equipe', 'A equipe'], ['orgao', 'O órgão responsável']] },
          { id: 'mostrar_responsavel', rot: `Mostrar o responsável (${p.responsavel_nome || 'nenhum'})`, tipo: 'check', val: p.mostrar_responsavel },
          { id: 'cliente_orientacoes', rot: 'Orientações para o cliente', tipo: 'area', val: p.cliente_orientacoes, largo: true },
        ]) + '<p class="peq mut">Ao salvar, o cliente recebe um aviso de atualização.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => salvar(ctx, api('PUT', `/api/processos/${p.id}`, {
        cliente_proximo_passo: ler('cliente_proximo_passo'), cliente_quem: ler('cliente_quem') || null, mostrar_responsavel: ler('mostrar_responsavel'),
        cliente_orientacoes: ler('cliente_orientacoes') }), 'Salvo — visível ao cliente') }] });
    },
    publicar: (d) => {
      const p = proc(d.proc);
      folha({ titulo: 'Publicar atualização ao cliente', sub: `${p.numero} · ${p.servico_nome} · ${E.ficha.cliente.nome}`, corpo:
        campos([{ id: 'texto', rot: 'Texto que o cliente vai ler no histórico do processo', tipo: 'area', largo: true, obrig: true }]) +
        '<p class="peq mut">Aparece no histórico do processo e gera um aviso. Mudanças de etapa, protocolo, recebimento e entrega já são publicadas automaticamente.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Publicar', cls: 'p', fn: (ctx) => salvar(ctx, api('POST', `/api/processos/${p.id}/publicar`, { texto: ler('texto') }), 'Publicado ao cliente') }] });
    },
    liberar: (d) => {
      const c = E.ficha.cliente;
      const procs = E.ficha.processos.filter((p) => p.situacao !== 'cancelado');
      folha({ titulo: 'Liberar arquivo ao cliente', sub: `Somente ${c.nome} poderá ver e baixar`, corpo:
        `<div class="nota-l">Este arquivo vai aparecer na Área do cliente de <strong>${esc(c.nome)}</strong> (${esc(c.whatsapp)}). Nenhuma outra pessoa terá acesso.</div>` + campos([
          { id: 'titulo', rot: 'Nome que o cliente vai ver', val: d.titulo || '', largo: true, obrig: true },
          { id: 'processo_id', rot: 'Mostrar no processo', tipo: 'sel', val: d.proc || '', opts: [['', 'Geral (fora de um processo)'], ...procs.map((p) => [p.id, `${p.numero} · ${p.servico_nome}`])], largo: true },
        ]), botoes: [{ txt: 'Cancelar' }, { txt: `Liberar para ${c.nome.replace(/^\[DEMO\]\s*/, '').split(' ')[0]}`, cls: 'p', fn: (ctx) => salvar(ctx, api('POST', '/api/liberacoes',
        { arquivo_id: Number(d.arquivo), processo_id: lerNum('processo_id'), titulo: ler('titulo') }), 'Arquivo liberado ao cliente') }] });
    },
    enviarArquivo: () => {
      const c = E.ficha.cliente;
      const procs = E.ficha.processos.filter((p) => p.situacao !== 'cancelado');
      folha({ titulo: 'Enviar arquivo ao cliente', sub: `Somente ${c.nome} poderá ver e baixar`, corpo:
        `<div class="nota-l">O arquivo fica disponível na Área do cliente de <strong>${esc(c.nome)}</strong>.</div>` + campos([
          { id: 'arquivo', rot: 'Arquivo (PDF ou imagem, até 8 MB)', tipo: 'arquivo', largo: true, obrig: true },
          { id: 'titulo', rot: 'Nome que o cliente vai ver', largo: true, obrig: true, ph: 'Ex.: Guia de orientações para o dia da Migração' },
          { id: 'processo_id', rot: 'Mostrar no processo', tipo: 'sel', opts: [['', 'Geral (fora de um processo)'], ...procs.map((p) => [p.id, `${p.numero} · ${p.servico_nome}`])], largo: true },
        ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Enviar e liberar', cls: 'p', fn: async (ctx) => {
        const arquivo = await lerArquivo('arquivo');
        if (!arquivo) throw new Error('Escolha o arquivo.');
        await salvar(ctx, api('POST', `/api/clientes/${c.id}/liberar-arquivo`, { arquivo, titulo: ler('titulo'), processo_id: lerNum('processo_id') }), 'Arquivo liberado ao cliente');
      } }] });
    },
    revogar: async (d) => salvar(null, api('POST', `/api/liberacoes/${d.id}/revogar`), 'O cliente não vê mais este arquivo'),

    /* site */
    salvarSite: async () => salvar(null, api('PUT', '/api/site-admin', Object.fromEntries(['site_whatsapp', 'site_telefone', 'site_email', 'site_endereco', 'site_instagram',
      'site_youtube', 'horario_atendimento', 'site_dominio'].map((k) => [k, ler(k)]))), 'Site atualizado'),
    enviarMascote: async () => {
      const arquivo = await lerArquivo('mascote');
      if (!arquivo) throw new Error('Escolha a imagem.');
      await salvar(null, api('POST', '/api/site-admin/mascote', { arquivo }), 'Mascote enviado');
    },
    faqEditar: (d) => {
      const x = d.id ? E.faq.find((q) => q.id === Number(d.id)) : { pergunta: '', resposta: '', ordem: (E.faq.length + 1), ativo: 1 };
      folha({ titulo: d.id ? 'Editar pergunta' : 'Nova pergunta', corpo: campos([
        { id: 'pergunta', rot: 'Pergunta', val: x.pergunta, largo: true, obrig: true },
        { id: 'resposta', rot: 'Resposta', tipo: 'area', val: x.resposta, largo: true, obrig: true },
        { id: 'ordem', rot: 'Ordem', tipo: 'num', val: x.ordem },
        ...(d.id ? [{ id: 'ativo', rot: 'Publicada no site', tipo: 'check', val: x.ativo }] : []),
      ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => {
        const corpo = { pergunta: ler('pergunta'), resposta: ler('resposta'), ordem: lerNum('ordem'), ativo: d.id ? ler('ativo') : 1 };
        return salvar(ctx, d.id ? api('PUT', `/api/faq/${d.id}`, corpo) : api('POST', '/api/faq', corpo), 'Pergunta salva');
      } }] });
    },
    filtroHoje: async (d) => {
      if (d.f === 'vencendo') { document.getElementById('cartao-vencendo')?.scrollIntoView({ behavior: 'smooth' }); return; }
      E.filtroHoje = d.f; await pintar(true);
      if (d.f !== 'todos') document.getElementById('cartao-processos')?.scrollIntoView({ behavior: 'smooth' });
    },

    novoCliente: () => folha({ titulo: 'Novo cliente', sub: 'Cadastro rápido. O resto dos dados pode ser completado depois, na ficha.',
      corpo: campos([
        { id: 'nome', rot: 'Nome completo', obrig: true, largo: true },
        { id: 'whatsapp', rot: 'WhatsApp com código do país', tipo: 'tel', obrig: true, ph: '+55 45 99999-0000', largo: true },
        { id: 'servico_id', rot: 'Serviço', tipo: 'sel', opts: optsServicos('Escolher depois') },
        { id: 'cidade_id', rot: 'Cidade', tipo: 'sel', opts: optsCidades() },
        { id: 'mesmo', rot: 'Confirmo que é outra pessoa com o mesmo WhatsApp', tipo: 'check', oculto: true, largo: true },
      ]),
      botoes: [{ txt: 'Cancelar' }, { txt: 'Cadastrar', cls: 'p', fn: async (ctx) => {
        try {
          const r = await api('POST', '/api/clientes', { nome: ler('nome'), whatsapp: ler('whatsapp'), servico_id: lerNum('servico_id'),
            cidade_id: lerNum('cidade_id'), confirmar_mesmo_whatsapp: ler('mesmo') });
          ctx.fechar(); torrada('Cliente cadastrado');
          location.hash = `#/cliente/${r.id}/${r.processo_id ? 'processos' : 'resumo'}`;
        } catch (e) {
          if (e.extra?.cliente_existente) {
            ctx.mostrar('mesmo');
            ctx.erro(e.message);
            const el = document.getElementById('folha-erro');
            el.insertAdjacentHTML('beforeend', ` <a class="b s" href="#/cliente/${Number(e.extra.cliente_existente)}" data-fecha-folha>Abrir a ficha existente</a>`);
            el.querySelector('[data-fecha-folha]').addEventListener('click', fecharFolha);
            return;
          }
          throw e;
        }
      } }] }),

    editarCliente: () => {
      const c = E.ficha.cliente;
      folha({ titulo: 'Dados do cliente', sub: c.nome, larga: true, corpo: campos([
        { id: 'nome', rot: 'Nome completo', val: c.nome, obrig: true, largo: true },
        { id: 'whatsapp', rot: 'WhatsApp com código do país', tipo: 'tel', val: c.whatsapp, obrig: true },
        { id: 'email', rot: 'E-mail', tipo: 'email', val: c.email },
        { id: 'nascimento', rot: 'Data de nascimento', tipo: 'data', val: c.nascimento },
        { id: 'nacionalidade', rot: 'Nacionalidade', val: c.nacionalidade },
        { id: 'documento_tipo', rot: 'Documento de identificação', tipo: 'sel', val: c.documento_tipo, opts: [['', '—'], 'RG', 'Passaporte', 'RG e passaporte'] },
        { id: 'documento_numero', rot: 'Número do documento', val: c.documento_numero },
        { id: 'estado_civil', rot: 'Estado civil', tipo: 'sel', val: c.estado_civil, opts: [['', '—'], 'Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável', 'Solteira', 'Solteiro', 'Casada', 'Casado', 'Divorciada', 'Divorciado'].filter((x, i, a) => a.indexOf(x) === i) },
        { id: 'perfil_comercial', rot: 'Perfil comercial', tipo: 'sel', val: c.perfil_comercial, opts: [['', '—'], ...CAT.perfis_comerciais], ajuda: 'Usado para orçamento: estudante, empresário ou outro.' },
        { id: 'responsavel_id', rot: 'Responsável pelo atendimento', tipo: 'sel', val: c.responsavel_id, opts: optsUsuarios() },
        { id: 'cidade_id', rot: 'Cidade', tipo: 'sel', val: c.cidade_id, opts: optsCidades('—') },
        { id: 'aceita_mensagens', rot: 'O cliente autorizou receber mensagens pelo WhatsApp', tipo: 'check', val: c.aceita_mensagens, largo: true },
        { id: 'mensagens_tipos', rot: 'Tipos de mensagem autorizados', tipo: 'checks', val: c.mensagens_tipos,
          opts: [['aniversario', 'Aniversário'], ['vencimento', 'Vencimento de documento'], ['agendamento', 'Agendamento'], ['documento', 'Documento disponível']] },
        { id: 'preferencias', rot: 'Preferências de contato', val: c.preferencias, largo: true, ph: 'Ex.: prefere áudio; não ligar antes das 9h' },
        { id: 'observacoes', rot: 'Observações', tipo: 'area', val: c.observacoes, largo: true },
      ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => salvar(ctx, api('PUT', `/api/clientes/${c.id}`, {
        nome: ler('nome'), whatsapp: ler('whatsapp'), email: ler('email'), nascimento: ler('nascimento') || null, nacionalidade: ler('nacionalidade'),
        documento_tipo: ler('documento_tipo') || null, documento_numero: ler('documento_numero'), estado_civil: ler('estado_civil'),
        perfil_comercial: ler('perfil_comercial') || null, responsavel_id: lerNum('responsavel_id'), cidade_id: lerNum('cidade_id'),
        aceita_mensagens: ler('aceita_mensagens'), mensagens_tipos: ler('mensagens_tipos'), preferencias: ler('preferencias'), observacoes: ler('observacoes'),
      }), 'Dados salvos') }] });
    },

    whatsAvulso: () => {
      const c = E.ficha.cliente;
      folha({ titulo: 'Mensagem pelo WhatsApp', sub: `${c.nome} · ${c.whatsapp}`, corpo: campos([{ id: 'texto', rot: 'Mensagem', tipo: 'area', largo: true, val: `Olá, ${c.nome.replace(/^\[DEMO\]\s*/, '').split(' ')[0]}.` }]) +
        '<p class="peq mut">Abre o WhatsApp com o texto pronto. O envio é feito por você, no aparelho; fica registrado como "aberta no WhatsApp", sem confirmação de envio.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Abrir WhatsApp', cls: 'p', fn: async (ctx) => {
        const w = window.open('about:blank', '_blank');
        try {
          const r = await api('POST', '/api/mensagens/avulsa', { cliente_id: c.id, texto: ler('texto') });
          if (w) { w.opener = null; w.location.href = r.link; } else location.href = r.link;
          ctx.fechar(); pintar(true);
        } catch (e) { w?.close(); throw e; }
      } }] });
    },

    novoProcesso: (d) => {
      const c = E.ficha?.cliente;
      const s0 = CAT.servicos.find((s) => s.ativo);
      folha({ titulo: 'Novo processo', sub: c?.nome, corpo: campos([
        { id: 'servico_id', rot: 'Serviço', tipo: 'sel', opts: optsServicos(), val: s0?.id, largo: true },
        { id: 'modalidade', rot: 'Modalidade', tipo: 'sel', opts: s0?.modalidades.length ? s0.modalidades : [['', '—']] },
        { id: 'cidade_id', rot: 'Cidade', tipo: 'sel', opts: optsCidades('—'), val: c?.cidade_id },
        { id: 'responsavel_id', rot: 'Responsável', tipo: 'sel', opts: optsUsuarios(), val: c?.responsavel_id || CAT.eu.id },
      ]) + '<p class="peq mut">Documentos válidos que o cliente já tem em arquivo entram automaticamente na lista do novo processo.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Abrir processo', cls: 'p', fn: async (ctx) => {
        await api('POST', '/api/processos', { cliente_id: Number(d.cliente), servico_id: lerNum('servico_id'), modalidade: ler('modalidade'),
          cidade_id: lerNum('cidade_id'), responsavel_id: lerNum('responsavel_id') });
        ctx.fechar(); torrada('Processo aberto');
        if (location.hash !== `#/cliente/${d.cliente}/processos`) location.hash = `#/cliente/${d.cliente}/processos`; else pintar(true);
      } }] });
    },

    etapa: async (d) => {
      const p = proc(d.proc);
      await salvar(null, api('PUT', `/api/processos/${p.id}`, { etapa_idx: p.etapa_idx + Number(d.d) }), Number(d.d) > 0 ? 'Etapa avançada' : 'Etapa anterior');
    },

    editarProcesso: (d) => {
      const p = proc(d.proc);
      const serv = CAT.serv.get(p.servico_id);
      folha({ titulo: 'Editar processo', sub: `${p.numero} · ${p.servico_nome}`, corpo: campos([
        { id: 'etapa_idx', rot: 'Etapa atual', tipo: 'sel', val: p.etapa_idx, opts: p.etapas.map((e, i) => [i, `${i + 1}. ${e.nome}`]), largo: true },
        { id: 'proxima_acao', rot: 'Próximo passo interno (escrito à mão, o cliente não vê)', val: p.proxima_acao, largo: true, ajuda: `Deixe vazio para usar o sugerido: "${p.proxima_automatica}". Ao mudar de etapa, o texto escrito à mão é limpo.` },
        { id: 'modalidade', rot: 'Modalidade', tipo: 'sel', val: p.modalidade, opts: [...new Set([...(serv?.modalidades || []), p.modalidade].filter(Boolean))].map((m) => [m, m]) },
        { id: 'cidade_id', rot: 'Cidade', tipo: 'sel', val: p.cidade_id, opts: optsCidades('—') },
        { id: 'responsavel_id', rot: 'Responsável', tipo: 'sel', val: p.responsavel_id, opts: optsUsuarios() },
        { id: 'prazo_dias', rot: 'Prazo estimado (dias)', tipo: 'num', val: p.prazo_dias, ajuda: p.protocolo_data ? 'A previsão é recalculada a partir da data do protocolo.' : 'Estimativa, não garantia.' },
        { id: 'protocolo_numero', rot: 'Número do protocolo', val: p.protocolo_numero },
        { id: 'observacoes', rot: 'Observação interna da equipe (o cliente não vê)', tipo: 'area', val: p.observacoes, largo: true },
      ]) + '<p class="peq mut">O que aparece para o cliente é editado em "Editar o que o cliente vê". Mudar a etapa publica a nova etapa para o cliente.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => {
        const corpo = { modalidade: ler('modalidade'), cidade_id: lerNum('cidade_id'), responsavel_id: lerNum('responsavel_id'),
          prazo_dias: lerNum('prazo_dias'), protocolo_numero: ler('protocolo_numero'), observacoes: ler('observacoes'), etapa_idx: lerNum('etapa_idx') };
        const prox = ler('proxima_acao');
        if (prox !== (p.proxima_acao || '') || lerNum('etapa_idx') === p.etapa_idx) corpo.proxima_acao = prox;
        return salvar(ctx, api('PUT', `/api/processos/${p.id}`, corpo), 'Processo salvo');
      } }] });
    },

    protocolo: (d) => {
      const p = proc(d.proc);
      const pend = p.faltam.length;
      folha({ titulo: 'Registrar protocolo', sub: `${p.numero} · ${p.servico_nome}${p.cidade_nome ? ' · ' + p.cidade_nome : ''}`, corpo:
        (pend ? `<div class="nota-l">Ainda ${pend === 1 ? 'falta 1 documento' : `faltam ${pend} documentos`} na lista. Pode registrar mesmo assim, se o órgão aceitou.</div>` : '') +
        campos([
          { id: 'numero', rot: 'Número do protocolo', val: p.protocolo_numero },
          { id: 'data', rot: 'Data do protocolo', tipo: 'data', val: CAT.hoje, obrig: true },
          { id: 'prazo_dias', rot: 'Prazo estimado (dias)', tipo: 'num', val: p.prazo_dias, obrig: true,
            ajuda: 'Estimativa para calcular a previsão. Varia por serviço, cidade e caso; previsão não é garantia.' },
        ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Registrar', cls: 'p', fn: (ctx) => salvar(ctx,
        api('POST', `/api/processos/${p.id}/protocolo`, { numero: ler('numero'), data: ler('data'), prazo_dias: lerNum('prazo_dias') }), 'Protocolo registrado') }] });
    },

    recebido: (d) => {
      const p = proc(d.proc);
      const serv = CAT.serv.get(p.servico_id);
      const tipo = serv?.doc_resultante_id ? CAT.tipo.get(serv.doc_resultante_id) : null;
      folha({ titulo: 'Documento recebido do órgão', sub: `${p.numero} · ${p.servico_nome}`, corpo: campos([
        { id: 'data', rot: 'Data em que recebeu', tipo: 'data', val: CAT.hoje, obrig: true },
        ...(tipo ? [{ id: 'emissao', rot: `Emissão (${tipo.nome})`, tipo: 'data' }, { id: 'validade', rot: 'Válido até', tipo: 'data', ajuda: 'Copie a data escrita no documento. Ela gera os avisos de vencimento.' },
          { id: 'arquivo', rot: 'Anexo (PDF ou imagem)', tipo: 'arquivo', largo: true }] : []),
      ]) + (tipo ? `<p class="peq mut">O ${esc(tipo.nome.toLowerCase())} entra na lista de documentos do cliente e pode ser reaproveitado nos próximos processos.</p>` : ''),
      botoes: [{ txt: 'Cancelar' }, { txt: 'Registrar recebimento', cls: 'p', fn: async (ctx) => salvar(ctx, api('POST', `/api/processos/${p.id}/recebido`, {
        data: ler('data'), emissao: ler('emissao') || null, validade: ler('validade') || null, arquivo: await lerArquivo('arquivo') }), 'Recebimento registrado') }] });
    },

    entregue: (d) => {
      const p = proc(d.proc);
      folha({ titulo: 'Entrega ao cliente', sub: `${p.numero} · ${p.servico_nome}`, corpo: campos([{ id: 'data', rot: 'Data da entrega', tipo: 'data', val: CAT.hoje, obrig: true }]) +
        '<p class="peq mut">O processo será marcado como concluído. Ele continua na ficha, com todo o histórico.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Registrar entrega', cls: 'p', fn: (ctx) => salvar(ctx, api('POST', `/api/processos/${p.id}/entregue`, { data: ler('data') }), 'Entrega registrada') }] });
    },

    cancelarProcesso: (d) => {
      const p = proc(d.proc);
      folha({ titulo: 'Cancelar processo', sub: `${p.numero} · ${p.servico_nome}`, corpo: campos([{ id: 'motivo', rot: 'Motivo', tipo: 'area', largo: true, obrig: true }]) +
        '<p class="peq mut">Nada é apagado: o processo fica na ficha como cancelado.</p>',
      botoes: [{ txt: 'Voltar' }, { txt: 'Cancelar processo', cls: 'p', fn: (ctx) => salvar(ctx, api('POST', `/api/processos/${p.id}/cancelar`, { motivo: ler('motivo') }), 'Processo cancelado') }] });
    },

    derivar: (d) => {
      const p = proc(d.proc);
      const s = CAT.serv.get(Number(d.serv));
      folha({ titulo: `Abrir ${s.nome}`, sub: `A partir de ${p.numero}`, corpo: campos([
        { id: 'cidade_id', rot: 'Cidade', tipo: 'sel', val: p.cidade_id, opts: optsCidades('—') },
        { id: 'modalidade', rot: 'Modalidade', tipo: 'sel', opts: s.modalidades.length ? s.modalidades : [['', '—']] },
      ]) + '<p class="peq mut">Os documentos válidos já registrados (inclusive o que acabou de chegar) entram na lista automaticamente. Os vencidos aparecem como pendentes.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Abrir processo', cls: 'p', fn: (ctx) => salvar(ctx, api('POST', `/api/processos/${p.id}/derivar`,
        { vinculo: d.v, servico_id: s.id, cidade_id: lerNum('cidade_id'), modalidade: ler('modalidade') }), 'Processo aberto') }] });
    },

    renovar: (d) => {
      const p = proc(d.proc);
      const atual = CAT.serv.get(p.servico_id);
      const sugerido = atual?.grupo === 'Residência' ? CAT.servicos.find((s) => s.codigo === 'res_renov') || atual : atual;
      folha({ titulo: 'Renovação', sub: `A partir de ${p.numero} · ${p.servico_nome}`, corpo: campos([
        { id: 'servico_id', rot: 'Serviço da renovação', tipo: 'sel', opts: optsServicos(), val: sugerido?.id, largo: true },
        { id: 'cidade_id', rot: 'Cidade', tipo: 'sel', val: p.cidade_id, opts: optsCidades('—') },
      ]) + '<p class="peq mut">Abre um processo novo, ligado a este. O processo anterior fica intacto, com o seu histórico. Confirme na fonte oficial se a renovação já é possível.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Abrir renovação', cls: 'p', fn: (ctx) => salvar(ctx, api('POST', `/api/processos/${p.id}/derivar`,
        { vinculo: 'renovacao', servico_id: lerNum('servico_id'), cidade_id: lerNum('cidade_id') }), 'Renovação aberta') }] });
    },

    prioridade: (d) => {
      const p = proc(d.proc);
      folha({ titulo: 'Trâmite prioritário oficial', sub: `${p.numero} · ${p.servico_nome}`, corpo:
        '<div class="nota-l">Só para procedimento oficial de urgência, com taxa publicada pelo órgão e comprovante oficial. Pagamento por fora a funcionário não é registrado aqui nem em lugar nenhum do sistema.</div>' +
        campos([{ id: 'justificativa', rot: 'Qual é o procedimento oficial e onde ele está publicado', tipo: 'area', largo: true, obrig: true },
          { id: 'arquivo', rot: 'Comprovante oficial (boleta, resolução)', tipo: 'arquivo', largo: true, obrig: true }]) +
        '<p class="peq mut">A taxa oficial correspondente é lançada no Financeiro como "Taxa oficial", marcando "Prioridade oficial".</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Registrar', cls: 'p', fn: async (ctx) => salvar(ctx, api('POST', `/api/processos/${p.id}/prioridade`,
        { justificativa: ler('justificativa'), arquivo: await lerArquivo('arquivo') }), 'Trâmite prioritário registrado') }] });
    },

    addItem: (d) => {
      const p = proc(d.proc);
      const ja = new Set(p.itens.map((i) => i.tipo_id));
      folha({ titulo: 'Acrescentar documento à lista', sub: `${p.numero} · ${p.servico_nome}`, corpo: campos([
        { id: 'tipo_id', rot: 'Documento', tipo: 'sel', largo: true, opts: CAT.tipos.filter((t) => t.ativo && !ja.has(t.id)).map((t) => [t.id, t.nome]) },
        { id: 'opcional', rot: 'Só se aplicável (não bloqueia)', tipo: 'check' },
        { id: 'exige_recente_dias', rot: 'Exige emissão de até (dias)', tipo: 'num', ajuda: 'Deixe vazio se não houver essa exigência.' },
      ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Acrescentar', cls: 'p', fn: (ctx) => salvar(ctx, api('POST', `/api/processos/${p.id}/checklist`,
        { tipo_id: lerNum('tipo_id'), opcional: ler('opcional'), exige_recente_dias: lerNum('exige_recente_dias') }), 'Documento acrescentado') }] });
    },

    itemDoc: (d) => {
      const { i, p } = item(d.item);
      folha({ titulo: i.doc ? `Nova versão — ${i.tipo_nome}` : `Registrar ${i.tipo_nome}`, sub: `${p.numero} · ${p.servico_nome}`,
        corpo: (i.doc ? '<div class="info-l">A versão atual fica guardada no histórico do documento.</div>' : '') + campos(camposDoc({}, CAT.tipo.get(i.tipo_id))),
        botoes: [{ txt: 'Cancelar' }, { txt: 'Registrar', cls: 'p', fn: async (ctx) => salvar(ctx, api('POST', `/api/checklist/${i.id}/documento`, await lerDoc()), 'Documento registrado') }] });
    },

    itemReusar: (d) => {
      const { i } = item(d.item);
      const docs = E.ficha.documentos.filter((x) => x.tipo_id === i.tipo_id);
      folha({ titulo: `Usar ${i.tipo_nome} já registrado`, corpo: campos([{ id: 'documento_id', rot: 'Versão', tipo: 'sel', largo: true, opts: docs.map((x) =>
        [x.id, `Versão ${x.versao}${x.substituido_em ? ' (anterior)' : ' (atual)'} · emitido ${br(x.emissao)} · válido até ${br(x.validade)}`]) }]),
      botoes: [{ txt: 'Cancelar' }, { txt: 'Usar esta versão', cls: 'p', fn: (ctx) => salvar(ctx, api('POST', `/api/checklist/${i.id}/reusar`, { documento_id: lerNum('documento_id') }), 'Documento ligado ao processo') }] });
    },

    itemSolicitado: (d) => {
      const { i } = item(d.item);
      folha({ titulo: `${i.tipo_nome}: solicitado`, corpo: campos([
        { id: 'solicitado_em', rot: 'Data da solicitação', tipo: 'data', val: CAT.hoje },
        { id: 'responsavel_id', rot: 'Responsável', tipo: 'sel', opts: optsUsuarios(), val: i.responsavel_id || CAT.eu.id },
        { id: 'observacoes', rot: 'Onde/como foi pedido', tipo: 'area', largo: true, val: i.observacoes },
      ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => salvar(ctx, api('PUT', `/api/checklist/${i.id}`, {
        status: 'solicitado', solicitado_em: ler('solicitado_em'), responsavel_id: lerNum('responsavel_id'), observacoes: ler('observacoes'), exige_recente_dias: i.exige_recente_dias,
      }), 'Marcado como solicitado') }] });
    },

    itemStatus: async (d) => {
      const { i } = item(d.item);
      await salvar(null, api('PUT', `/api/checklist/${i.id}`, { status: d.s, responsavel_id: i.responsavel_id, solicitado_em: i.solicitado_em,
        observacoes: i.observacoes, exige_recente_dias: i.exige_recente_dias }), d.s === 'nao_aplicavel' ? 'Marcado como não se aplica' : 'Voltou a ser exigido');
    },

    itemEditar: (d) => {
      const { i } = item(d.item);
      folha({ titulo: `Ajustar — ${i.tipo_nome}`, corpo: campos([
        { id: 'responsavel_id', rot: 'Responsável', tipo: 'sel', opts: optsUsuarios(), val: i.responsavel_id },
        { id: 'exige_recente_dias', rot: 'Exige emissão de até (dias)', tipo: 'num', val: i.exige_recente_dias, ajuda: 'Só se o órgão exigir documento recente neste processo. É diferente de validade.' },
        { id: 'orientacao_cliente', rot: 'Orientação para o cliente (aparece na Área do cliente)', tipo: 'area', largo: true, val: i.orientacao_cliente, ph: 'Ex.: traga o original no dia do atendimento' },
        { id: 'observacoes', rot: 'Observação interna (o cliente não vê)', tipo: 'area', largo: true, val: i.observacoes },
      ]) + (i.doc ? `<p class="peq mut">Para corrigir datas do documento, use a aba Documentos.</p>` : ''),
      botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => salvar(ctx, api('PUT', `/api/checklist/${i.id}`, {
        status: i.status, responsavel_id: lerNum('responsavel_id'), solicitado_em: i.solicitado_em, observacoes: ler('observacoes'), exige_recente_dias: lerNum('exige_recente_dias'),
        orientacao_cliente: ler('orientacao_cliente'),
      }), 'Ajustado') }] });
    },

    docNovo: (d) => {
      const tipoId = d.tipo ? Number(d.tipo) : null;
      folha({ titulo: tipoId ? `Nova versão — ${CAT.tipo.get(tipoId)?.nome}` : 'Registrar documento', sub: E.ficha.cliente.nome, corpo: campos([
        ...(tipoId ? [] : [{ id: 'tipo_id', rot: 'Documento', tipo: 'sel', largo: true, opts: CAT.tipos.filter((t) => t.ativo).map((t) => [t.id, t.nome]) }]),
        ...camposDoc({}, tipoId ? CAT.tipo.get(tipoId) : null),
      ]) + '<p class="peq mut">Processos em andamento sem protocolo que pedem este documento passam a usar esta versão.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Registrar', cls: 'p', fn: async (ctx) => salvar(ctx, api('POST', `/api/clientes/${E.ficha.cliente.id}/documentos`,
        { tipo_id: tipoId || lerNum('tipo_id'), ...(await lerDoc()) }), 'Documento registrado') }] });
    },

    docCorrigir: (d) => {
      const doc = E.ficha.documentos.find((x) => x.id === Number(d.doc));
      folha({ titulo: `Corrigir ${doc.tipo_nome}`, sub: `Versão ${doc.versao}. A correção fica no histórico.`, corpo: campos(camposDoc(doc, CAT.tipo.get(doc.tipo_id))),
        botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: async (ctx) => salvar(ctx, api('PUT', `/api/documentos/${doc.id}`, await lerDoc()), 'Documento corrigido') }] });
    },

    /* financeiro */
    cobranca: (d) => {
      const procs = E.ficha.processos.filter((p) => p.situacao !== 'cancelado');
      const enviar = async (ctx, justificativa) => {
        const moeda = ler('moeda');
        const valor = lerDinheiro(ler('valor'), moeda);
        if (!valor) throw new Error('Informe o valor.');
        return salvar(ctx, api('POST', '/api/lancamentos', { cliente_id: Number(d.cliente), tipo: ler('tipo'), descricao: ler('descricao'), moeda, valor,
          data: ler('data'), processo_id: lerNum('processo_id'), prioridade_oficial: ler('prioridade_oficial'), arquivo: await lerArquivo('arquivo'),
          adicional_justificativa: justificativa || ler('adicional') || undefined }), 'Lançado');
      };
      folha({ titulo: 'Lançar cobrança', sub: E.ficha.cliente.nome, corpo: campos([
        { id: 'tipo', rot: 'Tipo', tipo: 'sel', opts: [['honorario', 'Honorário'], ['taxa', 'Taxa oficial'], ['custo', 'Custo documental'], ['desconto', 'Desconto']] },
        { id: 'processo_id', rot: 'Processo', tipo: 'sel', opts: [['', 'Geral (sem processo)'], ...procs.map((p) => [p.id, `${p.numero} · ${p.servico_nome}`])] },
        { id: 'descricao', rot: 'Descrição', largo: true, obrig: true, ph: 'Ex.: Taxa da Migração — residência temporária' },
        { id: 'moeda', rot: 'Moeda', tipo: 'sel', opts: optsMoedas() },
        { id: 'valor', rot: 'Valor', tipo: 'dinheiro', obrig: true, ph: '0,00' },
        { id: 'data', rot: 'Data', tipo: 'data', val: CAT.hoje },
        { id: 'arquivo', rot: 'Comprovante (opcional)', tipo: 'arquivo' },
        { id: 'prioridade_oficial', rot: 'É taxa de trâmite prioritário oficial (exige comprovante oficial)', tipo: 'check', largo: true },
        { id: 'adicional', rot: 'Motivo da cobrança adicional ao pacote', tipo: 'area', largo: true, oculto: true },
      ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Lançar', cls: 'p', fn: async (ctx) => {
        try { await enviar(ctx); } catch (e) {
          if (e.extra?.pede_justificativa) { ctx.mostrar('adicional'); ctx.erro(e.message); return; }
          throw e;
        }
      } }] });
    },

    pagamento: (d) => {
      const fin = E.ficha.financeiro;
      const abertas = fin.parcelas.filter((p) => !p.anulada && p.falta > 0);
      const pc = d.parcela ? abertas.find((p) => p.id === Number(d.parcela)) : null;
      const moedaPadrao = pc?.moeda || Object.entries(fin.saldos).find(([, s]) => s.saldo > 0)?.[0] || 'BRL';
      folha({ titulo: 'Registrar pagamento', sub: E.ficha.cliente.nome, corpo: campos([
        { id: 'parcela_id', rot: 'Referente à parcela', tipo: 'sel', val: pc?.id, largo: true,
          opts: [['', 'Nenhuma parcela específica'], ...abertas.map((p) => [p.id, `${p.descricao} · falta ${dinheiro(p.falta, p.moeda)} · vence ${br(p.vencimento)}`])] },
        { id: 'moeda', rot: 'Moeda em que abate a dívida', tipo: 'sel', opts: optsMoedas(), val: moedaPadrao },
        { id: 'valor', rot: 'Valor', tipo: 'dinheiro', obrig: true, val: pc ? paraCampo(pc.falta, pc.moeda) : '' },
        { id: 'data', rot: 'Data do pagamento', tipo: 'data', val: CAT.hoje },
        { id: 'forma', rot: 'Forma de pagamento', tipo: 'sel', opts: ['Pix', 'Transferência', 'Dinheiro', 'Cartão', 'Depósito', 'Outro'] },
        { id: 'descricao', rot: 'Descrição', val: pc ? `Pagamento — ${pc.descricao}` : 'Pagamento', largo: true },
        { id: 'arquivo', rot: 'Comprovante', tipo: 'arquivo', largo: true },
        { id: 'outra', rot: 'O dinheiro chegou em outra moeda', tipo: 'check', largo: true },
        { id: 'moeda_original', rot: 'Moeda recebida', tipo: 'sel', opts: optsMoedas() },
        { id: 'valor_original', rot: 'Valor recebido nessa moeda', tipo: 'dinheiro' },
        { id: 'cambio_nota', rot: 'Cotação usada e a fonte', largo: true, ph: 'Ex.: 1 USD = 7.300 PYG, casa de câmbio X, 24/10' },
      ]) + '<p class="peq mut">Se a moeda for outra, informe a conversão: o sistema não converte sozinho.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Registrar pagamento', cls: 'p', fn: async (ctx) => {
        const moeda = ler('moeda');
        const valor = lerDinheiro(ler('valor'), moeda);
        if (!valor) throw new Error('Informe o valor.');
        const outra = ler('outra') && ler('moeda_original') !== moeda;
        const vo = outra ? lerDinheiro(ler('valor_original'), ler('moeda_original')) : null;
        if (outra && !vo) throw new Error('Informe o valor recebido na outra moeda.');
        await salvar(ctx, api('POST', '/api/lancamentos', { cliente_id: Number(d.cliente), tipo: 'pagamento', parcela_id: lerNum('parcela_id'),
          moeda, valor, data: ler('data'), forma: ler('forma'), descricao: ler('descricao') || 'Pagamento', arquivo: await lerArquivo('arquivo'),
          ...(outra ? { moeda_original: ler('moeda_original'), valor_original: vo, cambio_nota: ler('cambio_nota') } : {}) }), 'Pagamento registrado');
      } }] });
    },

    parcelas: (d) => {
      const procs = E.ficha.processos.filter((p) => p.situacao === 'andamento');
      folha({ titulo: 'Programar entrada e parcelas', sub: E.ficha.cliente.nome, corpo: campos([
        { id: 'processo_id', rot: 'Processo', tipo: 'sel', opts: [['', 'Geral'], ...procs.map((p) => [p.id, `${p.numero} · ${p.servico_nome}`])], largo: true },
        { id: 'moeda', rot: 'Moeda', tipo: 'sel', opts: optsMoedas() },
        { id: 'entrada', rot: 'Valor da entrada', tipo: 'dinheiro', ph: '0,00' },
        { id: 'entrada_data', rot: 'Data da entrada', tipo: 'data', val: CAT.hoje },
        { id: 'n', rot: 'Número de parcelas depois da entrada', tipo: 'num', val: '0' },
        { id: 'parcela', rot: 'Valor de cada parcela', tipo: 'dinheiro', ph: '0,00' },
        { id: 'primeira', rot: 'Vencimento da primeira parcela', tipo: 'data', val: addDias(CAT.hoje, 30) },
        { id: 'intervalo', rot: 'Intervalo entre parcelas (dias)', tipo: 'num', val: '30' },
      ]) + '<p class="peq mut">As parcelas organizam as datas de pagamento. O valor devido vem dos honorários, taxas e custos lançados.</p>',
      botoes: [{ txt: 'Cancelar' }, { txt: 'Programar', cls: 'p', fn: (ctx) => {
        const m = ler('moeda');
        const lista = [];
        const ent = lerDinheiro(ler('entrada'), m);
        if (ent) lista.push({ descricao: 'Entrada', moeda: m, valor: ent, vencimento: ler('entrada_data') });
        const n = lerNum('n') || 0;
        const vp = lerDinheiro(ler('parcela'), m);
        if (n > 0 && !vp) throw new Error('Informe o valor de cada parcela.');
        for (let k = 0; k < n; k++) lista.push({ descricao: `Parcela ${k + 1} de ${n}`, moeda: m, valor: vp, vencimento: addDias(ler('primeira'), k * (lerNum('intervalo') || 30)) });
        if (!lista.length) throw new Error('Informe a entrada ou as parcelas.');
        return salvar(ctx, api('POST', '/api/parcelas', { cliente_id: Number(d.cliente), processo_id: lerNum('processo_id'), parcelas: lista }), 'Parcelas programadas');
      } }] });
    },

    pacote: (d) => folha({ titulo: 'Criar pacote', sub: E.ficha.cliente.nome, corpo: campos([
      { id: 'nome', rot: 'Nome do pacote', largo: true, obrig: true, ph: 'Ex.: Residência + cédula + carteira' },
      { id: 'servicos', rot: 'Serviços incluídos', tipo: 'checks', opts: CAT.servicos.filter((s) => s.ativo).map((s) => [s.id, s.nome]) },
      { id: 'moeda', rot: 'Moeda', tipo: 'sel', opts: optsMoedas() },
      { id: 'valor', rot: 'Valor dos honorários do pacote', tipo: 'dinheiro', obrig: true },
      { id: 'data', rot: 'Data', tipo: 'data', val: CAT.hoje },
      { id: 'observacoes', rot: 'Condições negociadas', tipo: 'area', largo: true },
    ]) + '<p class="peq mut">Depois de criado, o sistema avisa se alguém tentar cobrar honorário à parte por um serviço que já está no pacote. Taxas oficiais e custos continuam sendo lançados à parte.</p>',
    botoes: [{ txt: 'Cancelar' }, { txt: 'Criar pacote', cls: 'p', fn: (ctx) => {
      const m = ler('moeda'); const v = lerDinheiro(ler('valor'), m);
      if (!v) throw new Error('Informe o valor.');
      return salvar(ctx, api('POST', '/api/pacotes', { cliente_id: Number(d.cliente), nome: ler('nome'), servicos: ler('servicos').map(Number), moeda: m, valor: v,
        data: ler('data'), observacoes: ler('observacoes') }), 'Pacote criado');
    } }] }),

    anularLanc: (d) => folha({ titulo: 'Anular lançamento', corpo: campos([{ id: 'motivo', rot: 'Motivo', tipo: 'area', largo: true, obrig: true }]) +
      '<p class="peq mut">O lançamento continua visível, riscado, com o motivo.</p>',
    botoes: [{ txt: 'Voltar' }, { txt: 'Anular', cls: 'p', fn: (ctx) => salvar(ctx, api('POST', `/api/lancamentos/${d.id}/anular`, { motivo: ler('motivo') }), 'Lançamento anulado') }] }),
    anularParcela: (d) => folha({ titulo: 'Anular parcela', corpo: campos([{ id: 'motivo', rot: 'Motivo', tipo: 'area', largo: true, obrig: true }]),
      botoes: [{ txt: 'Voltar' }, { txt: 'Anular', cls: 'p', fn: (ctx) => salvar(ctx, api('POST', `/api/parcelas/${d.id}/anular`, { motivo: ler('motivo') }), 'Parcela anulada') }] }),

    /* agenda */
    novoCompromisso: (d) => formCompromisso({ cliente_id: d.cliente ? Number(d.cliente) : null, processo_id: d.proc ? Number(d.proc) : null, data: CAT.hoje, tipo: 'atendimento' }),
    editarCompromisso: async (d) => {
      const r = await api('GET', '/api/agenda');
      const g = r.eventos.find((x) => x.id === Number(d.id));
      if (g) formCompromisso(g);
    },
    agendaAcao: async (d) => salvar(null, api('PUT', `/api/agenda/${d.id}`, { acao: d.a }), { concluir: 'Concluído', reabrir: 'Reaberto', cancelar: 'Cancelado' }[d.a]),
    avisoVisto: async (d) => salvar(null, api('POST', `/api/lembretes/${d.id}/visto`), 'Aviso marcado como visto'),

    /* mensagens */
    msgAbrir: async (d) => {
      const w = window.open('about:blank', '_blank');
      try {
        const r = await api('POST', `/api/mensagens/${d.id}/abrir`);
        if (w) { w.opener = null; w.location.href = r.link; } else location.href = r.link;
        await pintar(true);
      } catch (e) { w?.close(); throw e; }
    },
    msgEnviei: async (d) => salvar(null, api('POST', `/api/mensagens/${d.id}/informar-envio`), 'Registrado como envio manual'),
    msgCancelar: async (d) => salvar(null, api('POST', `/api/mensagens/${d.id}/cancelar`), 'Mensagem não será enviada'),
    msgTentar: async (d) => salvar(null, api('POST', `/api/mensagens/${d.id}/tentar-de-novo`), 'Nova tentativa programada'),

    /* assinaturas */
    assNova: () => formAssinatura({ tipo: 'assinatura', periodicidade: 'mensal', confirmado: 1, ativo: 1, moeda: 'USD' }),
    assEditar: async (d) => { const r = await api('GET', '/api/financeiro'); const a = r.assinaturas.find((x) => x.id === Number(d.id)); if (a) formAssinatura(a); },
    assRenovada: async (d) => { const r = await api('POST', `/api/assinaturas/${d.id}/renovada`); torrada(`Próximo vencimento: ${br(r.vencimento)}`); pintar(true); },

    /* configurações */
    salvarGeral: async () => salvar(null, api('PUT', '/api/config', { alertas_documento_dias: ler('alertas_documento_dias'), alertas_assinatura_dias: ler('alertas_assinatura_dias'),
      alerta_parcela_dias: ler('alerta_parcela_dias'), janela_vencimentos_dias: ler('janela_vencimentos_dias'), hora_envio: ler('hora_envio') }), 'Configuração salva — avisos recalculados'),
    minhaSenha: async () => { await api('POST', '/api/minha-senha', { atual: ler('atual'), nova: ler('nova') }); torrada('Senha trocada'); pintar(); },
    backup: async () => { const r = await api('POST', '/api/backup'); torrada(`Cópia feita (${plural(r.arquivos, 'anexo', 'anexos')})${r.divergencias ? ' — com problemas no manifesto' : ''}`, r.divergencias ? 'ng' : ''); },
    servEditar: (d) => formServico(d.id ? CAT.serv.get(Number(d.id)) : null),
    addEtapa: () => document.getElementById('ed-etapas')?.insertAdjacentHTML('beforeend', linhaEtapa({ nome: '', marco: null })),
    tirarEtapa: (d, el) => el.closest('.linha')?.remove(),
    tipoEditar: (d) => {
      const t = d.id ? CAT.tipo.get(Number(d.id)) : { nome: '', tem_validade: 0, nota: '', ativo: 1 };
      folha({ titulo: d.id ? 'Editar tipo de documento' : 'Novo tipo de documento', corpo: campos([
        { id: 'nome', rot: 'Nome', val: t.nome, largo: true, obrig: true },
        { id: 'tem_validade', rot: 'Costuma ter validade impressa', tipo: 'check', val: t.tem_validade, largo: true },
        { id: 'nota', rot: 'Nota', tipo: 'area', val: t.nota, largo: true },
        ...(d.id ? [{ id: 'ativo', rot: 'Ativo', tipo: 'check', val: t.ativo }] : []),
      ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: async (ctx) => {
        const corpo = { nome: ler('nome'), tem_validade: ler('tem_validade'), nota: ler('nota'), ativo: d.id ? ler('ativo') : 1 };
        await salvar(ctx, d.id ? api('PUT', `/api/doc-tipos/${d.id}`, corpo) : api('POST', '/api/doc-tipos', corpo), 'Salvo');
      } }] });
    },
    cidadeEditar: (d) => {
      const c = d.id ? CAT.cid.get(Number(d.id)) : { nome: '', ativo: 1 };
      folha({ titulo: d.id ? 'Editar cidade' : 'Acrescentar cidade', corpo: campos([{ id: 'nome', rot: 'Nome', val: c.nome, largo: true, obrig: true },
        ...(d.id ? [{ id: 'ativo', rot: 'Ativa', tipo: 'check', val: c.ativo }] : [])]),
      botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => salvar(ctx, d.id ? api('PUT', `/api/cidades/${d.id}`, { nome: ler('nome'), ativo: ler('ativo') })
        : api('POST', '/api/cidades', { nome: ler('nome') }), 'Salvo') }] });
    },
    modeloEditar: (d) => {
      const m = CAT.modelos.find((x) => x.id === Number(d.id));
      folha({ titulo: `Modelo: ${m.nome}`, corpo: campos([
        { id: 'texto', rot: 'Texto', tipo: 'area', val: m.texto, largo: true, ajuda: 'Marcadores: {nome}, {documento}, {data}, {hora}, {local}.' },
        { id: 'modelo_aprovado', rot: 'Nome do modelo aprovado no WhatsApp', val: m.modelo_aprovado, ajuda: 'Opcional. Necessário para envio automático fora da janela de 24 horas.' },
        { id: 'idioma', rot: 'Idioma do modelo', val: m.idioma },
      ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => salvar(ctx, api('PUT', `/api/modelos/${m.id}`,
        { texto: ler('texto'), modelo_aprovado: ler('modelo_aprovado'), idioma: ler('idioma') }), 'Modelo salvo') }] });
    },
    usuarioEditar: (d) => folha({ titulo: d.id ? 'Editar usuário' : 'Novo usuário', corpo: campos([
      { id: 'nome', rot: 'Nome', val: d.nome || '', largo: true, obrig: true },
      ...(d.id ? [] : [{ id: 'email', rot: 'E-mail', tipo: 'email', largo: true, obrig: true }]),
      { id: 'perfil', rot: 'Perfil', tipo: 'sel', val: d.perfil || 'atendente', opts: [['atendente', 'Atendente'], ['admin', 'Administrador']] },
      ...(d.id ? [{ id: 'ativo', rot: 'Tem acesso', tipo: 'check', val: d.ativo === '1' }] : []),
      { id: 'senha', rot: d.id ? 'Nova senha (deixe vazio para manter)' : 'Senha inicial (mínimo 10 caracteres)', tipo: 'senha', largo: true },
    ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => salvar(ctx, d.id
      ? api('PUT', `/api/usuarios/${d.id}`, { nome: ler('nome'), perfil: ler('perfil'), ativo: ler('ativo'), senha: ler('senha') || undefined })
      : api('POST', '/api/usuarios', { nome: ler('nome'), email: ler('email'), perfil: ler('perfil'), senha: ler('senha') }), 'Usuário salvo').then(() => carregarCatalogo()) }] }),
  };

  function formCompromisso(g) {
    const clientes = E.ficha?.cliente ? [[E.ficha.cliente.id, E.ficha.cliente.nome]] : [];
    const carregar = clientes.length ? Promise.resolve(null) : api('GET', '/api/clientes');
    carregar.then((r) => {
      const lista = r ? r.clientes.map((c) => [c.id, c.nome]) : clientes;
      if (g.cliente_id && !lista.some(([id]) => id === g.cliente_id)) lista.push([g.cliente_id, g.cliente_nome || 'Cliente']);
      const procs = E.ficha?.cliente?.id === g.cliente_id ? E.ficha.processos.filter((p) => p.situacao === 'andamento') : [];
      folha({ titulo: g.id ? 'Editar compromisso' : 'Agendar', corpo: campos([
        { id: 'tipo', rot: 'Tipo', tipo: 'sel', val: g.tipo, opts: [['atendimento', 'Atendimento'], ['tarefa', 'Tarefa']] },
        { id: 'titulo', rot: 'O quê', val: g.titulo, obrig: true, ph: 'Ex.: Ir à Migração com o cliente' },
        { id: 'data', rot: 'Data', tipo: 'data', val: g.data, obrig: true },
        { id: 'hora', rot: 'Hora', tipo: 'hora', val: g.hora },
        { id: 'local', rot: 'Local', val: g.local, largo: true },
        { id: 'cliente_id', rot: 'Cliente', tipo: 'sel', val: g.cliente_id, opts: [['', 'Nenhum'], ...lista] },
        ...(procs.length ? [{ id: 'processo_id', rot: 'Processo', tipo: 'sel', val: g.processo_id, opts: [['', '—'], ...procs.map((p) => [p.id, `${p.numero} · ${p.servico_nome}`])] }] : []),
        { id: 'responsavel_id', rot: 'Responsável', tipo: 'sel', val: g.responsavel_id || CAT.eu.id, opts: optsUsuarios() },
        { id: 'avisar_cliente', rot: 'Avisar o cliente por WhatsApp (se ele autorizou)', tipo: 'check', val: g.avisar_cliente, largo: true },
        { id: 'visivel_cliente', rot: 'Mostrar na Área do cliente (precisa estar ligado a um processo)', tipo: 'check', val: g.visivel_cliente, largo: true },
        { id: 'observacoes', rot: 'Observações', tipo: 'area', val: g.observacoes, largo: true },
      ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => {
        const corpo = { tipo: ler('tipo'), titulo: ler('titulo'), data: ler('data'), hora: ler('hora') || null, local: ler('local'), cliente_id: lerNum('cliente_id'),
          processo_id: lerNum('processo_id'), responsavel_id: lerNum('responsavel_id'), avisar_cliente: ler('avisar_cliente'), visivel_cliente: ler('visivel_cliente'),
          observacoes: ler('observacoes') };
        return salvar(ctx, g.id ? api('PUT', `/api/agenda/${g.id}`, corpo) : api('POST', '/api/agenda', corpo), 'Agendado');
      } }] });
    }).catch((e) => torrada(e.message, 'ng'));
  }

  function formAssinatura(a) {
    folha({ titulo: a.id ? 'Editar' : 'Cadastrar domínio ou assinatura', corpo: campos([
      { id: 'tipo', rot: 'Tipo', tipo: 'sel', val: a.tipo, opts: [['dominio', 'Domínio'], ['assinatura', 'Assinatura'], ['outro', 'Outro']] },
      { id: 'nome', rot: 'Nome', val: a.nome, obrig: true, ph: 'Ex.: mestredospapeis.com, Canva, CapCut' },
      { id: 'fornecedor', rot: 'Fornecedor', val: a.fornecedor, ph: 'Ex.: registrador do domínio' },
      { id: 'vencimento', rot: 'Próximo vencimento', tipo: 'data', val: a.vencimento, obrig: true },
      { id: 'periodicidade', rot: 'Periodicidade', tipo: 'sel', val: a.periodicidade, opts: [['mensal', 'Mensal'], ['anual', 'Anual'], ['unica', 'Pagamento único']] },
      { id: 'moeda', rot: 'Moeda', tipo: 'sel', val: a.moeda || 'USD', opts: optsMoedas() },
      { id: 'valor', rot: 'Valor', tipo: 'dinheiro', val: a.valor != null ? paraCampo(a.valor, a.moeda) : '' },
      { id: 'responsavel_id', rot: 'Responsável', tipo: 'sel', val: a.responsavel_id, opts: optsUsuarios() },
      { id: 'confirmado', rot: 'Dados conferidos na conta do fornecedor', tipo: 'check', val: a.confirmado, largo: true },
      { id: 'ativo', rot: 'Ativo', tipo: 'check', val: a.ativo, largo: true },
      { id: 'observacoes', rot: 'Observações', tipo: 'area', val: a.observacoes, largo: true },
    ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => {
      const m = ler('moeda'); const txt = ler('valor');
      const v = txt ? lerDinheiro(txt, m) : null;
      if (txt && !v) throw new Error('Valor inválido.');
      const corpo = { tipo: ler('tipo'), nome: ler('nome'), fornecedor: ler('fornecedor'), vencimento: ler('vencimento'), periodicidade: ler('periodicidade'),
        moeda: v ? m : null, valor: v, responsavel_id: lerNum('responsavel_id'), confirmado: ler('confirmado'), ativo: ler('ativo'), observacoes: ler('observacoes') };
      return salvar(ctx, a.id ? api('PUT', `/api/assinaturas/${a.id}`, corpo) : api('POST', '/api/assinaturas', corpo), 'Salvo');
    } }] });
  }

  const MARCOS = [['', 'Etapa comum'], ['protocolo', 'Marca o protocolo'], ['recebido', 'Marca o recebimento'], ['entregue', 'Marca a entrega']];
  const linhaEtapa = (e) => `<div class="linha"><input type="text" class="et-nome" value="${esc(e.nome)}" aria-label="Nome da etapa">
    <select aria-label="Tipo de etapa">${MARCOS.map(([v, t]) => `<option value="${v}"${(e.marco || '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
    <button class="b s" data-acao="tirarEtapa">Tirar</button>
    <input type="text" class="et-desc" value="${esc(e.descricao || '')}" placeholder="Explicação simples para o cliente (opcional)" aria-label="Explicação da etapa" style="grid-column:1/-1"></div>`;
  function formServico(s) {
    const v = s || { nome: '', grupo: '', modalidades: ['Padrão'], etapas: [{ nome: 'Contato' }, { nome: 'Pagamento inicial' }, { nome: 'Coleta de documentos' },
      { nome: 'Protocolo', marco: 'protocolo' }, { nome: 'Recebido', marco: 'recebido' }, { nome: 'Entregue ao cliente', marco: 'entregue' }], checklist: [], prazo_dias: null,
    prazos_cidade: {}, doc_resultante_id: null, segue_para: [], nota: '', ativo: 1 };
    const ck = new Map(v.checklist.map((i) => [i.tipo_id, i]));
    const tabCk = `<table class="tab"><thead><tr><th>Documento</th><th>Pedir</th><th>Só se aplicável</th><th>Emissão de até (dias)</th></tr></thead><tbody>${CAT.tipos.filter((t) => t.ativo).map((t) => {
      const i = ck.get(t.id);
      return `<tr data-tipo="${t.id}"><td data-r="Documento">${esc(t.nome)}</td><td data-r="Pedir"><input type="checkbox" class="ck-inc"${i ? ' checked' : ''} aria-label="Pedir ${esc(t.nome)}"></td>
        <td data-r="Só se aplicável"><input type="checkbox" class="ck-opc"${i?.opcional ? ' checked' : ''} aria-label="Só se aplicável"></td>
        <td data-r="Emissão de até (dias)"><input type="number" class="ck-dias" min="1" value="${i?.exige_recente_dias ?? ''}" style="width:110px" aria-label="Dias"></td></tr>`;
    }).join('')}</tbody></table>`;
    const prazos = CAT.cidades.filter((c) => c.ativo).map((c) => `<div class="campo"><label for="pz-${c.id}">${esc(c.nome)}</label><input type="number" id="pz-${c.id}" class="pz" data-cid="${c.id}" min="1" value="${v.prazos_cidade[String(c.id)] ?? ''}"></div>`).join('');
    folha({ titulo: s ? `Serviço: ${s.nome}` : 'Novo serviço', sub: 'Mudanças valem para processos novos.', larga: true, corpo: campos([
      { id: 'nome', rot: 'Nome', val: v.nome, obrig: true },
      { id: 'grupo', rot: 'Grupo', val: v.grupo, ph: 'Ex.: Residência, Empresa' },
      { id: 'modalidades', rot: 'Modalidades (uma por linha)', tipo: 'area', val: v.modalidades.join('\n'), largo: true },
      { id: 'h1', tipo: 'html', html: `<span class="rotulo">Etapas, na ordem</span><div class="ajuda">Cada serviço pode ter a sua sequência. As etapas marcadas avançam sozinhas quando o protocolo, o recebimento e a entrega são registrados.</div>
        <div class="linhas-editor" id="ed-etapas">${v.etapas.map(linhaEtapa).join('')}</div><button class="b s" data-acao="addEtapa">Acrescentar etapa</button>` },
      { id: 'prazo_dias', rot: 'Prazo estimado padrão (dias)', tipo: 'num', val: v.prazo_dias, ajuda: 'Deixe vazio se não houver estimativa. Previsão não é garantia.' },
      { id: 'doc_resultante_id', rot: 'Documento que este serviço gera', tipo: 'sel', val: v.doc_resultante_id, opts: [['', 'Nenhum'], ...CAT.tipos.map((t) => [t.id, t.nome])] },
      { id: 'h2', tipo: 'html', html: `<span class="rotulo">Prazo estimado por cidade (dias)</span><div class="ajuda">Vazio = usa o padrão.</div><div class="campos">${prazos}</div>` },
      { id: 'h3', tipo: 'html', html: `<span class="rotulo">Documentos pedidos</span><div class="ajuda">"Emissão de até" é para quando o órgão exige documento recente. É diferente de validade.</div>${tabCk}` },
      { id: 'segue_para', rot: 'Depois de receber, sugerir abrir', tipo: 'checks', val: v.segue_para, opts: CAT.servicos.filter((x) => x.id !== s?.id).map((x) => [x.codigo, x.nome]) },
      { id: 'nota', rot: 'Nota (fonte oficial, observações)', tipo: 'area', val: v.nota, largo: true },
      ...(s ? [{ id: 'ativo', rot: 'Ativo', tipo: 'check', val: v.ativo }] : []),
    ]), botoes: [{ txt: 'Cancelar' }, { txt: 'Salvar', cls: 'p', fn: (ctx) => {
      const etapas = [...document.querySelectorAll('#ed-etapas .linha')].map((l) => ({ nome: l.querySelector('.et-nome').value.trim(),
        descricao: l.querySelector('.et-desc').value.trim() || null, marco: l.querySelector('select').value || null })).filter((e) => e.nome);
      const checklist = [...document.querySelectorAll('tr[data-tipo]')].filter((tr) => tr.querySelector('.ck-inc').checked).map((tr) => ({
        tipo_id: Number(tr.dataset.tipo), opcional: tr.querySelector('.ck-opc').checked ? 1 : 0, exige_recente_dias: tr.querySelector('.ck-dias').value ? Number(tr.querySelector('.ck-dias').value) : null }));
      const prazos_cidade = Object.fromEntries([...document.querySelectorAll('.pz')].filter((i) => i.value).map((i) => [i.dataset.cid, Number(i.value)]));
      const corpo = { nome: ler('nome'), grupo: ler('grupo'), modalidades: ler('modalidades').split('\n').map((x) => x.trim()).filter(Boolean), etapas, checklist,
        prazo_dias: lerNum('prazo_dias'), prazos_cidade, doc_resultante_id: lerNum('doc_resultante_id'), segue_para: ler('segue_para'), nota: ler('nota'), ativo: s ? ler('ativo') : 1 };
      return salvar(ctx, s ? api('PUT', `/api/servicos/${s.id}`, corpo) : api('POST', '/api/servicos', corpo), 'Serviço salvo');
    } }] });
  }

  /* ── eventos ─────────────────────────────────────────── */
  document.addEventListener('click', async (ev) => {
    if (ev.target.closest('.fundo') && !ev.target.closest('[data-acao]')) return;
    const el = ev.target.closest('[data-acao]');
    if (el) {
      ev.preventDefault();
      const fn = ACOES[el.dataset.acao];
      if (fn) { try { await fn(el.dataset, el); } catch (e) { if (!e.silencioso) torrada(e.message, 'ng'); } }
      return;
    }
    const tr = ev.target.closest('tr[data-ir]');
    if (tr && !ev.target.closest('a,button,input,select,details')) location.hash = tr.dataset.ir;
  });
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.matches('[data-busca]')) { clearTimeout(E.buscaT); E.buscaT = setTimeout(() => buscar(t.value).catch((e) => torrada(e.message, 'ng')), 250); }
    if (t.matches('[data-filtra]')) {
      const q = t.value.toLowerCase().trim();
      const dig = q.replace(/\D/g, '');
      document.querySelectorAll('tr[data-texto]').forEach((tr) => {
        const tx = tr.dataset.texto;
        tr.classList.toggle('oculto', !!q && !tx.includes(q) && !(dig.length >= 4 && tx.replace(/\D/g, '').includes(dig)));
      });
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.matches('[data-busca]')) {
      const linhas = document.querySelectorAll('#resultado-busca tr[data-ir]');
      if (linhas.length === 1) location.hash = linhas[0].dataset.ir;
    }
  });
  document.addEventListener('change', (ev) => {
    if (ev.target.id === 'f-servico_id' && document.getElementById('f-modalidade')?.tagName === 'SELECT') {
      const s = CAT.serv.get(Number(ev.target.value));
      document.getElementById('f-modalidade').innerHTML = (s?.modalidades.length ? s.modalidades : ['—']).map((m) => `<option value="${esc(m === '—' ? '' : m)}">${esc(m)}</option>`).join('');
    }
  });

  /* ── início ──────────────────────────────────────────── */
  async function iniciar() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(R('/sw.js')).catch(() => {});
    let est;
    try { est = await api('GET', '/api/estado'); } catch (e) { raiz.innerHTML = `<div class="entrada"><div class="caixa"><div class="alerta-l">${esc(e.message)}</div></div></div>`; return; }
    if (est.precisa_configurar) return telaConfigurar();
    if (!est.usuario) return telaEntrada(est.demo);
    try { await carregarCatalogo(); } catch (e) { if (!e.silencioso) torrada(e.message, 'ng'); return; }
    casca();
    pintar();
  }
  iniciar();
})();
