'use strict';
/* Preenche o site com o que a equipe configurou. Canal não configurado não aparece. */
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (id) => document.getElementById(id);
  /* base do endereço: '/' no servidor local, '/<repositório>/' na demonstração do GitHub Pages */
  const R = (p) => (document.querySelector('meta[name="mdp-base"]')?.content || '/') + String(p).replace(/^\//, '');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(R('/sw.js')).catch(() => {});

  fetch(R('/api/publico/site')).then((r) => (r.ok ? r.json() : Promise.reject(r))).then((s) => {
    if (s.mascote) { const m = $('mascote'); m.src = R(s.mascote); m.classList.remove('oculto'); }

    $('faq').innerHTML = s.faq.length
      ? s.faq.map((f) => `<details><summary>${esc(f.pergunta)}</summary><p>${esc(f.resposta)}</p></details>`).join('')
      : '<p class="mut">Em breve.</p>';

    const c = s.contato;
    const itens = [];
    if (c.whatsapp) itens.push(`<a href="https://wa.me/${esc(c.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener"><div class="r">WhatsApp</div><div class="v">${esc(c.whatsapp)}</div></a>`);
    if (c.telefone) itens.push(`<a href="tel:${esc(c.telefone.replace(/[^\d+]/g, ''))}"><div class="r">Telefone</div><div class="v">${esc(c.telefone)}</div></a>`);
    if (c.email) itens.push(`<a href="mailto:${esc(c.email)}"><div class="r">E-mail</div><div class="v">${esc(c.email)}</div></a>`);
    if (c.endereco) itens.push(`<div><div class="r">Endereço</div><div class="v">${esc(c.endereco)}</div></div>`);
    if (c.instagram) itens.push(`<a href="${esc(c.instagram)}" target="_blank" rel="noopener"><div class="r">Instagram</div><div class="v">O Mestre dos Papéis</div></a>`);
    if (c.youtube) itens.push(`<a href="${esc(c.youtube)}" target="_blank" rel="noopener"><div class="r">YouTube</div><div class="v">O Mestre dos Papéis</div></a>`);
    $('contatos').innerHTML = itens.join('');
    if (!itens.length) {
      $('contatos').classList.add('oculto');
    }
    if (s.horario) $('horario').textContent = `Horário de atendimento: ${s.horario}`;
    const redes = [c.instagram && `<a href="${esc(c.instagram)}" target="_blank" rel="noopener">Instagram</a>`,
      c.youtube && `<a href="${esc(c.youtube)}" target="_blank" rel="noopener">YouTube</a>`].filter(Boolean);
    $('redes').innerHTML = redes.join(' · ');
  }).catch(() => { $('faq').innerHTML = '<p class="mut">Não foi possível carregar agora.</p>'; });
})();
