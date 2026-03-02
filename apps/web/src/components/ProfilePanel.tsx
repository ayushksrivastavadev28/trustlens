"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bug,
  Check,
  ChevronRight,
  CreditCard,
  Edit2,
  Globe,
  Info,
  LogOut,
  Mail,
  Palette,
  Phone,
  Send,
  Upload,
  User,
  X
} from "lucide-react";
import { useEffect, useState } from "react";

type ProfileUser = {
  id: string;
  email: string;
  plan: "free" | "pro";
  name?: string;
  username?: string;
  phoneNumber?: string | null;
  profilePicture?: string | null;
};

type ProfilePanelProps = {
  open: boolean;
  user: ProfileUser | null;
  onClose: () => void;
  onLogout: () => void;
  onOpenPaywall: () => void;
  onUserUpdate: (updates: Partial<ProfileUser>) => void;
  theme: "default" | "light" | "dark";
  setTheme: (theme: "default" | "light" | "dark") => void;
  language: "en" | "hi";
  setLanguage: (language: "en" | "hi") => void;
};

const STRINGS = {
  en: {
    profileTitle: "Profile",
    editProfile: "Edit Profile",
    subscription: "Subscription",
    freePlan: "Free Plan",
    proPlan: "Pro Plan",
    emailLabel: "Email",
    phoneNumber: "Phone Number",
    noPhoneNumber: "Not added",
    appearance: "Appearance",
    language: "Language",
    reportBug: "Report Bug",
    about: "About",
    version: "Version",
    logout: "Logout",
    logoutConfirmTitle: "Confirm Logout",
    logoutConfirmMessage: "Are you sure you want to logout from TrustLens AI?",
    default: "Default",
    light: "Light",
    dark: "Dark",
    hindi: "Hindi",
    english: "English",
    namePlaceholder: "Enter your name",
    usernamePlaceholder: "Enter your username",
    saveChanges: "Save Changes",
    cancel: "Cancel",
    reportBugTitle: "Report a Bug",
    bugDescription: "Please describe the bug you encountered:",
    characterCounter: "characters",
    sendReport: "Send Report",
    reportSent: "Report sent successfully!"
  },
  hi: {
    profileTitle: "प्रोफाइल",
    editProfile: "प्रोफाइल संपादित करें",
    subscription: "सदस्यता",
    freePlan: "फ्री प्लान",
    proPlan: "प्रो प्लान",
    emailLabel: "ईमेल",
    phoneNumber: "फ़ोन नंबर",
    noPhoneNumber: "जोड़ा नहीं गया",
    appearance: "दिखावट",
    language: "भाषा",
    reportBug: "बग रिपोर्ट करें",
    about: "के बारे में",
    version: "संस्करण",
    logout: "लॉग आउट",
    logoutConfirmTitle: "लॉग आउट की पुष्टि करें",
    logoutConfirmMessage: "क्या आप वाकई TrustLens AI से लॉग आउट करना चाहते हैं?",
    default: "डिफ़ॉल्ट",
    light: "लाइट",
    dark: "डार्क",
    hindi: "हिंदी",
    english: "अंग्रेज़ी",
    namePlaceholder: "अपना नाम दर्ज करें",
    usernamePlaceholder: "अपना यूज़रनेम दर्ज करें",
    saveChanges: "परिवर्तन सहेजें",
    cancel: "रद्द करें",
    reportBugTitle: "बग रिपोर्ट करें",
    bugDescription: "कृपया उस बग का वर्णन करें जिसका आपने सामना किया:",
    characterCounter: "अक्षर",
    sendReport: "रिपोर्ट भेजें",
    reportSent: "रिपोर्ट सफलतापूर्वक भेज दी गई!"
  }
} as const;

