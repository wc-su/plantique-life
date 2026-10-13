const authErrorMessages = Object.freeze({
  user_already_exists: '此信箱已經註冊過',
  email_exists: '此信箱已經註冊過',
  weak_password: '密碼強度不足',
  invalid_credentials: '帳號或密碼錯誤',
  email_address_invalid: '此信箱無法使用，請換一個',
  validation_failed: '輸入的資料格式有誤',
  over_request_rate_limit: '操作太頻繁，請稍後再試',
  email_not_confirmed: '請先到信箱完成驗證',
});

export function getAuthErrorMessage(code) {
  const message = authErrorMessages[code];
  return message ?? '發生錯誤，請稍後再試';
}
