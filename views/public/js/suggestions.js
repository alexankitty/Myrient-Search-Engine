typingTimeout = null;
selectedSuggestion = null;
totalSuggestions = 0;
async function getSuggestions(query) {
  await fetch("/suggest", {
    method: "POST",
    body: JSON.stringify({ query: query }),
    headers: { "Content-type": "application/json; charset=UTF-8" },
  })
    .then((response) => response.json())
    .then((json) => populateSuggestions(json));
}
async function populateSuggestions(suggestArr) {
  selectedSuggestion = null;
  suggestions = suggestArr.suggestions;
  let suggestionList = document.getElementById("suggestionList");
  suggestionList.replaceChildren();
  let searchElem = document.getElementById("search");
  let listLength = suggestions.length > 10 ? 10 : suggestions.length;
  totalSuggestions = listLength;
  for (let x = 0; x < listLength; x++) {
    let listElem = document.createElement("li");
    listElem.classList.add("Suggestion");
    listElem.innerText = suggestions[x].suggestion;
    listElem.addEventListener("click", (e) => {
      searchElem.value = listElem.innerText;
      suggestionList.style.display = "none";
      selectedSuggestion = null;
      totalSuggestions = 0;
    });
    listElem.addEventListener("mouseover", (e) => {
      selectedSuggestion = null;
      clearSelects();
    });
    listElem.id = `suggestions${x}`;
    suggestionList.appendChild(listElem);
    suggestionList.style.display = "block";
  }
}
document.addEventListener(
  "DOMContentLoaded",
  function (e) {
    searchElem = document.getElementById("search");
    if (!searchElem) {
      return;
    }
    searchElem /
      addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          if (selectedSuggestion != null) {
            e.preventDefault();
          }
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
        }
      });
    searchElem.addEventListener("keyup", function (e) {
      if (e.key === "Escape") {
        return;
      }
      if (e.key === "ArrowUp") {
        if (!totalSuggestions) return;
        if (typeof selectedSuggestion != "number") {
          selectedSuggestion = totalSuggestions - 1;
        } else {
          selectedSuggestion -= 1;
          if (selectedSuggestion < 0) {
            selectedSuggestion = totalSuggestions - 1;
          }
        }
        selectSuggestion(selectedSuggestion);
        return;
      }
      if (e.key === "ArrowDown") {
        if (!totalSuggestions) return;
        if (typeof selectedSuggestion != "number") {
          selectedSuggestion = 0;
        } else {
          selectedSuggestion += 1;
          if (selectedSuggestion > totalSuggestions - 1) {
            selectedSuggestion = 0;
          }
        }
        selectSuggestion(selectedSuggestion);
        return;
      }
      if (e.key === "Enter") {
        if (selectedSuggestion != null) {
          enterSuggestion(selectedSuggestion);
          return;
        }
        return;
      }
      query = searchElem.value;
      if (typingTimeout != null) {
        clearTimeout(typingTimeout);
      }
      typingTimeout = setTimeout(function () {
        typingTimeout = null;
        if (!query) {
          let suggestionList = document.getElementById("suggestionList");
          suggestionList.replaceChildren();
          suggestionList.style.display = "none";
          totalSuggestions = 0;
        } else {
          getSuggestions(query);
        }
      }, 500);
    });

    document.body.addEventListener("click", (e) => {
      let suggestionList = document.getElementById("suggestionList");
      suggestionList.style.display = "none";
      totalSuggestions = 0;
    });
    document.addEventListener("keyup", (e) => {
      if (e.key === "Escape") {
        let suggestionList = document.getElementById("suggestionList");
        suggestionList.style.display = "none";
        totalSuggestions = 0;
      }
    });
  },
  false
);
function selectSuggestion(id) {
  let suggestId = `suggestions${id}`;
  clearSelects();
  document.getElementById(suggestId).classList.add("selected");
}
function enterSuggestion(id) {
  let suggestId = `suggestions${id}`;
  clearSelects();
  document.getElementById("search").value =
    document.getElementById(suggestId).innerText;
  selectedSuggestion = null;
  suggestionList.style.display = "none";
  totalSuggestions = 0;
}
function clearSelects() {
  let suggestionList = document.getElementById("suggestionList");
  let selectedItems = suggestionList.getElementsByClassName("selected");
  if (!selectedItems.length) {
    return;
  }
  for (item in selectedItems) {
    if (typeof selectedItems[item].classList === "undefined") {
      //this is jank but the stupid function double fires
      return;
    }
    selectedItems[item].classList.remove("selected");
  }
}
