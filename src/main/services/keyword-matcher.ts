import type { Category } from '../../shared/types';

interface CategoryRule {
  category: Category;
  keywords: string[];
  patterns: RegExp[];
  weight: number;
}

export interface CategorySuggestion {
  category: Category;
  confidence: number;
}

const RULES: CategoryRule[] = [
  {
    category: 'Taxes',
    keywords: [
      'w-2', 'w2', '1099', '1040', 'tax return', 'irs', 'refund',
      'adjusted gross', 'filing status', 'taxable income', 'federal tax',
      'state tax', 'tax year', 'form 1040', 'schedule c', 'schedule a',
    ],
    patterns: [
      /\bform\s*(?:1040|1099|w-?2|w-?4|941|940)\b/i,
      /\btax\s*(?:return|refund|year|filing)\b/i,
    ],
    weight: 1.0,
  },
  {
    category: 'Banking',
    keywords: [
      'bank statement', 'account balance', 'routing number', 'checking',
      'savings', 'wire transfer', 'ach', 'fdic', 'overdraft', 'direct deposit',
      'account number', 'bank of america', 'chase', 'wells fargo', 'citibank',
    ],
    patterns: [
      /\baccount\s*(?:number|balance|summary)\b/i,
      /\brouting\s*(?:number|#)\b/i,
      /\bstatement\s*period\b/i,
    ],
    weight: 1.0,
  },
  {
    category: 'Insurance',
    keywords: [
      'premium', 'policy number', 'deductible', 'claim', 'coverage',
      'insured', 'beneficiary', 'underwriting', 'policyholder',
      'effective date', 'expiration date', 'insurance company',
    ],
    patterns: [
      /\bpolicy\s*(?:number|#|no)\b/i,
      /\bclaim\s*(?:number|#|no)\b/i,
    ],
    weight: 1.0,
  },
  {
    category: 'Medical',
    keywords: [
      'diagnosis', 'prescription', 'patient', 'medical record',
      'explanation of benefits', 'eob', 'copay', 'referral', 'lab results',
      'physician', 'healthcare', 'hospital', 'clinic', 'pharmacy',
      'blood test', 'vaccination', 'immunization record',
    ],
    patterns: [
      /\bpatient\s*(?:name|id|number)\b/i,
      /\bdate\s*of\s*service\b/i,
      /\bexplanation\s*of\s*benefits\b/i,
    ],
    weight: 1.0,
  },
  {
    category: 'Receipts',
    keywords: [
      'invoice', 'receipt', 'order confirmation', 'subtotal', 'payment received',
      'qty', 'item #', 'amount due', 'amount paid', 'transaction',
      'purchase', 'order number', 'shipping', 'billing address',
    ],
    patterns: [
      /\btotal\s*[:$]/i,
      /\border\s*(?:number|#|no|confirmation)\b/i,
      /\binvoice\s*(?:number|#|no|date)\b/i,
    ],
    weight: 1.0,
  },
  {
    category: 'Home',
    keywords: [
      'lease', 'mortgage', 'property tax', 'hoa', 'deed', 'appraisal',
      'escrow', 'landlord', 'tenant', 'rent', 'homeowner', 'real estate',
      'property address', 'closing', 'title insurance',
    ],
    patterns: [
      /\bproperty\s*(?:tax|address|value)\b/i,
      /\blease\s*(?:agreement|term|renewal)\b/i,
      /\bmortgage\s*(?:statement|payment|rate)\b/i,
    ],
    weight: 1.0,
  },
  {
    category: 'Identity',
    keywords: [
      'passport', 'driver license', "driver's license", 'social security',
      'birth certificate', 'ssn', 'naturalization', 'green card',
      'state id', 'identification', 'date of birth',
    ],
    patterns: [
      /\bssn\b/i,
      /\b\d{3}-\d{2}-\d{4}\b/,
      /\bpassport\s*(?:number|#|no)\b/i,
      /\bdriver['']?s?\s*licen[sc]e\b/i,
    ],
    weight: 1.0,
  },
  {
    category: 'Legal',
    keywords: [
      'contract', 'agreement', 'attorney', 'court', 'plaintiff', 'defendant',
      'notarized', 'exhibit', 'jurisdiction', 'legal', 'counsel',
      'arbitration', 'settlement', 'affidavit', 'testimony',
    ],
    patterns: [
      /\bcase\s*(?:number|#|no)\b/i,
      /\bcourt\s*(?:of|order|date)\b/i,
    ],
    weight: 1.0,
  },
  {
    category: 'Utilities',
    keywords: [
      'electric', 'water bill', 'gas bill', 'internet', 'billing period',
      'meter reading', 'kwh', 'usage summary', 'utility', 'cable',
      'phone bill', 'broadband', 'service address',
    ],
    patterns: [
      /\bbilling\s*period\b/i,
      /\bmeter\s*reading\b/i,
      /\busage\s*summary\b/i,
    ],
    weight: 1.0,
  },
  {
    category: 'Work',
    keywords: [
      'pay stub', 'paystub', 'offer letter', 'employment', 'salary',
      'employer', 'benefits enrollment', 'performance review', 'w-4',
      'hire date', 'employee', 'compensation', 'bonus', 'gross pay',
      'net pay', 'withholding',
    ],
    patterns: [
      /\bpay\s*(?:stub|period|date|rate)\b/i,
      /\bgross\s*pay\b/i,
      /\bnet\s*pay\b/i,
    ],
    weight: 1.0,
  },
  {
    category: 'Kids',
    keywords: [
      'report card', 'enrollment', 'tuition', 'school', 'immunization',
      'pediatric', 'guardian', 'student', 'grade', 'teacher',
      'parent', 'field trip', 'school district',
    ],
    patterns: [
      /\breport\s*card\b/i,
      /\bschool\s*(?:year|district|name)\b/i,
    ],
    weight: 1.0,
  },
  {
    category: 'Mail',
    keywords: [
      'usps', 'tracking number', 'postage', 'certified mail',
      'return receipt', 'fedex', 'ups', 'dhl', 'shipment',
      'delivery confirmation', 'postal',
    ],
    patterns: [
      /\btracking\s*(?:number|#|no)\b/i,
      /\b1Z[A-Z0-9]{16}\b/, // UPS tracking
    ],
    weight: 1.0,
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function suggestCategory(
  extractedText: string | null,
  filename: string
): CategorySuggestion | null {
  const text = normalize([extractedText ?? '', filename].join(' '));
  if (!text) return null;

  let bestCategory: Category | null = null;
  let bestScore = 0;

  for (const rule of RULES) {
    let score = 0;

    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        // Multi-word phrases score higher
        score += keyword.includes(' ') ? 3 : 1;
      }
    }

    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        score += 4;
      }
    }

    score *= rule.weight;

    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
    }
  }

  if (!bestCategory || bestScore === 0) return null;

  // Normalize score to 0.0-1.0 range
  // A score of 1 (single keyword) -> ~0.3, 15+ -> ~0.95
  const confidence = Math.min(0.95, 1 - 1 / (1 + bestScore * 0.15));

  if (confidence < 0.3) return null;

  return {
    category: bestCategory,
    confidence: Math.round(confidence * 100) / 100,
  };
}
