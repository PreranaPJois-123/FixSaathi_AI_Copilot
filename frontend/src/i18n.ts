import { useCallback } from 'react'
import { useAuth } from './context/AuthContext'
import type { Language } from './types'

const en = {
  newChat: 'New chat', home: 'Home', searchChats: 'Search chats', noChats: 'No chats yet. Start one above.', noMatch: 'No chats match your search.',
  more: 'More', today: 'Today', yesterday: 'Yesterday', prev7: 'Previous 7 days', older: 'Older',
  history: 'Repair History', reports: 'Service Reports', diagnoses: 'Saved Diagnoses', senior: 'Senior Technician Support', manager: 'Manager Dashboard', demo: 'Demo Scenarios',
  profile: 'Profile', settings: 'Settings', help: 'Help and Support', signOut: 'Sign out', openProfileMenu: 'Open profile menu',
  rename: 'Rename', delete: 'Delete', deleteTitle: 'Delete this chat?', deleteBody: 'This removes the chat, its messages and photos. It cannot be undone.',
  cancel: 'Cancel', deleteChat: 'Delete chat', deleteFailed: 'Could not delete this chat.', renameFailed: 'Could not rename this chat.',
  account: 'Account', preferredLanguage: 'Preferred language', langNote: "Saved to your account. FixSaathi's AI replies and live voice use this language, and the app menus follow it too.",
  appearance: 'Appearance', appearanceNote: 'Applies instantly and is remembered on this device.', dark: 'Dark', light: 'Light', system: 'System default',
}
export type Key = keyof typeof en