export function ProfilePanel({
  open,
  user,
  onClose,
  onLogout,
  onOpenPaywall,
  onUserUpdate,
  theme,
  setTheme,
  language,
  setLanguage
}: ProfilePanelProps) {
  const [editMode, setEditMode] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugDescription, setBugDescription] = useState("");
  const [bugSent, setBugSent] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [imageFile, setImageFile] = useState<string>(user?.profilePicture || "");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSystemDark, setIsSystemDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false
  );

  const t = STRINGS[language] || STRINGS.en;

  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setUsername(user.username || "");
    setImageFile(user.profilePicture || "");
  }, [user?.id, user?.name, user?.username, user?.profilePicture]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => setIsSystemDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateSystemTheme);
    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, []);

  const handleSaveProfile = () => {
    onUserUpdate({ name, username, profilePicture: imageFile || null });
    setEditMode(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImageFile(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleThemeToggle = () => {
    const currentlyDark = theme === "dark" || (theme === "default" && isSystemDark);
    setTheme(currentlyDark ? "light" : "dark");
  };

  const handleSendBugReport = () => {
    if (!bugDescription.trim()) return;
    setBugSent(true);
    setTimeout(() => {
      setBugSent(false);
      setBugDescription("");
      setBugReportOpen(false);
    }, 1500);
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            aria-label="Close profile panel"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl dark:bg-zinc-900"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white/80 p-6 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
              <button
                onClick={onClose}
                className="rounded-full p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Back"
              >
                <ArrowLeft className="text-zinc-500" size={24} />
              </button>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t.profileTitle}</h2>
              <div className="w-10" />
            </div>

            <div className="p-6 text-center">
              <div className="relative inline-block">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-1">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white dark:bg-zinc-800">
                    {imageFile || user.profilePicture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageFile || user.profilePicture || ""} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <User className="text-zinc-400" size={40} />
                    )}
                  </div>
                </div>
                {editMode && (
                  <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-blue-600 p-2 text-white shadow-lg transition-colors hover:bg-blue-700">
                    <Upload size={16} />
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>

              {editMode ? (
                <div className="mt-4 space-y-4">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t.usernamePlaceholder}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <div className="flex justify-center gap-2 pt-2">
                    <button
                      onClick={() => setEditMode(false)}
                      className="rounded-full border border-zinc-200 px-6 py-2 font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {t.cancel}
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      className="rounded-full bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      {t.saveChanges}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{user.name || "User"}</h3>
                  <p className="text-zinc-500 dark:text-zinc-400">@{user.username || "user"}</p>
                </div>
              )}
            </div>

            <div className="space-y-2 px-4">
              {!editMode ? (
                <button
                  onClick={() => setEditMode(true)}
                  className="group flex w-full items-center justify-between rounded-2xl p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
                      <Edit2 className="text-blue-600 dark:text-blue-400" size={20} />
                    </div>
                    <span className="font-semibold text-zinc-900 dark:text-white">{t.editProfile}</span>
                  </div>
                  <ChevronRight className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" size={20} />
                </button>
              ) : null}

              <button
                onClick={onOpenPaywall}
                className="group flex w-full items-center justify-between rounded-2xl p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-900/20">
                    <CreditCard className="text-purple-600 dark:text-purple-400" size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-zinc-900 dark:text-white">{t.subscription}</p>
                    <p className="text-sm text-zinc-500">{user.plan === "pro" ? t.proPlan : t.freePlan}</p>
                  </div>
                </div>
                <ChevronRight className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" size={20} />
              </button>

              <div className="group flex w-full items-center justify-between rounded-2xl p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20">
                    <Mail className="text-green-600 dark:text-green-400" size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-zinc-900 dark:text-white">{t.emailLabel}</p>
                    <p className="text-sm text-zinc-500">{user.email}</p>
                  </div>
                </div>
                <ChevronRight className="text-zinc-400" size={20} />
              </div>

              <div className="group flex w-full items-center justify-between rounded-2xl p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-900/20">
                    <Phone className="text-orange-600 dark:text-orange-400" size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-zinc-900 dark:text-white">{t.phoneNumber}</p>
                    <p className="text-sm text-zinc-500">{user.phoneNumber || t.noPhoneNumber}</p>
                  </div>
                </div>
                <ChevronRight className="text-zinc-400" size={20} />
              </div>

              <div className="flex w-full items-center justify-between rounded-2xl p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-900/20">
                    <Palette className="text-pink-600 dark:text-pink-400" size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-zinc-900 dark:text-white">{t.appearance}</p>
                    <p className="text-sm text-zinc-500">
                      {theme === "default" ? `${t.default} (${isSystemDark ? t.dark : t.light})` : theme === "dark" ? t.dark : t.light}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleThemeToggle}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    theme === "dark" || (theme === "default" && isSystemDark) ? "bg-zinc-900" : "bg-zinc-300"
                  }`}
                  aria-label="Toggle light and dark mode"
                  title="Toggle light and dark mode"
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                      theme === "dark" || (theme === "default" && isSystemDark) ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => setLanguageOpen((v) => !v)}
                  className="group flex w-full items-center justify-between rounded-2xl p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/20">
                      <Globe className="text-indigo-600 dark:text-indigo-400" size={20} />
                    </div>
                    <span className="font-semibold text-zinc-900 dark:text-white">{t.language}</span>
                  </div>
                  <ChevronRight className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" size={20} />
                </button>

                <AnimatePresence>
                  {languageOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute left-4 right-4 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      {(["en", "hi"] as const).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => {
                            setLanguage(lang);
                            setLanguageOpen(false);
                          }}
                          className={`flex w-full items-center justify-between p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/50 ${
                            language === lang ? "bg-blue-50 dark:bg-blue-900/20" : ""
                          }`}
                        >
                          <span className="font-medium text-zinc-900 dark:text-white">{lang === "en" ? t.english : t.hindi}</span>
                          {language === lang ? <Check className="text-blue-600" size={18} /> : null}
                        </button>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <button
                onClick={() => setBugReportOpen(true)}
                className="group flex w-full items-center justify-between rounded-2xl p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
                    <Bug className="text-red-600 dark:text-red-400" size={20} />
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-white">{t.reportBug}</span>
                </div>
                <ChevronRight className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" size={20} />
              </button>

              <div className="group flex w-full items-center justify-between rounded-2xl p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-900/20">
                    <Info className="text-gray-600 dark:text-gray-400" size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-zinc-900 dark:text-white">{t.about}</p>
                    <p className="text-sm text-zinc-500">{t.version} 1.0.0</p>
                  </div>
                </div>
                <ChevronRight className="text-zinc-400" size={20} />
              </div>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="group mt-4 flex w-full items-center justify-between rounded-2xl p-4 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <LogOut className="text-red-600 dark:text-red-400" size={20} />
                  </div>
                  <span className="font-semibold text-red-600 dark:text-red-400">{t.logout}</span>
                </div>
                <ChevronRight className="text-red-400" size={20} />
              </button>
            </div>

            <AnimatePresence>
              {bugReportOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full max-w-md rounded-3xl bg-white p-6 dark:bg-zinc-900"
                  >
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t.reportBugTitle}</h3>
                      <button
                        onClick={() => setBugReportOpen(false)}
                        className="rounded-full p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        aria-label="Close"
                      >
                        <X className="text-zinc-500" size={20} />
                      </button>
                    </div>

                    {bugSent ? (
                      <div className="py-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <Check className="text-green-600" size={32} />
                        </div>
                        <p className="text-lg font-semibold text-zinc-900 dark:text-white">{t.reportSent}</p>
                      </div>
                    ) : (
                      <>
                        <p className="mb-4 text-zinc-500 dark:text-zinc-400">{t.bugDescription}</p>
                        <textarea
                          value={bugDescription}
                          onChange={(e) => setBugDescription(e.target.value)}
                          placeholder="Describe the bug..."
                          maxLength={500}
                          className="h-32 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                        />
                        <p className="mt-2 text-right text-sm text-zinc-400">
                          {bugDescription.length}/500 {t.characterCounter}
                        </p>
                        <div className="mt-6 flex gap-3">
                          <button
                            onClick={() => setBugReportOpen(false)}
                            className="flex-1 rounded-full border border-zinc-200 px-6 py-3 font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            {t.cancel}
                          </button>
                          <button
                            onClick={handleSendBugReport}
                            disabled={!bugDescription.trim()}
                            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Send size={18} />
                            {t.sendReport}
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {showLogoutConfirm ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full max-w-md rounded-3xl bg-white p-6 dark:bg-zinc-900"
                  >
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                        <LogOut className="text-red-600" size={32} />
                      </div>
                      <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-white">{t.logoutConfirmTitle}</h3>
                      <p className="mb-6 text-zinc-500 dark:text-zinc-400">{t.logoutConfirmMessage}</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowLogoutConfirm(false)}
                          className="flex-1 rounded-full border border-zinc-200 px-6 py-3 font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {t.cancel}
                        </button>
                        <button
                          onClick={() => {
                            setShowLogoutConfirm(false);
                            onLogout();
                          }}
                          className="flex-1 rounded-full bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700"
                        >
                          {t.logout}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
