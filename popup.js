window.addEventListener("load", load_popup);

function load_popup() {
    document.getElementById('get_accounts').addEventListener("click", get_all_accounts);
    document.getElementById('delete_accounts').addEventListener("click", delete_all_accounts);
    document.getElementById('okta_login').addEventListener("click", okta_login);
    document.getElementById('okta_apps_refresh').addEventListener("click", load_okta_apps);
    document.getElementById('add_role_filter').addEventListener("click", add_aws_role_filter);


    document.getElementById("accounts_tab").addEventListener("click", tab_click);
    document.getElementById("settings_tab").addEventListener("click", tab_click);
    chrome.storage.local.get(["settings"], function(result){
        if (result.settings == undefined) {result.settings = {}}
        if (result.settings.current_tab == undefined) {
            result.settings.current_tab = "settings_tab";
            chrome.storage.local.set(result);
        }
        openTab(result.settings.current_tab);
    });

    //Get saved settings
    document.getElementById("okta_domain").addEventListener("focusout", save_setting);
    document.getElementById("okta_username").addEventListener("focusout", save_setting);
    document.getElementById("okta_password").addEventListener("focusout", save_setting);
    chrome.storage.local.get(["settings"], function(result) {  
        if (result.settings == undefined) {
            return;
        }
        if (result.settings.okta_domain != undefined) {
            document.getElementById("okta_domain").value = result.settings.okta_domain;
        } 
        if (result.settings.okta_username != undefined) {
            document.getElementById("okta_username").value = result.settings.okta_username;
        } 
        if (result.settings.okta_password != undefined) {
            document.getElementById("okta_password").value = result.settings.okta_password;
        }
        if (result.settings.role_filters != undefined && result.settings.role_filters.length != 0) {
            result.settings.role_filters.forEach(filter =>{
                add_aws_role_filter(filter);
            });
        }
    });

    load_aws_accounts();
    load_okta_aws_app();
    load_okta_apps();
}

