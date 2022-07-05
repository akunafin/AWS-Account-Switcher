function get_all_accounts() {
    chrome.storage.local.set({"accounts_status": {"status": "progress", "message": "Retrieving list of AWS accounts..."}})
    chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
    aws_login(function(tab_id){
        chrome.tabs.executeScript(tab_id, {file: 'get_accounts.js'},
        function(accounts){
            if (chrome.runtime.lastError) {
                chrome.storage.local.set({"accounts_status": {"status": "failed", "message": chrome.runtime.lastError.message}})
                chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
                return;
            }
            chrome.storage.local.get(["accounts"], accounts_storage => {
                if (accounts_storage.accounts == undefined) {
                    accounts_storage.accounts = {}; 
                }
                chrome.storage.local.get(["settings"], settings_storage => {
                    if (settings_storage.settings == undefined) {settings_storage.settings = {}}
                    if (settings_storage.settings.role_filters == undefined) {settings_storage.settings.role_filters = []}
                    var role_filters = settings_storage.settings.role_filters;
                    accounts[0].forEach(account => {
                        var matches = account.name.match(/Account: (.+) \(([0-9]+)\)/);
                        var account_name = matches[1] + '/' + account.role;
                        var account_id = matches[2];
                        if (role_filters.length > 0 && role_filters.indexOf(account.role) == -1) {
                            if (accounts_storage.accounts[account_name] != undefined) {
                                delete accounts_storage.accounts[account_name];
                            }
                        } else {
                            if (accounts_storage.accounts[account_name] == undefined) {
                                accounts_storage.accounts[account_name] = {"id": account_id, "status": "expired"};
                            }
                        }
                    });
                    chrome.storage.local.set(accounts_storage);
                    chrome.tabs.remove(tab_id);
                    chrome.storage.local.set({accountsstatus: "ready"})
                    chrome.storage.local.set({"accounts_status": {"status": "success", "message": "Successfully retrieved the list of AWS accounts."}})
                    chrome.runtime.sendMessage({"method": "UpdatePopup"});
                });
            });
        });
    })
}

function change_account(account){
    save (false, function() {
        chrome.cookies.getAll({"domain": ".amazon.com"}, function(cookies_to_remove) {
            for (i = 0; i<cookies_to_remove.length; i++) {
                if (cookies_to_remove[i].name == "noflush_awscnm") {continue;}
                var cookie_to_remove = {};
                cookie_to_remove.name = cookies_to_remove[i].name;
                var domain = cookies_to_remove[i].domain.match(/^\.?(.+)$/)[1];
                cookie_to_remove.url = "https://" + domain + cookies_to_remove[i].path;
                cookie_to_remove.storeId = cookies_to_remove[i].storeId;
                chrome.cookies.remove(cookie_to_remove);
            }
            chrome.storage.local.get(["accounts"], function(result) {
                cookies_to_add = result["accounts"][account].cookies;
                for (i=0; i<cookies_to_add.length; i++) {
                    var cookie_to_add = cookies_to_add[i];
                    delete cookie_to_add.hostOnly;
                    delete cookie_to_add.session;
                    var domain = cookie_to_add.domain.match(/^\.?(.+)$/)[1];
                    cookie_to_add.url = "https://" + domain + cookie_to_add.path;
                    chrome.cookies.set(cookie_to_add);            
                }
                refresh_all_aws_tabs();
            });
        });
    });
}

function refresh_all_aws_tabs() {
    chrome.tabs.query({"url": "*://*.console.aws.amazon.com/*"}, tabs => {
        if (tabs.length>0) {
            for (i=0; i<tabs.length; i++) {
                chrome.tabs.reload(tabs[i].id);
            }
        } else {
            chrome.tabs.create({"url": "https://console.aws.amazon.com/"});
        }
        chrome.storage.local.set({"accounts_status": {"status": "success", "message": "Account changed sucessfully"}})
        chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
        chrome.tabs.query({ active: true, currentWindow: true }, active_tabs => {
            if (active_tabs[0] != undefined) {
                if (!active_tabs[0].url.includes("console.aws.amazon.com")) {
                    chrome.tabs.update(tabs[0].id, {selected: true});
                }
            }
        });
    });
}