const hi: Record<Key, string> = {
  newChat: 'नई चैट', home: 'होम', searchChats: 'चैट खोजें', noChats: 'अभी कोई चैट नहीं। ऊपर से शुरू करें।', noMatch: 'कोई चैट नहीं मिली।',
  more: 'और', today: 'आज', yesterday: 'कल', prev7: 'पिछले 7 दिन', older: 'पुरानी',
  history: 'मरम्मत इतिहास', reports: 'सर्विस रिपोर्ट', diagnoses: 'सहेजे गए निदान', senior: 'सीनियर टेक्नीशियन सहायता', manager: 'मैनेजर डैशबोर्ड', demo: 'डेमो परिदृश्य',
  profile: 'प्रोफ़ाइल', settings: 'सेटिंग्स', help: 'सहायता', signOut: 'साइन आउट', openProfileMenu: 'प्रोफ़ाइल मेनू खोलें',
  rename: 'नाम बदलें', delete: 'हटाएँ', deleteTitle: 'यह चैट हटाएँ?', deleteBody: 'इससे चैट, उसके संदेश और फ़ोटो हट जाएँगे। इसे वापस नहीं किया जा सकता।',
  cancel: 'रद्द करें', deleteChat: 'चैट हटाएँ', deleteFailed: 'यह चैट हटाई नहीं जा सकी।', renameFailed: 'नाम बदला नहीं जा सका।',
  account: 'खाता', preferredLanguage: 'पसंदीदा भाषा', langNote: 'आपके खाते में सहेजी जाती है। FixSaathi के AI उत्तर, लाइव वॉइस और ऐप के मेनू इसी भाषा में होंगे।',
  appearance: 'दिखावट', appearanceNote: 'तुरंत लागू होती है और इस डिवाइस पर याद रखी जाती है।', dark: 'डार्क', light: 'लाइट', system: 'सिस्टम डिफ़ॉल्ट',
}
const kn: Record<Key, string> = {
  newChat: 'ಹೊಸ ಚಾಟ್', home: 'ಮುಖಪುಟ', searchChats: 'ಚಾಟ್‌ಗಳನ್ನು ಹುಡುಕಿ', noChats: 'ಇನ್ನೂ ಚಾಟ್‌ಗಳಿಲ್ಲ. ಮೇಲಿನಿಂದ ಪ್ರಾರಂಭಿಸಿ.', noMatch: 'ಯಾವುದೇ ಚಾಟ್ ಸಿಗಲಿಲ್ಲ.',
  more: 'ಇನ್ನಷ್ಟು', today: 'ಇಂದು', yesterday: 'ನಿನ್ನೆ', prev7: 'ಕಳೆದ 7 ದಿನಗಳು', older: 'ಹಳೆಯವು',
  history: 'ದುರಸ್ತಿ ಇತಿಹಾಸ', reports: 'ಸೇವಾ ವರದಿಗಳು', diagnoses: 'ಉಳಿಸಿದ ರೋಗನಿರ್ಣಯಗಳು', senior: 'ಹಿರಿಯ ತಂತ್ರಜ್ಞರ ಸಹಾಯ', manager: 'ಮ್ಯಾನೇಜರ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', demo: 'ಡೆಮೊ ಸನ್ನಿವೇಶಗಳು',
  profile: 'ಪ್ರೊಫೈಲ್', settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು', help: 'ಸಹಾಯ ಮತ್ತು ಬೆಂಬಲ', signOut: 'ಸೈನ್ ಔಟ್', openProfileMenu: 'ಪ್ರೊಫೈಲ್ ಮೆನು ತೆರೆಯಿರಿ',
  rename: 'ಹೆಸರು ಬದಲಿಸಿ', delete: 'ಅಳಿಸಿ', deleteTitle: 'ಈ ಚಾಟ್ ಅಳಿಸಬೇಕೆ?', deleteBody: 'ಇದು ಚಾಟ್, ಅದರ ಸಂದೇಶಗಳು ಮತ್ತು ಫೋಟೋಗಳನ್ನು ತೆಗೆದುಹಾಕುತ್ತದೆ. ಇದನ್ನು ಹಿಂದಕ್ಕೆ ಪಡೆಯಲು ಸಾಧ್ಯವಿಲ್ಲ.',
  cancel: 'ರದ್ದುಮಾಡಿ', deleteChat: 'ಚಾಟ್ ಅಳಿಸಿ', deleteFailed: 'ಈ ಚಾಟ್ ಅಳಿಸಲು ಆಗಲಿಲ್ಲ.', renameFailed: 'ಹೆಸರು ಬದಲಿಸಲು ಆಗಲಿಲ್ಲ.',
  account: 'ಖಾತೆ', preferredLanguage: 'ಆದ್ಯತೆಯ ಭಾಷೆ', langNote: 'ನಿಮ್ಮ ಖಾತೆಯಲ್ಲಿ ಉಳಿಸಲಾಗುತ್ತದೆ. FixSaathi ಯ AI ಉತ್ತರಗಳು, ಲೈವ್ ಧ್ವನಿ ಮತ್ತು ಆ್ಯಪ್ ಮೆನುಗಳು ಈ ಭಾಷೆಯಲ್ಲಿರುತ್ತವೆ.',
  appearance: 'ನೋಟ', appearanceNote: 'ತಕ್ಷಣ ಅನ್ವಯವಾಗುತ್ತದೆ ಮತ್ತು ಈ ಸಾಧನದಲ್ಲಿ ನೆನಪಿನಲ್ಲಿರುತ್ತದೆ.', dark: 'ಡಾರ್ಕ್', light: 'ಲೈಟ್', system: 'ಸಿಸ್ಟಮ್ ಡೀಫಾಲ್ಟ್',
}
const ta: Record<Key, string> = {
  newChat: 'புதிய அரட்டை', home: 'முகப்பு', searchChats: 'அரட்டைகளைத் தேடு', noChats: 'இன்னும் அரட்டைகள் இல்லை. மேலே தொடங்குங்கள்.', noMatch: 'பொருந்தும் அரட்டை இல்லை.',
  more: 'மேலும்', today: 'இன்று', yesterday: 'நேற்று', prev7: 'கடந்த 7 நாட்கள்', older: 'பழையவை',
  history: 'பழுது வரலாறு', reports: 'சேவை அறிக்கைகள்', diagnoses: 'சேமித்த கண்டறிதல்கள்', senior: 'மூத்த தொழில்நுட்ப வல்லுநர் உதவி', manager: 'மேலாளர் டாஷ்போர்டு', demo: 'டெமோ சூழ்நிலைகள்',
  profile: 'சுயவிவரம்', settings: 'அமைப்புகள்', help: 'உதவி மற்றும் ஆதரவு', signOut: 'வெளியேறு', openProfileMenu: 'சுயவிவர மெனுவைத் திற',
  rename: 'பெயர் மாற்று', delete: 'நீக்கு', deleteTitle: 'இந்த அரட்டையை நீக்கவா?', deleteBody: 'இது அரட்டை, அதன் செய்திகள் மற்றும் புகைப்படங்களை நீக்கும். இதை மீட்க முடியாது.',
  cancel: 'ரத்து செய்', deleteChat: 'அரட்டையை நீக்கு', deleteFailed: 'இந்த அரட்டையை நீக்க முடியவில்லை.', renameFailed: 'பெயரை மாற்ற முடியவில்லை.',
  account: 'கணக்கு', preferredLanguage: 'விருப்ப மொழி', langNote: 'உங்கள் கணக்கில் சேமிக்கப்படும். FixSaathi இன் AI பதில்கள், நேரடி குரல் மற்றும் செயலி மெனுக்கள் இந்த மொழியில் இருக்கும்.',
  appearance: 'தோற்றம்', appearanceNote: 'உடனே செயல்படும்; இந்தச் சாதனத்தில் நினைவில் இருக்கும்.', dark: 'டார்க்', light: 'லைட்', system: 'சிஸ்டம் இயல்புநிலை',
}
const dict: Record<Language, Record<Key, string>> = { English: en, Hindi: hi, Kannada: kn, Tamil: ta }

export function useT() {
  const { user } = useAuth()
  const lang = user?.preferred_language ?? 'English'
  return useCallback((k: Key) => (dict[lang] ?? en)[k] ?? en[k], [lang])
}
