import { z } from 'zod';

export const RecruitmentExtractionSchema = z.object({
  recruitment_title: z.string().nullable().describe('Official recruitment title or job headline'),
  organization: z.string().nullable().describe('Issuing organization, e.g. APPSC, SSC, RRB'),
  notification_number: z.string().nullable().describe('Official notification / CEN / Advertisement number'),
  recruitment_type: z.string().nullable().describe('Type of notice: recruitment_notification, exam_notice, etc.'),
  description: z.string().nullable().optional().describe('Official recruitment description or brief post summary explicitly stated in the notice'),

  vacancies: z.number().nullable().describe('Total number of vacancies declared in notification'),

  notification_date: z.string().nullable().optional().describe('Official notification publication date in YYYY-MM-DD format if explicitly stated'),
  application_start: z.string().nullable().describe('Application start date in YYYY-MM-DD format if explicitly stated'),
  application_end: z.string().nullable().describe('Application closing date in YYYY-MM-DD format if explicitly stated'),
  exam_date: z.string().nullable().describe('Scheduled examination date in YYYY-MM-DD format if explicitly stated'),

  age: z.object({
    minimum: z.number().nullable().describe('Minimum age requirement in years'),
    maximum: z.number().nullable().describe('Maximum age limit in years for general category'),
    relaxation: z.record(z.string(), z.string()).nullable().describe('Age relaxation details by category (e.g. SC/ST: 5 years)'),
  }),

  education: z.object({
    minimum_level: z.string().nullable().describe('Minimum education level (e.g. 10th, 12th, Graduate, Post Graduate)'),
    required_degrees: z.array(z.string()).nullable().describe('Required degree qualifications (e.g. B.Tech, B.Sc)'),
    allowed_branches: z.array(z.string()).nullable().describe('Allowed engineering/specialization branches'),
    required_subjects: z.array(z.string()).nullable().describe('Required specific subjects'),
  }),

  experience: z.object({
    required: z.boolean().nullable().describe('Whether prior work experience is mandatory'),
    details: z.string().nullable().describe('Details of required experience if applicable'),
  }),

  nationality_requirement: z.string().nullable().describe('Nationality / Citizenship requirement (e.g. Indian Citizen)'),
  domicile_requirement: z.string().nullable().describe('State domicile requirement if explicitly restricted'),

  category_requirements: z.record(z.string(), z.string()).nullable().describe('Specific reservation/category conditions'),

  gender_requirements: z.string().nullable().describe('Gender restrictions if specified (e.g. Male only, Female only, All)'),

  physical_requirements: z.record(z.string(), z.string()).nullable().describe('Physical standards (height, chest, vision, etc.) if applicable'),

  post_wise_eligibility: z.array(z.object({
    post_name: z.string(),
    vacancies: z.number().nullable(),
    education: z.string().nullable(),
    age_limit: z.string().nullable(),
  })).nullable().describe('Breakdown of eligibility rules for individual posts if notification has multiple posts'),

  important_conditions: z.array(z.string()).nullable().describe('Other mandatory eligibility rules or conditions'),

  ambiguities: z.array(z.string()).describe('List of critical eligibility fields that were missing or ambiguous in the notification content'),
});

export type RecruitmentExtraction = z.infer<typeof RecruitmentExtractionSchema>;
