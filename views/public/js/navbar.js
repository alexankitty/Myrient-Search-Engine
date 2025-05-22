  $(document).ready(function() {
    // Make sure Bootstrap dropdown is properly initialized
    $('.dropdown-toggle').dropdown();
  });

  const aTags = document.querySelectorAll('a')
  aTags.forEach(aTag => {
    if(aTag.getAttribute('href') == window.location.pathname){
      aTag.classList.add('selected')
      aTag.classList.remove('hidden')
    }
  })

  function changeLanguage(lang) {
    // Create URL with new language parameter
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    window.location.href = url.toString();
  }