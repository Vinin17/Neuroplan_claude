/* =========================================================
   NEUROPLAN · script.js
   Todas as páginas carregam este arquivo. Cada bloco "iniciar..."
   só roda se encontrar os elementos da sua própria tela.

   COMO TUDO SE CONECTA
   - Existe UMA lista de tarefas (localStorage). Hoje, Rotina e Usuário
     leem a mesma lista.
   - Nova tarefa cria/edita/exclui nessa lista.
   - Cuidados muda o comportamento das telas (veja "CUIDADOS" abaixo).
   - Usuário calcula as estatísticas a partir das tarefas concluídas.
   Os dados ficam só neste aparelho (localStorage).
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Configuração ---------- */
  // true  = na primeira vez, o app já vem com tarefas de exemplo (como no Figma)
  // false = o app começa vazio
  const SEMEAR_EXEMPLOS = true;

  const CHAVES = {
    tarefas: "neuroplan:tarefas",
    concluidas: "neuroplan:concluidas", // lista de "idDaTarefa|AAAA-MM-DD"
    cuidados: "neuroplan:cuidados",
    perfil: "neuroplan:perfil",
    aviso: "neuroplan:aviso",           // mensagem para a próxima página
  };

  const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const DIAS_CURTOS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const CATEGORIAS = { aula: "Aula", afazeres: "Afazeres", saude: "Saúde", lazer: "Lazer" };

  const ICONE_RELOGIO = '<svg class="icone icone--mini" aria-hidden="true"><use href="#i-clock"/></svg>';
  const ICONE_LAPIS = '<svg class="icone" aria-hidden="true"><use href="#i-pencil"/></svg>';


  /* =========================================================
     UTILITÁRIOS
     ========================================================= */
  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => Array.from(raiz.querySelectorAll(seletor));

  function ler(chave, padrao) {
    try {
      const valor = localStorage.getItem(chave);
      return valor === null ? padrao : JSON.parse(valor);
    } catch (erro) {
      return padrao;
    }
  }

  function guardar(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch (erro) {
      /* sem armazenamento: o app funciona, só não lembra */
    }
  }

  function plural(n, singular, pluralTxt) {
    return n === 1 ? singular : pluralTxt;
  }

  /* ----- Datas (sempre no formato AAAA-MM-DD, no fuso do aparelho) ----- */
  const doisDigitos = (n) => String(n).padStart(2, "0");

  function paraISO(data) {
    return data.getFullYear() + "-" + doisDigitos(data.getMonth() + 1) + "-" + doisDigitos(data.getDate());
  }
  function deISO(iso) {
    const [ano, mes, dia] = iso.split("-").map(Number);
    return new Date(ano, mes - 1, dia);
  }
  function somarDias(iso, quantidade) {
    const data = deISO(iso);
    data.setDate(data.getDate() + quantidade);
    return paraISO(data);
  }
  const hojeISO = () => paraISO(new Date());
  const ehISO = (texto) => /^\d{4}-\d{2}-\d{2}$/.test(texto || "");

  /* ----- Horas ("09:30") ----- */
  function minutos(hora) {
    if (!hora) return null;
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
  }
  function horaCurta(hora) {
    if (!hora) return "";
    const [h, m] = hora.split(":");
    return Number(h) + ":" + m;
  }
  function duracao(tarefa) {
    const inicio = minutos(tarefa.inicio);
    const fim = minutos(tarefa.fim);
    return inicio !== null && fim !== null ? fim - inicio : 0;
  }

  /* ----- Avisos rápidos ----- */
  function mostrarAviso(texto) {
    const el = document.createElement("div");
    el.className = "aviso";
    el.setAttribute("role", "status");
    el.textContent = texto;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-visivel"));
    setTimeout(() => {
      el.classList.remove("is-visivel");
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }
  function avisarNaProximaPagina(texto) {
    try { sessionStorage.setItem(CHAVES.aviso, texto); } catch (erro) { /* ignora */ }
  }
  function mostrarAvisoPendente() {
    try {
      const texto = sessionStorage.getItem(CHAVES.aviso);
      if (texto) {
        sessionStorage.removeItem(CHAVES.aviso);
        mostrarAviso(texto);
      }
    } catch (erro) { /* ignora */ }
  }


  /* =========================================================
     DADOS: tarefas, conclusões e cuidados
     Tarefa = { id, nome, categoria, inicio, fim, avisar, descricao,
                data (AAAA-MM-DD), repetir (toda semana), importante }
     ========================================================= */
  function normalizar(t) {
    return {
      id: t.id || "t" + Date.now() + Math.random().toString(36).slice(2, 6),
      nome: String(t.nome || "Tarefa"),
      categoria: CATEGORIAS[t.categoria] ? t.categoria : "aula",
      inicio: t.inicio || "",
      fim: t.fim || "",
      avisar: t.avisar !== false,
      descricao: t.descricao || "",
      data: ehISO(t.data) ? t.data : hojeISO(),
      repetir: Boolean(t.repetir),
      importante: Boolean(t.importante),
    };
  }

  function exemplos() {
    const hoje = hojeISO();
    const amanha = somarDias(hoje, 1);
    return [
      { id: "ex1", nome: "Revisar biologia", categoria: "aula", inicio: "09:00", fim: "10:00", data: hoje, repetir: true, importante: true },
      { id: "ex2", nome: "Arrumar o quarto", categoria: "afazeres", inicio: "11:00", fim: "11:30", data: hoje },
      { id: "ex3", nome: "Academia", categoria: "saude", inicio: "16:00", fim: "17:00", data: hoje },
      { id: "ex4", nome: "Revisar Matemática", categoria: "aula", inicio: "19:00", fim: "20:00", data: hoje, repetir: true },
      { id: "ex5", nome: "Entregar trabalho de história", categoria: "aula", inicio: "10:00", fim: "10:30", data: amanha },
    ];
  }

  function carregarTarefas() {
    let lista = ler(CHAVES.tarefas, null);
    if (lista === null) {
      lista = SEMEAR_EXEMPLOS ? exemplos() : [];
      guardar(CHAVES.tarefas, lista);
    }
    const precisaSalvar = lista.some((t) => !ehISO(t.data));
    const normalizadas = lista.map(normalizar);
    if (precisaSalvar) guardar(CHAVES.tarefas, normalizadas);
    return normalizadas;
  }

  function salvarTarefas(lista) {
    guardar(CHAVES.tarefas, lista);
  }

  // A tarefa acontece neste dia? (no próprio dia, ou toda semana se repetir)
  function ocorreEm(tarefa, iso) {
    if (tarefa.data === iso) return true;
    return tarefa.repetir && iso > tarefa.data && deISO(iso).getDay() === deISO(tarefa.data).getDay();
  }

  function ordenar(a, b, prioridade) {
    if (prioridade && a.importante !== b.importante) return a.importante ? -1 : 1;
    const ma = minutos(a.inicio);
    const mb = minutos(b.inicio);
    const va = ma === null ? 1e9 : ma;
    const vb = mb === null ? 1e9 : mb;
    return va - vb || a.nome.localeCompare(b.nome, "pt-BR");
  }

  function tarefasDoDia(iso, todas, prioridade) {
    return todas.filter((t) => ocorreEm(t, iso)).sort((a, b) => ordenar(a, b, prioridade));
  }

  /* ----- Conclusões: uma por tarefa E por dia (tarefas semanais) ----- */
  const chaveConclusao = (tarefa, iso) => tarefa.id + "|" + iso;
  const carregarConcluidas = () => new Set(ler(CHAVES.concluidas, []));
  const salvarConcluidas = (conjunto) => guardar(CHAVES.concluidas, Array.from(conjunto));

  /* ----- Cuidados ----- */
  const carregarCuidados = () => ler(CHAVES.cuidados, {});


  /* =========================================================
     ITEM DE TAREFA (usado em Hoje e em Rotina)
     ========================================================= */
  function criarItemTarefa(tarefa, iso, concluidas, cuidados, opcoes) {
    const mostrarData = Boolean(opcoes && opcoes.mostrarData);
    const destaque = Boolean(cuidados.prioridade && tarefa.importante);

    const li = document.createElement("li");
    li.className = "tarefa tarefa--" + tarefa.categoria + (destaque ? " tarefa--importante" : "");
    li.dataset.id = tarefa.id;
    li.dataset.data = iso;

    const rotulo = document.createElement("label");
    rotulo.className = "tarefa__principal";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "tarefa__check";
    check.checked = concluidas.has(chaveConclusao(tarefa, iso));

    const texto = document.createElement("span");
    texto.className = "tarefa__texto";

    const titulo = document.createElement("span");
    titulo.className = "tarefa__titulo";
    titulo.textContent = tarefa.nome;

    // Linha de informações (hora • categoria • ...)
    const partes = [];
    if (mostrarData) {
      const d = deISO(iso);
      partes.push(DIAS_CURTOS[d.getDay()].slice(0, 3) + ", " + d.getDate());
    }
    partes.push(horaCurta(tarefa.inicio) || "Sem hora");
    partes.push(CATEGORIAS[tarefa.categoria]);

    const minutosTotais = duracao(tarefa);
    if (cuidados["sessoes-curtas"] && minutosTotais > 25) {
      partes.push(Math.ceil(minutosTotais / 25) + " sessões de 25 min");
    }
    if (cuidados.pausas && minutosTotais > 45) {
      partes.push("pausa a cada 45 min");
    }
    if (destaque) partes.push("Importante");
    if (tarefa.repetir) partes.push("Toda semana");

    const meta = document.createElement("span");
    meta.className = "tarefa__meta";
    meta.insertAdjacentHTML("beforeend", ICONE_RELOGIO);
    partes.forEach((parte, i) => {
      if (i > 0) {
        const ponto = document.createElement("span");
        ponto.setAttribute("aria-hidden", "true");
        ponto.textContent = "•";
        meta.appendChild(ponto);
      }
      const span = document.createElement("span");
      span.textContent = parte;
      meta.appendChild(span);
    });

    texto.append(titulo, meta);
    rotulo.append(check, texto);

    const editar = document.createElement("a");
    editar.className = "tarefa__editar";
    editar.href = "nova-tarefa.html?editar=" + encodeURIComponent(tarefa.id);
    editar.setAttribute("aria-label", "Editar " + tarefa.nome);
    editar.insertAdjacentHTML("beforeend", ICONE_LAPIS);

    li.append(rotulo, editar);
    return li;
  }

  // Marcar/desmarcar uma tarefa: grava e avisa a tela para se redesenhar
  function ligarChecks(lista, aoMudar) {
    lista.addEventListener("change", (evento) => {
      if (!evento.target.classList.contains("tarefa__check")) return;
      const li = evento.target.closest(".tarefa");
      const chave = li.dataset.id + "|" + li.dataset.data;
      const conjunto = carregarConcluidas();
      if (evento.target.checked) conjunto.add(chave); else conjunto.delete(chave);
      salvarConcluidas(conjunto);
      if (aoMudar) aoMudar(li.dataset.id, li.dataset.data);
    });
  }

  function devolverFoco(id, iso) {
    const alvo = $('.tarefa[data-id="' + id + '"][data-data="' + iso + '"] .tarefa__check');
    if (alvo) alvo.focus();
  }


  /* =========================================================
     TODAS AS PÁGINAS: cuidados ativos e inicial do avatar
     ========================================================= */
  function aplicarCuidados() {
    document.body.classList.toggle("modo-calmo", Boolean(carregarCuidados()["modo-calmo"]));
  }

  function atualizarAvatares() {
    const perfil = ler(CHAVES.perfil, null);
    const nome = perfil && perfil.nome ? perfil.nome.trim() : "";
    if (!nome) return;
    const inicial = nome.charAt(0).toUpperCase();
    $$(".avatar").forEach((el) => { el.textContent = inicial; });
  }


  /* =========================================================
     ABERTURA (index.html): símbolo -> logo completo -> Hoje
     ========================================================= */
  function iniciarAbertura() {
    const etapa1 = $("#abertura-1");
    const etapa2 = $("#abertura-2");
    if (!etapa1 || !etapa2) return;

    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const irParaHoje = () => window.location.replace("hoje.html");

    setTimeout(() => {
      etapa1.classList.remove("is-ativa");
      etapa2.classList.add("is-ativa");
    }, reduzir ? 500 : 1400);

    setTimeout(irParaHoje, reduzir ? 1200 : 2800);
    document.addEventListener("click", irParaHoje); // tocar pula a abertura
  }


  /* =========================================================
     HOJE (hoje.html)
     ========================================================= */
  function iniciarHoje() {
    const listaHoje = $("#lista-hoje");
    if (!listaHoje) return;

    const listaRecuperar = $("#lista-recuperacao");
    const blocoRecuperar = $("#bloco-recuperacao");
    const semana = $("#semana");
    const apoio = $(".titulo-tela__apoio");
    const faixaProxima = $("#proxima");
    const iso = hojeISO();

    // Data de hoje no título
    const agora = new Date();
    $("#hoje-titulo").textContent = DIAS[agora.getDay()] + ", " + agora.getDate() + " de " + MESES[agora.getMonth()];

    function desenhar() {
      const todas = carregarTarefas();
      const concluidas = carregarConcluidas();
      const cuidados = carregarCuidados();
      const prioridade = Boolean(cuidados.prioridade);

      // 1) Tarefas de hoje
      const doDia = tarefasDoDia(iso, todas, prioridade);
      listaHoje.textContent = "";
      doDia.forEach((t) => listaHoje.appendChild(criarItemTarefa(t, iso, concluidas, cuidados)));
      $("#vazio-hoje").hidden = doDia.length > 0;

      const feitas = doDia.filter((t) => concluidas.has(chaveConclusao(t, iso))).length;
      if (doDia.length === 0) {
        apoio.textContent = "Dia livre. Aproveite para descansar ou planejar algo.";
      } else if (feitas === doDia.length) {
        apoio.textContent = "Tudo feito por hoje. Você merece uma pausa.";
      } else {
        apoio.textContent = "Você tem " + doDia.length + " " + plural(doDia.length, "tarefa planejada", "tarefas planejadas") + ". Comece pela mais leve.";
      }

      // 2) Cuidado "Recuperação": pendências dos últimos 7 dias
      listaRecuperar.textContent = "";
      let pendentes = 0;
      if (cuidados.recuperacao) {
        for (let i = 1; i <= 7; i++) {
          const dia = somarDias(iso, -i);
          tarefasDoDia(dia, todas, prioridade).forEach((t) => {
            if (concluidas.has(chaveConclusao(t, dia))) return;
            listaRecuperar.appendChild(criarItemTarefa(t, dia, concluidas, cuidados, { mostrarData: true }));
            pendentes++;
          });
        }
      }
      blocoRecuperar.hidden = pendentes === 0;

      // 3) Próximos 7 dias (cada cartão leva para a Rotina daquele dia)
      semana.textContent = "";
      for (let i = 0; i < 7; i++) {
        const dia = somarDias(iso, i);
        const tarefasDia = tarefasDoDia(dia, todas, prioridade);
        const feitasDia = tarefasDia.filter((t) => concluidas.has(chaveConclusao(t, dia))).length;

        const item = document.createElement("li");
        item.className = "semana__item";

        const cartao = document.createElement("a");
        cartao.className = "semana__dia" + (i === 0 ? " is-hoje" : "");
        cartao.href = "rotina.html?data=" + dia;

        const nome = document.createElement("h3");
        nome.className = "semana__nome";
        nome.textContent = DIAS_CURTOS[deISO(dia).getDay()];

        const qtd = document.createElement("p");
        qtd.className = "semana__qtd";
        qtd.textContent = tarefasDia.length + " " + plural(tarefasDia.length, "tarefa", "tarefas");

        const bolinhas = document.createElement("div");
        bolinhas.className = "semana__bolinhas";
        bolinhas.setAttribute("aria-label", feitasDia + " de " + tarefasDia.length + " " + plural(tarefasDia.length, "tarefa concluída", "tarefas concluídas"));
        tarefasDia.slice(0, 8).forEach((t, n) => {
          const b = document.createElement("span");
          b.className = "bolinha" + (concluidas.has(chaveConclusao(t, dia)) ? " is-feita" : "");
          bolinhas.appendChild(b);
        });

        cartao.append(nome, qtd, bolinhas);
        item.appendChild(cartao);
        semana.appendChild(item);
      }

      atualizarProxima(doDia, concluidas, cuidados);
    }

    // Cuidado "Previsibilidade": avisa a próxima tarefa e quanto falta
    function atualizarProxima(doDia, concluidas, cuidados) {
      if (!cuidados.previsibilidade) {
        faixaProxima.hidden = true;
        return;
      }
      const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
      const proxima = doDia.find((t) => {
        const inicio = minutos(t.inicio);
        return inicio !== null && inicio >= agoraMin && !concluidas.has(chaveConclusao(t, iso));
      });
      if (!proxima) {
        faixaProxima.hidden = true;
        return;
      }
      const falta = minutos(proxima.inicio) - agoraMin;
      let quando = "agora";
      if (falta > 0) {
        quando = "em " + (falta >= 60 ? Math.floor(falta / 60) + " h" + (falta % 60 ? " " + (falta % 60) + " min" : "") : falta + " min");
      }
      faixaProxima.textContent = "Próxima: " + proxima.nome + " às " + horaCurta(proxima.inicio) + " (" + quando + ")";
      faixaProxima.hidden = false;
    }

    const aoMudar = (id, dia) => { desenhar(); devolverFoco(id, dia); };
    ligarChecks(listaHoje, aoMudar);
    ligarChecks(listaRecuperar, aoMudar);

    desenhar();
    setInterval(desenhar, 60000); // mantém o "em X min" e a data atualizados
    mostrarAvisoPendente();
  }


  /* =========================================================
     NOVA TAREFA (nova-tarefa.html): criar, editar e excluir
     ========================================================= */
  function iniciarNovaTarefa() {
    const form = $("#form-tarefa");
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    const todas = carregarTarefas();
    const existente = todas.find((t) => t.id === params.get("editar")) || null;

    const campoNome = $("#tarefa-nome");
    const campoInicio = $("#hora-inicio");
    const campoFim = $("#hora-fim");
    const campoData = $("#tarefa-data");
    const textoData = $("#data-texto");

    function rotuloData(iso) {
      if (iso === hojeISO()) return "Hoje";
      if (iso === somarDias(hojeISO(), 1)) return "Amanhã";
      const d = deISO(iso);
      return DIAS_CURTOS[d.getDay()].slice(0, 3) + ", " + d.getDate() + "/" + doisDigitos(d.getMonth() + 1);
    }

    // Data inicial: a da tarefa editada, a da URL (?data=) ou hoje
    const dataInicial = existente ? existente.data : (ehISO(params.get("data")) ? params.get("data") : hojeISO());
    campoData.value = dataInicial;
    textoData.textContent = rotuloData(dataInicial);
    campoData.addEventListener("change", () => {
      if (!campoData.value) campoData.value = hojeISO();
      textoData.textContent = rotuloData(campoData.value);
    });

    // Modo edição: preenche o formulário com a tarefa
    if (existente) {
      campoNome.value = existente.nome;
      form.elements.categoria.value = existente.categoria;
      campoInicio.value = existente.inicio;
      campoFim.value = existente.fim;
      form.elements.aviso.checked = existente.avisar;
      form.elements.repetir.checked = existente.repetir;
      form.elements.importante.checked = existente.importante;
      form.elements.descricao.value = existente.descricao;

      $("#nova-rotulo").textContent = "Editar";
      $("#nova-titulo").textContent = "Editar tarefa";
      $("#btn-salvar").textContent = "Salvar alterações";
      $("#btn-excluir").hidden = false;
      document.title = "Editar tarefa · NeuroPlan";
    }

    // Depois de salvar/excluir: hoje -> Hoje; outro dia -> Rotina naquele dia
    const destinoApos = (iso) => (iso === hojeISO() ? "hoje.html" : "rotina.html?data=" + iso);

    function limparErros() {
      $$(".campo__erro", form).forEach((el) => el.remove());
      $$("[aria-invalid]", form).forEach((el) => {
        el.removeAttribute("aria-invalid");
        el.removeAttribute("aria-describedby");
      });
    }

    function mostrarErro(campo, mensagem, idErro) {
      const erro = document.createElement("p");
      erro.className = "campo__erro";
      erro.id = idErro;
      erro.setAttribute("role", "alert");
      erro.textContent = mensagem;
      (campo.closest(".campo") || campo.parentElement).appendChild(erro);
      campo.setAttribute("aria-invalid", "true");
      campo.setAttribute("aria-describedby", idErro);
    }

    form.addEventListener("submit", (evento) => {
      evento.preventDefault();
      limparErros();

      const nome = campoNome.value.trim();
      let primeiroErro = null;

      if (!nome) {
        mostrarErro(campoNome, "Dê um nome para a tarefa.", "erro-nome");
        primeiroErro = campoNome;
      }
      if (campoInicio.value && campoFim.value && campoFim.value <= campoInicio.value) {
        mostrarErro(campoFim, "O horário final precisa ser depois do inicial.", "erro-horario");
        primeiroErro = primeiroErro || campoFim;
      }
      if (primeiroErro) {
        primeiroErro.focus();
        return;
      }

      const tarefa = normalizar({
        id: existente ? existente.id : undefined,
        nome: nome,
        categoria: form.elements.categoria.value,
        inicio: campoInicio.value,
        fim: campoFim.value,
        avisar: form.elements.aviso.checked,
        descricao: form.elements.descricao.value.trim(),
        data: campoData.value,
        repetir: form.elements.repetir.checked,
        importante: form.elements.importante.checked,
      });

      const lista = existente
        ? todas.map((t) => (t.id === existente.id ? tarefa : t))
        : todas.concat(tarefa);
      salvarTarefas(lista);

      avisarNaProximaPagina(existente ? "Alterações salvas" : "Tarefa salva");
      window.location.href = destinoApos(tarefa.data);
    });

    $("#btn-excluir").addEventListener("click", () => {
      if (!existente) return;
      if (!window.confirm('Excluir "' + existente.nome + '"?' + (existente.repetir ? "\nIsso remove todas as repetições semanais." : ""))) return;
      salvarTarefas(todas.filter((t) => t.id !== existente.id));
      avisarNaProximaPagina("Tarefa excluída");
      window.location.href = destinoApos(existente.data);
    });

    campoNome.addEventListener("input", limparErros);
  }


  /* =========================================================
     ROTINA (rotina.html): calendário + resumo + tarefas do dia
     ========================================================= */
  function iniciarRotina() {
    const grade = $("#cal-grade");
    const selMes = $("#cal-mes");
    const selAno = $("#cal-ano");
    if (!grade || !selMes || !selAno) return;

    const hojeData = new Date();
    const params = new URLSearchParams(window.location.search);
    let dataSel = ehISO(params.get("data")) ? params.get("data") : hojeISO();

    // Anos disponíveis: do ano passado até daqui a 2 anos (e o da data aberta)
    const anoSel = deISO(dataSel).getFullYear();
    const primeiroAno = Math.min(hojeData.getFullYear() - 1, anoSel);
    const ultimoAno = Math.max(hojeData.getFullYear() + 2, anoSel);
    selAno.textContent = "";
    for (let ano = primeiroAno; ano <= ultimoAno; ano++) selAno.add(new Option(ano, ano));

    const listaDia = $("#dia-tarefas");
    const resumo = $("#resumo-semana");
    const botaoAdicionar = $(".menu__adicionar");

    function desenhar() {
      const todas = carregarTarefas();
      const concluidas = carregarConcluidas();
      const cuidados = carregarCuidados();
      const prioridade = Boolean(cuidados.prioridade);

      const sel = deISO(dataSel);
      selMes.value = String(sel.getMonth());
      selAno.value = String(sel.getFullYear());

      desenharCalendario(todas, prioridade, sel);
      desenharDetalhe(todas, concluidas, cuidados, prioridade, sel);
      desenharResumo(todas, prioridade, sel);

      // O botão "+" já abre a Nova tarefa neste dia
      if (botaoAdicionar) botaoAdicionar.href = "nova-tarefa.html?data=" + dataSel;
    }

    function desenharCalendario(todas, prioridade, sel) {
      const mes = sel.getMonth();
      const ano = sel.getFullYear();
      const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
      const totalDias = new Date(ano, mes + 1, 0).getDate();

      $$(".calendario__dia", grade).forEach((el) => el.remove());

      for (let i = 0; i < primeiroDiaSemana; i++) {
        const vazio = document.createElement("span");
        vazio.className = "calendario__dia is-vazio";
        vazio.setAttribute("aria-hidden", "true");
        grade.appendChild(vazio);
      }

      for (let dia = 1; dia <= totalDias; dia++) {
        const diaISO = ano + "-" + doisDigitos(mes + 1) + "-" + doisDigitos(dia);
        const quantidade = tarefasDoDia(diaISO, todas, prioridade).length;

        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "calendario__dia";
        botao.textContent = dia;
        botao.dataset.data = diaISO;
        if (quantidade > 0) botao.classList.add("is-marcado");
        if (diaISO === hojeISO()) botao.classList.add("is-hoje");
        const selecionado = diaISO === dataSel;
        if (selecionado) botao.classList.add("is-selecionado");
        botao.setAttribute("aria-pressed", String(selecionado));
        botao.setAttribute(
          "aria-label",
          dia + " de " + MESES[mes] + ", " + DIAS[new Date(ano, mes, dia).getDay()] +
            (quantidade ? ", " + quantidade + " " + plural(quantidade, "tarefa", "tarefas") : "")
        );
        grade.appendChild(botao);
      }

      const sobra = (7 - ((primeiroDiaSemana + totalDias) % 7)) % 7;
      for (let i = 1; i <= sobra; i++) {
        const fora = document.createElement("span");
        fora.className = "calendario__dia is-fora";
        fora.setAttribute("aria-hidden", "true");
        fora.textContent = i;
        grade.appendChild(fora);
      }
    }

    function desenharDetalhe(todas, concluidas, cuidados, prioridade, sel) {
      const tarefas = tarefasDoDia(dataSel, todas, prioridade);

      $("#dia-titulo").textContent = "Dia " + sel.getDate() + " • " + DIAS[sel.getDay()];
      $("#dia-qtd").textContent = tarefas.length === 0
        ? "Nenhuma tarefa agendada"
        : tarefas.length + " " + plural(tarefas.length, "tarefa agendada", "tarefas agendadas");
      $("#dia-lista").textContent = tarefas.length === 0
        ? "Dia livre. Toque no + para planejar."
        : tarefas.map((t) => t.nome).join(" • ");

      listaDia.textContent = "";
      tarefas.forEach((t) => listaDia.appendChild(criarItemTarefa(t, dataSel, concluidas, cuidados)));
    }

    // Resumo da semana (domingo a sábado) em que o dia selecionado está
    function desenharResumo(todas, prioridade, sel) {
      const inicioSemana = somarDias(dataSel, -sel.getDay());
      resumo.textContent = "";
      let algum = false;

      for (let i = 0; i < 7; i++) {
        const dia = somarDias(inicioSemana, i);
        const tarefas = tarefasDoDia(dia, todas, prioridade);
        if (tarefas.length === 0) continue;
        algum = true;

        const item = document.createElement("li");
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "resumo-semana__dia" + (dia === dataSel ? " is-selecionado" : "");
        botao.dataset.data = dia;

        const nome = document.createElement("span");
        nome.className = "resumo-semana__nome";
        nome.textContent = DIAS_CURTOS[deISO(dia).getDay()];
        botao.appendChild(nome);

        tarefas.slice(0, 3).forEach((t) => {
          const linha = document.createElement("span");
          linha.className = "resumo-semana__item";
          linha.textContent = t.nome;
          botao.appendChild(linha);
        });
        if (tarefas.length > 3) {
          const mais = document.createElement("span");
          mais.className = "resumo-semana__item";
          mais.textContent = "+" + (tarefas.length - 3) + " " + plural(tarefas.length - 3, "tarefa", "tarefas");
          botao.appendChild(mais);
        }

        item.appendChild(botao);
        resumo.appendChild(item);
      }

      if (!algum) {
        const vazio = document.createElement("li");
        vazio.className = "resumo-semana__vazio";
        vazio.textContent = "Semana livre: nenhuma tarefa agendada.";
        resumo.appendChild(vazio);
      }
    }

    function irParaMes(passo) {
      const sel = deISO(dataSel);
      let mes = sel.getMonth() + passo;
      let ano = sel.getFullYear();
      if (mes < 0) { mes = 11; ano -= 1; }
      if (mes > 11) { mes = 0; ano += 1; }
      if (ano < primeiroAno || ano > ultimoAno) return;
      escolherMes(ano, mes);
    }

    // Ao trocar de mês: seleciona hoje (se for o mês atual) ou o dia 1
    function escolherMes(ano, mes) {
      const ehMesAtual = ano === hojeData.getFullYear() && mes === hojeData.getMonth();
      dataSel = ehMesAtual ? hojeISO() : ano + "-" + doisDigitos(mes + 1) + "-01";
      desenhar();
    }

    grade.addEventListener("click", (evento) => {
      const botao = evento.target.closest("button.calendario__dia");
      if (!botao) return;
      dataSel = botao.dataset.data;
      desenhar();
      const novo = $('.calendario__dia[data-data="' + dataSel + '"]', grade);
      if (novo) novo.focus();
    });

    resumo.addEventListener("click", (evento) => {
      const botao = evento.target.closest("button.resumo-semana__dia");
      if (!botao) return;
      dataSel = botao.dataset.data;
      desenhar();
    });

    $("#cal-anterior").addEventListener("click", () => irParaMes(-1));
    $("#cal-proximo").addEventListener("click", () => irParaMes(1));
    selMes.addEventListener("change", () => escolherMes(Number(selAno.value), Number(selMes.value)));
    selAno.addEventListener("change", () => escolherMes(Number(selAno.value), Number(selMes.value)));

    ligarChecks(listaDia, (id, dia) => { desenhar(); devolverFoco(id, dia); });

    desenhar();
    mostrarAvisoPendente();
  }


  /* =========================================================
     CUIDADOS (cuidados.html)
     Cada interruptor muda o app assim:
       Previsibilidade -> Hoje mostra "Próxima: ... (em X min)"
       Pausas          -> tarefas com +45 min mostram "pausa a cada 45 min"
       Modo Calmo      -> cores suaves e sem animações em todo o app
       Sessões curtas  -> tarefas longas mostram "N sessões de 25 min"
       Recuperação     -> Hoje mostra "Para recuperar" (pendências de 7 dias)
       Prioridade      -> tarefas importantes sobem na lista e ganham destaque
     ========================================================= */
  function iniciarCuidados() {
    const interruptores = $$(".interruptor");
    if (interruptores.length === 0) return;

    const estado = carregarCuidados();
    interruptores.forEach((el) => { el.checked = Boolean(estado[el.name]); });

    interruptores.forEach((el) => {
      el.addEventListener("change", () => {
        estado[el.name] = el.checked;
        guardar(CHAVES.cuidados, estado);
        aplicarCuidados();
      });
    });
  }


  /* =========================================================
     USUÁRIO (usuario.html): perfil + estatísticas reais
     ========================================================= */
  function calcularEstatisticas() {
    const tarefas = carregarTarefas();
    const porId = {};
    tarefas.forEach((t) => { porId[t.id] = t; });
    const concluidas = carregarConcluidas();

    let feitas = 0;
    const diasComConclusao = new Set();
    concluidas.forEach((chave) => {
      const [id, dia] = chave.split("|");
      const tarefa = porId[id];
      if (tarefa && ocorreEm(tarefa, dia)) {
        feitas++;
        diasComConclusao.add(dia);
      }
    });

    // Meta alcançada = dia em que TODAS as tarefas foram concluídas
    let metas = 0;
    diasComConclusao.forEach((dia) => {
      const doDia = tarefas.filter((t) => ocorreEm(t, dia));
      if (doDia.length > 0 && doDia.every((t) => concluidas.has(chaveConclusao(t, dia)))) metas++;
    });

    // Dias seguidos com pelo menos 1 tarefa feita (hoje ainda sem tarefa não quebra a sequência)
    let sequencia = 0;
    let cursor = hojeISO();
    if (!diasComConclusao.has(cursor)) cursor = somarDias(cursor, -1);
    while (diasComConclusao.has(cursor)) {
      sequencia++;
      cursor = somarDias(cursor, -1);
    }

    return { sequencia, feitas, metas };
  }

  function iniciarUsuario() {
    const form = $("#form-perfil");
    const botao = $(".perfil__editar");
    if (!form || !botao) return;

    // Estatísticas
    const estatisticas = calcularEstatisticas();
    $$("[data-estatistica]").forEach((el) => {
      el.textContent = doisDigitos(estatisticas[el.dataset.estatistica] || 0);
    });

    // Perfil
    const campos = {
      nome: $("#perfil-nome"),
      idade: $("#perfil-idade"),
      neuro: $("#perfil-neuro"),
      objetivos: $("#perfil-objetivos"),
    };
    const titulo = $("#usuario-titulo");
    const textoBotao = botao.firstChild; // texto "Editar perfil" (antes do ícone)

    const salvo = ler(CHAVES.perfil, null);
    if (salvo) {
      Object.keys(campos).forEach((chave) => {
        if (typeof salvo[chave] === "string") campos[chave].value = salvo[chave];
      });
    }

    function atualizarNomeNaTela() {
      titulo.textContent = campos.nome.value.trim().split(/\s+/)[0] || "Perfil";
    }
    atualizarNomeNaTela();

    let editando = false;
    botao.addEventListener("click", () => {
      editando = !editando;
      Object.values(campos).forEach((campo) => { campo.readOnly = !editando; });
      form.classList.toggle("is-editando", editando);
      textoBotao.textContent = editando ? " Salvar perfil " : " Editar perfil ";

      if (editando) {
        campos.nome.focus();
        return;
      }

      const dados = {};
      Object.keys(campos).forEach((chave) => { dados[chave] = campos[chave].value.trim(); });
      guardar(CHAVES.perfil, dados);
      atualizarNomeNaTela();
      atualizarAvatares();
      mostrarAviso("Perfil salvo");
    });

    form.addEventListener("submit", (evento) => evento.preventDefault());
  }


  /* ---------- Início ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    aplicarCuidados();
    atualizarAvatares();

    iniciarAbertura();
    iniciarHoje();
    iniciarNovaTarefa();
    iniciarRotina();
    iniciarCuidados();
    iniciarUsuario();
  });
})();
