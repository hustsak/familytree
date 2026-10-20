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
  invitations: {
    title: string;
    subtitle: string;
    invitedBy: string;
    roleOffered: string;
    expiresIn: string;
    acceptBtn: string;
    alreadyAccepted: string;
    invalidTitle: string;
    invalidSubtitle: string;
    inviteRelativeBtn: string;
    inviteModalTitle: string;
    inviteModalSubtitle: string;
    emailPlaceholder: string;
    sendInviteBtn: string;
    inviteGenerated: string;
    copyLink: string;
    copied: string;
  };
  onboarding: {
    title: string;
    subtitle: string;
    step1: string;
    step2: string;
    step3: string;
    firstNameLabel: string;
    lastNameLabel: string;
    khmerNameLabel: string;
    genderLabel: string;
    genderMale: string;
    genderFemale: string;
    genderOther: string;
    birthYearLabel: string;
    relationPrompt: string;
    relationParent: string;
    relationGrandparent: string;
    relationGreatGrandparent: string;
    relationRoot: string;
    searchRelativePlaceholder: string;
    noRelativesFound: string;
    selectedAnchor: string;
    submitBtn: string;
    submitting: string;
    successTitle: string;
    successDesc: string;
    viewTreeBtn: string;
    clarificationTitle: string;
    clarificationPrompt: string;
    duplicateWarningTitle: string;
    step4: string;
    confirmBranch: string;
    draftRestored: string;
    connectViaGrandparentNotice: string;
    selectParentPrompt: string;
    selectGrandparentPrompt: string;
  };
  tree: {
    findMyself: string;
    focusBranch: string;
    siblings: string;
    memories: string;
    noMemories: string;
    verifiedBadge: string;
    disputedBadge: string;
    pendingBadge: string;
    living: string;
    deceased: string;
    relativesInTree: string;
    searchPlaceholder: string;
    emptyTreeTitle: string;
    emptyTreeDesc: string;
    establishFoundingBtn: string;
  };
  adminDashboard: {
    title: string;
    subtitle: string;
    tabRequests: string;
    tabAudit: string;
    statusFilterAll: string;
    statusFilterPending: string;
    statusFilterClarification: string;
    statusFilterApproved: string;
    statusFilterRejected: string;
    noRequestsTitle: string;
    noRequestsDesc: string;
    requestedBy: string;
    proposedPerson: string;
    targetAnchor: string;
    relationType: string;
    submittedOn: string;
    duplicateWarning: string;
    reviewModalTitle: string;
    reviewDecisionPrompt: string;
    approveBtn: string;
    rejectBtn: string;
    clarifyBtn: string;
    adminNotesPlaceholder: string;
    resolutionActionLabel: string;
    actionCreateNew: string;
    actionLinkExisting: string;
    explicitParentLabel: string;
    auditTrailTitle: string;
    auditAction: string;
    auditActor: string;
    auditTime: string;
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
    invitations: {
      title: "Family Lineage Invitation",
      subtitle: "You have been personally summoned to join a private sacred family sanctuary.",
      invitedBy: "Invited by",
      roleOffered: "Lineage Role",
      expiresIn: "Expires on",
      acceptBtn: "Accept & Enter Lineage",
      alreadyAccepted: "This invitation token has already been claimed.",
      invalidTitle: "Invalid or Expired Invitation",
      invalidSubtitle: "This invitation link is no longer valid. Please contact your family council administrator for a fresh link.",
      inviteRelativeBtn: "Invite Relative",
      inviteModalTitle: "Summon a Family Relative",
      inviteModalSubtitle: "Generate an invitation link to invite a relative into this private sanctuary.",
      emailPlaceholder: "relative@familyheritage.org",
      sendInviteBtn: "Generate Invitation",
      inviteGenerated: "Invitation Created Successfully",
      copyLink: "Copy Invite Link",
      copied: "Copied to clipboard!",
    },
    onboarding: {
      title: "Lineage Onboarding",
      subtitle: "Register your real identity and weave yourself into the family tree.",
      step1: "1. Real Identity",
      step2: "2. Ancestral Anchor",
      step3: "3. Branch Verification",
      firstNameLabel: "First Name",
      lastNameLabel: "Last Name",
      khmerNameLabel: "Khmer Name (Optional)",
      genderLabel: "Gender",
      genderMale: "Male",
      genderFemale: "Female",
      genderOther: "Other",
      birthYearLabel: "Birth Year (Optional)",
      relationPrompt: "Identify an existing relative in this tree as your:",
      relationParent: "Parent (Father or Mother)",
      relationGrandparent: "Grandparent",
      relationGreatGrandparent: "Great-Grandparent",
      relationRoot: "Founding Patriarch / Matriarch (Tree Root)",
      searchRelativePlaceholder: "Type to search relatives by name...",
      noRelativesFound: "No relatives found matching your query.",
      selectedAnchor: "Selected Anchor Relative",
      submitBtn: "Verify Lineage & Connect",
      submitting: "Weaving into family tree...",
      successTitle: "Lineage Connected Successfully",
      successDesc: "Your node has been verified and placed into the interactive family tree.",
      viewTreeBtn: "Open Interactive Tree",
      clarificationTitle: "Lineage Clarification Needed",
      clarificationPrompt: "Multiple branches were detected. Please specify your exact parent to prevent guessing relationships:",
      duplicateWarningTitle: "Potential Duplicate Relative Detected",
      step4: "4. Join Family Tree",
      confirmBranch: "Confirm Family Branch & Kinship",
      draftRestored: "Saved onboarding progress restored from draft.",
      connectViaGrandparentNotice: "Parent not listed yet? You can connect through an existing grandparent or great-grandparent.",
      selectParentPrompt: "Select your parent from existing relatives in this tree:",
      selectGrandparentPrompt: "Select your grandparent or great-grandparent:",
    },
    tree: {
      findMyself: "Find Myself",
      focusBranch: "Focus Branch",
      siblings: "Siblings",
      memories: "Memories & Archives",
      noMemories: "No memories or archival photos uploaded yet.",
      verifiedBadge: "Verified Lineage",
      disputedBadge: "Disputed Relationship",
      pendingBadge: "Pending Council Approval",
      living: "Living",
      deceased: "Deceased",
      relativesInTree: "relatives recorded in lineage",
      searchPlaceholder: "Search relatives by name (English or Khmer)...",
      emptyTreeTitle: "Empty Family Tree",
      emptyTreeDesc: "This family space has no relatives recorded yet. Onboard the founding patriarch or matriarch to begin.",
      establishFoundingBtn: "Establish Founding Ancestor",
    },
    adminDashboard: {
      title: "Family Council & Lineage Approvals",
      subtitle: "Review incoming relative connection requests, clarify ambiguous branches, and protect genealogical accuracy.",
      tabRequests: "Connection Queue",
      tabAudit: "Lineage Audit Trail",
      statusFilterAll: "All Requests",
      statusFilterPending: "Pending Review",
      statusFilterClarification: "Clarification Needed",
      statusFilterApproved: "Approved",
      statusFilterRejected: "Rejected",
      noRequestsTitle: "No Connection Requests Found",
      noRequestsDesc: "There are currently no connection requests matching the selected filter for this family space.",
      requestedBy: "Requested By",
      proposedPerson: "Proposed Relative",
      targetAnchor: "Target Ancestral Anchor",
      relationType: "Claimed Relationship",
      submittedOn: "Submitted On",
      duplicateWarning: "Duplicate Warning Flagged",
      reviewModalTitle: "Council Review Decision",
      reviewDecisionPrompt: "Select the council's decision regarding this lineage connection request:",
      approveBtn: "Approve Connection",
      rejectBtn: "Reject Connection",
      clarifyBtn: "Request Clarification",
      adminNotesPlaceholder: "Add optional council notes or instructions for the relative...",
      resolutionActionLabel: "Duplicate Person Resolution",
      actionCreateNew: "Create as distinct relative (confirmed separate individual)",
      actionLinkExisting: "Link to existing relative profile in tree",
      explicitParentLabel: "Specify Direct Parent ID (Required for multi-generation branches)",
      auditTrailTitle: "Council Decisions & Lineage Audit Log",
      auditAction: "Action Taken",
      auditActor: "Council Member",
      auditTime: "Date & Time",
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
    invitations: {
      title: "លិខិតអញ្ជើញចូលរួមពង្សាវតារ",
      subtitle: "អ្នកត្រូវបានអញ្ជើញឱ្យចូលរួមក្នុងដែនពង្សាវតារគ្រួសារឯកជនដ៏ពិសិដ្ឋ។",
      invitedBy: "អញ្ជើញដោយ",
      roleOffered: "តួនាទីក្នុងខ្សែស្រឡាយ",
      expiresIn: "ផុតកំណត់នៅថ្ងៃ",
      acceptBtn: "ទទួលយក និងចូលរួមក្នុងខ្សែស្រឡាយ",
      alreadyAccepted: "តំណភ្ជាប់អញ្ជើញនេះត្រូវបានប្រើប្រាស់រួចហើយ។",
      invalidTitle: "តំណភ្ជាប់មិនត្រឹមត្រូវ ឬផុតកំណត់",
      invalidSubtitle: "តំណភ្ជាប់អញ្ជើញនេះលែងមានសុពលភាពហើយ។ សូមទាក់ទងអ្នកគ្រប់គ្រងគ្រួសារដើម្បីសុំតំណថ្មី។",
      inviteRelativeBtn: "អញ្ជើញសាច់ញាតិ",
      inviteModalTitle: "អញ្ជើញសាច់ញាតិគ្រួសារ",
      inviteModalSubtitle: "បង្កើតតំណភ្ជាប់អញ្ជើញដើម្បីអញ្ជើញសាច់ញាតិចូលរួមក្នុងដែនឯកជននេះ។",
      emailPlaceholder: "relative@familyheritage.org",
      sendInviteBtn: "បង្កើតតំណអញ្ជើញ",
      inviteGenerated: "បានបង្កើតតំណអញ្ជើញដោយជោគជ័យ",
      copyLink: "ចម្លងតំណអញ្ជើញ",
      copied: "បានចម្លងទៅក្តារតម្បៀតខ្ទាស់!",
    },
    onboarding: {
      title: "ការចុះឈ្មោះចូលក្នុងខ្សែស្រឡាយ",
      subtitle: "សូមបញ្ចូលឈ្មោះពិតរបស់អ្នក និងតភ្ជាប់ខ្លួនអ្នកទៅក្នុងដើមឈើគ្រួសារ។",
      step1: "១. អត្តសញ្ញាណពិត",
      step2: "២. ជ្រើសរើសបុព្វការីជនបង្គោល",
      step3: "៣. ការផ្ទៀងផ្ទាត់មែកធាង",
      firstNameLabel: "នាមខ្លួន",
      lastNameLabel: "នាមត្រកូល",
      khmerNameLabel: "ឈ្មោះជាភាសាខ្មែរ (ស្រេចចិត្ត)",
      genderLabel: "ភេទ",
      genderMale: "ប្រុស",
      genderFemale: "ស្រី",
      genderOther: "ផ្សេងទៀត",
      birthYearLabel: "ឆ្នាំកំណើត (ស្រេចចិត្ត)",
      relationPrompt: "កំណត់សាច់ញាតិបង្គោលដែលមានស្រាប់ជា៖",
      relationParent: "ឪពុក ឬម្តាយ (Parent)",
      relationGrandparent: "ជីតា ឬជីដូន (Grandparent)",
      relationGreatGrandparent: "ទួត (Great-Grandparent)",
      relationRoot: "ដូនតាដើម ឬមេគ្រួសារដំបូង (Root)",
      searchRelativePlaceholder: "វាយបញ្ចូលឈ្មោះដើម្បីស្វែងរកសាច់ញាតិ...",
      noRelativesFound: "មិនមានសាច់ញាតិត្រូវនឹងការស្វែងរកឡើយ។",
      selectedAnchor: "សាច់ញាតិបង្គោលដែលបានជ្រើសរើស",
      submitBtn: "ផ្ទៀងផ្ទាត់ខ្សែស្រឡាយ និងតភ្ជាប់",
      submitting: "កំពុងតភ្ជាប់ចូលក្នុងដើមឈើ...",
      successTitle: "បានតភ្ជាប់ខ្សែស្រឡាយដោយជោគជ័យ",
      successDesc: "ទិន្នន័យរបស់អ្នកត្រូវបានផ្ទៀងផ្ទាត់ និងបញ្ចូលទៅក្នុងដើមឈើគ្រួសារអន្តរកម្ម។",
      viewTreeBtn: "បើកមើលដើមឈើគ្រួសារ",
      clarificationTitle: "ត្រូវការបញ្ជាក់មែកធាងគ្រួសារ",
      clarificationPrompt: "ប្រព័ន្ធបានរកឃើញមែកធាងច្រើន។ សូមជ្រើសរើសឪពុក ឬម្តាយពិតប្រាកដរបស់អ្នកដើម្បីជៀសវាងការស្មាន៖",
      duplicateWarningTitle: "រកឃើញឈ្មោះសាច់ញាតិស្រដៀងគ្នា",
      step4: "៤. ចូលរួមដើមឈើគ្រួសារ",
      confirmBranch: "ផ្ទៀងផ្ទាត់សាខាគ្រួសារ & ទំនាក់ទំនង",
      draftRestored: "បានស្តារវឌ្ឍនភាពដែលបានរក្សាទុកដោយជោគជ័យ។",
      connectViaGrandparentNotice: "ឪពុកម្តាយមិនទាន់មានក្នុងដើមឈើ? អ្នកអាចតភ្ជាប់តាមរយៈជីដូនជីតា ឬទួតបាន។",
      selectParentPrompt: "ជ្រើសរើសឪពុក ឬម្តាយរបស់អ្នកពីសាច់ញាតិដែលមានស្រាប់៖",
      selectGrandparentPrompt: "ជ្រើសរើសជីដូនជីតា ឬទួតរបស់អ្នក៖",
    },
    tree: {
      findMyself: "ស្វែងរកខ្លួនខ្ញុំ",
      focusBranch: "ផ្តោតលើសាខាគ្រួសារ",
      siblings: "បងប្អូនបង្កើត",
      memories: "អនុស្សាវរីយ៍ & បណ្ណសារ",
      noMemories: "មិនទាន់មានរូបថត ឬអនុស្សាវរីយ៍ត្រូវបានបង្ហោះនៅឡើយទេ។",
      verifiedBadge: "ខ្សែស្រឡាយផ្ទៀងផ្ទាត់រួច",
      disputedBadge: "ទំនាក់ទំនងកំពុងជំទាស់",
      pendingBadge: "រង់ចាំការអនុម័តពីក្រុមប្រឹក្សា",
      living: "នៅរស់",
      deceased: "ទទួលមរណភាព",
      relativesInTree: "នាក់ក្នុងខ្សែស្រឡាយ",
      searchPlaceholder: "ស្វែងរកសាច់ញាតិតាមឈ្មោះ (ខ្មែរ ឬអង់គ្លេស)...",
      emptyTreeTitle: "មិនទាន់មានទិន្នន័យដើមឈើគ្រួសារ",
      emptyTreeDesc: "ដែនគ្រួសារនេះមិនទាន់មានសាច់ញាតិណាម្នាក់នៅឡើយទេ។ សូមចុះឈ្មោះមេគ្រួសារដំបូងដើម្បីចាប់ផ្តើម។",
      establishFoundingBtn: "ចុះឈ្មោះមេគ្រួសារដំបូង",
    },
    adminDashboard: {
      title: "ក្រុមប្រឹក្សាគ្រួសារ & ការអនុម័តខ្សែស្រឡាយ",
      subtitle: "ពិនិត្យសំណើសុំតភ្ជាប់សាច់ញាតិ បញ្ជាក់មែកធាងដែលមិនច្បាស់លាស់ និងការពារភាពត្រឹមត្រូវនៃពង្សាវតារ។",
      tabRequests: "បញ្ជីសំណើតភ្ជាប់",
      tabAudit: "កំណត់ហេតុសវនកម្មខ្សែស្រឡាយ",
      statusFilterAll: "សំណើទាំងអស់",
      statusFilterPending: "រង់ចាំការពិនិត្យ",
      statusFilterClarification: "ត្រូវការការបញ្ជាក់",
      statusFilterApproved: "បានអនុម័ត",
      statusFilterRejected: "បានបដិសេធ",
      noRequestsTitle: "មិនមានសំណើតភ្ជាប់នៅឡើយទេ",
      noRequestsDesc: "បច្ចុប្បន្នមិនមានសំណើតភ្ជាប់ណាមួយស្របតាមតម្រងដែលបានជ្រើសរើសសម្រាប់ដែនគ្រួសារនេះទេ។",
      requestedBy: "ស្នើសុំដោយ",
      proposedPerson: "សាច់ញាតិដែលបានស្នើសុំ",
      targetAnchor: "បុព្វបុរសបង្គោល",
      relationType: "ទំនាក់ទំនងដែលបានប្រកាស",
      submittedOn: "កាលបរិច្ឆេទស្នើសុំ",
      duplicateWarning: "ការព្រមានរកឃើញឈ្មោះស្រដៀងគ្នា",
      reviewModalTitle: "ការសម្រេចចិត្តរបស់ក្រុមប្រឹក្សា",
      reviewDecisionPrompt: "សូមជ្រើសរើសការសម្រេចចិត្តរបស់ក្រុមប្រឹក្សាគ្រួសារលើសំណើតភ្ជាប់នេះ៖",
      approveBtn: "អនុម័តការតភ្ជាប់",
      rejectBtn: "បដិសេធសំណើ",
      clarifyBtn: "ស្នើសុំការបញ្ជាក់បន្ថែម",
      adminNotesPlaceholder: "បន្ថែមចំណាំរបស់ក្រុមប្រឹក្សា ឬការណែនាំដល់សាច់ញាតិ...",
      resolutionActionLabel: "ដំណោះស្រាយចំពោះឈ្មោះស្រដៀងគ្នា",
      actionCreateNew: "បង្កើតជាសាច់ញាតិថ្មី (បញ្ជាក់ថាជាមនុស្សផ្សេងគ្នា)",
      actionLinkExisting: "ភ្ជាប់ទៅកាន់ប្រវត្តិរូបសាច់ញាតិដែលមានស្រាប់ក្នុងដើមឈើ",
      explicitParentLabel: "កំណត់លេខសម្គាល់ឪពុកម្តាយផ្ទាល់ (ចាំបាច់សម្រាប់មែកធាងឆ្លងជំនាន់)",
      auditTrailTitle: "កំណត់ហេតុការសម្រេចចិត្ត & សវនកម្ម",
      auditAction: "សកម្មភាព",
      auditActor: "សមាជិកក្រុមប្រឹក្សា",
      auditTime: "កាលបរិច្ឆេទ & ពេលវេលា",
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
