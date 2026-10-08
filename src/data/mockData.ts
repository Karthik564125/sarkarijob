import type { 
  RecruitmentItem, 
  NotificationItem, 
  ApplicationTrackerItem, 
  UserAccount, 
  DetailedEligibilityProfile, 
  UserSettings, 
  ChecklistItem 
} from '../types';

export const initialUserAccount: UserAccount = {
  fullName: 'Karthik S',
  username: 'karthik',
  email: 'karthik@example.com',
  phone: '+91 98765 43210',
  password: 'karthik',
};

export const initialDetailedEligibility: DetailedEligibilityProfile = {
  // 1. Personal
  fullName: 'Karthik S',
  dob: '1998-05-14',
  gender: 'Male',
  state: 'Karnataka',
  category: 'General (UR)',

  // 2. 10th
  board10: 'CBSE',
  passingYear10: '2014',
  percentage10: '92.4%',

  // 3. 12th
  board12: 'Karnataka State Board (PUC)',
  passingYear12: '2016',
  stream12: 'Science (PCMC)',
  percentage12: '88.5%',

  // 4. Graduation
  educationLevel: 'Graduation / Bachelor Degree',
  degree: 'B.Tech',
  branch: 'Computer Science & Engineering',
  university: 'Visvesvaraya Technological University (VTU)',
  graduationYear: '2020',
  percentageGrad: '81.2%',

  // 5. Additional
  workExperience: '2 Years (Software Development)',
  pwbdStatus: 'No',
  exServiceman: 'No',
  drivingLicence: 'LMV',
  otherCertifications: 'AWS Certified Cloud Practitioner, NPTEL Algorithms',
};

export const initialUserSettings: UserSettings = {
  dailyUpdate: true,
  preferredTime: '08:00 AM',
  notificationEmail: true,
  notificationBrowser: true,
  notificationSms: false,
  sourceSSC: true,
  sourceRRB: true,
};

export const mockRecruitments: RecruitmentItem[] = [
  {
    id: 'ssc-cgl-2026',
    title: 'SSC CGL 2026 (Combined Graduate Level)',
    organization: 'SSC',
    status: 'APPLICATION OPEN',
    eligibility: 'Eligible',
    startDate: '24 Sep 2026',
    lastDate: '24 Oct 2026',
    examDate: '15 Dec 2026',
    vacancies: '17,727 Posts',
    qualification: 'Bachelor\'s Degree in any discipline from a recognized University',
    ageLimit: '18 - 30 Years (as on 01/08/2026)',
    shortDescription: 'Staff Selection Commission conducts CGL for Group B and Group C Inspector, Assistant Section Officer, and Auditor posts in Central Ministries.',
    officialUrl: 'https://ssc.gov.in',
    notificationPdfUrl: 'https://ssc.gov.in/notifications/cgl-2026-advt.pdf',
    actionRequired: true,
    tags: ['Group B', 'Group C', 'Graduate Level', 'Pan India']
  },
  {
    id: 'rrb-ntpc-grad-2026',
    title: 'RRB NTPC Graduate Level Posts 2026',
    organization: 'RRB',
    status: 'OPENING SOON',
    eligibility: 'Eligible',
    startDate: '12 Nov 2026',
    lastDate: '12 Dec 2026',
    examDate: 'Feb 2027 (Tentative)',
    vacancies: '8,113 Posts',
    qualification: 'Graduation Degree from a recognized University',
    ageLimit: '18 - 33 Years',
    shortDescription: 'Railway Recruitment Board Non-Technical Popular Categories recruitment for Goods Train Manager, Station Master, Senior Clerk, and Commercial Apprentice.',
    officialUrl: 'https://indianrailways.gov.in',
    notificationPdfUrl: 'https://indianrailways.gov.in/rrb-ntpc-2026.pdf',
    actionRequired: false,
    tags: ['Indian Railways', 'Station Master', 'Graduate']
  },
  {
    id: 'ssc-je-2026',
    title: 'SSC Junior Engineer (Civil, Mechanical, Electrical) 2026',
    organization: 'SSC',
    status: 'NOT ELIGIBLE',
    eligibility: 'Not Eligible',
    ineligibilityReason: 'Required qualification (Diploma/Degree in Civil, Mechanical, or Electrical Engineering) does not match your profile (B.Tech Computer Science & Engineering).',
    startDate: '10 Oct 2026',
    lastDate: '10 Nov 2026',
    examDate: 'Jan 2027',
    vacancies: '1,765 Posts',
    qualification: 'Degree/Diploma in Civil, Mechanical, or Electrical Engineering',
    ageLimit: '18 - 32 Years',
    shortDescription: 'Junior Engineer positions across CPWD, Military Engineer Services (MES), and Central Water Commission.',
    officialUrl: 'https://ssc.gov.in',
    actionRequired: false,
    tags: ['Technical', 'Engineering Stream Required']
  },
  {
    id: 'ssc-chsl-2026',
    title: 'SSC CHSL 2026 (Combined Higher Secondary Level)',
    organization: 'SSC',
    status: 'CLOSING SOON',
    eligibility: 'Eligible',
    startDate: '01 Sep 2026',
    lastDate: '08 Oct 2026',
    examDate: '18 Nov 2026',
    vacancies: '3,712 Posts',
    qualification: '12th Standard or equivalent from a recognized board',
    ageLimit: '18 - 27 Years',
    shortDescription: 'Recruitment for Lower Division Clerk (LDC), Junior Secretariat Assistant (JSA), and Data Entry Operator (DEO).',
    officialUrl: 'https://ssc.gov.in',
    notificationPdfUrl: 'https://ssc.gov.in/chsl-2026-notice.pdf',
    actionRequired: true,
    tags: ['LDC', 'DEO', '12th Pass']
  },
  {
    id: 'rrb-technician-2026',
    title: 'RRB Technician Grade I & III Recruitment 2026',
    organization: 'RRB',
    status: 'APPLICATION OPEN',
    eligibility: 'Eligible',
    startDate: '15 Sep 2026',
    lastDate: '16 Oct 2026',
    examDate: 'Dec 2026',
    vacancies: '9,144 Posts',
    qualification: 'B.Sc / B.Tech in Electronics / CS / IT / Physics / Engineering or ITI (Grade dependent)',
    ageLimit: '18 - 36 Years',
    shortDescription: 'Grade I Signal & Telecommunication Technician and Grade III workshop technicians across Indian Railway zones.',
    officialUrl: 'https://indianrailways.gov.in',
    actionRequired: true,
    tags: ['Signal & Telecom', 'Technician']
  }
];

