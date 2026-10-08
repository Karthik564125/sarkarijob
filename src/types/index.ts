export type Organization = 'SSC' | 'RRB';

export type RecruitmentStatus = 
  | 'APPLICATION OPEN' 
  | 'OPENING SOON' 
  | 'CLOSING SOON' 
  | 'NOT ELIGIBLE' 
  | 'EXAM SCHEDULED' 
  | 'APPLICATION CLOSED';

export type EligibilityStatus = 'Eligible' | 'Not Eligible' | 'Conditional';

export interface RecruitmentItem {
  id: string;
  title: string;
  organization: Organization;
  status: RecruitmentStatus;
  eligibility: EligibilityStatus;
  ineligibilityReason?: string;
  startDate: string;
  lastDate: string;
  examDate?: string;
  vacancies?: string;
  qualification: string;
  ageLimit: string;
  shortDescription: string;
  officialUrl: string;
  notificationPdfUrl?: string;
  actionRequired: boolean;
  tags?: string[];
}

export interface NotificationItem {
  id: string;
  title: string;
  organization: Organization;
  postedDate: string;
  deadline: string;
  status: 'Open' | 'Opening Soon' | 'Closed';
  eligibility: 'Eligible' | 'Not Eligible';
  link: string;
  category: string;
  isNew?: boolean;
}

export type ApplicationStatus = 'Applied' | 'Not Applied' | 'Exam Scheduled' | 'Result Pending';

export interface ApplicationTrackerItem {
  id: string;
  recruitmentName: string;
  organization: Organization;
  registrationNo: string;
  appliedDate: string;
  status: ApplicationStatus;
  examDate?: string;
  hallTicketAvailable?: boolean;
  notes?: string;
  lastUpdated: string;
}

export interface UserAccount {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
}

export interface DetailedEligibilityProfile {
  // 1. Personal Details
  fullName: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  state: string;
  category: string;

  // 2. 10th / Secondary Education
  board10: string;
  passingYear10: string;
  percentage10: string;

  // 3. Intermediate / 12th
  board12: string;
  passingYear12: string;
  stream12: string;
  percentage12: string;

  // 4. Graduation
  educationLevel: string;
  degree: string;
  branch: string;
  university: string;
  graduationYear: string;
  percentageGrad: string;

  // 5. Additional Eligibility
  workExperience: string;
  pwbdStatus: 'Yes' | 'No';
  exServiceman: 'Yes' | 'No';
  drivingLicence: 'LMV' | 'HMV' | 'None' | 'Not Applicable';
  otherCertifications: string;
}

export interface UserSettings {
  dailyUpdate: boolean;
  preferredTime: string;
  notificationEmail: boolean;
  notificationBrowser: boolean;
  notificationSms: boolean;
  sourceSSC: boolean;
  sourceRRB: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}
