/* Mockup helpers: icons + shared navigation chrome. Static prototypes only — not app code.
   Icons are drawn in the Lucide style (2px stroke, round caps); Phase 5 swaps in lucide-react. */
(function () {
  var P = {
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    'calendar-check':
      '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18m-12 6 2 2 4-4"/>',
    users:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    dashboard:
      '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    printer:
      '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert:
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 7L2 7"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    music:
      '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    trash:
      '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  };
  function svg(name, cls) {
    return (
      '<svg class="icon ' +
      (cls || '') +
      '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      (P[name] || '') +
      '</svg>'
    );
  }
  function logo(size) {
    return '<img src="assets/lnhc-logo.png" alt="" width="' + size + '" height="' + size + '">';
  }

  var chromes = {
    volunteer: function (a) {
      var l = function (id, href, ic, t) {
        return (
          '<a href="' +
          href +
          '"' +
          (a === id ? ' aria-current="page"' : '') +
          '>' +
          svg(ic) +
          t +
          '</a>'
        );
      };
      return (
        '<div class="topbar"><div class="topbar-in">' +
        '<a class="brand" href="volunteer-home.html">' +
        logo(40) +
        '<span><span class="name">LNHC Schedule</span><span class="sub">Lipa New Hope Church</span></span></a>' +
        '<nav class="nav" aria-label="Main">' +
        l('home', 'volunteer-home.html', 'home', 'Home') +
        l('schedule', 'schedule-month.html', 'calendar', 'Schedules') +
        l('avail', 'my-availability.html', 'calendar-check', 'My availability') +
        '</nav>' +
        '<div class="user"><span class="avatar" aria-hidden="true">R</span><span class="hide-sm">Rden</span><a class="btn quiet sm hide-sm" href="login.html">' +
        svg('logout', 'sm') +
        'Log out</a></div>' +
        '</div></div>'
      );
    },
    volunteerTabs: function (a) {
      var t = function (id, href, ic, txt) {
        return (
          '<a href="' +
          href +
          '"' +
          (a === id ? ' aria-current="page"' : '') +
          '>' +
          svg(ic) +
          txt +
          '</a>'
        );
      };
      return (
        t('home', 'volunteer-home.html', 'home', 'Home') +
        t('schedule', 'schedule-month.html', 'calendar', 'Schedules') +
        t('avail', 'my-availability.html', 'calendar-check', 'Availability') +
        t('me', 'login.html', 'user', 'Profile')
      );
    },
    admin: function (a) {
      var l = function (id, href, ic, t) {
        return (
          '<a href="' +
          href +
          '"' +
          (a === id ? ' aria-current="page"' : '') +
          '>' +
          svg(ic) +
          t +
          '</a>'
        );
      };
      return (
        '<a class="brand" href="admin-dashboard.html">' +
        logo(40) +
        '<span><span class="name">LNHC Schedule</span><span class="sub">Administrator</span></span></a>' +
        '<nav aria-label="Administration">' +
        l('dash', 'admin-dashboard.html', 'dashboard', 'Dashboard') +
        l('sched', 'admin-roster.html', 'calendar', 'Schedules') +
        l('vol', 'admin-volunteers.html', 'users', 'Volunteers') +
        l('venues', '#', 'pin', 'Venues &amp; positions') +
        l('ann', '#', 'megaphone', 'Announcements') +
        l('acc', '#', 'lock', 'Accounts') +
        l('log', '#', 'history', 'Activity log') +
        '</nav>' +
        '<div class="who"><span class="avatar" aria-hidden="true">A</span><span>Admin<br><a href="login.html">Log out</a></span></div>'
      );
    },
    adminTabs: function (a) {
      var t = function (id, href, ic, txt) {
        return (
          '<a href="' +
          href +
          '"' +
          (a === id ? ' aria-current="page"' : '') +
          '>' +
          svg(ic) +
          txt +
          '</a>'
        );
      };
      return (
        t('dash', 'admin-dashboard.html', 'dashboard', 'Dashboard') +
        t('sched', 'admin-roster.html', 'calendar', 'Schedules') +
        t('vol', 'admin-volunteers.html', 'users', 'Volunteers') +
        t('more', '#', 'menu', 'More')
      );
    },
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-chrome]').forEach(function (el) {
      var k = el.getAttribute('data-chrome');
      var a = el.getAttribute('data-active');
      if (chromes[k]) el.innerHTML = chromes[k](a);
    });
    document.querySelectorAll('[data-tabbar]').forEach(function (el) {
      var k = el.getAttribute('data-tabbar') + 'Tabs';
      el.innerHTML = chromes[k](el.getAttribute('data-active'));
    });
    document.querySelectorAll('i[data-i]').forEach(function (el) {
      var t = document.createElement('span');
      t.style.display = 'contents';
      t.innerHTML = svg(el.getAttribute('data-i'), el.getAttribute('data-c'));
      el.replaceWith(t.firstChild);
    });
    /* Tiny interactions so the prototypes feel alive */
    document.querySelectorAll('[aria-pressed]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.classList.contains('serving')) return;
        b.setAttribute(
          'aria-pressed',
          b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true',
        );
      });
    });
    document.querySelectorAll('[data-tabs]').forEach(function (group) {
      var tabs = group.querySelectorAll('[role=tab]');
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabs.forEach(function (x) {
            x.setAttribute('aria-selected', x === tab ? 'true' : 'false');
            var p = document.getElementById(x.getAttribute('aria-controls'));
            if (p) p.hidden = x !== tab;
          });
        });
      });
    });
  });
})();
