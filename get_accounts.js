var radios = document.querySelectorAll('input[type="radio"]');
accounts=[];
radios.forEach(radio => {
  var account_name = radio.closest(".saml-account:not([id])").querySelector(".saml-account-name").innerText;
  var role_name = radio.value.split('/')[1];
  accounts.push({"name": account_name, "role": role_name})
});
accounts;