import CryptoJS from 'crypto-js';

// In a real app, this key would be hidden or exchanged securely.
const SECRET_KEY = 'my-super-secret-privex-key';

export const encryptMessage = (text) => {
  if (!text) return '';
  // Encrypts text and turns it into a Base64 string
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

export const decryptMessage = (cipherText) => {
  if (!cipherText) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    return 'Error: Could not decrypt';
  }
};