function save(login, callback){
    chrome.storage.local.set({"accounts_status": {"status": "progress", "message": "Saving account cookies."}});
    chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
    var account_name, account_id, account_role;
    chrome.cookies.getAll({"domain": ".amazon.com"}, function(all_cookies){
        if (all_cookies.length == 0) {callback();return}
        for (i=0; i<all_cookies.length; i++) {
            if (all_cookies[i].name == "XSRF-TOKEN") {
                all_cookies.splice(i,1);
                i--;
            }
            if (all_cookies[i].name == "noflush_awscnm") {
                all_cookies.splice(i,1);
                i--;
            }
            if (all_cookies[i].name == "aws-userInfo") {
                if (all_cookies[i].domain === "amazon.com") {continue;}
                var userInfo = JSON.parse(decodeURIComponent(all_cookies[i].value));
                account_name = userInfo.alias;
                account_id = userInfo.arn.match(/sts::([0-9]+):/)[1];
                account_role = userInfo.arn.split('/')[1];
            }
        }
        if (account_name == undefined || account_id == undefined || account_role == undefined) {callback();return}
        var expirationDate;
        chrome.storage.local.get(["accounts"], function(storage) {
            if (storage.accounts != undefined && storage.accounts[account_name + '/' + account_role] != undefined) {
                expirationDate = storage.accounts[account_name + '/' + account_role].expirationDate;
            }
            if (login) {
                expirationDate = (Date.now()/1000) + (9 * 60 * 60);
            }
            storage.accounts[account_name + '/' + account_role] = {"id": account_id, "cookies": all_cookies, "expirationDate": expirationDate, "status": "ready"};
            chrome.storage.local.set(storage, function(){
                chrome.runtime.sendMessage({"method": "UpdatePopup"});
                callback();
            });
        });
    });
}

function login(account, callback) {
    chrome.storage.local.get(["accounts"], function(storage){
        chrome.storage.local.set({"accounts_status": {"status": "progress", "message": "Performing AWS account login"}});
        chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
        if (storage.accounts == undefined) {
            chrome.storage.local.set({"accounts_status": {"status": "failed", "message": "No accounts found in storage."}})
            chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
            return;
        }
        if (storage.accounts[account] == undefined) {
            chrome.storage.local.set({"accounts_status": {"status": "failed", "message": "No such account " + account}})
            chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
            return;
        }
        var account_id = storage.accounts[account].id;
        var account_name = account.split('/')[0];
        var account_role = account.split('/')[1];
        aws_login(function(tab_id){
            chrome.storage.local.set({"accounts_status": {"status": "progress", "message": "Performing AWS account login"}});
            chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
            chrome.tabs.executeScript(tab_id, {
                code: `document.querySelector('input[type="radio"][value*="` + account_id + `"][value*="` + account_role + `"]').checked = true; document.getElementById('signin_button').click()`
            },
            function(){
                if (chrome.runtime.lastError) {
                    chrome.storage.local.set({"accounts_status": {"status": "failed", "message": chrome.runtime.lastError.message}})
                    chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
                    return;
                }
                var console_timer = setInterval(wait_console, 1000);
                function wait_console() {
                    chrome.tabs.executeScript(tab_id, {
                        code: `window.location.href`
                    },
                    function(tab_url) {
                        if (chrome.runtime.lastError) {
                            chrome.storage.local.set({"accounts_status": {"status": "failed", "message": chrome.runtime.lastError.message}})
                            chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
                            clearInterval(console_timer);
                            return;
                        }
                        if (tab_url == undefined) {return}
                        if (tab_url[0] == undefined) {return}
                        if (tab_url[0].includes("console.aws.amazon.com")) {
                            clearInterval(console_timer);
                            save(true, function(){
                                chrome.tabs.query({"url": "*://*.console.aws.amazon.com/*"}, function(tabs){
                                    if (tabs.length > 1) {chrome.tabs.remove(tab_id);}
                                });
                                callback();   
                            });
                        }
                    });
                }
            });
        });
    });
}

function checkExpire(){
    chrome.storage.local.get(["accounts"], (result) => {
        if (result.accounts == undefined) {return}
        var items = result.accounts;
        if (items.length == 0) {return}
        var allKeys = Object.keys(items);
        var currentDate = Math.floor(Date.now() / 1000);
        for (i=0; i<allKeys.length; i++) {
            var account = allKeys[i];
            var expirationDate = items[account].expirationDate;
            var status = items[account].status;
            if (status == "expired") {
                continue;
            }
            if (expirationDate < currentDate) {
                result["accounts"][account].status = "expired";
                chrome.storage.local.set(result);
            }
        }
    });
}

