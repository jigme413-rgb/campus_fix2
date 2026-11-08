// Small progressive enhancements. Every page also works with JavaScript turned off.
(function () {
  // Theme toggle without a reload (the form still posts to /theme without JS)
  var themeForm = document.getElementById('theme-form');
  if (themeForm) {
    themeForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var root = document.documentElement;
      var current = root.dataset.theme ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      document.cookie = 'theme=' + next + '; path=/; max-age=31536000; samesite=lax';
    });
  }

  // Ask before destructive actions: <form data-confirm="Are you sure?">
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      if (!window.confirm(form.dataset.confirm)) event.preventDefault();
    });
  });

  // Submit filter / role forms as soon as a select changes
  document.querySelectorAll('form[data-autosubmit] select').forEach(function (select) {
    select.addEventListener('change', function () {
      var form = select.form;
      var page = form.querySelector('input[name="page"]');
      if (page) page.remove();
      form.requestSubmit ? form.requestSubmit() : form.submit();
    });
  });

  // Prevent double submission of any form
  document.querySelectorAll('form[method="post"]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      if (event.defaultPrevented) return;
      var button = form.querySelector('button[type="submit"]');
      if (button && form.id !== 'theme-form') {
        setTimeout(function () { button.disabled = true; }, 0);
      }
    });
  });
})();
