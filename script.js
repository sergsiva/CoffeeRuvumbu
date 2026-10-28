(function(){
  "use strict";

  /* ---------------------------------------------------------------
     i18n
  --------------------------------------------------------------- */
  var I18N = {};
  function parseCSV(text){
    return text.split(/\r?\n/).filter(function(l){ return l.length; }).map(function(line){
      var cells = [], cur = "", inQuotes = false;
      for (var i = 0; i < line.length; i++){
        var c = line[i];
        if (inQuotes){
          if (c === '"' && line[i+1] === '"'){ cur += '"'; i++; }
          else if (c === '"'){ inQuotes = false; }
          else cur += c;
        } else if (c === '"'){ inQuotes = true; }
        else if (c === ','){ cells.push(cur); cur = ""; }
        else cur += c;
      }
      cells.push(cur);
      return cells;
    });
  }
  function loadI18N(){
    return fetch("localizations.csv").then(function(res){ return res.text(); }).then(function(text){
      var rows = parseCSV(text), langs = rows[0].slice(1);
      langs.forEach(function(l){ I18N[l] = {}; });
      for (var r = 1; r < rows.length; r++){
        var key = rows[r][0];
        langs.forEach(function(l, i){ I18N[l][key] = rows[r][i + 1]; });
      }
    });
  }

  var LANG_KEY = "ruvumbu-lang";
  var currentLang = "en";
  try {
    var saved = localStorage.getItem(LANG_KEY);
    if (saved) currentLang = saved;
  } catch(e){}

  function applyLang(lang){
    if (!I18N[lang]) return;
    currentLang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch(e){}
    document.documentElement.lang = lang;

    var dict = I18N[lang];
    document.querySelectorAll("[data-i18n]").forEach(function(el){
      var key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) el.innerHTML = dict[key];
    });

    var togBtn = document.getElementById("nav-toggle");
    if (togBtn){
      var isOpen = togBtn.getAttribute("aria-expanded") === "true";
      togBtn.textContent = isOpen ? dict["nav.toggleClose"] : dict["nav.toggleOpen"];
    }

    var label = document.getElementById("langBtnLabel");
    if (label) label.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
    document.querySelectorAll("#langMenu button").forEach(function(btn){
      btn.setAttribute("aria-selected", String(btn.getAttribute("data-lang") === lang));
    });
  }

  /* language dropdown */
  var langSwitch = document.getElementById("langSwitch");
  var langBtn = document.getElementById("langBtn");
  var langMenu = document.getElementById("langMenu");
  if (langSwitch && langBtn && langMenu){
    function closeLangMenu(){
      langMenu.hidden = true;
      langSwitch.classList.remove("open");
      langBtn.setAttribute("aria-expanded","false");
    }
    langBtn.addEventListener("click", function(){
      var willOpen = langMenu.hidden;
      langMenu.hidden = !willOpen;
      langSwitch.classList.toggle("open", willOpen);
      langBtn.setAttribute("aria-expanded", String(willOpen));
    });
    langMenu.querySelectorAll("button[data-lang]").forEach(function(btn){
      btn.addEventListener("click", function(){
        applyLang(btn.getAttribute("data-lang"));
        closeLangMenu();
      });
    });
    document.addEventListener("click", function(e){
      if (!langSwitch.contains(e.target)) closeLangMenu();
    });
    document.addEventListener("keydown", function(e){
      if (e.key === "Escape") closeLangMenu();
    });
  }

  loadI18N().then(function(){ applyLang(currentLang); }).catch(function(){ /* localizations.csv unreachable (e.g. file://) — page stays in authored English text */ });

  /* ---------------------------------------------------------------
     fixed nav
  --------------------------------------------------------------- */
  var navEl = document.querySelector(".nav");
  if (navEl){
    var onNavScroll = function(){
      navEl.classList.toggle("is-scrolled", window.scrollY > 40);
    };
    onNavScroll();
    window.addEventListener("scroll", onNavScroll, { passive: true });
  }

  /* ---------------------------------------------------------------
     photo gallery + lightbox
  --------------------------------------------------------------- */
  (function(){
    var thumbs = document.querySelectorAll(".g-photo");
    var photos = Array.prototype.map.call(thumbs, function(el){
      var img = el.querySelector("img");
      return { src: img.src, alt: img.alt };
    });

    var lb = document.getElementById("lightbox"), lbImg = document.getElementById("lbImg"), lbCap = document.getElementById("lbCap");
    var lbPrev = document.getElementById("lbPrev"), lbNext = document.getElementById("lbNext"), lbClose = document.getElementById("lbClose");
    var current = 0, lastFocused = null;

    function show(i){
      current = (i + photos.length) % photos.length;
      var p = photos[current];
      lbImg.src = p.src; lbImg.alt = p.alt; lbCap.textContent = p.alt;
    }
    function open(i){
      lastFocused = document.activeElement;
      show(i);
      lb.hidden = false;
      document.body.style.overflow = "hidden";
      lbClose.focus();
    }
    function close(){
      lb.hidden = true;
      document.body.style.overflow = "";
      if (lastFocused) lastFocused.focus();
    }
    thumbs.forEach(function(el, i){
      el.addEventListener("click", function(){ open(i); });
    });
    lbPrev.addEventListener("click", function(){ show(current - 1); });
    lbNext.addEventListener("click", function(){ show(current + 1); });
    lbClose.addEventListener("click", close);
    lb.addEventListener("click", function(e){ if (e.target === lb) close(); });
    document.addEventListener("keydown", function(e){
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(current - 1);
      if (e.key === "ArrowRight") show(current + 1);
    });
  })();

  /* ---------------------------------------------------------------
     compact navigation
  --------------------------------------------------------------- */
  var tog = document.getElementById("nav-toggle"), panel = document.getElementById("mobile-nav");
  if (tog && panel){
    tog.addEventListener("click", function(){
      var open = tog.getAttribute("aria-expanded") === "true";
      tog.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
      tog.textContent = open ? I18N[currentLang]["nav.toggleOpen"] : I18N[currentLang]["nav.toggleClose"];
    });
    panel.addEventListener("click", function(e){
      if (e.target.tagName === "A"){
        panel.hidden = true;
        tog.setAttribute("aria-expanded","false");
        tog.textContent = I18N[currentLang]["nav.toggleOpen"];
      }
    });
  }

  /* ---------------------------------------------------------------
     reveal on enter + metric count-up
  --------------------------------------------------------------- */
  var items = document.querySelectorAll(".rv, .rv-tilt");
  var nums = document.querySelectorAll(".metric .n");

  function runCount(el){
    var target = parseInt(el.getAttribute("data-count"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    var sep = el.getAttribute("data-sep") === "1";
    var start = performance.now(), dur = 1100;
    function fmt(v){ return sep ? v.toLocaleString("en-US") : String(v); }
    function tick(now){
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(Math.round(target * eased)) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (!("IntersectionObserver" in window)) {
    items.forEach(function(el){ el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function(el){ io.observe(el); });

    var io2 = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (!e.isIntersecting) return;
        runCount(e.target);
        io2.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    nums.forEach(function(el){ io2.observe(el); });
  }

  /* ---------------------------------------------------------------
     video gallery + lightbox
  --------------------------------------------------------------- */
  (function(){
    var vcards = document.querySelectorAll(".v-card");
    if (!vcards.length) return;
    var videos = Array.prototype.map.call(vcards, function(el){
      return {
        src: el.getAttribute("data-video"),
        title: el.getAttribute("data-title") + " (" + el.getAttribute("data-duration") + ")"
      };
    });

    var vlb = document.getElementById("videoLightbox"), vlVideo = document.getElementById("vlVideo"), vlCap = document.getElementById("vlCap");
    var vlPrev = document.getElementById("vlPrev"), vlNext = document.getElementById("vlNext"), vlClose = document.getElementById("vlClose");
    var vCurrent = 0, vLastFocused = null;

    function vShow(i){
      vCurrent = (i + videos.length) % videos.length;
      var v = videos[vCurrent];
      vlVideo.src = v.src;
      vlCap.textContent = v.title;
      vlVideo.play().catch(function(){});
    }
    function vOpen(i){
      vLastFocused = document.activeElement;
      vShow(i);
      vlb.hidden = false;
      document.body.style.overflow = "hidden";
      vlClose.focus();
    }
    function vClose(){
      vlVideo.pause();
      vlVideo.removeAttribute("src");
      vlVideo.load();
      vlb.hidden = true;
      document.body.style.overflow = "";
      if (vLastFocused) vLastFocused.focus();
    }
    vcards.forEach(function(el, i){
      el.addEventListener("click", function(){ vOpen(i); });
    });
    vlPrev.addEventListener("click", function(){ vShow(vCurrent - 1); });
    vlNext.addEventListener("click", function(){ vShow(vCurrent + 1); });
    vlClose.addEventListener("click", vClose);
    vlb.addEventListener("click", function(e){ if (e.target === vlb) vClose(); });
    document.addEventListener("keydown", function(e){
      if (vlb.hidden) return;
      if (e.key === "Escape") vClose();
      if (e.key === "ArrowLeft") vShow(vCurrent - 1);
      if (e.key === "ArrowRight") vShow(vCurrent + 1);
    });
  })();

  /* ---------------------------------------------------------------
     modals: quote / tour / legal
     — открытие через делегирование, чтобы ссылки внутри
       переведённых чекбоксов тоже работали
  --------------------------------------------------------------- */
  (function(){
    var overlays = document.querySelectorAll(".modal-overlay");

    function anyOpen(){
      var open = false;
      overlays.forEach(function(o){ if (!o.hidden) open = true; });
      return open;
    }
    function openModal(id){
      var overlay = document.getElementById(id);
      if (!overlay || !overlay.hidden) return;
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      var closeBtn = overlay.querySelector("[data-close-modal]");
      if (closeBtn) closeBtn.focus();
    }
    function closeModal(overlay){
      if (overlay.hidden) return;
      overlay.hidden = true;
      if (!anyOpen()) document.body.style.overflow = "";
      // вернуть фокус первому подходящему триггеру
      var focusTarget = document.querySelector('[data-open-modal="' + overlay.id.replace(/Modal$/, "") + '"]');
      if (focusTarget && focusTarget.focus) focusTarget.focus();
    }
    function closeAllModals(){
      overlays.forEach(function(o){ if (!o.hidden) closeModal(o); });
    }

    // делегирование: открытие любой модалки по data-open-modal
    document.addEventListener("click", function(e){
      var trigger = e.target.closest && e.target.closest("[data-open-modal]");
      if (!trigger) return;
      e.preventDefault();
      var id = trigger.getAttribute("data-open-modal");
      openModal(id + "Modal");
      var form = document.getElementById(id + "Form");
      var success = document.getElementById(id + "Success");
      if (form){ form.reset(); form.hidden = false; }
      if (success) success.hidden = true;
    });

    // закрытие: крестик и клик по подложке
    overlays.forEach(function(overlay){
      overlay.addEventListener("click", function(e){
        if (e.target.closest && e.target.closest("[data-close-modal]")){
          closeModal(overlay); return;
        }
        if (e.target === overlay) closeModal(overlay);
      });
    });
    document.addEventListener("keydown", function(e){
      if (e.key === "Escape") closeAllModals();
    });

    /* выбор тарифа в таблице */
    document.querySelectorAll(".price-row").forEach(function(row){
      var radio = row.querySelector('input[type="radio"]');
      function selectRow(){
        document.querySelectorAll(".price-row").forEach(function(r){ r.classList.remove("is-selected"); });
        row.classList.add("is-selected");
      }
      if (radio && radio.checked) row.classList.add("is-selected");
      row.addEventListener("click", function(e){
        if (e.target.tagName !== "INPUT") radio.checked = true;
        selectRow();
      });
    });

    /* визуальная отправка: реального бэкенда нет, показываем success */
    var quoteForm = document.getElementById("quoteForm");
    var quoteSuccess = document.getElementById("quoteSuccess");
    if (quoteForm){
      quoteForm.addEventListener("submit", function(e){
        e.preventDefault();
        if (!quoteForm.checkValidity()){ quoteForm.reportValidity(); return; }
        quoteForm.hidden = true;
        quoteSuccess.hidden = false;
      });
    }
    var tourForm = document.getElementById("tourForm");
    var tourSuccess = document.getElementById("tourSuccess");
    if (tourForm){
      tourForm.addEventListener("submit", function(e){
        e.preventDefault();
        if (!tourForm.checkValidity()){ tourForm.reportValidity(); return; }
        tourForm.hidden = true;
        tourSuccess.hidden = false;
      });
    }
  })();

  /* ---------------------------------------------------------------
     cookie banner
  --------------------------------------------------------------- */
  (function(){
    var KEY = "ruvumbu-cookies";
    var banner = document.getElementById("cookieBanner");
    if (!banner) return;

    var choice = null;
    try { choice = localStorage.getItem(KEY); } catch(e){}
    if (!choice) banner.hidden = false;

    function setChoice(v){
      try { localStorage.setItem(KEY, v); } catch(e){}
      banner.hidden = true;
    }
    var acc = document.getElementById("cookieAccept");
    var dec = document.getElementById("cookieDecline");
    if (acc) acc.addEventListener("click", function(){ setChoice("accepted"); });
    if (dec) dec.addEventListener("click", function(){ setChoice("declined"); });
  })();

})();