function load_aws_accounts() {
    update_accounts_status();
    var current_account = "";
    var current_role = "";
    chrome.cookies.getAll({"domain": ".amazon.com", "name": "aws-userInfo"}, function(user_info_cookies){
        if (user_info_cookies.length != 0) {
            for (i=0; i<user_info_cookies.length; i++) {
                if (user_info_cookies[i].domain === "amazon.com") {continue;}
                var userInfo = JSON.parse(decodeURIComponent(user_info_cookies[i].value));
                current_account = userInfo.alias;
                current_role = userInfo.arn.split('/')[1];
                break;
            }
        }
        chrome.storage.local.get(["accounts"], (result) => {
            if (result.accounts == undefined) {return}
            items = result.accounts;
            if (items.length == 0) {return}
            var allKeys = Object.keys(items);
            for (i=0; i<allKeys.length; i++) {
                var row_div = document.createElement('div');
                row_div.classList.add("row");

                var menu_open_btn = document.createElement('div');
                menu_open_btn.id = "open_menu";
                menu_open_btn.classList.add("menu_drop_btn");
                menu_open_btn.classList.add("fa");               
                menu_open_btn.classList.add("fa-ellipsis-v");               
                menu_open_btn.classList.add("fa-2x");
                menu_open_btn.addEventListener("click", toggle_menu);
                row_div.appendChild(menu_open_btn);

                var account_div = document.createElement('div');
                account_div.classList.add("account");
                if (current_account + '/' + current_role === allKeys[i]){
                    account_div.classList.add("select");
                }
                account_div.id = allKeys[i];
                account_div.addEventListener("click", account_change);
                row_div.appendChild(account_div);
                var account_name_role_div = document.createElement('div');
                account_name_role_div.id = "account_name_role";
                account_div.appendChild(account_name_role_div);
                var account_name_div = document.createElement('div');
                account_name_div.innerText = allKeys[i].split('/')[0];
                account_name_div.id = "account_name";
                account_name_role_div.appendChild(account_name_div);
                var account_role_div = document.createElement('div');
                account_role_div.id = "account_role";
                account_role_div.innerText = allKeys[i].split('/')[1];
                account_name_role_div.appendChild(account_role_div);
                var info_div = document.createElement('div');
                info_div.id = "status_div";
                account_div.appendChild(info_div);
                var status = items[allKeys[i]].status;
                var status_div = document.createElement('div');
                status_div.id = "status";
                status_div.innerText = status;
                info_div.appendChild(status_div);
                var account_id_div = document.createElement('div');
                account_id_div.classList.add("status");
                account_id_div.innerText = items[allKeys[i]].id;
                info_div.appendChild(account_id_div);

                var drop_content = document.createElement('div');
                drop_content.classList.add("drop_content");  
                row_div.appendChild(drop_content);
                var menu_close_btn = document.createElement('div');
                menu_close_btn.id = "close_menu";
                menu_close_btn.classList.add('menu_drop_btn');
                menu_close_btn.classList.add('fas');
                menu_close_btn.classList.add('fa-chevron-right');
                menu_close_btn.classList.add('fa-2x');
                menu_close_btn.addEventListener("click", toggle_menu)
                drop_content.appendChild(menu_close_btn);
                var menu_options = document.createElement('div');
                menu_options.classList.add("menu_options");
                drop_content.appendChild(menu_options);
                var delete_menu_option = document.createElement('div');
                delete_menu_option.classList.add("menu_option");
                delete_menu_option.addEventListener("click", delete_account);
                menu_options.appendChild(delete_menu_option);
                var delete_menu_icon = document.createElement('div');
                delete_menu_icon.classList.add("fa");
                delete_menu_icon.classList.add("fa-trash-alt");
                delete_menu_option.appendChild(delete_menu_icon);
                var delete_menu_text = document.createElement('div');
                delete_menu_text.classList.add("option_text");
                delete_menu_text.innerText = "Delete";
                delete_menu_option.appendChild(delete_menu_text);
                
                
                if (status == "ready") {
                    status_div.classList.add("green");
                    var expire_menu_option = document.createElement('div');
                    expire_menu_option.classList.add("menu_option");
                    expire_menu_option.addEventListener("click", expire_account);
                    menu_options.appendChild(expire_menu_option);
                    var expire_menu_icon = document.createElement('div');
                    expire_menu_icon.classList.add("fa");
                    expire_menu_icon.classList.add("fa-clock");
                    expire_menu_option.appendChild(expire_menu_icon);
                    var expire_menu_text = document.createElement('div');
                    expire_menu_text.classList.add("option_text");
                    expire_menu_text.innerText = "Expire";
                    expire_menu_option.appendChild(expire_menu_text);
                } else {
                    status_div.classList.add("red");
                }

                document.getElementById('accounts_div').appendChild(row_div);
            }
        });
    });
}

function load_okta_aws_app() {
    var aws_app_parent_div = document.getElementById("aws_app");
    aws_app_parent_div.querySelectorAll("div").forEach(div => {
        aws_app_parent_div.removeChild(div);
    });
    chrome.storage.local.get(["settings"], function(storage){
        if (storage.settings == undefined) {return}
        if (storage.settings.aws_app == undefined){
            document.getElementById("aws_app_status").innerText = "No AWS App selected. Please choose your AWS App from the applications list below."
            document.getElementById("aws_app_status").style.display = 'block'
        } else {
            document.getElementById("aws_app_status").style.display = 'none'
            var aws_app_div = document.createElement("div");
            aws_app_div.classList.add("okta_aws_app");
            aws_app_parent_div.appendChild(aws_app_div);
            var aws_app_img = document.createElement("img");
            aws_app_img.src = storage.settings.aws_app.logo;
            aws_app_div.appendChild(aws_app_img);
            var aws_app_label = document.createElement("span");
            aws_app_label.innerText = storage.settings.aws_app.name;
            aws_app_div.appendChild(aws_app_label);  
            var aws_app_url = document.createElement("input");
            aws_app_url.type = "hidden";
            aws_app_url.value = storage.settings.aws_app.url;   
            aws_app_div.appendChild(aws_app_url); 
            var aws_app_id = document.createElement("input");
            aws_app_id.type = "hidden";
            aws_app_id.value = storage.settings.aws_app.id;   
            aws_app_div.appendChild(aws_app_id);      
            var delete_button = document.createElement("button");
            delete_button.className = "small_button fa fa-trash-alt";
            aws_app_div.appendChild(delete_button);
            delete_button.addEventListener("click", clear_aws_app);
        }
    });
}

