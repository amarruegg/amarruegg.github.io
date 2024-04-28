document.addEventListener("DOMContentLoaded", function () {
    const editor = document.getElementById("editor");
    const tiles = document.querySelectorAll(".tile");

    tiles.forEach(tile => {
        tile.addEventListener("dragstart", dragStart);
        tile.addEventListener("dragend", dragEnd);
    });

    let importedCSS = '';

document.getElementById("importButton").addEventListener("click", function() {
document.getElementById("importCSS").click();
});

document.getElementById("importCSS").addEventListener("change", function(e) {
const file = e.target.files[0];
if (file) {
  const reader = new FileReader();
  reader.readAsText(file, "UTF-8");
  reader.onload = function (evt) {
    importedCSS = evt.target.result;
  }
  reader.onerror = function (evt) {
    console.error("An error occurred while reading the CSS file");
  }
}
});



document.getElementById("exportButton").addEventListener("click", function() {
// Create a copy of the editor content.
var editorContent = document.getElementById("editor").cloneNode(true);

// Define all classes of elements to remove.
var classesToRemove = ["color-picker", "size-picker", "spacer-size-indicator", "url-btn", "url-input", "url-toggle", "font-size-picker"];

// Loop over all classes and remove those elements from the copied content.
classesToRemove.forEach(function(classToRemove) {
  var elements = editorContent.getElementsByClassName(classToRemove);

  while (elements.length > 0) {
    elements[0].parentNode.removeChild(elements[0]);
  }
});

// Add the imported CSS to the HTML.
var htmlContent = `<style>${importedCSS}</style>` + editorContent.innerHTML;

// Export the modified copied content.
var blob = new Blob([htmlContent], {type: "text/plain;charset=utf-8"});
var a = document.createElement("a");
a.download = "editor-content.html";
a.href = URL.createObjectURL(blob);
a.dataset.downloadurl = ["text/plain", a.download, a.href].join(":");
a.style.display = "none";
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(function() { URL.revokeObjectURL(a.href); }, 1500);
});



    editor.addEventListener("dragover", dragOver);
    editor.addEventListener("dragenter", dragEnter);
    editor.addEventListener("dragleave", dragLeave);
    editor.addEventListener("drop", drop);

    let placeholder;

    function dragStart() {
  this.classList.add("dragging");
  placeholder = document.createElement('div');
  placeholder.classList.add('tile-placeholder');
}

function dragEnd() {
this.classList.remove("dragging");
      if (placeholder) {
          placeholder.remove();
      }
}


    function dragOver(e) {
        e.preventDefault();
    }

    function dragEnter(e) {
      e.preventDefault();
      editor.classList.add("dragover");

      // Refactor: Insert placeholder correctly
      let afterNode = getDragAfterElement(editor, e.clientY);
      if (afterNode == null) {
          editor.appendChild(placeholder);
      } else {
          editor.insertBefore(placeholder, afterNode);
      }
  }

    function dragLeave() {
        editor.classList.remove("dragover");
    }

    function drop(e) {
        e.preventDefault();
        editor.classList.remove("dragover");
        const tile = document.querySelector(".dragging");
        let placeholderHTML;

      switch (tile.textContent.trim()) {
        case "Text":
placeholderHTML = `
<div class="editor-item glow-on-hover">
          <div style="display: flex; justify-content: center; width: 100%">
              <table width="600" style="width: 600px; max-width: 600px">
                  <tr>
                      <td style="-webkit-font-smoothing: antialiased; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 22px; padding-left: 4%; padding-right: 4%; text-align: left; color: #000000">
                          {{body_copy_1}}
                      </td>
                  </tr>
              </table>
              <div class="font-size-picker" style="display: flex;">
                  <button class="font-size-btn">A</button>
                  <div class="font-size-menu">
                      <button class="font-size-option" data-size="12">12px</button>
                      <button class="font-size-option" data-size="14">14px</button>
                      <button class="font-size-option" data-size="16">16px</button>
                      <button class="font-size-option" data-size="18">18px</button>
                      <button class="font-size-option" data-size="20">20px</button>
                      <button class="font-size-option" data-size="22">22px</button>
                      <button class="font-size-option" data-size="24">24px</button>
                  </div>
              </div>
          </div>
      </div>`;
break;
          case "Image":
placeholderHTML = `
  <div class="editor-image-container glow-on-hover" style="display: flex; justify-content: center; align-items: center;">
    <table align="center">
      <tr>
        <td align="center" valign="bottom">
          <img class="editor-image" border="0" src="https://jungleworks.com/wp-content/uploads/2016/04/business_model.png" alt="image" width="600" style="max-width: 600px; width: 100%; border: 0;">
        </td>
      </tr>
    </table>
    <button class="url-toggle">🔗</button>
    <div class="url-picker">
      <input class="url-input" type="text" value="https://jungleworks.com/wp-content/uploads/2016/04/business_model.png">
      <button class="url-btn">Update</button>
    </div>
  </div>`;
break;

          case "Button":
placeholderHTML = `
  <div class="editor-button glow-on-hover">
      <div style="display: flex; justify-content: center;">
          <table>
            <tr>
              <td height="50" style=" width: 600px; font-size: 50px; line-height: 50px; -mso-line-height: 50px;"> </td>
            </tr>
            <tr>
              <td align="center" valign="top" width="100%">
                <center>
                  <table border="0" align="center" cellpadding="0" cellspacing="0" style="background-color: #ff00bf; border-radius: 30px; min-width: 200px; max-width: 300px; min-height: 50px;">
                    <tr>
                      <td align="center" style="padding-left: 50px; padding-right: 50px; vertical-align: middle; padding-top: 17px; padding-bottom: 17px;">
                        <center>
                          <a class="button-link" href="{{cta_url}}" style="-webkit-font-smoothing: antialiased; font-family: Arial, Helvetica, sans-serif; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; line-height: 22px; text-align: center;">{{cta}}</a>
                        </center>
                      </td>
                    </tr>
                  </table>
                </center>
              </td>
            </tr>
            <tr>
              <td height="50" style="font-size: 50px; line-height: 50px; -mso-line-height: 50px;"> </td>
            </tr>
          </table>
      </div>
      <div class="color-picker">
        <button class="color-btn">🎨</button>
        <div class="color-menu">
          <button class="color-option" data-bg="#FFFFFF" data-text="#000000" style="background-color: #FFFFFF;"></button>
          <button class="color-option" data-bg="#ff00bf" data-text="#FFFFFF" style="background-color: #ff00bf;"></button>
          <button class="color-option" data-bg="#523BE4" data-text="#FFFFFF" style="background-color: #523BE4;"></button>
        </div>
      </div>
  </div>`;
break;

        case "OL":
          placeholderHTML = `
    <div class="glow-on-hover" style="display: flex; justify-content: center;">
      <tr>
  <td>
<table class="wrapto600px" width="600" align="center" border="0" cellpadding="0" cellspacing="0">
  <tr>
      <td style="padding: 0 4%; font-family: 'LyftProUI-SemiBold', 'Proxima Nova', 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: left; color:#11111F; line-height: 30px; font-weight: bold; font-size: 30px; vertical-align: middle;" align="left" valign="middle">
          {{list_header}}
      </td>
  </tr>
  <tr>
      <td height="30" style="font-size: 30px; line-height: 30px; -mso-line-height: 30px;"> </td>
  </tr>
  <tr>
      <td style="padding: 0px 4%;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                  <td align="left" valign="top">
                      <img alt="Icon - 1 Circle" src="https://s3.amazonaws.com/growth.lyft.com/2018_Brand_Refresh/icons/UI/Circle-Outline/Steps/01@2x.png" width="40" height="40" style="max-height: 40px; max-width: 40px; display: block;" border="0">
                  </td>
                  <td align="center" valign="middle" width="100%">
                      <table width="100%" cellpadding="0" cellspacing="0" style="min-width: 100%;">
                          <tr>
                              <td align="left" valign="top" style="font-family: 'LyftProUI-SemiBold', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 20px; color: #11111F; line-height: 20px; text-align: left; padding-left: 18px; padding-right: 18px; vertical-align: top; font-weight: 800;">
                                  {{li_header_1}}
                              </td>
                          </tr>
                          <tr>
                              <td height="10" style="font-size: 10px; line-height: 10px; -mso-line-height: 10px;"> </td>
                          </tr>
                          <tr>
                              <td align="left" class="mobilebody" valign="top" style="font-family: 'LyftProUI-Regular', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; color: #11111F; line-height: 22px; text-align: left; padding-left: 18px; padding-right: 18px; vertical-align: top;">
                                  {{li_body_1}}
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
              <tr>
                  <td height="30" style="font-size: 30px; line-height: 30px; -mso-line-height: 30px;"> </td>
              </tr>
          </table>
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                  <td align="left" valign="top">
                      <img alt="Icon - 2 Circle" src="https://s3.amazonaws.com/growth.lyft.com/2018_Brand_Refresh/icons/UI/Circle-Outline/Steps/02@2x.png" width="40" height="40" style="max-height: 40px; max-width: 40px; display: block;" border="0">
                  </td>
                  <td align="center" valign="middle" width="100%">
                      <table width="100%" cellpadding="0" cellspacing="0" style="min-width: 100%;">
                          <tr>
                              <td align="left" valign="top" style="font-family: 'LyftProUI-SemiBold', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 20px; color: #11111F; line-height: 20px; text-align: left; padding-left: 18px; padding-right: 18px; vertical-align: top; font-weight: 800;">
                                  {{li_header_2}}
                              </td>
                          </tr>
                          <tr>
                              <td height="10" style="font-size: 10px; line-height: 10px; -mso-line-height: 10px;"> </td>
                          </tr>
                          <tr>
                              <td align="left" class="mobilebody" valign="top" style="font-family: 'LyftProUI-Regular', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; color: #11111F; line-height: 22px; text-align: left; padding-left: 18px; padding-right: 18px; vertical-align: top;">
                                  {{li_body_2}}
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
              <tr>
                  <td height="30" style="font-size: 30px; line-height: 30px; -mso-line-height: 30px;"> </td>
              </tr>
          </table>
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                  <td align="left" valign="top">
                      <img alt="Icon - 3 Circle" src="https://s3.amazonaws.com/growth.lyft.com/2018_Brand_Refresh/icons/UI/Circle-Outline/Steps/03@2x.png" width="40" height="40" style="max-height: 40px; max-width: 40px; display: block;" border="0">
                  </td>
                  <td align="center" valign="middle" width="100%">
                      <table width="100%" cellpadding="0" cellspacing="0" style="min-width: 100%;">
                          <tr>
                              <td align="left" valign="top" style="font-family: 'LyftProUI-SemiBold', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 20px; color: #11111F; line-height: 20px; text-align: left; padding-left: 18px; padding-right: 18px; vertical-align: top; font-weight: 800;">
                                  {{li_header_3}}
                              </td>
                          </tr>
                          <tr>
                              <td height="10" style="font-size: 10px; line-height: 10px; -mso-line-height: 10px;"> </td>
                          </tr>
                          <tr>
                              <td align="left" class="mobilebody" valign="top" style="font-family: 'LyftProUI-Regular', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; color: #11111F; line-height: 22px; text-align: left; padding-left: 18px; padding-right: 18px; vertical-align: top;">
                                  {{li_body_3}}
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
          </table>
      </td>
  </tr>
</table>
</td>
</tr>
      </div>`;
          break;
          case "Module":
placeholderHTML = `
  <div class="glow-on-hover" style="display: flex; justify-content: center; align-items: center;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" class="wrapto600px" width="600">
      <tr>
        <td style="vertical-align: top;">
          <table class="" width="100%" align="center" border="0" cellpadding="0" cellspacing="0" bgcolor="#FFF2BD" style="background-color: #FFF2BD;">
              <tr>
                  <td height="30" style="font-size: 30px; line-height: 30px; -mso-line-height: 30px;"> </td>
              </tr>
              <tr>
                  <td align="center" width="100%" style="padding: 0 4%;">
                      <img src="https://s3.amazonaws.com/growth.lyft.com/img/litmus-design-library/modules/module_7a.png" width="95" style="display: block; max-width: 95px;" alt="Cellphone in Hand" />
                  </td>
              </tr>
              <tr>
                  <td height="20" style="font-size: 20px; line-height: 20px; -mso-line-height: 20px;">&nbsp;</td>
              </tr>
              <tr>
                  <td style="padding: 0 4%; font-family: 'LyftProUI-SemiBold', 'Proxima Nova', 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center; color:#11111F; line-height: 30px; font-weight: bold; font-size: 30px; vertical-align: middle;" align="center" valign="middle">
                      {{module_header}}
                  </td>
              </tr>
              <tr>
                  <td height="10" style="font-size: 10px; line-height: 10px; -mso-line-height: 10px;">&nbsp;</td>
              </tr>
              <tr>
                  <td style="-webkit-font-smoothing: antialiased; font-family: 'LyftProUI-Regular', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; color: #11111F; line-height: 22px; padding-left: 4%; padding-right: 4%; text-align: center;">
                      {{module_body}}
                  </td>
              </tr>
              <tr>
                  <td height="30" style="font-size: 30px; line-height: 30px; -mso-line-height: 30px;"> </td>
              </tr>
              <tr>
                  <td align="left" valign="top" style="font-family: 'LyftProUI-Bold', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; color: #8D3A7F; line-height: 16px; text-align: center; vertical-align: top;">
                      <a href="https://www.lyft.com" target="_blank" style="color: #8D3A7F; text-decoration: underline;">{{module_cta}}</a>
                  </td>
              </tr>
              <tr>
                  <td height="50" style="font-size: 50px; line-height: 50px; -mso-line-height: 50px;"> </td>
              </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
break;

          case "Spacer":
placeholderHTML = `
  <div class="editor-spacer glow-on-hover" style="display: flex; justify-content: center; align-items: center; flex-direction: column;">
    <div class="spacer-size-indicator" style="color: black; text-align: center;">sp30</div>
    <table>
      <tr>
        <td height="30" style=" width: 600px; font-size: 30px; line-height: 30px; -mso-line-height: 30px;"> </td>
      </tr>
    </table>
    <div class="size-picker">
      <button class="size-btn">📏</button>
      <div class="size-menu">
        <button class="size-option" data-size="10">10px</button>
        <button class="size-option" data-size="20">20px</button>
        <button class="size-option" data-size="25">25px</button>
        <button class="size-option" data-size="30">30px</button>
        <button class="size-option" data-size="35">35px</button>
        <button class="size-option" data-size="40">40px</button>
        <button class="size-option" data-size="45">45px</button>
        <button class="size-option" data-size="50">50px</button>
      </div>
    </div>
  </div>`;
break;

case "M1":
placeholderHTML = `
<div class="glow-on-hover" style="display: flex; justify-content: center; align-items: center;">
    <table class="wrapto600px" width="600" align="center" border="0" cellpadding="0" cellspacing="0">
  <tr>
      <td class="header3" style="-webkit-font-smoothing: antialiased; font-family: 'LyftProUI-Bold', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 700; font-size: 37px; line-height: 40px; color: #0C0B31; text-align: left; vertical-align: top; padding-left: 4%; padding-right: 4%;" align="left" valign="top" >
          {{module_header_1}}
      </td>
  </tr>
  <tr>
      <td height="32" style="font-size: 32px; line-height: 32px; -mso-line-height: 32px;">&nbsp;</td>
  </tr>
  <tr>
      <td align="center" valign="bottom">
          <img src="{{module_img_1}}" alt="{{module_img_alt_1}}" width="600" style="display: block; max-width: 600px; width: 100%; border: 0;" border="0">
      </td>
  </tr>
  <tr>
      <td height="24" style="font-size: 24px; line-height: 24px; -mso-line-height: 24px;">&nbsp;</td>
  </tr>
  <tr>
      <td class="subheader1" style="-webkit-font-smoothing: antialiased; font-family: 'LyftProUI-Bold', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 700; font-size: 24px; line-height: 27px; color: #0C0B31; text-align: left; vertical-align: top; padding-left: 4%; padding-right: 4%;" align="left" valign="top">
          {{module_subheader_1}}
      </td>
  </tr>
  <tr>
      <td height="12" style="font-size: 12px; line-height: 12px; -mso-line-height: 12px;">&nbsp;</td>
  </tr>
  <tr>
      <td class="body1" style="-webkit-font-smoothing: antialiased; font-family: 'LyftProUI-Regular', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 400; font-size: 16px; line-height: 19px; color: #0C0B31; text-align: left; vertical-align: top; padding-left: 4%; padding-right: 4%;" align="left" valign="top">
          {{module_body_1}}
      </td>
  </tr>
  <tr>
      <td height="32" style="font-size: 32px; line-height: 32px; -mso-line-height: 32px;">&nbsp;</td>
  </tr>
  <tr>
      <td align="center" valign="bottom">
          <img src="{{module_img_2}}" alt="{{module_img_alt_2}}" width="600" style="display: block; max-width: 600px; width: 100%; border: 0;" border="0">
      </td>
  </tr>
  <tr>
      <td height="24" style="font-size: 24px; line-height: 24px; -mso-line-height: 24px;">&nbsp;</td>
  </tr>
  <tr>
      <td class="subheader1" style="-webkit-font-smoothing: antialiased; font-family: 'LyftProUI-Bold', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 700; font-size: 24px; line-height: 27px; color: #0C0B31; text-align: left; vertical-align: top; padding-left: 4%; padding-right: 4%;" align="left" valign="top">
          {{module_subheader_2}}
      </td>
  </tr>
  <tr>
      <td height="12" style="font-size: 12px; line-height: 12px; -mso-line-height: 12px;">&nbsp;</td>
  </tr>
  <tr>
      <td class="body1" style="-webkit-font-smoothing: antialiased; font-family: 'LyftProUI-Regular', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 400; font-size: 16px; line-height: 19px; color: #0C0B31; text-align: left; vertical-align: top; padding-left: 4%; padding-right: 4%;" align="left" valign="top">
          {{module_body_2}}
      </td>
  </tr>
  <tr>
      <td height="32" style="font-size: 32px; line-height: 32px; -mso-line-height: 32px;">&nbsp;</td>
  </tr>
  <tr>
      <td align="center" valign="bottom">
          <img src="{{module_img_3}}" alt="{{module_img_alt_3}}" width="600" style="display: block; max-width: 600px; width: 100%; border: 0;" border="0">
      </td>
  </tr>
  <tr>
      <td height="24" style="font-size: 24px; line-height: 24px; -mso-line-height: 24px;">&nbsp;</td>
  </tr>
  <tr>
      <td class="subheader1" style="-webkit-font-smoothing: antialiased; font-family: 'LyftProUI-Bold', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 700; font-size: 24px; line-height: 27px; color: #0C0B31; text-align: left; vertical-align: top; padding-left: 4%; padding-right: 4%;" align="left" valign="top">
          {{module_subheader_3}}
      </td>
  </tr>
  <tr>
      <td height="12" style="font-size: 12px; line-height: 12px; -mso-line-height: 12px;">&nbsp;</td>
  </tr>
  <tr>
      <td class="body1" style="-webkit-font-smoothing: antialiased; font-family: 'LyftProUI-Regular', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 400; font-size: 16px; line-height: 19px; color: #0C0B31; text-align: left; vertical-align: top; padding-left: 4%; padding-right: 4%;" align="left" valign="top">
          {{module_body_3}}
      </td>
  </tr>
  <tr>
      <td height="32" style="font-size: 32px; line-height: 32px; -mso-line-height: 32px;">&nbsp;</td>
  </tr>
</table>
  </div>`;
break;
        default:
          placeholderHTML = "<p>Unknown</p>";
      }

      const div = document.createElement("div");
div.innerHTML = placeholderHTML;
div.classList.add("editor-item");


// CTA Button color selector logic
if (tile.textContent.trim() === "Button") {
    const colorPicker = div.querySelector(".color-picker");
    const colorBtn = colorPicker.querySelector(".color-btn");
    const colorMenu = colorPicker.querySelector(".color-menu");
  
    colorBtn.addEventListener("click", (event) => {
      event.stopPropagation(); // Prevent this click from triggering the document click event
      colorMenu.classList.toggle("show");
    });
  
    colorPicker.querySelectorAll(".color-option").forEach(option => {
      option.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevent this click from triggering the document click event
        const button = div.querySelector("table[style*='background-color']");
        const link = div.querySelector(".button-link");
        button.style.backgroundColor = option.dataset.bg;
        link.style.color = option.dataset.text;
        colorMenu.classList.remove("show");
      });
    });
  
    // Add this event listener to handle clicks outside of the colorPicker
    document.addEventListener('click', function(event) {
      const isClickInside = colorPicker.contains(event.target);
  
      if (!isClickInside) {
        colorBtn.style.display = 'none'; // Hide the color-btn
        if (colorMenu.classList.contains('show')) {
          colorMenu.classList.remove('show'); // Hide the color-menu
        }
      }
    });
  
    // Add this event listener to the dropped tile to show the color-btn when it's clicked
    div.addEventListener('click', function(event) {
      event.stopPropagation(); // Prevent this click from triggering the document click event
      colorBtn.style.display = 'block';
    });
  }

// Font size selection logic
if (tile.textContent.trim() === "Text") {
    const sizePicker = div.querySelector(".font-size-picker");
    const fontSizeBtn = sizePicker.querySelector(".font-size-btn");
    const fontSizeMenu = sizePicker.querySelector(".font-size-menu");
  
    fontSizeBtn.addEventListener("click", (event) => {
      event.stopPropagation(); // Prevent this click from triggering the document click event
      fontSizeMenu.classList.toggle("show");
    });
  
    sizePicker.querySelectorAll(".font-size-option").forEach(option => {
      option.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevent this click from triggering the document click event
        const spacer = div.querySelector("table td");
        spacer.style.fontSize = `${option.dataset.size}px`;
        spacer.style.lineHeight = `${option.dataset.size}px`;
        spacer.height = `${option.dataset.size}`;
        spacer.style.msoLineHeight = `${option.dataset.size}px`;
  
        const sizeIndicator = div.querySelector(".font-size-indicator");
        sizeIndicator.textContent = `sp${option.dataset.size}`;
  
        sizePicker.querySelector(".font-size-menu").classList.remove("show");
      });
    });
  
  // Add this event listener to handle clicks outside of the sizePicker
  document.addEventListener('click', function(event) {
    const isClickInside = sizePicker.contains(event.target);

    if (!isClickInside) {
      fontSizeBtn.style.display = 'none'; // Hide the font-size-btn
      if (fontSizeMenu.classList.contains('show')) {
        fontSizeMenu.classList.remove('show'); // Hide the font-size-menu
      }
    }
  });

  // Add this event listener to the dropped tile to show the font-size-btn when it's clicked
  div.addEventListener('click', function(event) {
    event.stopPropagation(); // Prevent this click from triggering the document click event
    fontSizeBtn.style.display = 'block';
  });
}

// Spacer size selection logic
if (tile.textContent.trim() === "Spacer") {
    const sizePicker = div.querySelector(".size-picker");
    const sizeBtn = sizePicker.querySelector(".size-btn"); // Define sizeBtn here
    const sizeMenu = sizePicker.querySelector(".size-menu"); // Define sizeMenu here

    sizeBtn.addEventListener("click", () => {
        sizeMenu.classList.toggle("show");
    });
  
    sizePicker.querySelectorAll(".size-option").forEach(option => {
        option.addEventListener("click", () => {
            const spacer = div.querySelector("table td");
            spacer.style.fontSize = `${option.dataset.size}px`;
            spacer.style.lineHeight = `${option.dataset.size}px`;
            spacer.height = `${option.dataset.size}`;
            spacer.style.msoLineHeight = `${option.dataset.size}px`;
  
            const sizeIndicator = div.querySelector(".spacer-size-indicator");
            sizeIndicator.textContent = `sp${option.dataset.size}`;
  
            sizeMenu.classList.remove("show");
        });
    });

    // Add this event listener to handle clicks outside of the sizePicker
    document.addEventListener('click', function(event) {
        const isClickInside = sizePicker.contains(event.target);
  
        if (!isClickInside) {
            sizeBtn.style.display = 'none'; // Hide the size-btn
            if (sizeMenu.classList.contains('show')) {
                sizeMenu.classList.remove('show'); // Hide the size-menu
            }
        }
    });

    // Add this event listener to the dropped tile to show the size-btn when it's clicked
    div.addEventListener('click', function(event) {
        event.stopPropagation(); // Prevent this click from triggering the document click event
        sizeBtn.style.display = 'block';
    });
}


// Image replacement button logic
if (tile.textContent.trim() === "Image") {
        const urlPicker = div.querySelector(".url-picker");
        const urlToggle = div.querySelector(".url-toggle");
        urlToggle.addEventListener("click", () => {
          urlPicker.classList.toggle("show");
        });
        urlPicker.querySelector(".url-btn").addEventListener("click", () => {
          const imageUrl = urlPicker.querySelector(".url-input").value;
          div.querySelector(".editor-image").src = imageUrl;
          urlPicker.classList.remove("show");
        });
      }

const removeButton = document.createElement("span");
removeButton.innerHTML = '<i class="fas fa-times"></i>';
removeButton.classList.add("editor-item-remove");
removeButton.addEventListener("click", () => {
  div.remove();
});
div.appendChild(removeButton);

editor.replaceChild(div, placeholder);

      // Refactor: Insert div correctly
      let afterNode = getDragAfterElement(editor, e.clientY);
      if (afterNode == null) {
          editor.appendChild(div);
      } else {
          editor.insertBefore(div, afterNode);
      }
  }

  // Refactor: New helper function to determine which node the new one will be inserted after
  function getDragAfterElement(container, y) {
      const draggableElements = [...container.querySelectorAll('.editor-item:not(.dragging)')];

      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) {
              return { offset: offset, element: child }
          } else {
              return closest;
          }
      }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
});

