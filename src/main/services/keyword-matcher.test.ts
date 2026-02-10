import { describe, it, expect } from 'vitest';
import { suggestCategory } from './keyword-matcher';

describe('suggestCategory', () => {
  it('returns null for empty text and filename', () => {
    expect(suggestCategory(null, '')).toBeNull();
    expect(suggestCategory('', '')).toBeNull();
  });

  it('suggests Taxes for tax-related text', () => {
    const result = suggestCategory(
      'Form 1040 U.S. Individual Income Tax Return Filing Status Taxable Income',
      'tax-return-2024.pdf'
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Taxes');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it('suggests Banking for bank statement text', () => {
    const result = suggestCategory(
      'Chase Bank Statement Account Balance Routing Number Checking Account Summary',
      'statement.pdf'
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Banking');
  });

  it('suggests Medical for medical text', () => {
    const result = suggestCategory(
      'Explanation of Benefits Patient Name Date of Service Copay Lab Results',
      'eob.pdf'
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Medical');
  });

  it('suggests Insurance for insurance text', () => {
    const result = suggestCategory(
      'Insurance Policy Number Premium Deductible Coverage Beneficiary',
      'policy.pdf'
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Insurance');
  });

  it('suggests Receipts for receipt text', () => {
    const result = suggestCategory(
      'Invoice #12345 Order Confirmation Subtotal: $50.00 Total: $55.00',
      'receipt.pdf'
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Receipts');
  });

  it('suggests Home for mortgage text', () => {
    const result = suggestCategory(
      'Mortgage Statement Property Tax Escrow Account Landlord Lease Agreement',
      'mortgage.pdf'
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Home');
  });

  it('suggests Identity for ID-related text', () => {
    const result = suggestCategory(
      "Driver's License Social Security Birth Certificate Passport Number",
      'id-scan.pdf'
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Identity');
  });

  it('suggests Legal for legal text', () => {
    const result = suggestCategory(
      'Contract Agreement Attorney Plaintiff Defendant Notarized Jurisdiction',
      'contract.pdf'
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Legal');
  });

  it('suggests Work for employment text', () => {
    const result = suggestCategory(
      'Pay Stub Employer Salary Gross Pay Net Pay Withholding Benefits Enrollment',
      'paystub.pdf'
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Work');
  });

  it('suggests Utilities for utility bill text', () => {
    const result = suggestCategory(
      'Electric Bill Billing Period Meter Reading kWh Usage Summary',
      'electric-bill.pdf'
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Utilities');
  });

  it('can match from filename alone when no extracted text', () => {
    const result = suggestCategory(null, 'tax-return-2024-form-1040.pdf');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Taxes');
  });

  it('returns null for unrecognizable text', () => {
    const result = suggestCategory(
      'Lorem ipsum dolor sit amet',
      'random-file.pdf'
    );
    expect(result).toBeNull();
  });

  it('confidence is between 0 and 1', () => {
    const result = suggestCategory(
      'IRS Form 1040 Tax Return Adjusted Gross Income Taxable Income Filing Status',
      'tax-return.pdf'
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
  });

  it('higher keyword density produces higher confidence', () => {
    const low = suggestCategory(null, 'tax.pdf');
    const high = suggestCategory(
      'IRS Form 1040 Tax Return Adjusted Gross Income Taxable Income W-2 1099 Refund',
      'tax-return-2024.pdf'
    );

    // Both should suggest Taxes
    if (low && high) {
      expect(high.confidence).toBeGreaterThan(low.confidence);
    }
  });
});