function load_okta_apps() {
    chrome.storage.local.get(["settings"], function(storage){
        if (storage.settings == undefined) {return}
        if (storage.settings.okta_domain == undefined) {
            aws_app_list_status.innerText = "There is no domain. Please write OKTA Domain above."
            aws_app_list_status.style.display = 'block'
            return
        }
        var okta_apps_div = document.querySelector("div.apps_list");
        okta_apps_div.innerHTML = '';
        document.getElementById("okta_apps_load").style.display = 'flex'
        var list_apps_request = new XMLHttpRequest();
        list_apps_url = "https://" + storage.settings.okta_domain + "/api/v1/users/me/home/tabs?type=all&expand=items%2Citems.resource";
        list_apps_request.open("GET", list_apps_url);
        list_apps_request.send();
        list_apps_request.onload = function() {
            if (list_apps_request.status != 200) {
                if (list_apps_request.status == 403) {
                    aws_app_list_status.innerText = "Failed to get the list of okta applications. Need to login!"
                    aws_app_list_status.style.display = 'block'
                } else {
                    aws_app_list_status.innerText = "Failed to get the list of okta applications. Status: " + list_apps_request.status;
                    aws_app_list_status.style.display = 'block'
                }
                document.getElementById("okta_apps_load").style.display = 'none'
                return
            }
            aws_app_list_status.style.display = 'none'
            var okta_tabs = JSON.parse(list_apps_request.response);
            okta_tabs.forEach(okta_tab => {
                var okta_apps = okta_tab._embedded.items;
                okta_apps.forEach(app => {
                    var app_div = document.createElement("div");
                    app_div.classList.add("okta_app");
                    okta_apps_div.appendChild(app_div);
                    var app_img = document.createElement("img");
                    app_img.src = app._embedded.resource.logoUrl;
                    app_div.appendChild(app_img);
                    var app_label = document.createElement("span");
                    app_label.innerText = app._embedded.resource.label;
                    app_div.appendChild(app_label);  
                    var app_url = document.createElement("input");
                    app_url.type = "hidden";
                    app_url.id = "app_url";
                    app_url.value = app._embedded.resource.linkUrl;   
                    app_div.appendChild(app_url); 
                    var app_id = document.createElement("input");
                    app_id.type = "hidden";
                    app_id.id = "app_id";
                    app_id.value = app.id;   
                    app_div.appendChild(app_id); 
                    app_div.addEventListener("click", select_aws_app);
                });
                document.getElementById("okta_apps_load").style.display = 'none'
            });
        }
    });
}

function select_aws_app(e) {
    var aws_app_div = e.currentTarget;
    var aws_app_name = aws_app_div.querySelector("span").innerText;
    var aws_app_id = aws_app_div.querySelector("#app_id").value;
    var aws_app_url = aws_app_div.querySelector("#app_url").value;
    var aws_app_logo = aws_app_div.querySelector("img").src;
    chrome.storage.local.get(["settings"], function(storage){
        if (storage.settings == undefined) {return}
        storage.settings.aws_app = {
            "name": aws_app_name,
            "id": aws_app_id,
            "url": aws_app_url,
            "logo": aws_app_logo
        };
        chrome.storage.local.set(storage, function(){
            load_okta_aws_app();
        });
    });
}