export const mockNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'SSC CGL 2026 Official Detailed Notification Released (17,727 Vacancies)',
    organization: 'SSC',
    postedDate: 'Today, 09:30 AM',
    deadline: '24 Oct 2026',
    status: 'Open',
    eligibility: 'Eligible',
    link: '#ssc-cgl-2026',
    category: 'Application Window',
    isNew: true
  },
  {
    id: 'notif-2',
    title: 'RRB NTPC 2026 Tentative Exam Schedule & Short Notice Issued',
    organization: 'RRB',
    postedDate: 'Yesterday, 04:15 PM',
    deadline: '12 Dec 2026',
    status: 'Opening Soon',
    eligibility: 'Eligible',
    link: '#rrb-ntpc-grad-2026',
    category: 'Exam Notice',
    isNew: true
  },
  {
    id: 'notif-3',
    title: 'SSC CHSL Tier 1 Admit Card & Status Released for South Region',
    organization: 'SSC',
    postedDate: '03 Oct 2026',
    deadline: '08 Oct 2026',
    status: 'Open',
    eligibility: 'Eligible',
    link: '#ssc-chsl-2026',
    category: 'Admit Card'
  },
  {
    id: 'notif-4',
    title: 'RRB ALP 2026 Stage-II Revised Syllabus & Instructions Document',
    organization: 'RRB',
    postedDate: '01 Oct 2026',
    deadline: 'N/A',
    status: 'Open',
    eligibility: 'Eligible',
    link: '#',
    category: 'Syllabus Update'
  },
  {
    id: 'notif-5',
    title: 'SSC Selection Post Phase XII Final Answer Key & Cutoff Declared',
    organization: 'SSC',
    postedDate: '28 Sep 2026',
    deadline: 'Closed',
    status: 'Closed',
    eligibility: 'Not Eligible',
    link: '#',
    category: 'Result / Answer Key'
  }
];

export const mockApplications: ApplicationTrackerItem[] = [
  {
    id: 'app-1',
    recruitmentName: 'SSC CGL 2026',
    organization: 'SSC',
    registrationNo: 'SSC2026-98432178',
    appliedDate: '26 Sep 2026',
    status: 'Applied',
    examDate: '15 Dec 2026',
    hallTicketAvailable: false,
    notes: 'Payment confirmed. Registration form saved to local downloads.',
    lastUpdated: '26 Sep 2026'
  },
  {
    id: 'app-2',
    recruitmentName: 'SSC CHSL 2026',
    organization: 'SSC',
    registrationNo: 'SSC2026-55120984',
    appliedDate: '15 Sep 2026',
    status: 'Exam Scheduled',
    examDate: '18 Nov 2026 (Shift 2: 12:30 PM)',
    hallTicketAvailable: true,
    notes: 'Exam City: Bengaluru. Admit card available for download.',
    lastUpdated: '03 Oct 2026'
  },
  {
    id: 'app-3',
    recruitmentName: 'RRB Technician Grade I (Signal)',
    organization: 'RRB',
    registrationNo: 'RRB26-88001923',
    appliedDate: 'Pending',
    status: 'Not Applied',
    notes: 'Document verification draft saved. Need photo with white background.',
    lastUpdated: '01 Oct 2026'
  },
  {
    id: 'app-4',
    recruitmentName: 'SSC Selection Post Phase XI',
    organization: 'SSC',
    registrationNo: 'SSC2025-11029384',
    appliedDate: '14 May 2025',
    status: 'Result Pending',
    examDate: '10 Aug 2025',
    notes: 'Tier 1 cleared. Awaiting final merit list verification.',
    lastUpdated: '20 Sep 2026'
  }
];

export const initialChecklist: ChecklistItem[] = [
  { id: 'chk-1', text: 'Check SSC notifications', completed: true },
  { id: 'chk-2', text: 'Check RRB notifications', completed: true },
  { id: 'chk-3', text: 'Apply for SSC CGL 2026', completed: false },
  { id: 'chk-4', text: 'Review upcoming exam syllabus & dates', completed: false },
];