chrome.runtime.onMessage.addListener( function(request,sender,sendResponse) {
    if (request.method == "changeAccount") {
        chrome.storage.local.set({"accounts_status": {"status": "progress", "message": "Retrieving list of AWS accounts..."}})
        chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
        chrome.storage.local.get(["accounts"], function(result){
            if (result.accounts == undefined) {
                chrome.storage.local.set({"accounts_status": {"status": "failed", "message": "No accounts found in storage."}})
                chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
                return;
            }
            if (result.accounts[request.account] == undefined) {
                chrome.storage.local.set({"accounts_status": {"status": "failed", "message": "No such account " + request.account}})
                chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
                return;
            }
            if (result.accounts[request.account].status == "expired") {
                login(request.account, refresh_all_aws_tabs);
            } else {
                change_account(request.account);
            }
        });
    }
    else if (request.method == "loginOkta") {
        okta_login();
    }
    else if (request.method == "getAllAccounts") {
        get_all_accounts();
    }
});

function registerAlarms(alarmName) {
    chrome.alarms.getAll(function(alarms) {
        var hasAlarm = alarms.some(function(a) {
            return a.name == alarmName;
        });
        if (hasAlarm) {
            chrome.alarms.clear(alarmName, function(){
                chrome.alarms.create(alarmName, {delayInMinutes: 1.0, periodInMinutes: 3.0});
            });
        } else {
            chrome.alarms.create(alarmName, {delayInMinutes: 1.0, periodInMinutes: 3.0});
        }
    })
}

chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name == "checkExpire") {
        checkExpire();
    }
});

chrome.idle.onStateChanged.addListener(function(state) {
    if (state == "active") {
        registerAlarms("checkExpire");
    }
});

function aws_login(callback) {
    chrome.storage.local.get(["settings"], function(storage){
        if (storage.settings == undefined) {
            chrome.storage.local.set({"accounts_status": {"status": "failed", "message": "Settings not found."}})
            chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
            return;
        } 
        if (storage.settings.aws_app == undefined) {
            chrome.storage.local.set({"accounts_status": {"status": "failed", "message": "AWS app not set!"}})
            chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
            return;
        }
        if (storage.settings.okta_domain == undefined) {
            chrome.storage.local.set({"accounts_status": {"status": "failed", "message": "OKTA domain not set!"}})
            chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
            return;
        };
        var aws_saml_url = storage.settings.aws_app.url;
        //Check okta login
        var list_apps_request = new XMLHttpRequest();
        list_apps_url = "https://" + storage.settings.okta_domain + "/api/v1/users/me/home/tabs";
        list_apps_request.open("GET", list_apps_url);
        list_apps_request.send();
        list_apps_request.onload = function() {
            if (list_apps_request.status != 200) {
                chrome.storage.local.set({"accounts_status": {"status": "progress", "message": "Performing okta login"}})
                chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
                okta_login(aws_login, callback);
                return;
            }
            chrome.storage.local.set({"accounts_status": {"status": "progress", "message": "Opening AWS login page"}})
            chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
            chrome.tabs.create({"url": aws_saml_url, "selected": false}, function(tab) {
                var signin_timer = setInterval(wait_signin, 1000);
                function wait_signin(){           
                    chrome.tabs.executeScript(tab.id, {
                        code: `window.location.href`
                    },
                    function(tab_url){
                        if (chrome.runtime.lastError) {
                            chrome.storage.local.set({"accounts_status": {"status": "failed", "message": chrome.runtime.lastError.message}})
                            chrome.runtime.sendMessage({"method": "UpdateAccountsStatus"});
                            return;
                        }
                        if (tab_url != "https://signin.aws.amazon.com/saml") {return}
                        clearInterval(signin_timer);
                        callback(tab.id);
                    });
                }
            });
        }
    });
}