function clear_aws_app() {
    chrome.storage.local.get(["settings"], function(storage){
        if (storage.settings == undefined) {return}
        delete storage.settings.aws_app;
        chrome.storage.local.set(storage, function(){
            load_okta_aws_app();
        })
    });
}

function account_change(e) {
    var target = e.currentTarget;
    var account = target.id;
    chrome.runtime.sendMessage({"method": "changeAccount", "account": account});
    var account_divs = document.querySelectorAll('div.account');
    for (i=0; i<account_divs.length; i++) {
        account_divs[i].classList.remove("select");
    }
    target.classList.add("select");
}

function toggle_menu(e) {
    var target = e.currentTarget;
    var drop_div = null;
    if (target.id == "open_menu") {
        pos = 370;
        target_pos = 1;
        offset = -5;
        drop_div = target.parentElement.querySelector(".drop_content");
    } else if (target.id == "close_menu") {
        pos = 1;
        target_pos = 370;
        offset = 5;
        drop_div = target.parentElement;
    } else {
        console.log("unknown button triggered menu toggle");
        return;
    }
    id = setInterval(function() {
        if (Math.abs(target_pos - pos) < Math.abs(offset)) {
            offset = target_pos - pos;
        }
        pos+=offset;
        drop_div.style.left = pos + 'px';
        if (pos == target_pos) {
            clearInterval(id);
        }
    }, 1);
}

function get_all_accounts() {
    chrome.runtime.sendMessage({"method": "getAllAccounts"});
}

function delete_all_accounts() {
    chrome.storage.local.remove(["accounts"], function() {
        location.reload();
    });
}

function expire_account(e) {
    var account_name = e.currentTarget.closest(".row").querySelector("#account_name").innerText;
    var account_role = e.currentTarget.closest(".row").querySelector("#account_role").innerText;
    var account = account_name + '/' + account_role;
    chrome.storage.local.get(["accounts"], function(result) {
        if (result.accounts == undefined) {return}
        if (result.accounts[account] == undefined) {return}
        result.accounts[account].status = 'expired';
        chrome.storage.local.set(result, function(){location.reload()});
    });
}

function delete_account(e) {
    var account_name = e.currentTarget.closest(".row").querySelector("#account_name").innerText;
    var account_role = e.currentTarget.closest(".row").querySelector("#account_role").innerText;
    var account = account_name + '/' + account_role;
    chrome.storage.local.get(["accounts"], function(result) {
        if (result.accounts == undefined) {return}
        if (result.accounts[account] == undefined) {return}
        delete result.accounts[account];
        chrome.storage.local.set(result, function(){location.reload()});
    });
}

chrome.runtime.onMessage.addListener( function(request,sender,sendResponse) {
    if (request.method == "UpdatePopup") {
        location.reload();
    }
    else if (request.method == "UpdateLoginStatus") {
        update_login_status();
    }
    else if (request.method == "UpdateAccountsStatus") {
        update_accounts_status();
    }
});

function tab_click(e) {
    var tabName = e.currentTarget.id;
    openTab(tabName);
}

function openTab(tabName) {
    // Declare all variables
    var i, tabcontent, tablinks;
  
    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
  
    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
  
    // Show the current tab, and add an "active" class to the button that opened the tab
    document.querySelector("div#" + tabName).style.display = "block";
    document.querySelector("button#" + tabName).className += " active";
    chrome.storage.local.get(["settings"], function(storage){
        storage.settings.current_tab = tabName;
        chrome.storage.local.set(storage);
    });
}

function save_setting(e) {
    var target = e.currentTarget;
    chrome.storage.local.get(["settings"], function(result){
        if (result.settings == undefined) {
            result.settings = {};
        }
        if (target.value != ""){
            result.settings[target.id] = target.value;
        } else {
            delete result.settings[target.id];    
        }
        chrome.storage.local.set(result)
    });
}

