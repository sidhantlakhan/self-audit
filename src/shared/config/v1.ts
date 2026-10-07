import type { AssessmentConfig, DimensionDef, DimensionId, Question, QuestionType, ScoringRule } from '../types.ts';
import { LISTS } from './lists.ts';

export const ASSESSMENT_VERSION = 'v1';
export const SCORING_VERSION = 'v1';

const V = ASSESSMENT_VERSION;
const o = (values: string[]) => values.map((value) => ({ value }));
const map = (pairs: Record<string, number>): ScoringRule => ({ kind: 'map', map: pairs });

type Base = Partial<Question> & { id: string; phase: number; type: QuestionType; label: string };
const q = (b: Base): Question => ({
  dimension: 'context',
  required: true,
  weight: 1,
  scored: false,
  aiRelevant: true,
  opportunityRelevant: false,
  version: V,
  ...b,
});

const OWN: DimensionId = 'ownership_decision_making';
const PRO: DimensionId = 'processes_workflows';
const DAT: DimensionId = 'data_systems_technology';
const PEO: DimensionId = 'people_controls_governance';
const PER: DimensionId = 'performance_business_control';

export const DIMENSIONS: DimensionDef[] = [
  { id: OWN, label: 'Ownership & Decision Making', short: 'Ownership', weight: 0.15, description: 'Who owns what, who decides, and how much the business depends on the founder.' },
  { id: PRO, label: 'Processes & Workflows', short: 'Processes', weight: 0.25, description: 'How well recurring work is defined, followed and consistent.' },
  { id: DAT, label: 'Data, Systems & Technology', short: 'Data & Systems', weight: 0.3, description: 'Whether business information is captured, accurate, current and connected.' },
  { id: PEO, label: 'People, Controls & Governance', short: 'People & Controls', weight: 0.2, description: 'Team readiness, data-sharing rules, access controls and review discipline.' },
  { id: PER, label: 'Performance & Business Control', short: 'Performance', weight: 0.1, description: 'Visibility of results, metric ownership and the quality of management information.' },
];

