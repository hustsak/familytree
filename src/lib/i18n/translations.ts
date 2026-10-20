export type SupportedLanguage = "en" | "km";

export interface Translations {
  appName: string;
  appSubtitle: string;
  tagline: string;
  language: string;
  english: string;
  khmer: string;
  nav: {
    dashboard: string;
    tree: string;
    directory: string;
    archive: string;
    admin: string;
    signOut: string;
    signIn: string;
    register: string;
  };
  auth: {
    welcomeBack: string;
    signInTitle: string;
    signInSubtitle: string;
    signUpTitle: string;
    signUpSubtitle: string;
    emailLabel: string;
    passwordLabel: string;
    fullNameLabel: string;
    signInBtn: string;
    signUpBtn: string;
    alreadyHaveAccount: string;
    dontHaveAccount: string;
    invitationOnlyNotice: string;
    orContinueWith: string;
    loading: string;
  };
  spaces: {
    mySpaces: string;
    createSpace: string;
    spaceName: string;
    spaceDesc: string;
    createSpaceBtn: string;
    noSpaces: string;
    noSpacesDesc: string;
    privateBadge: string;
    membersCount: string;
    enterSpace: string;
    roleOwner: string;
    roleAdmin: string;
    roleMember: string;
  };
  heritage: {
    sacredBonds: string;
    preserveLegacy: string;
    generationsConnected: string;
    exploreAncestry: string;
    honorAncestors: string;
  };
}