function okta_login(callback, callback_argument = null) {
    console.log('okta login');
    chrome.storage.local.get(["settings"], function(storage){
        chrome.storage.local.set({"login_status": {"status": "progress", "message": "signing in to okta..."}});
        chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
        if (storage.settings == undefined) {
            chrome.storage.local.set({"login_status": {"status": "failed", "message": "Login failed! No settings found"}});
            chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
            return;
        }
        if (storage.settings.okta_domain == undefined) {
            chrome.storage.local.set({"login_status": {"status": "failed", "message": "Login failed! OKTA domain not set"}});
            chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
            return;
        }
        if (storage.settings.okta_username == undefined) {
            chrome.storage.local.set({"login_status": {"status": "failed", "message": "Login failed! OKTA username not set"}});
            chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
            return;
        }
        if (storage.settings.okta_password == undefined) {
            chrome.storage.local.set({"login_status": {"status": "failed", "message": "Login failed! OKTA password not set"}});
            chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
            return;
        }
        var domain = storage.settings.okta_domain;
        var username = storage.settings.okta_username;
        var password = storage.settings.okta_password;

        var authn = new XMLHttpRequest(); 
        var authn_url = "https://" + domain + "/api/v1/authn";
        var authn_body = {"username":username,"password":password};
        authn.open("POST", authn_url);
        authn.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        authn.send(JSON.stringify(authn_body));
        authn.onload = function() {
            if (authn.status != 200) {
                chrome.storage.local.set({"login_status": {"status": "failed", "message": "Login failed! Login request got response code " + authn.status}});
                chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
                return;
            }
            authn_response = JSON.parse(authn.response);

            //MFA if requested
            if (authn_response.status == "MFA_REQUIRED") {
                let factor_id = null;
                authn_response._embedded.factors.forEach(factor => {
                    if (factor.factorType == "push") {
                        factor_id = factor.id;
                        return;
                    }
                });
                if (!factor_id) {
                    chrome.storage.local.set({"login_status": {"status": "failed", "message": "Login failed! MFA failed"}});
                    chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
                    return
                }
                let mfa_url = "https://" + domain + '/api/v1/authn/factors/' + factor_id + '/verify'
                let mfa_body = {
                    factorId: factor_id,
                    stateToken: authn_response.stateToken
                };
                let mfa_try_count = 0;
                let mfa_interval = setInterval(function() {
                    mfa_try_count++;
                    let mfa_request = new XMLHttpRequest();
                    mfa_request.open("POST", mfa_url);
                    mfa_request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                    mfa_request.send(JSON.stringify(mfa_body));
                    mfa_request.onload = function() {
                        if (mfa_request.status != 200) {
                            chrome.storage.local.set({"login_status": {"status": "failed", "message": "Login failed! MFA failed"}});
                            chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
                            clearInterval(mfa_interval);
                            return;
                        }
                        let mfa_response = JSON.parse(mfa_request.response);
                        console.log(mfa_response);
                        if (mfa_response.status == 'MFA_CHALLENGE') {
                            chrome.storage.local.set({"login_status": {"status": "progress", "message": "Okta PUSH notification sent. Waiting for approve."}});
                            chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
                        } else if (mfa_response.status == 'SUCCESS') {
                            console.log('mfa success');
                            chrome.storage.local.set({"login_status": {"status": "progress", "message": "OKTA MFA authentication success"}});
                            chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
                            clearInterval(mfa_interval);
                            getSessionCookie(callback, callback_argument, mfa_response.sessionToken);
                        }
                        if (mfa_try_count > 11) {
                            chrome.storage.local.set({"login_status": {"status": "failed", "message": "OKTA MFA failed. PUSH not approved"}});
                            chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
                            clearInterval(mfa_interval);
                        }
                    }
                }, 5000);
            } else {
                getSessionCookie(callback, callback_argument, authn_response.sessionToken);
            }

        }
    });
}

function getSessionCookie(callback, callback_argument, sessionToken) {
    chrome.storage.local.get(["settings"], function(storage){
        var domain = storage.settings.okta_domain;
        var cookie_url = "https://" + domain + "/login/sessionCookieRedirect?checkAccountSetupComplete=true&token=" + sessionToken + "&redirectUrl=https%3A%2F%2F" + domain + "%2Fuser%2Fnotifications"
        var cookie_request = new XMLHttpRequest(); 
        cookie_request.open("GET", cookie_url);
        cookie_request.send();
        cookie_request.onload = function() {
            if (cookie_request.status == 200) {
                chrome.storage.local.set({"login_status": {"status": "success", "message": "Login success!"}});
                chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
                if (callback) {
                    callback(callback_argument);
                }
                return;
            } else {
                chrome.storage.local.set({"login_status": {"status": "failed", "message": "Login failed! Update cookie request got response code " + cookie_request.status}});
                chrome.runtime.sendMessage({"method": "UpdateLoginStatus"});
                return;
            }
        }
    });
}

registerAlarms("checkExpire");

chrome.storage.local.remove("accounts_status");
chrome.storage.local.remove("login_status");