function update_role_filters() {
    chrome.storage.local.get("settings", function(storage){
        if (storage.settings == undefined) {storage.settings = {}}
        storage.settings.role_filters = [];
        var filters = document.querySelectorAll("div.role_filter input");
        filters.forEach(filter => {
            if (filter.value != "") {
                storage.settings.role_filters.push(filter.value);
            }
        });
        chrome.storage.local.set(storage);
    });
}

function okta_login() {
    chrome.runtime.sendMessage({"method": "loginOkta"});
}

function update_login_status() {
    chrome.storage.local.get(["login_status"], function(storage){
        if (storage.login_status == undefined) {return}
        var status_div = document.getElementById("login_status_div");  
        var status_span = document.getElementById("login_status");
        var login_button = document.querySelector("button#okta_login");
        var login_button_span = login_button.querySelector("span");
        status_div.style.display = "block";
        status_span.innerText = storage.login_status.message;
        if (storage.login_status.status == "failed") {
            status_span.className = "red";
            login_button_span.innerText = "Login";
            login_button_span.className = "";
            login_button.disabled = false;
        }
        else if (storage.login_status.status == "success") {
            status_span.className = "green";
            login_button_span.innerText = "Login";
            login_button_span.className = "";
            login_button.disabled = false;
            load_okta_apps();
        }
        else if (storage.login_status.status == "progress") {
            status_span.className = "";
            login_button_span.innerText = "";
            login_button_span.className = "fas fa-spinner fa-pulse";
            login_button.disabled = true;
        } else {
            status_span.className.status = "";
            login_button_span.innerText = "Login";
            login_button_span.className = "";
            login_button.disabled = false;
        }
    });
}

function update_accounts_status() {
    chrome.storage.local.get(["accounts_status"], function(storage){
        if (storage.accounts_status == undefined) {return}
        document.getElementById("accounts_load_span").innerText = storage.accounts_status.message;
        if (storage.accounts_status.status == "success") {
            document.getElementById("accounts_load").style.display = "none";
        }
        else if (storage.accounts_status.status == "failed") {
            document.getElementById("accounts_load").style.display = "none";
        }
        else if (storage.accounts_status.status == "progress") {
            document.getElementById("accounts_load").style.display = "flex";
        }
        else {
            document.getElementById("accounts_load").style.display = "none";
        }
    });
}

function add_aws_role_filter(value) {
    if (typeof value != "string") {value = ""}
    var role_filters_list = document.getElementById("role_filters_list");
    var role_filter_div = document.createElement("div");
    role_filter_div.className = "role_filter";
    role_filters_list.appendChild(role_filter_div);
    var role_filter_input = document.createElement('input');
    role_filter_input.className = "text_setting_value";
    role_filter_input.value = value;
    role_filter_input.addEventListener("focusout", update_role_filters);
    role_filter_input.spellcheck = false;
    role_filter_div.appendChild(role_filter_input);
    var role_filter_delete_button = document.createElement('button');
    role_filter_delete_button.className = "small_button fa fa-trash-alt";
    role_filter_delete_button.addEventListener("click", delete_role_filter);
    role_filter_div.appendChild(role_filter_delete_button);
}

function delete_role_filter(e) {
    var target = e.currentTarget;
    if (target == undefined) {return};
    var role_filter_div = target.parentElement;
    var filter_value = role_filter_div.querySelector("input").value;
    document.getElementById("role_filters_list").removeChild(role_filter_div);
    chrome.storage.local.get("settings", function(storage){
        if (storage.settings == undefined) {return}
        if (storage.settings.role_filters == undefined) {return}
        var index = storage.settings.role_filters.indexOf(filter_value);
        if (index > -1) {
            storage.settings.role_filters.splice(index, 1);
        }
        chrome.storage.local.set(storage);
    });
}