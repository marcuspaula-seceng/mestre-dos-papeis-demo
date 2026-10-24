'use strict';
/*
 * Área do cliente. Só consulta e conversa: nada aqui altera etapa, prazo ou pendência.
 * Atualiza sozinha a cada 15 segundos perguntando ao servidor se houve novidade.
 */
(() => {
  const raiz = document.getElementById('raiz');
  /* base do endereço: '/' no servidor local, '/<repositório>/' na demonstração do GitHub Pages */
  const R = (p) => (document.querySelector('meta[name="mdp-base"]')?.content || '/') + String(p).replace(/^\//, '');
  const E = { nome: '', demo: false, horario: null, versao: null, offline: false, verificado: null, avisos: 0, duvidas: 0,
    rascunho: {}, enviando: false, timer: null, ultimaRota: '' };
  const INTERVALO = 15000;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const br = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
  const dh = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Asuncion', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Asuncion', hour: '2-digit', minute: '2-digit' }) : '');
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
  const et = (c, t) => `<span class="et ${c}">${esc(t)}</span>`;

  async function api(metodo, url, corpo) {
    let r;
    try {
      r = await fetch(R(url), { method: metodo, credentials: 'same-origin', cache: 'no-store',
        headers: { 'X-MDP': '1', ...(corpo ? { 'Content-Type': 'application/json' } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
    } catch { throw Object.assign(new Error('Sem conexão. Verifique a internet e tente de novo.'), { rede: true }); }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.endsWith('/entrar') && !url.includes('/perfil/senha')) {
      pararAtualizacao(); location.hash = '#/entrar';
      throw Object.assign(new Error('Sua sessão terminou. Entre de novo.'), { silencioso: true });
    }
    if (!r.ok) throw new Error(j.erro || 'Não foi possível concluir. Tente de novo.');
    return j;
  }
  function torrada(m, tipo) {
    const t = document.createElement('div');
    t.className = 'torrada' + (tipo === 'ng' ? ' ng' : '');
    t.textContent = m;
    document.getElementById('torradas').appendChild(t);
    setTimeout(() => t.remove(), 4500);
  }

  /* ── casca ─────────────────────────────────────────── */
  const IC = {
    processos: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>',
    duvidas: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4M12 14.5h.01"/>',
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  };
  function casca() {
    if (document.getElementById('ac-main')) return;
    raiz.innerHTML = `<div class="ac">
      <header class="ac-topo"><div class="cont"><a class="logo" href="#/processos"><img src="${R('/icone.svg')}" alt=""><span class="n">O Mestre dos Papéis<small>Área do cliente</small></span></a>
        <button class="sino" data-ir="#/avisos" aria-label="Avisos">Avisos<span class="cont-n oculto" id="n-avisos"></span></button></div></header>
      <nav class="ac-nav" aria-label="Navegação">
        ${[['processos', 'Meus processos'], ['duvidas', 'Dúvidas'], ['perfil', 'Perfil']].map(([k, t]) =>
          `<a href="#/${k}" data-nav="${k}"><svg viewBox="0 0 24 24">${IC[k]}</svg>${t}${k === 'duvidas' ? '<span class="pt oculto" id="n-duvidas"></span>' : ''}</a>`).join('')}
      </nav>
      <main class="ac-main"><div class="cont" id="ac-main"></div></main></div>`;
  }
  function contadores() {
    const a = document.getElementById('n-avisos'); const d = document.getElementById('n-duvidas');
    if (a) { a.textContent = E.avisos; a.classList.toggle('oculto', !E.avisos); }
    if (d) { d.textContent = E.duvidas; d.classList.toggle('oculto', !E.duvidas); }
  }
  function linhaEstado() {
    if (E.offline) {
      return `<div class="faixa ng" role="status"><strong>Sem conexão no momento.</strong> As informações abaixo podem estar desatualizadas.<br>
        <button class="bt s" data-acao="tentar">Tentar atualizar</button></div>`;
    }
    if (E.adiada) return `<div class="estado" role="status"><span class="pontinho"></span><strong>Há novidades.</strong>
      <button class="bt s" data-acao="tentar">Mostrar agora</button></div>`;
    return `<div class="estado" role="status"><span class="pontinho"></span>${E.verificado ? `Atualizado às ${esc(hora(E.verificado))}.` : 'Verificando novidades…'} A tela se atualiza sozinha.
      <button class="bt s" data-acao="tentar">Atualizar agora</button></div>`;
  }

  /* ── rotas ─────────────────────────────────────────── */
  const PUBLICAS = ['entrar', 'esqueci', 'ativar', 'nova-senha'];
  async function pintar({ silencioso = false } = {}) {
    const [rota, arg] = location.hash.replace(/^#\/?/, '').split('/');
    if (PUBLICAS.includes(rota)) { pararAtualizacao(); return TELAS_PUB[rota](arg); }
    casca();
    if (!E.timer) { iniciarAtualizacao(); if (!E.verificado) verificar(false); }
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === ({ processo: 'processos', duvida: 'duvidas', 'nova-duvida': 'duvidas' }[rota] || rota)));
    const alvo = document.getElementById('ac-main');
    const tela = TELAS[rota] || TELAS.processos;
    const mudouRota = E.ultimaRota !== location.hash;
    E.ultimaRota = location.hash;
    if (!silencioso) alvo.innerHTML = '<div class="carregando-c" role="status">Carregando…</div>';
    const y = window.scrollY;
    try {
      const html = await tela(arg);
      alvo.innerHTML = (E.demo ? '<div class="faixa demo"><strong>Demonstração.</strong> Dados fictícios.</div>' : '') + html;
      if (silencioso && !mudouRota) window.scrollTo(0, y); else window.scrollTo(0, 0);
      restaurarRascunho();
    } catch (e) {
      if (e.silencioso) return;
      if (e.rede) { E.offline = true; if (!silencioso) alvo.innerHTML = linhaEstado(); }
      else if (!silencioso) alvo.innerHTML = `<div class="faixa ng">${esc(e.message)}</div><a class="bt" href="#/processos">Voltar aos processos</a>`;
    }
  }
  window.addEventListener('hashchange', () => pintar());

  /* ── atualização automática ────────────────────────── */
  async function verificar(forcar) {
    try {
      const n = await api('GET', '/api/cliente/novidades');
      const mudou = E.versao !== null && n.versao !== E.versao;
      const voltou = E.offline;
      E.versao = n.versao; E.avisos = n.avisos_nao_lidos; E.duvidas = n.duvidas_nao_lidas; E.verificado = n.verificado_em; E.offline = false;
      contadores();
      /* não redesenha enquanto a pessoa digita: avisa e espera o toque em "Atualizar agora" */
      const digitando = !forcar && document.activeElement?.matches?.('#ac-main textarea, #ac-main input, #ac-main select');
      if ((mudou || voltou || forcar || E.adiada) && !digitando) { E.adiada = false; await pintar({ silencioso: true }); }
      else {
        if (mudou && digitando) E.adiada = true;
        const est = document.querySelector('.estado'); if (est) est.outerHTML = linhaEstado();
      }
    } catch (e) {
      if (e.silencioso) return;
      if (!E.offline) { E.offline = true; const est = document.querySelector('.estado'); if (est) est.outerHTML = linhaEstado(); }
    }
  }
  function iniciarAtualizacao() { pararAtualizacao(); E.timer = setInterval(() => { if (!document.hidden) verificar(false); }, INTERVALO); }
  function pararAtualizacao() { if (E.timer) clearInterval(E.timer); E.timer = null; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && E.timer) verificar(false); });
  window.addEventListener('online', () => { if (E.timer) verificar(true); });
  window.addEventListener('offline', () => { E.offline = true; const est = document.querySelector('.estado'); if (est) est.outerHTML = linhaEstado(); });

  /* ════════════ telas públicas ════════════ */
  const caixa = (titulo, corpo) => { raiz.innerHTML = `<div class="ac"><header class="ac-topo"><div class="cont"><a class="logo" href="${R('/')}"><img src="${R('/icone.svg')}" alt="">
    <span class="n">O Mestre dos Papéis<small>Área do cliente</small></span></a></div></header>
    <main class="ac-main"><div class="cont"><div class="card entrada-c"><h2>${esc(titulo)}</h2>${corpo}</div></div></main></div>`; };
  const erroForm = (m) => { const e = document.getElementById('erro'); e.textContent = m; e.classList.remove('oculto'); };

  const TELAS_PUB = {
    entrar() {
      caixa('Entrar', `${E.demo ? '<div class="faixa demo"><strong>Ambiente de demonstração.</strong> Entre com <strong>juliana@demo.invalid</strong> ou <strong>carlos@demo.invalid</strong>, senha <strong>demo-cliente-2026</strong>.</div>' : ''}
        <form class="form" id="f-entrar">
        <div class="campo"><label for="email">E-mail</label><input id="email" type="email" autocomplete="username" required></div>
        <div class="campo"><label for="senha">Senha</label><input id="senha" type="password" autocomplete="current-password" required></div>
        <div class="faixa ng oculto" id="erro" role="alert"></div>
        <button class="bt p largo" type="submit">Entrar</button>
        <a href="#/esqueci" class="peq">Esqueci a senha</a>
        <p class="peq mut">Ainda não tem acesso? A equipe envia um convite depois do primeiro atendimento.</p></form>`);
      document.getElementById('f-entrar').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const bt = ev.target.querySelector('button'); bt.disabled = true;
        try {
          await api('POST', '/api/cliente/entrar', { email: document.getElementById('email').value, senha: document.getElementById('senha').value });
          await iniciar();
        } catch (e) { erroForm(e.message); } finally { bt.disabled = false; }
      });
    },
    esqueci() {
      caixa('Recuperar acesso', `<form class="form" id="f-esq">
        <p>Informe o e-mail que você usa para entrar. A equipe recebe o pedido e envia um novo link de acesso.</p>
        <div class="campo"><label for="email">E-mail</label><input id="email" type="email" autocomplete="email" required></div>
        <div class="faixa ng oculto" id="erro" role="alert"></div>
        <button class="bt p largo" type="submit">Pedir novo acesso</button><a href="#/entrar" class="peq">Voltar</a></form>`);
      document.getElementById('f-esq').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        try {
          const r = await api('POST', '/api/cliente/recuperar', { email: document.getElementById('email').value });
          caixa('Pedido registrado', `<p>${esc(r.mensagem)}</p>${E.horario ? `<p class="mut peq">Horário de atendimento: ${esc(E.horario)}</p>` : ''}<a class="bt p largo" href="#/entrar">Voltar à entrada</a>`);
        } catch (e) { erroForm(e.message); }
      });
    },
    ativar(token) { return telaSenha(token, 'ativacao'); },
    'nova-senha'(token) { return telaSenha(token, 'recuperacao'); },
  };
  async function telaSenha(token, tipo) {
    caixa(tipo === 'ativacao' ? 'Ativar acesso' : 'Criar nova senha', '<div class="carregando-c">Conferindo o link…</div>');
    let info;
    try { info = await api('POST', '/api/cliente/link', { token, tipo }); } catch (e) {
      return caixa('Link indisponível', `<p>${esc(e.message)}</p><a class="bt p largo" href="#/entrar">Ir para a entrada</a>`);
    }
    caixa(tipo === 'ativacao' ? `Bem-vindo${info.nome ? ', ' + info.nome : ''}` : 'Criar nova senha', `<form class="form" id="f-senha">
      <p>${tipo === 'ativacao' ? 'Crie a sua senha para acessar a Área do cliente.' : 'Escolha uma nova senha.'}</p>
      ${info.email ? `<div class="campo"><label>E-mail de acesso</label><input value="${esc(info.email)}" disabled></div>` : ''}
      <div class="campo"><label for="s1">Senha</label><input id="s1" type="password" autocomplete="new-password" minlength="10" required><span class="ajuda">Pelo menos 10 caracteres.</span></div>
      <div class="campo"><label for="s2">Repita a senha</label><input id="s2" type="password" autocomplete="new-password" required></div>
      <div class="faixa ng oculto" id="erro" role="alert"></div>
      <button class="bt p largo" type="submit">${tipo === 'ativacao' ? 'Ativar e entrar' : 'Salvar e entrar'}</button></form>`);
    document.getElementById('f-senha').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const s1 = document.getElementById('s1').value;
      if (s1 !== document.getElementById('s2').value) return erroForm('As duas senhas não são iguais.');
      try {
        await api('POST', '/api/cliente/definir-senha', { token, tipo, senha: s1 });
        history.replaceState(null, '', R('/cliente/#/processos'));
        await iniciar();
      } catch (e) { erroForm(e.message); }
    });
  }

  /* ════════════ Meus processos ════════════ */
  function cartao(p) {
    const pct = Math.round((p.etapa_numero / p.total_etapas) * 100);
    return `<article class="card"><div class="ref">${esc(p.numero)}</div><h2>${esc(p.servico)}</h2>
      ${et(p.concluido ? 'ok' : p.situacao === 'Documento pronto para entrega' ? 'in' : 'at', p.situacao)}
      <div class="rot">Etapa atual</div><div>${esc(p.etapa_atual)} <span class="mut peq">(${p.etapa_numero} de ${p.total_etapas})</span></div>
      <div class="progresso" aria-hidden="true"><span style="width:${p.concluido ? 100 : pct}%"></span></div>
      <div class="prox"><div class="rot">Próximo passo</div>${esc(p.proximo_passo)}</div>
      <div class="peq mut">Última atualização: ${esc(dh(p.atualizado_em))}</div>
      <a class="bt p largo" style="margin-top:12px" href="#/processo/${p.id}">Ver detalhes</a></article>`;
  }
  const linhaDoc = (d) => `<div class="doc"><div class="t"><strong>${esc(d.titulo)}</strong><div class="peq mut">${esc(d.tipo)} · disponibilizado em ${esc(dh(d.liberado_em))}</div></div>
    <a class="bt s" href="${R('/api/')}cliente/arquivos/${d.id}" target="_blank" rel="noopener">Ver</a><a class="bt s" href="${R('/api/')}cliente/arquivos/${d.id}?baixar=1">Baixar</a></div>`;

  const TELAS = {
    async processos() {
      const r = await api('GET', '/api/cliente/processos');
      const ativos = r.processos.filter((p) => !p.concluido);
      const conc = r.processos.filter((p) => p.concluido);
      return `${linhaEstado()}<h1>Meus processos</h1>
        ${!r.processos.length ? '<div class="card vazio-c"><strong>Nenhum processo por aqui ainda</strong>Quando a equipe abrir o seu processo, ele aparece nesta tela.</div>' : ''}
        ${ativos.map(cartao).join('')}
        ${conc.length ? `<h2 style="margin-top:26px">Concluídos</h2>${conc.map(cartao).join('')}` : ''}
        ${r.documentos_gerais.length ? `<div class="card"><h3>Outros documentos disponíveis</h3>${r.documentos_gerais.map(linhaDoc).join('')}</div>` : ''}`;
    },

    async processo(id) {
      const p = await api('GET', `/api/cliente/processos/${Number(id)}`);
      const d = p.datas;
      const tempo = p.linha_do_tempo.map((e) => `<li class="${e.estado}"><span class="bola"></span>
        <div class="nome">${esc(e.nome)}${e.estado === 'atual' && !p.concluido ? ' <span class="et in">Etapa atual</span>' : ''}</div>
        ${e.data ? `<div class="quando">${e.estado === 'concluida' ? 'Concluída' : 'Desde'} ${esc(br(e.data))}</div>` : ''}
        ${e.descricao ? `<div class="peq mut">${esc(e.descricao)}</div>` : ''}</li>`).join('');
      const datas = [];
      for (const g of d.agendamentos) datas.push(`<div><div class="r">${g.realizado ? 'Atendimento realizado' : 'Agendamento confirmado'}</div><div class="v">${esc(br(g.data))}${g.hora ? ' às ' + esc(g.hora) : ''}</div><div class="peq">${esc(g.titulo)}${g.local ? ' · ' + esc(g.local) : ''}</div></div>`);
      if (d.protocolo) datas.push(`<div><div class="r">Protocolo (data confirmada)</div><div class="v">${esc(br(d.protocolo))}</div>${d.numero_protocolo ? `<div class="peq">Nº ${esc(d.numero_protocolo)}</div>` : ''}</div>`);
      if (d.previsao) datas.push(`<div><div class="r">Previsão estimada</div><div class="v">${esc(br(d.previsao))}</div><div class="peq mut">${d.previsao_passou ? 'A estimativa já passou. A equipe está acompanhando.' : 'Estimativa, não é data confirmada.'}</div></div>`);
      if (d.recebido_em) datas.push(`<div><div class="r">Documento emitido e recebido</div><div class="v">${esc(br(d.recebido_em))}</div></div>`);
      if (d.entregue_em) datas.push(`<div><div class="r">Entregue a você</div><div class="v">${esc(br(d.entregue_em))}</div></div>`);
      if (d.validade) datas.push(`<div><div class="r">Validade do documento</div><div class="v">${esc(br(d.validade))}</div></div>`);
      return `<a class="voltar" href="#/processos">← Meus processos</a>${linhaEstado()}
        <div class="card"><div class="ref">${esc(p.numero)}</div><h2>${esc(p.servico)}</h2>${et(p.concluido ? 'ok' : 'at', p.situacao)}
          <div class="datas" style="margin-top:12px">
            ${p.cidade ? `<div><div class="r">Cidade de atendimento</div><div class="v">${esc(p.cidade)}</div></div>` : ''}
            <div><div class="r">Etapa atual</div><div class="v">${esc(p.etapa_atual)}</div></div>
            ${p.responsavel ? `<div><div class="r">Responsável pelo atendimento</div><div class="v">${esc(p.responsavel)}</div></div>` : ''}
          </div><div class="peq mut" style="margin-top:10px">Última atualização: ${esc(dh(p.atualizado_em))}</div></div>
        <div class="card"><h3>Próximo passo</h3><p style="margin:.3em 0">${esc(p.proximo_passo.texto)}</p>
          ${p.proximo_passo.quem ? `<div class="peq"><strong>Quem faz:</strong> ${esc(p.proximo_passo.quem)}</div>` : ''}
          ${p.orientacoes ? `<div class="rot">Orientações da equipe</div><p style="white-space:pre-wrap;margin:.3em 0">${esc(p.orientacoes)}</p>` : ''}</div>
        <div class="card"><h3>O que falta</h3>${p.falta.length ? `<ul class="lista">${p.falta.map((f) => `<li><strong>${esc(f.documento)}</strong> ${et(f.situacao.startsWith('Solicitado') ? 'in' : f.situacao.includes('Vencido') || f.situacao.includes('antiga') ? 'ng' : 'at', f.situacao)}
          ${f.orientacao ? `<div class="peq" style="margin-top:4px">${esc(f.orientacao)}</div>` : ''}</li>`).join('')}</ul>` : `<p class="mut" style="margin:0">${p.concluido ? 'Nada pendente.' : 'Nada pendente neste momento.'}</p>`}</div>
        <div class="card"><h3>Linha do tempo</h3><ol class="tempo">${tempo}</ol></div>
        <div class="card"><h3>Datas</h3>${datas.length ? `<div class="datas">${datas.join('')}</div>` : '<p class="mut" style="margin:0">Nenhuma data registrada ainda.</p>'}</div>
        <div class="card"><h3>Documentos</h3>${p.documentos.length ? p.documentos.map(linhaDoc).join('') : '<p class="mut" style="margin:0">Nenhum documento disponibilizado para este processo.</p>'}</div>
        <div class="card"><h3>Histórico</h3>${p.historico.length ? `<ul class="lista">${p.historico.map((h) => `<li><div class="peq mut">${esc(dh(h.em))}${h.da_equipe ? ' · mensagem da equipe' : ''}</div>${esc(h.texto)}</li>`).join('')}</ul>` : '<p class="mut" style="margin:0">Sem atualizações ainda.</p>'}</div>
        <a class="bt ouro largo" href="#/nova-duvida/${p.id}">Tenho uma dúvida sobre este processo</a>`;
    },

    /* ════════════ Dúvidas ════════════ */
    async duvidas() {
      const r = await api('GET', '/api/cliente/duvidas');
      E.horario = r.horario;
      const COR = { enviada: 'at', em_atendimento: 'in', respondida: 'ok', encerrada: 'nt' };
      return `${linhaEstado()}<h1>Dúvidas</h1>
        <p class="mut">Use este espaço para esclarecimentos com a equipe. As mensagens não mudam o andamento do processo.${r.horario ? ` Horário de atendimento: ${esc(r.horario)}.` : ''}</p>
        <a class="bt p largo" href="#/nova-duvida/geral" style="margin-bottom:16px">Nova dúvida</a>
        ${r.duvidas.length ? r.duvidas.map((d) => `<a class="card" href="#/duvida/${d.id}" style="display:block;text-decoration:none;color:inherit">
          <div class="ref">${esc(d.processo)}</div><h3 style="margin:.2em 0">${d.nao_lida ? '● ' : ''}${esc(d.assunto)}</h3>
          ${et(COR[d.situacao], d.situacao_rotulo)} ${d.nao_lida ? et('in', 'Resposta nova') : ''}
          <div class="peq mut" style="margin-top:6px">Atualizada em ${esc(dh(d.atualizado_em))}</div></a>`).join('')
          : '<div class="card vazio-c"><strong>Nenhuma dúvida enviada</strong>Quando precisar, toque em "Nova dúvida".</div>'}`;
    },

    async 'nova-duvida'(arg) {
      const r = await api('GET', '/api/cliente/duvidas');
      E.horario = r.horario;
      const pid = arg && arg !== 'geral' ? Number(arg) : '';
      const rs = E.rascunho.nova || (E.rascunho.nova = { chave: uuid(), categoria: 'Andamento', assunto: '', texto: '', processo_id: pid });
      if (pid && !rs.texto) rs.processo_id = pid;
      return `<a class="voltar" href="#/duvidas">← Dúvidas</a><div class="card"><h2>Nova dúvida</h2>
        <form class="form" id="f-duvida">
          <div class="campo"><label for="d-proc">Sobre</label><select id="d-proc"><option value="">Dúvida geral</option>
            ${r.processos.map((p) => `<option value="${p.id}"${Number(rs.processo_id) === p.id ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
          <div class="campo"><span style="font-weight:600;font-size:15px;color:var(--ink-2)">Assunto sugerido</span><div class="chips" id="d-cat">
            ${r.categorias.map((c) => `<button type="button" data-cat="${esc(c)}" class="${rs.categoria === c ? 'on' : ''}" aria-pressed="${rs.categoria === c}">${esc(c)}</button>`).join('')}</div></div>
          <div class="campo"><label for="d-assunto">Assunto</label><input id="d-assunto" maxlength="120" value="${esc(rs.assunto)}" placeholder="Em poucas palavras"></div>
          <div class="campo"><label for="d-texto">Mensagem</label><textarea id="d-texto" maxlength="4000">${esc(rs.texto)}</textarea></div>
          <div class="faixa ng oculto" id="erro" role="alert"></div>
          <button class="bt p largo" type="submit">Enviar dúvida</button>
          ${r.horario ? `<p class="peq mut">A equipe responde no horário de atendimento: ${esc(r.horario)}.</p>` : '<p class="peq mut">A equipe responde assim que possível, no horário de atendimento.</p>'}
        </form></div>`;
    },

    async duvida(id) {
      const d = await api('GET', `/api/cliente/duvidas/${Number(id)}`);
      const rs = E.rascunho[`d${d.id}`] || (E.rascunho[`d${d.id}`] = { chave: uuid(), texto: '', falhou: false });
      const COR = { enviada: 'at', em_atendimento: 'in', respondida: 'ok', encerrada: 'nt' };
      return `<a class="voltar" href="#/duvidas">← Dúvidas</a>${linhaEstado()}<div class="card"><div class="ref">${esc(d.processo)} · ${esc(d.categoria || '')}</div>
        <h2>${esc(d.assunto)}</h2>${et(COR[d.situacao], d.situacao_rotulo)}
        <div class="conversa">${d.mensagens.map((m) => `<div class="balao ${m.autor}"><div class="q">${esc(m.autor_nome)} · ${esc(dh(m.criado_em))}${m.autor === 'cliente' ? ' · enviada' : ''}</div><div class="t">${esc(m.texto)}</div></div>`).join('')}</div>
        ${d.situacao === 'encerrada' ? '<div class="faixa in">Conversa encerrada. Se a dúvida voltou, escreva abaixo para reabrir.</div>' : ''}
        <form class="form" id="f-msg" data-duvida="${d.id}">
          <div class="campo"><label for="m-texto">${d.situacao === 'encerrada' ? 'Reabrir com uma nova mensagem' : 'Responder'}</label><textarea id="m-texto" maxlength="4000">${esc(rs.texto)}</textarea></div>
          <div class="faixa ng${rs.falhou ? '' : ' oculto'}" id="erro" role="alert">${rs.falhou ? 'A mensagem não foi enviada. O texto foi guardado: toque em Enviar para tentar de novo.' : ''}</div>
          <button class="bt p largo" type="submit">Enviar</button>
          ${d.situacao !== 'encerrada' ? '<button class="bt largo" type="button" data-acao="encerrar" data-id="' + d.id + '">Minha dúvida foi resolvida</button>' : ''}
          ${d.horario ? `<p class="peq mut">Horário de atendimento: ${esc(d.horario)}. A resposta não é imediata.</p>` : ''}
        </form></div>`;
    },

    /* ════════════ Perfil ════════════ */
    async perfil() {
      const p = await api('GET', '/api/cliente/perfil');
      const pend = (campo) => p.pedidos.find((x) => x.campo === campo);
      const NOMES = { atualizacao: 'Nova atualização do processo', resposta: 'Resposta a uma dúvida', documento: 'Novo documento disponibilizado', agenda: 'Agendamento ou lembrete da equipe' };
      return `<h1>Perfil</h1>
        <div class="card"><h3>Meus dados</h3><div class="datas">
          <div><div class="r">Nome</div><div class="v">${esc(p.nome)}</div></div>
          <div><div class="r">WhatsApp</div><div class="v">${esc(p.whatsapp)}</div>${pend('whatsapp') ? `<div class="peq">Alteração para ${esc(pend('whatsapp').valor)} aguardando confirmação da equipe</div>` : ''}</div>
          <div><div class="r">E-mail de acesso</div><div class="v">${esc(p.email)}</div>${pend('email') ? `<div class="peq">Alteração para ${esc(pend('email').valor)} aguardando confirmação da equipe</div>` : ''}</div>
          ${p.cidade ? `<div><div class="r">Cidade</div><div class="v">${esc(p.cidade)}</div></div>` : ''}
          ${p.nacionalidade ? `<div><div class="r">Nacionalidade</div><div class="v">${esc(p.nacionalidade)}</div></div>` : ''}
        </div><p class="peq mut">Para corrigir outros dados, abra uma dúvida geral.</p></div>
        <div class="card"><h3>Atualizar contato</h3><p class="peq mut">A mudança vale depois que a equipe confirmar com você.</p>
          <form class="form" id="f-contato"><div class="campo"><label for="c-campo">Contato</label><select id="c-campo"><option value="whatsapp">WhatsApp</option><option value="email">E-mail de acesso</option></select></div>
          <div class="campo"><label for="c-valor">Novo contato</label><input id="c-valor" placeholder="WhatsApp com código do país, ex.: +55 45 99999-0000"></div>
          <button class="bt largo" type="submit">Pedir alteração</button></form></div>
        <div class="card"><h3>Avisos</h3>
          ${Object.entries(NOMES).map(([k, t]) => `<label class="alternar"><span>${t}</span><input type="checkbox" data-pref="${k}"${p.preferencias[k] ? ' checked' : ''}></label>`).join('')}
          <p class="peq mut" style="margin-top:10px">Os avisos aparecem aqui, no aplicativo. E-mail: <strong>${p.canais.email ? 'ativo' : 'não disponível no momento'}</strong>. Notificação no celular: <strong>${p.canais.push ? 'ativa' : 'não disponível no momento'}</strong>.</p></div>
        <div class="card"><h3>Alterar senha</h3><form class="form" id="f-senha2">
          <div class="campo"><label for="p-atual">Senha atual</label><input id="p-atual" type="password" autocomplete="current-password" required></div>
          <div class="campo"><label for="p-nova">Nova senha</label><input id="p-nova" type="password" autocomplete="new-password" minlength="10" required><span class="ajuda">Pelo menos 10 caracteres.</span></div>
          <button class="bt largo" type="submit">Alterar senha</button></form></div>
        <button class="bt largo" data-acao="sair">Sair</button>`;
    },

    async avisos() {
      const r = await api('GET', '/api/cliente/avisos');
      if (r.avisos.some((a) => !a.lida)) api('POST', '/api/cliente/avisos/lidos').then(() => { E.avisos = 0; contadores(); }).catch(() => {});
      return `${linhaEstado()}<h1>Avisos</h1>${r.avisos.length ? `<div class="card"><ul class="lista">${r.avisos.map((a) =>
        `<li>${a.lida ? '' : et('in', 'Novo') + ' '}<a href="${esc(a.link || '#/processos')}">${esc(a.titulo)}</a><div class="peq mut">${esc(dh(a.criado_em))}</div></li>`).join('')}</ul></div>`
        : '<div class="card vazio-c"><strong>Nenhum aviso</strong>Atualizações, respostas e documentos novos aparecem aqui.</div>'}`;
    },
  };

  /* ── rascunhos: o texto nunca se perde numa atualização automática ou falha de envio ── */
  function restaurarRascunho() {
    const f = document.getElementById('f-msg');
    if (f && document.activeElement?.id === 'm-texto') return;
  }
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.id === 'm-texto') { const f = t.closest('form'); E.rascunho[`d${f.dataset.duvida}`].texto = t.value; }
    if (t.id === 'd-assunto') E.rascunho.nova.assunto = t.value;
    if (t.id === 'd-texto') E.rascunho.nova.texto = t.value;
  });
  document.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (t.id === 'd-proc') E.rascunho.nova.processo_id = t.value;
    if (t.dataset.pref) {
      const prefs = Object.fromEntries([...document.querySelectorAll('[data-pref]')].map((i) => [i.dataset.pref, i.checked]));
      try { await api('PUT', '/api/cliente/perfil/preferencias', prefs); torrada('Preferência salva'); } catch (e) { if (!e.silencioso) { torrada(e.message, 'ng'); t.checked = !t.checked; } }
    }
  });

  document.addEventListener('submit', async (ev) => {
    const f = ev.target;
    if (!['f-duvida', 'f-msg', 'f-contato', 'f-senha2'].includes(f.id)) return;
    ev.preventDefault();
    const bt = f.querySelector('button[type=submit]');
    if (E.enviando) return;
    E.enviando = true; bt.disabled = true;
    const textoBt = bt.textContent; bt.textContent = 'Enviando…';
    try {
      if (f.id === 'f-duvida') {
        const rs = E.rascunho.nova;
        if (!rs.assunto.trim() || !rs.texto.trim()) throw new Error('Preencha o assunto e a mensagem.');
        const r = await api('POST', '/api/cliente/duvidas', { chave: rs.chave, processo_id: rs.processo_id || null, categoria: rs.categoria, assunto: rs.assunto, texto: rs.texto });
        delete E.rascunho.nova;
        torrada('Dúvida enviada à equipe');
        location.hash = `#/duvida/${r.id}`;
      } else if (f.id === 'f-msg') {
        const rs = E.rascunho[`d${f.dataset.duvida}`];
        if (!rs.texto.trim()) throw new Error('Escreva a mensagem.');
        try {
          await api('POST', `/api/cliente/duvidas/${f.dataset.duvida}/mensagens`, { chave: rs.chave, texto: rs.texto });
        } catch (e) { rs.falhou = true; throw e; }
        E.rascunho[`d${f.dataset.duvida}`] = { chave: uuid(), texto: '', falhou: false };
        torrada('Mensagem enviada');
        await pintar({ silencioso: true });
      } else if (f.id === 'f-contato') {
        await api('POST', '/api/cliente/perfil/contato', { campo: document.getElementById('c-campo').value, valor: document.getElementById('c-valor').value });
        torrada('Pedido enviado. A equipe vai confirmar a alteração.');
        await pintar({ silencioso: true });
      } else if (f.id === 'f-senha2') {
        await api('POST', '/api/cliente/perfil/senha', { atual: document.getElementById('p-atual').value, nova: document.getElementById('p-nova').value });
        f.reset(); torrada('Senha alterada');
      }
    } catch (e) {
      if (!e.silencioso) {
        const er = f.querySelector('#erro');
        const msg = e.rede ? 'Sem conexão. A mensagem não foi enviada e o texto foi guardado. Toque em Enviar para tentar de novo.' : e.message;
        if (er) { er.textContent = msg; er.classList.remove('oculto'); } else torrada(msg, 'ng');
      }
    } finally { E.enviando = false; if (document.body.contains(bt)) { bt.disabled = false; bt.textContent = textoBt; } }
  });

  document.addEventListener('click', async (ev) => {
    const ir = ev.target.closest('[data-ir]');
    if (ir) { location.hash = ir.dataset.ir; return; }
    const cat = ev.target.closest('[data-cat]');
    if (cat) {
      E.rascunho.nova.categoria = cat.dataset.cat;
      document.querySelectorAll('[data-cat]').forEach((b) => { b.classList.toggle('on', b === cat); b.setAttribute('aria-pressed', b === cat); });
      return;
    }
    const a = ev.target.closest('[data-acao]');
    if (!a) return;
    ev.preventDefault();
    try {
      if (a.dataset.acao === 'recarregar') location.reload();
      if (a.dataset.acao === 'tentar') { a.disabled = true; E.adiada = false; await verificar(true); }
      if (a.dataset.acao === 'encerrar') { await api('POST', `/api/cliente/duvidas/${a.dataset.id}/encerrar`); torrada('Conversa encerrada'); await pintar({ silencioso: true }); }
      if (a.dataset.acao === 'sair') { await api('POST', '/api/cliente/sair'); pararAtualizacao(); E.versao = null; location.hash = '#/entrar'; }
    } catch (e) { if (!e.silencioso) torrada(e.message, 'ng'); }
  });

  async function iniciar() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(R('/sw.js')).catch(() => {});
    let est;
    try { est = await api('GET', '/api/cliente/estado'); } catch (e) {
      raiz.innerHTML = `<div class="ac-main"><div class="cont"><div class="faixa ng">${esc(e.message)}<br><button class="bt s" data-acao="recarregar">Tentar de novo</button></div></div></div>`;
      return;
    }
    E.demo = !!est.demo; E.horario = est.horario; E.nome = est.nome;
    const rota = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (PUBLICAS.includes(rota) && rota !== 'entrar') return pintar();
    if (!est.logado) { if (location.hash !== '#/entrar') location.hash = '#/entrar'; else pintar(); return; }
    if (!location.hash || rota === 'entrar') history.replaceState(null, '', R('/cliente/#/processos'));
    await verificar(false);
    await pintar();
    iniciarAtualizacao();
  }
  iniciar();
})();
