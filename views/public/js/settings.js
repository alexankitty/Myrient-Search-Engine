  function setBoosts(){
    for(let boost in defaults.boost){
      if(typeof settings.boost[boost] == 'undefined') {settings.boost[boost] == defaults.boost[boost]}
      document.getElementById(boost + 'boost').value = settings.boost[boost]
      document.getElementById(boost + 'boost').addEventListener('keyup', () => {
        validate(document.getElementById(boost + 'boost'))
      })
    }
  }

  function setColumns(){
    for(let field in settings.fields){
      let element = document.getElementById(settings.fields[field])
      if(!element){settings.fields.splice(field, 1)}
      else{element.checked = true}
    }
    for(let field in defaults.fields){
      document.getElementById(defaults.fields[field]).addEventListener('change', () => {
        toggleLinkedTextBox(document.getElementById(defaults.fields[field]), document.getElementById(defaults.fields[field] + 'boost'))
      })
      let elem = document.getElementById(defaults.fields[field])
      if(!elem.checked){
        let boostField = document.getElementById(defaults.fields[field] + 'boost')
        boostField.classList.add('text-secondary')
        boostField.disabled = true
      }
    }
  }

  function setOthers(){
    if(typeof settings.combineWith == 'undefined') {settings.combineWith = defaults.combineWith}
    if(typeof settings.fuzzy == 'undefined') {settings.fuzzy = defaults.fuzzy}
    if(typeof settings.prefix == 'undefined') {settings.prefix = defaults.prefix}
    if(typeof settings.hideNonGame == 'undefined') {settings.hideNonGame = defaults.hideNonGame}
    if(typeof settings.hideNonGame == 'undefined') {settings.useOldResults = defaults.useOldResults}
    document.getElementById('combineWith').checked = settings.combineWith ? true : false
    document.getElementById('fuzzy').value = settings.fuzzy
    document.getElementById('prefix').checked = settings.prefix
    document.getElementById('hideNonGame').checked = settings.hideNonGame
    document.getElementById('useOldResults').checked = settings.useOldResults
  }

  function saveSettings(){
    for(let boost in defaults.boost){settings.boost[boost] = parseInt(document.getElementById(boost + 'boost').value)}
    settings.fields = []
    for(let field in defaults.fields){
      if(document.getElementById(defaults.fields[field]).checked){
        settings.fields.push(defaults.fields[field])
      }
    }
    settings.combineWith = document.getElementById('combineWith').checked ? 'AND' : ''
    settings.fuzzy = parseFloat (document.getElementById('fuzzy').value)
    settings.prefix = document.getElementById('prefix').checked
    settings.hideNonGame = document.getElementById('hideNonGame').checked
    settings.useOldResults = document.getElementById('useOldResults').checked
    localStorage.setItem('settings', JSON.stringify(settings))
    window.location.href = '/'
  }

  function loadSettings(){
    if(!settingStore) {
      settings = structuredClone(defaults)
      settingStore = JSON.stringify(settings)
      localStorage.setItem('settings', settingStore)
    }
    else{
      try{
        settings = JSON.parse(settingStore)
      }
      catch{
        //load defaults if not exist
        settings = defaults
      }
    }
    setBoosts()
    setColumns()
    setOthers()
  }
  document.body.onload = loadSettings
  document.getElementById('saveSettings').onclick = saveSettings

  function validate(element){
    let max = parseInt(element.max)
    let min = parseInt(element.min)
    let value = parseInt(element.value)
    if(value > max) {element.value = max}
    if(value < min) {element.value = min}
    console.log(max, min, value)
  }
  fuzzyElem = document.getElementById('fuzzy')
  fuzzyElem.addEventListener('keyup', () => {
    validate(fuzzyElem)
  })
  function toggleLinkedTextBox(checkBox, textBox){
    if(!checkBox.checked) {
      textBox.classList.add('text-secondary')
      textBox.disabled = true
    }
    else {
      textBox.classList.remove('text-secondary')
      textBox.disabled = false
    }
  }