export const translations: Record<SupportedLanguage, Translations> = {
  en: {
    appName: "Family Heritage",
    appSubtitle: "Sacred Ancestry & Living Genealogy",
    tagline: "Connecting relatives across generations in an invitation-only family sanctuary.",
    language: "Language",
    english: "English",
    khmer: "ភាសាខ្មែរ",
    nav: {
      dashboard: "Family Spaces",
      tree: "Interactive Tree",
      directory: "Relatives",
      archive: "Heritage Vault",
      admin: "Council & Approvals",
      signOut: "Sign Out",
      signIn: "Sign In",
      register: "Create Account",
    },
    auth: {
      welcomeBack: "Welcome back to your family sanctuary",
      signInTitle: "Enter Your Heritage",
      signInSubtitle: "Sign in with your private family credentials",
      signUpTitle: "Begin Your Family Journey",
      signUpSubtitle: "Register to join or create your private family space",
      emailLabel: "Email Address",
      passwordLabel: "Password",
      fullNameLabel: "Full Legal Name",
      signInBtn: "Enter Family Sanctuary",
      signUpBtn: "Create Family Account",
      alreadyHaveAccount: "Already registered?",
      dontHaveAccount: "Have an invitation?",
      invitationOnlyNotice: "Private & Invitation-Only: Your lineage data is strictly isolated and never publicly indexed.",
      orContinueWith: "Or connect via",
      loading: "Securing connection...",
    },
    spaces: {
      mySpaces: "Your Private Family Spaces",
      createSpace: "Create New Family Space",
      spaceName: "Family Name (e.g. The Ly Family Lineage)",
      spaceDesc: "Brief description or ancestral origin",
      createSpaceBtn: "Establish Family Space",
      noSpaces: "No Family Spaces Found",
      noSpacesDesc: "You are not yet a member of any family spaces. Create your family sanctuary or ask a family admin for an invitation.",
      privateBadge: "Private & Encrypted",
      membersCount: "relatives",
      enterSpace: "Enter Lineage",
      roleOwner: "Patriarch / Matriarch (Owner)",
      roleAdmin: "Council Guardian (Admin)",
      roleMember: "Family Member",
    },
    heritage: {
      sacredBonds: "Sacred Family Bonds",
      preserveLegacy: "Preserve every generation's name, story, and voice for posterity.",
      generationsConnected: "Generations Connected",
      exploreAncestry: "Explore Ancestry",
      honorAncestors: "Honoring our ancestors and guiding our descendants.",
    },
  },
  km: {
    appName: "កេរ្តិ៍ដំណែលគ្រួសារ",
    appSubtitle: "ពង្សាវតារ និងខ្សែស្រឡាយដូនតា",
    tagline: "ការតភ្ជាប់សាច់ញាតិគ្រប់ជំនាន់ ក្នុងដែនគ្រួសារឯកជន និងសុវត្ថិភាពខ្ពស់។",
    language: "ភាសា",
    english: "English",
    khmer: "ភាសាខ្មែរ",
    nav: {
      dashboard: "ដែនគ្រួសារ",
      tree: "ដើមឈើគ្រួសារ",
      directory: "បញ្ជីសាច់ញាតិ",
      archive: "បណ្ណសារប្រវត្តិ",
      admin: "ក្រុមប្រឹក្សា & ការអនុម័ត",
      signOut: "ចាកចេញ",
      signIn: "ចូលប្រើ",
      register: "ចុះឈ្មោះ",
    },
    auth: {
      welcomeBack: "សូមស្វាគមន៍ការវិលត្រឡប់មកកាន់ដែនគ្រួសាររបស់អ្នក",
      signInTitle: "ចូលកាន់ដែនពង្សាវតារ",
      signInSubtitle: "សូមបញ្ចូលព័ត៌មានសម្ងាត់គ្រួសាររបស់អ្នក",
      signUpTitle: "ចាប់ផ្តើមដំណើរពង្សាវតាររបស់អ្នក",
      signUpSubtitle: "ចុះឈ្មោះដើម្បីបង្កើត ឬចូលរួមដែនគ្រួសារឯកជន",
      emailLabel: "អាសយដ្ឋានអ៊ីមែល",
      passwordLabel: "ពាក្យសម្ងាត់",
      fullNameLabel: "ឈ្មោះពេញ (អក្សរខ្មែរ ឬឡាតាំង)",
      signInBtn: "ចូលកាន់ដែនគ្រួសារ",
      signUpBtn: "បង្កើតគណនីគ្រួសារ",
      alreadyHaveAccount: "មានគណនីរួចហើយ?",
      dontHaveAccount: "ទទួលបានការអញ្ជើញ?",
      invitationOnlyNotice: "ឯកជនភាពដាច់ខាត៖ ទិន្នន័យខ្សែស្រឡាយរបស់អ្នកត្រូវបានរក្សាការសម្ងាត់ និងមិនផ្សព្វផ្សាយជាសាធារណៈឡើយ។",
      orContinueWith: "ឬចូលតាមរយៈ",
      loading: "កំពុងភ្ជាប់ទិន្នន័យ...",
    },
    spaces: {
      mySpaces: "ដែនគ្រួសារឯកជនរបស់អ្នក",
      createSpace: "បង្កើតដែនគ្រួសារថ្មី",
      spaceName: "ឈ្មោះត្រកូល (ឧទាហរណ៍៖ ខ្សែស្រឡាយត្រកូលលី)",
      spaceDesc: "ការពិពណ៌នាសង្ខេប ឬប្រភពដើមដូនតា",
      createSpaceBtn: "បង្កើតដែនគ្រួសារ",
      noSpaces: "មិនទាន់មានដែនគ្រួសារនៅឡើយទេ",
      noSpacesDesc: "អ្នកមិនទាន់ជាសមាជិកនៃដែនគ្រួសារណាមួយនៅឡើយ។ សូមបង្កើតដែនគ្រួសារដំបូងរបស់អ្នក ឬសុំលិខិតអញ្ជើញពីអ្នកគ្រប់គ្រងគ្រួសារ។",
      privateBadge: "ឯកជន និងសុវត្ថិភាពខ្ពស់",
      membersCount: "សមាជិកសាច់ញាតិ",
      enterSpace: "ចូលមើលខ្សែស្រឡាយ",
      roleOwner: "មេគ្រួសារ (ម្ចាស់)",
      roleAdmin: "អ្នកគ្រប់គ្រងក្រុមប្រឹក្សា",
      roleMember: "សមាជិកគ្រួសារ",
    },
    heritage: {
      sacredBonds: "ចំណងគ្រួសារដ៏ពិសិដ្ឋ",
      preserveLegacy: "ថែរក្សាឈ្មោះ រឿងរ៉ាវ និងប្រវត្តិសាស្ត្ររបស់បុព្វការីជនគ្រប់ជំនាន់។",
      generationsConnected: "ជំនាន់ដែលបានតភ្ជាប់",
      exploreAncestry: "រុករកពង្សាវតារ",
      honorAncestors: "គោរពដឹងគុណបុព្វបុរស និងចង្អុលបង្ហាញផ្លូវដល់កូនចៅជំនាន់ក្រោយ។",
    },
  },
};