const QUESTIONS: Question[] = [
  // ── Phase 1 — Business Context ─────────────────────────────────────
  q({ id: 'Q1.1', phase: 1, type: 'short_text', label: 'Your name', field: 'respondent_name', validation: { minLength: 2, maxLength: 120 }, aiRelevant: false }),
  q({ id: 'Q1.2', phase: 1, type: 'short_text', label: 'Business name', field: 'business_name', validation: { minLength: 2, maxLength: 160 } }),
  q({ id: 'Q1.3', phase: 1, type: 'phone', label: 'Mobile number', field: 'mobile', helpText: 'Used to identify your assessment and to resume it. Indian (+91) and international numbers are accepted.', aiRelevant: false }),
  q({ id: 'Q1.4', phase: 1, type: 'email', label: 'Email address', field: 'email', validation: { maxLength: 200 }, aiRelevant: false }),
  q({ id: 'Q1.5', phase: 1, type: 'single_select', label: 'Your role', field: 'role', options: o(['Founder', 'Co-founder', 'CEO/Managing Director', 'Director', 'Business Head', 'Other']) }),
  q({ id: 'Q1.6', phase: 1, type: 'single_select', label: 'Industry', field: 'industry', optionsFrom: 'industries' }),
  q({ id: 'Q1.7', phase: 1, type: 'multi_select', label: 'Business model', description: 'Select all that apply.', field: 'business_model', options: o(['B2B', 'B2C', 'D2C', 'B2B2C', 'Manufacturing', 'Trading/Distribution', 'Retail', 'Services', 'Project-based', 'Subscription', 'Other']) }),
  q({ id: 'Q1.8', phase: 1, type: 'single_select', label: 'Annual turnover', field: 'turnover_range', optionsFrom: 'turnover' }),
  q({ id: 'Q1.9', phase: 1, type: 'single_select', label: 'Team size', description: 'Total number of people, including part-time and contract staff.', field: 'team_size', optionsFrom: 'team_size' }),
  q({ id: 'Q1.10', phase: 1, type: 'single_select', label: 'Years in operation', field: 'years_in_operation', optionsFrom: 'years' }),

  // ── Phase 2 — Ownership & Decision Making ──────────────────────────
  q({ id: 'Q2.1', phase: 2, dimension: OWN, type: 'rating', label: 'How clearly are responsibilities assigned across your key business functions?', scale: { low: 'Not clear', high: 'Very clear' }, scored: true, scoring: { kind: 'rating' } }),
  q({ id: 'Q2.2', phase: 2, dimension: OWN, type: 'single_select', label: 'How often is the founder personally involved in day-to-day operational decisions?', options: o(['Almost never', 'Occasionally', 'Several times a week', 'Daily', 'Multiple times a day']), scored: true, weight: 1.5,
    scoring: map({ 'Almost never': 100, Occasionally: 75, 'Several times a week': 50, Daily: 25, 'Multiple times a day': 0 }) }),
  q({ id: 'Q2.3', phase: 2, dimension: OWN, type: 'multi_select', label: 'Where does your team have authority to decide without the founder?', description: 'Select all that apply.',
    options: o(['Customer handling', 'Pricing within defined limits', 'Purchasing', 'Discounts', 'Hiring', 'Vendor decisions', 'Operational decisions', 'Financial decisions', 'None']), exclusiveOptions: ['None'], scored: true,
    scoring: { kind: 'multi', max: 5, points: { 'Customer handling': 1, 'Pricing within defined limits': 1, Purchasing: 1, Discounts: 1, Hiring: 1, 'Vendor decisions': 1, 'Operational decisions': 1, 'Financial decisions': 1, None: 0 } } }),
  q({ id: 'Q2.4', phase: 2, dimension: OWN, type: 'single_select', label: 'If you were unavailable for two weeks, what would happen to the business?', options: o(['Business would operate normally', 'Minor delays', 'Several decisions delayed', 'Major operational disruption', 'Business would struggle significantly']), scored: true, weight: 1.5,
    scoring: map({ 'Business would operate normally': 100, 'Minor delays': 75, 'Several decisions delayed': 50, 'Major operational disruption': 20, 'Business would struggle significantly': 0 }) }),
  q({ id: 'Q2.5', phase: 2, dimension: OWN, type: 'multi_select', label: 'Where does the knowledge needed to run the business mainly sit?', description: 'Select all that apply.',
    options: o(['Documented SOPs', 'Business software', 'Reports/dashboards', 'Employee knowledge', 'Founder knowledge', 'WhatsApp', 'Email', 'Excel/Sheets', 'Other']), scored: true,
    scoring: { kind: 'multi', max: 6, points: { 'Documented SOPs': 2, 'Business software': 2, 'Reports/dashboards': 2, 'Employee knowledge': 1, 'Founder knowledge': -2, WhatsApp: -1, Email: 0, 'Excel/Sheets': 1, Other: 0 } } }),
  q({ id: 'Q2.6', phase: 2, dimension: OWN, type: 'rating', label: 'When an unusual situation occurs, how clearly does your team know who can decide what to do?', scale: { low: 'Not clear', high: 'Very clear' }, scored: true, scoring: { kind: 'rating' } }),
  q({ id: 'Q2.7', phase: 2, dimension: OWN, type: 'multi_select', label: 'Which functions still depend on the founder for important decisions or execution?', description: 'Select all that apply.',
    options: o(['Sales', 'Marketing', 'Operations', 'Finance', 'HR', 'Procurement', 'Customer service', 'Technology', 'Other', 'None']), exclusiveOptions: ['None'], scored: true,
    scoring: { kind: 'inverse_count', total: 9, ignore: ['None'] } }),
  q({ id: 'Q2.8', phase: 2, dimension: OWN, type: 'rating', label: 'How confident are you that important responsibilities can be delegated without losing control?', scale: { low: 'Not confident', high: 'Very confident' }, scored: true, scoring: { kind: 'rating' } }),

  // ── Phase 3 — Processes & Workflows ────────────────────────────────
  q({ id: 'Q3.1', phase: 3, dimension: PRO, type: 'single_select', label: 'What proportion of your key recurring processes is documented?', options: o(['None', 'A few processes', 'Around 25%', 'Around 50%', 'Most', 'Almost all']), scored: true,
    scoring: map({ None: 0, 'A few processes': 15, 'Around 25%': 30, 'Around 50%': 55, Most: 80, 'Almost all': 100 }) }),
  q({ id: 'Q3.2', phase: 3, dimension: PRO, type: 'rating', label: 'How consistently are documented processes actually followed?', scale: { low: 'Rarely followed', high: 'Always followed' }, scored: true, scoring: { kind: 'rating' } }),
  q({ id: 'Q3.3', phase: 3, dimension: PRO, type: 'single_select', label: 'How often can a new employee learn a core task from existing documentation, without relying on the founder or a colleague?', options: o(['Almost always', 'Usually', 'Sometimes', 'Rarely', 'Almost never']), scored: true,
    scoring: map({ 'Almost always': 100, Usually: 75, Sometimes: 50, Rarely: 20, 'Almost never': 0 }) }),
  q({ id: 'Q3.4', phase: 3, dimension: PRO, type: 'rating', label: 'How consistently is the same task performed the same way by different people?', scale: { low: 'Very inconsistent', high: 'Very consistent' }, scored: true, scoring: { kind: 'rating' } }),
  q({ id: 'Q3.5', phase: 3, dimension: PRO, type: 'single_select', label: 'When the same error recurs, what is the usual response?', options: o(['Employee corrected', 'Employee retrained', 'Process changed', 'Additional approval added', 'No defined response']), scored: true,
    scoring: map({ 'Process changed': 100, 'Additional approval added': 55, 'Employee retrained': 45, 'Employee corrected': 25, 'No defined response': 0 }) }),
  q({ id: 'Q3.6', phase: 3, dimension: PRO, type: 'multi_select', label: 'Which activities in your business are repetitive?', description: 'Select all that apply.', options: o(['Data entry', 'Sales follow-up', 'Customer communication', 'Reporting', 'Documentation', 'Order processing', 'Procurement', 'Inventory', 'Finance-admin', 'HR-admin', 'Marketing', 'Customer support', 'Other', 'None']), exclusiveOptions: ['None'], opportunityRelevant: true }),
  q({ id: 'Q3.7', phase: 3, dimension: PRO, type: 'single_select', label: 'How often do processes break down or need urgent manual intervention?', options: o(['Very rarely', 'Occasionally', 'Frequently', 'Constantly', 'Processes not clearly defined']), scored: true,
    scoring: map({ 'Very rarely': 100, Occasionally: 70, Frequently: 35, Constantly: 10, 'Processes not clearly defined': 0 }) }),
  q({ id: 'Q3.8', phase: 3, dimension: PRO, type: 'rating', label: 'How clearly is ownership assigned for your key recurring processes?', scale: { low: 'Not clear', high: 'Very clear' }, scored: true, scoring: { kind: 'rating' } }),

  // ── Phase 4 — Data, Systems & Technology ───────────────────────────
  q({ id: 'Q4.1', phase: 4, dimension: DAT, type: 'multi_select', label: 'Which systems does your business use today?', description: 'Select all that apply.',
    options: o(['Tally', 'Zoho', 'SAP', 'Salesforce', 'Busy', 'ERP', 'CRM', 'HRMS', 'Inventory software', 'Excel', 'Google Sheets', 'WhatsApp Business', 'Custom software', 'Email', 'Other', 'Mostly manual']), exclusiveOptions: ['Mostly manual'], scored: true,
    scoring: { kind: 'multi', max: 4, points: { Tally: 1, Zoho: 1, SAP: 1, Salesforce: 1, Busy: 1, ERP: 1.5, CRM: 1.5, HRMS: 1, 'Inventory software': 1, Excel: 0.5, 'Google Sheets': 0.5, 'WhatsApp Business': 0, 'Custom software': 1, Email: 0, Other: 0.5, 'Mostly manual': 0 } } }),
  q({ id: 'Q4.2', phase: 4, dimension: DAT, type: 'multi_select', label: 'Where does important business information actually live?', description: 'Select all that apply.',
    options: o(['ERP', 'CRM', 'Accounting software', 'Excel/Sheets', 'Cloud storage', 'WhatsApp', 'Email', 'Paper', 'Employee knowledge', 'Founder knowledge', 'Multiple disconnected systems']), scored: true,
    scoring: { kind: 'multi', max: 4, points: { ERP: 2, CRM: 2, 'Accounting software': 1.5, 'Excel/Sheets': 0.5, 'Cloud storage': 1, WhatsApp: -1, Email: -0.5, Paper: -1.5, 'Employee knowledge': -1.5, 'Founder knowledge': -2, 'Multiple disconnected systems': -2 } } }),
  q({ id: 'Q4.3', phase: 4, dimension: DAT, type: 'single_select', label: "How quickly can you retrieve last month's customer-wise sales information?", options: o(['Immediately', 'Within a few minutes', 'Within an hour', 'Same day', 'Someone needs to prepare it', 'Difficult/unavailable']), scored: true, weight: 1.5,
    scoring: map({ Immediately: 100, 'Within a few minutes': 90, 'Within an hour': 70, 'Same day': 45, 'Someone needs to prepare it': 20, 'Difficult/unavailable': 0 }) }),
  q({ id: 'Q4.4', phase: 4, dimension: DAT, type: 'rating', label: 'How accurate is your core business data (customers, items, prices, stock, payments)?', scale: { low: 'Often wrong', high: 'Highly accurate' }, scored: true, weight: 1.5, scoring: { kind: 'rating' } }),
  q({ id: 'Q4.5', phase: 4, dimension: DAT, type: 'single_select', label: 'How current is your business data when you need it?', options: o(['Real-time/same day', 'Usually within a few days', 'Weekly', 'Irregularly', 'Often outdated']), scored: true,
    scoring: map({ 'Real-time/same day': 100, 'Usually within a few days': 70, Weekly: 45, Irregularly: 20, 'Often outdated': 0 }) }),
  q({ id: 'Q4.6', phase: 4, dimension: DAT, type: 'single_select', label: 'How often is the same data typed into more than one system or sheet?', options: o(['Never', 'Rarely', 'Sometimes', 'Frequently', 'Very frequently']), scored: true,
    scoring: map({ Never: 100, Rarely: 75, Sometimes: 50, Frequently: 20, 'Very frequently': 0 }) }),
  q({ id: 'Q4.7', phase: 4, dimension: DAT, type: 'rating', label: 'How well are your systems connected to each other?', scale: { low: 'Not connected', high: 'Fully connected' }, scored: true, scoring: { kind: 'rating' } }),
  q({ id: 'Q4.8', phase: 4, dimension: DAT, type: 'single_select', label: 'What percentage of important business activity happens outside structured systems?', options: o(['<10%', '10–25%', '25–50%', '50–75%', '>75%']), scored: true, weight: 1.5,
    scoring: map({ '<10%': 100, '10–25%': 75, '25–50%': 50, '50–75%': 25, '>75%': 0 }) }),
  q({ id: 'Q4.9', phase: 4, dimension: DAT, type: 'single_select', label: 'How is AI used in your business today?', description: 'For context only — current usage does not raise or lower your readiness score.', options: o(['Not used', 'Individual experimentation', 'Used by a few employees', 'Used across selected functions', 'Embedded into important workflows']) }),
  q({ id: 'Q4.10', phase: 4, dimension: DAT, type: 'multi_select', label: 'Which AI tools, if any, are in use?', description: 'For context only — not scored.', options: o(['ChatGPT', 'Claude', 'Gemini', 'Microsoft Copilot', 'Perplexity', 'AI features within existing software', 'Custom AI tools', 'Other', 'None']), exclusiveOptions: ['None'] }),

  // ── Phase 5 — People, Controls & Governance (+ Performance) ────────
  q({ id: 'Q5.1', phase: 5, dimension: PEO, type: 'rating', label: 'How comfortable is your team with adopting new software and technology?', scale: { low: 'Uncomfortable', high: 'Very comfortable' }, scored: true, scoring: { kind: 'rating' } }),
  q({ id: 'Q5.2', phase: 5, dimension: PEO, type: 'single_select', label: 'How often does your team learn new technology or tools?', options: o(['Regularly', 'Occasionally', 'Only when required', 'Rarely', 'Never']), scored: true,
    scoring: map({ Regularly: 100, Occasionally: 70, 'Only when required': 40, Rarely: 15, Never: 0 }) }),
  q({ id: 'Q5.3', phase: 5, dimension: PEO, type: 'single_select', label: 'Who is responsible for how AI is used in your business?', options: o(['Founder', 'IT team', 'Operations', 'HR', 'Individual employees', 'External resource', 'No one specifically']), scored: true,
    scoring: map({ 'IT team': 90, Operations: 80, HR: 70, Founder: 60, 'External resource': 50, 'Individual employees': 25, 'No one specifically': 0 }) }),
  q({ id: 'Q5.4', phase: 5, dimension: PEO, type: 'single_select', label: 'Do you have a written policy on what company data may be shared with external tools, including AI tools?', options: o(['Yes', 'Partially', 'No', "Don't know"]), scored: true,
    scoring: map({ Yes: 100, Partially: 50, No: 10, "Don't know": 0 }) }),
  q({ id: 'Q5.5', phase: 5, dimension: PEO, type: 'multi_select', label: 'What access controls protect customer, employee and financial data?', description: 'Select all that apply.', options: o(['Role-based access', 'System permissions', 'Approval-based access', 'Password-access controls', 'No formal controls', "Don't know"]), exclusiveOptions: ['No formal controls', "Don't know"], scored: true,
    scoring: { kind: 'multi', max: 4, points: { 'Role-based access': 2, 'System permissions': 1.5, 'Approval-based access': 1.5, 'Password-access controls': 1, 'No formal controls': 0, "Don't know": 0 } } }),
  q({ id: 'Q5.6', phase: 5, dimension: PEO, type: 'single_select', label: 'How would AI-generated output be reviewed before it is used?', options: o(['Defined review process', 'Human reviews important outputs', 'Individual employee decides', 'Founder reviews', 'No defined process']), scored: true,
    scoring: map({ 'Defined review process': 100, 'Human reviews important outputs': 75, 'Founder reviews': 50, 'Individual employee decides': 30, 'No defined process': 0 }) }),
  q({ id: 'Q5.7', phase: 5, dimension: PEO, type: 'rating', label: 'How comfortable would you be allowing AI to perform a business task without manual review at every step?', description: 'Context for the interpretation — not scored.', scale: { low: 'Not comfortable', high: 'Very comfortable' } }),
  q({ id: 'Q5.8', phase: 5, dimension: PEO, type: 'multi_select', label: 'Which activities would you restrict AI from performing?', description: 'Select all that apply. Context for the interpretation — not scored.', options: o(['Customer communication', 'Pricing', 'Financial decisions', 'HR decisions', 'Procurement', 'Marketing', 'Reporting', 'Internal operations', 'None', 'Other']), exclusiveOptions: ['None'] }),
  q({ id: 'Q5.9', phase: 5, dimension: PER, type: 'single_select', label: 'How often do you review business performance?', options: o(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Only when a problem occurs']), scored: true,
    scoring: map({ Daily: 100, Weekly: 90, Monthly: 60, Quarterly: 30, 'Only when a problem occurs': 0 }) }),
  q({ id: 'Q5.10', phase: 5, dimension: PER, type: 'rating', label: 'How clearly does each important business metric have an assigned owner?', scale: { low: 'Not clear', high: 'Very clear' }, scored: true, scoring: { kind: 'rating' } }),
  q({ id: 'Q5.11', phase: 5, dimension: PER, type: 'single_select', label: 'How is management reporting produced?', options: o(['Automatically', 'Mostly automatically', 'Partially automated', 'Manually', 'Ad hoc/difficult to produce']), scored: true,
    scoring: map({ Automatically: 100, 'Mostly automatically': 80, 'Partially automated': 50, Manually: 25, 'Ad hoc/difficult to produce': 0 }) }),
  q({ id: 'Q5.12', phase: 5, dimension: PER, type: 'rating', label: 'How confident are you that you have the information needed to make important business decisions?', scale: { low: 'Not confident', high: 'Very confident' }, scored: true, scoring: { kind: 'rating' } }),

  // ── Phase 6 — AI Opportunity & Business Intent ─────────────────────
  q({ id: 'Q6.1', phase: 6, type: 'long_text', label: 'What is the biggest operational bottleneck currently affecting your business?', voice: true, opportunityRelevant: true, validation: { minLength: 10, maxLength: 1200 }, helpText: 'A few sentences are enough. You can type or dictate.' }),
  q({ id: 'Q6.2', phase: 6, type: 'long_text', label: 'What takes up more of your time as a founder/business leader than it should?', voice: true, opportunityRelevant: true, required: false, validation: { minLength: 10, maxLength: 1200 } }),
  q({ id: 'Q6.3', phase: 6, type: 'multi_select', label: 'Which repetitive work consumes the most effort?', description: 'Select all that apply.', options: o(['Data entry', 'Reporting', 'Sales follow-up', 'Customer communication', 'Documentation', 'Scheduling', 'Finance-admin', 'HR-admin', 'Procurement', 'Operations', 'Marketing', 'Customer support', 'Other', 'None']), exclusiveOptions: ['None'], opportunityRelevant: true }),
  q({ id: 'Q6.4', phase: 6, type: 'ranking', label: 'Which business outcomes matter most to you?', description: 'Choose your top three and put them in order of priority.', rankCount: 3,
    options: o(['Save management time', 'Reduce founder dependency', 'Increase revenue', 'Improve employee productivity', 'Reduce operating costs', 'Improve customer experience', 'Reduce errors', 'Improve decision-making', 'Scale operations']), opportunityRelevant: true }),
  q({ id: 'Q6.5', phase: 6, type: 'long_text', label: 'If one business process could work significantly better without adding people, which would you choose?', voice: true, opportunityRelevant: true, required: false, validation: { minLength: 10, maxLength: 1200 } }),
  q({ id: 'Q6.6', phase: 6, type: 'multi_select', label: 'What do you expect AI to do for your business?', description: 'Select all that apply.', options: o(['Save time', 'Automate repetitive work', 'Improve sales', 'Improve customer service', 'Analyse business information', 'Improve decision-making', 'Reduce operational dependency', 'Build new capabilities', 'Not sure yet']), exclusiveOptions: ['Not sure yet'], opportunityRelevant: true }),
  q({ id: 'Q6.7', phase: 6, type: 'rating', label: 'How strongly do you intend to adopt AI within the next 12 months?', description: 'This reflects intent. It does not affect your readiness score.', scale: { low: 'No intention', high: 'Strong intention' } }),
];

const withLists = (qs: Question[]): Question[] =>
  qs.map((x) => (x.optionsFrom ? { ...x, options: o(LISTS[x.optionsFrom]) } : x));

export const CONFIG_V1: AssessmentConfig = {
  version: ASSESSMENT_VERSION,
  scoringVersion: SCORING_VERSION,
  phases: [
    { number: 1, title: 'Business Context', dimension: null, intro: 'A few facts about you and the business, so the diagnostic is read in the right context.' },
    { number: 2, title: 'Ownership & Decision Making', dimension: OWN, intro: 'Who owns what, and how much depends on you.' },
    { number: 3, title: 'Processes & Workflows', dimension: PRO, intro: 'How recurring work is defined, followed and improved.' },
    { number: 4, title: 'Data, Systems & Technology', dimension: DAT, intro: 'Where business information lives and how dependable it is.' },
    { number: 5, title: 'People, Controls & Governance', dimension: PEO, intro: 'Team readiness, rules, access and visibility of performance.' },
    { number: 6, title: 'AI Opportunity & Business Intent', dimension: null, intro: 'Where the business feels friction, and what you hope to gain. This shapes the opportunity profile, not the readiness score.' },
  ],
  dimensions: DIMENSIONS,
  bands: [
    { id: 'foundation', label: 'Foundation', min: 0, max: 30, summary: 'Core business foundations are not yet in place for AI to work reliably.' },
    { id: 'emerging', label: 'Emerging', min: 31, max: 50, summary: 'Some foundations exist, with significant gaps that would limit AI results.' },
    { id: 'developing', label: 'Developing', min: 51, max: 70, summary: 'Foundations are partly established; targeted gaps remain.' },
    { id: 'ready', label: 'Ready', min: 71, max: 85, summary: 'Foundations are largely in place to adopt AI in the business.' },
    { id: 'advanced', label: 'Advanced', min: 86, max: 100, summary: 'Foundations are strong and consistently applied.' },
  ],
  questions: withLists(QUESTIONS),
};
